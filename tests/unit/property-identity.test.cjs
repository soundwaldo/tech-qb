/* eslint-disable @typescript-eslint/no-require-imports -- Node CommonJS harness loads isolated TypeScript modules with test dependencies. */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const { randomUUID, createHash } = require('node:crypto');
const ts = require('typescript');
const { PGlite } = require('@electric-sql/pglite');

// Execute the real repository against disposable PostgreSQL. Only auth,
// encryption and token delivery are substituted; production data is never used.
function loadSource(entry, overrides = {}, cache = new Map()) {
  const filename = path.resolve(entry);
  if (cache.has(filename)) return cache.get(filename).exports;
  const mod = { exports: {} };
  cache.set(filename, mod);
  const code = ts.transpileModule(readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText;
  const localRequire = (name) => {
    if (Object.hasOwn(overrides, name)) return overrides[name];
    if (name === 'server-only') return {};
    if (name.startsWith('@/') || name.startsWith('.')) {
      const resolved = name.startsWith('@/') ? path.resolve('src', name.slice(2)) : path.resolve(path.dirname(filename), name);
      return loadSource(`${resolved}.ts`, overrides, cache);
    }
    return require(name);
  };
  new Function('require', 'module', 'exports', code)(localRequire, mod, mod.exports);
  return mod.exports;
}

const { normalizePropertyAddress } = loadSource('src/lib/property-address.ts');
const { retryTransaction } = loadSource('src/lib/transaction-retry.ts');

test('address variants match; different houses, units and ZIP codes stay distinct', () => {
  const canonical = normalizePropertyAddress('123 North Main Street Apt 4', '85001');
  for (const address of ['123 N. MAIN ST. #4', ' 123 north main street suite 4 ', '123 N Main St unit 4']) {
    assert.equal(normalizePropertyAddress(address, '85001-1234'), canonical);
  }
  for (const [address, zip] of [['124 N Main St Apt 4', '85001'], ['123 N Main St Apt 5', '85001'], ['123 N Main St', '85001'], ['123 N Main St Apt 4', '85002']]) {
    assert.notEqual(normalizePropertyAddress(address, zip), canonical);
  }
});

test('transaction conflicts retry; validation errors and exhausted retries propagate', async () => {
  let attempts = 0;
  assert.equal(await retryTransaction(async () => {
    if (++attempts < 3) throw Object.assign(new Error('serialization failure'), { code: '40001' });
    return 'committed';
  }), 'committed');
  assert.equal(attempts, 3);
  attempts = 0;
  await assert.rejects(retryTransaction(async () => { attempts++; throw new Error('invalid'); }), /invalid/);
  assert.equal(attempts, 1);
  attempts = 0;
  await assert.rejects(retryTransaction(async () => {
    attempts++; throw Object.assign(new Error('deadlock'), { code: '40P01' });
  }), /deadlock/);
  assert.equal(attempts, 4);
});

test('real intake SQL reuses one property across contractors and safely replays submissions', async () => {
  const pg = new PGlite();
  try {
    // gen_random_uuid is built into PostgreSQL. The optional pgcrypto extension
    // is not used by this schema and is unavailable in the embedded engine.
    await pg.exec(readFileSync('neon/schema.sql', 'utf8').replace('CREATE EXTENSION IF NOT EXISTS pgcrypto;', ''));
    const query = (strings, values) => ({ text: strings.reduce((text, part, i) => text + (i ? `$${i}` : '') + part, ''), values });
    const sql = async (strings, ...values) => {
      const q = query(strings, values);
      return (await pg.query(q.text, q.values)).rows;
    };
    let simulateConflict = false;
    sql.transaction = async (callback) => {
      if (simulateConflict) { simulateConflict = false; throw Object.assign(new Error('conflict'), { code: '40001' }); }
      const queries = callback((strings, ...values) => query(strings, values));
      return pg.transaction(async (tx) => {
        const results = [];
        for (const q of queries) results.push((await tx.query(q.text, q.values)).rows);
        return results;
      });
    };
    const hash = (value) => createHash('sha256').update(value).digest('hex');
    const domain = loadSource('src/features/pre-dispatch/domain.ts');
    const repository = loadSource('src/features/pre-dispatch/repository.ts', {
      '@/lib/db': { getDb: () => sql },
      '@/lib/auth/server': { getCurrentUser: async () => null },
      '@/lib/pii-encryption': { encryptPII: (v) => v, decryptPII: (v) => v, derivePropertyLookupHash: hash, derivePIILookupHash: (ns, v) => hash(`${ns}:${v}`) },
      './security': { ...domain, createCustomerAccessToken: () => ({ token: randomUUID(), claims: { jti: randomUUID() }, expiresAt: new Date(Date.now() + 3600000) }) },
    });
    async function prepare(address, unit = '', zip = '85001') {
      const company = randomUUID(), session = randomUUID(), media = randomUUID(), key = randomUUID();
      await pg.query('INSERT INTO pre_dispatch_companies(id,name,slug,display_name,notification_email,phone) VALUES($1,$2,$2,$2,$3,$4)', [company, company, 'test@example.test', '6025550100']);
      await pg.query("INSERT INTO pre_dispatch_upload_sessions(id,company_id,idempotency_key,expires_at) VALUES($1,$2,$3,now()+interval '30 minutes')", [session, company, key]);
      await pg.query("INSERT INTO pre_dispatch_media_assets(id,company_id,upload_session_id,type,storage_key,original_filename,safe_filename,mime_type,size_bytes,processing_status,sha256) VALUES($1,$2,$3,'image',$4,'test.jpg','test.jpg','image/jpeg',10,'verified','test-hash')", [media, company, session, media]);
      return { company, session, input: { sessionToken: 'test-token-is-long-enough', idempotencyKey: key, firstName: 'Test', lastName: 'Customer', mobilePhone: '6025550100', serviceAddress1: address, serviceAddress2: unit, city: 'Phoenix', state: 'AZ', postalCode: zip, problemDescription: 'The garage door will not open.', consentAccepted: true, aiProcessingConsent: true, mediaAssetIds: [media] } };
    }
    const first = await prepare('123 North Main Street', 'Apt 4');
    const second = await prepare('123 N. MAIN ST. #4', '', '85001-1234');
    const otherUnit = await prepare('123 North Main Street', 'Apt 5');
    const a = await repository.finalizeRequest(first.input, first.company, first.session);
    simulateConflict = true;
    const b = await repository.finalizeRequest(second.input, second.company, second.session);
    await repository.finalizeRequest(otherUnit.input, otherUnit.company, otherUnit.session);
    const replay = await repository.finalizeRequest(first.input, first.company, first.session);
    assert.equal(replay.id, a.id);
    assert.equal(replay.duplicate, true);
    assert.notEqual(a.id, b.id);
    const requests = (await pg.query('SELECT company_id,property_id FROM pre_dispatch_requests')).rows;
    assert.equal(requests.find(r => r.company_id === first.company).property_id, requests.find(r => r.company_id === second.company).property_id);
    assert.notEqual(requests.find(r => r.company_id === first.company).property_id, requests.find(r => r.company_id === otherUnit.company).property_id);
    assert.equal((await pg.query('SELECT count(*)::int AS count FROM properties')).rows[0].count, 2);
    assert.equal((await pg.query('SELECT count(*)::int AS count FROM maintenance_records')).rows[0].count, 3);
    assert.equal((await pg.query('SELECT count(*)::int AS count FROM pre_dispatch_outbox_events')).rows[0].count, 3);
    assert.equal(await repository.getTenantRequest(second.company, a.id), null);
    await assert.rejects(repository.finalizeRequest(first.input, second.company, first.session), /session/i);
    await assert.rejects(repository.finalizeRequest({ ...first.input, idempotencyKey: randomUUID() }, first.company, first.session), /Idempotency/);
  } finally { await pg.close(); }
});
