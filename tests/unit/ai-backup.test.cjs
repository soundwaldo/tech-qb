/* eslint-disable @typescript-eslint/no-require-imports -- Isolated CommonJS test harness. */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const ts = require('typescript');

function loadSource(filename, overrides) {
  const mod = { exports: {} };
  const code = ts.transpileModule(readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  new Function('require', 'module', 'exports', code)(name => {
    if (name === 'server-only') return {};
    if (name in overrides) return overrides[name];
    return require(name);
  }, mod, mod.exports);
  return mod.exports;
}

const azure = loadSource('src/lib/azure-ai.ts', {
  '@ai-sdk/azure': { createAzure: settings => ({ responses: modelId => ({ modelId, ...settings }) }) },
});
const { withAiBackup, shouldUseAzureBackup } = loadSource('src/lib/ai-provider.ts', {
  ai: { gateway: modelId => ({ modelId, provider: 'gateway' }) },
  './azure-ai': azure,
});

test('backup eligibility excludes policy, authentication, validation and cancellation errors', () => {
  for (const statusCode of [400, 401, 403, 404, 422]) assert.equal(shouldUseAzureBackup({ statusCode }), false);
  for (const statusCode of [429, 500, 502, 503, 504]) assert.equal(shouldUseAzureBackup({ statusCode }), true);
  assert.equal(shouldUseAzureBackup({ name: 'AbortError' }), false);
  assert.equal(shouldUseAzureBackup({ name: 'TimeoutError' }), true);
  assert.equal(shouldUseAzureBackup({ lastError: { statusCode: 503 } }), true);
  assert.equal(shouldUseAzureBackup({ cause: { code: 'ECONNRESET' } }), true);
});

test('primary success, explicit opt-in, failover attribution and bounded backup failure', async () => {
  const names = ['AZURE_AI_BACKUP_ENABLED', 'AZURE_RESOURCE_NAME', 'AZURE_OPENAI_DEPLOYMENT', 'AZURE_PRE_DISPATCH_DEPLOYMENT'];
  const original = Object.fromEntries(names.map(name => [name, process.env[name]]));
  try {
    process.env.AZURE_AI_BACKUP_ENABLED = 'true';
    process.env.AZURE_RESOURCE_NAME = 'test-resource';
    process.env.AZURE_OPENAI_DEPLOYMENT = 'test-deployment';
    delete process.env.AZURE_PRE_DISPATCH_DEPLOYMENT;
    let calls = 0;
    const primary = await withAiBackup('pre-dispatch', async () => { calls++; return 'primary'; });
    assert.equal(primary.provider, 'vercel-ai-gateway');
    assert.equal(calls, 1);
    const backup = await withAiBackup('pre-dispatch', async config => {
      if (config.model.provider === 'gateway') throw { statusCode: 503 };
      assert.equal(config.model.resourceName, 'test-resource');
      assert.equal(config.providerOptions.openai.store, false);
      return 'backup';
    });
    assert.deepEqual(backup, { result: 'backup', provider: 'azure-openai', modelVersion: 'test-deployment' });
    calls = 0;
    await assert.rejects(withAiBackup('pre-dispatch', async () => { calls++; throw Object.assign(new Error('unavailable'), { statusCode: 503 }); }));
    assert.equal(calls, 2);
    process.env.AZURE_AI_BACKUP_ENABLED = 'false';
    calls = 0;
    await assert.rejects(withAiBackup('pre-dispatch', async () => { calls++; throw Object.assign(new Error('unavailable'), { statusCode: 503 }); }));
    assert.equal(calls, 1);
    process.env.AZURE_OPENAI_DEPLOYMENT = 'openai/not-an-azure-deployment';
    assert.throws(() => azure.getAzureDeployment('pre-dispatch'), /deployment name/);
  } finally {
    for (const name of names) { if (original[name] === undefined) delete process.env[name]; else process.env[name] = original[name]; }
  }
});

test('email contact requires email on the server', () => {
  const { intakeSchema } = loadSource('src/features/pre-dispatch/schemas.ts', {
    './config': { acceptedMediaTypes: ['image/jpeg'], uploadLimits: { maxPhotos: 5, maxVideos: 1 } },
  });
  const input = {
    sessionToken: 'test-session-placeholder-123', idempotencyKey: 'a112d002-080d-4e86-8c88-20563015b245',
    firstName: 'Test', lastName: 'Customer', mobilePhone: '6025550100', email: '',
    serviceAddress1: '123 Main St', city: 'Phoenix', state: 'AZ', postalCode: '85001',
    preferredContactMethod: 'email', problemDescription: 'Door is not opening.',
    consentAccepted: true, aiProcessingConsent: true,
    mediaAssetIds: ['a112d002-080d-4e86-8c88-20563015b245'],
  };
  assert.equal(intakeSchema.safeParse(input).success, false);
  assert.equal(intakeSchema.safeParse({ ...input, email: 'customer@example.test' }).success, true);
  assert.equal(intakeSchema.safeParse({ ...input, preferredContactMethod: 'phone' }).success, true);
});
