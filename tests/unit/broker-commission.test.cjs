/* eslint-disable @typescript-eslint/no-require-imports -- Node CommonJS harness loads isolated TypeScript modules with test dependencies. */
const { after, test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
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

const { clawbackAmount, invoiceServiceMonths, netCommissionable, planCommissionInstallments, refundCommissionTarget } = loadSource('src/lib/broker-commission.ts');

const PERIOD_START = Date.UTC(2026, 0, 1) / 1000;

/** An invoice covering `months` whole calendar months, with tax and shipping. */
function invoice({ months = 1, amountPaid, tax = 0, shipping = 0, lineAmount, lines = true } = {}) {
  const periodEnd = Date.UTC(2026, months, 1) / 1000;
  return {
    amount_paid: amountPaid,
    amount_shipping: shipping,
    lines: lines ? { data: [{ amount: lineAmount ?? amountPaid - tax - shipping, tax_amounts: [{ amount: tax }], period: { start: PERIOD_START, end: periodEnd } }] } : null,
  };
}

test('an invoice is credited for the service months it pays for, not as one installment', () => {
  assert.equal(invoiceServiceMonths(invoice({ months: 1, amountPaid: 25000 })), 1);
  assert.equal(invoiceServiceMonths(invoice({ months: 12, amountPaid: 250000 })), 12);
  assert.equal(invoiceServiceMonths(invoice({ months: 3, amountPaid: 67500 })), 3);
  assert.equal(invoiceServiceMonths(invoice({ months: 1, amountPaid: 25000, lines: false })), null);
});

test('commission is verified net of tax and shipping, and unverifiable invoices accrue nothing', () => {
  // $1,000 of service, $85 tax and $15 shipping collected on a $1,100 charge.
  assert.deepEqual(netCommissionable(invoice({ months: 1, amountPaid: 110000, tax: 8500, shipping: 1500, lineAmount: 100000 })),
    { grossCents: 110000, excludedCents: 10000, netCents: 100000 });
  assert.equal(netCommissionable(invoice({ months: 1, amountPaid: 110000, tax: 8500, shipping: 1500, lineAmount: 100000, lines: false })), null);
  assert.equal(netCommissionable(invoice({ months: 1, amountPaid: 0 })), null);
  // Tax can never exceed the cash collected, so the commissionable basis cannot go negative.
  assert.equal(netCommissionable(invoice({ months: 1, amountPaid: 100000, tax: 120000, lineAmount: 100000 })).netCents, 0);
});

test('annual plans earn the window remaining at the sale rate and the rest at the support rate', () => {
  // Twelve service months paid up front with a full 12-month window: all twelve are sale months.
  assert.deepEqual(planCommissionInstallments({ monthsPaid: 12, monthsCredited: 0, commissionMonths: 12, commissionBps: 3000, supportBps: 1000, supportEnabled: true, netCents: 100000 }),
    [{ kind: 'sale', commissionBps: 3000, commissionCents: 30000, monthsCredited: 12, sequenceNumber: 1 }]);
  // Three months left in the window: only a quarter of the annual invoice is a sale commission.
  assert.deepEqual(planCommissionInstallments({ monthsPaid: 12, monthsCredited: 9, commissionMonths: 12, commissionBps: 3000, supportBps: 1000, supportEnabled: true, netCents: 100000 }),
    [
      { kind: 'sale', commissionBps: 3000, commissionCents: 7500, monthsCredited: 3, sequenceNumber: 10 },
      { kind: 'support', commissionBps: 1000, commissionCents: 7500, monthsCredited: 9, sequenceNumber: 13 },
    ]);
  // Window already exhausted and support disabled: the annual invoice earns nothing.
  assert.deepEqual(planCommissionInstallments({ monthsPaid: 12, monthsCredited: 12, commissionMonths: 12, commissionBps: 3000, supportBps: 1000, supportEnabled: false, netCents: 100000 }), []);
  // Monthly billing after the window still earns support commission when it is enabled: 10% of the $100 net basis.
  assert.deepEqual(planCommissionInstallments({ monthsPaid: 1, monthsCredited: 12, commissionMonths: 12, commissionBps: 3000, supportBps: 1000, supportEnabled: true, netCents: 10000 }),
    [{ kind: 'support', commissionBps: 1000, commissionCents: 1000, monthsCredited: 1, sequenceNumber: 13 }]);
});

test('refunds reduce commission pro-rata, are capped at what accrued, and never over-recover', () => {
  const basis = { netCents: 100000, commissionBps: 3000 };
  assert.deepEqual(refundCommissionTarget({ ...basis, refundCents: 0 }), { targetCents: 30000, refundCents: 0, fullyRefunded: false });
  assert.deepEqual(refundCommissionTarget({ ...basis, refundCents: 25000 }), { targetCents: 22500, refundCents: 25000, fullyRefunded: false });
  assert.deepEqual(refundCommissionTarget({ ...basis, refundCents: 100000 }), { targetCents: 0, refundCents: 100000, fullyRefunded: true });
  // A refund that also returns tax cannot claw back more commission than was earned.
  assert.deepEqual(refundCommissionTarget({ ...basis, refundCents: 110000 }), { targetCents: 0, refundCents: 100000, fullyRefunded: true });
  // Growing refunds on an already-paid row only recover the residual.
  assert.equal(clawbackAmount({ commissionCents: 30000, targetCents: 22500, alreadyClawedCents: 0 }), 7500);
  assert.equal(clawbackAmount({ commissionCents: 30000, targetCents: 22500, alreadyClawedCents: 7500 }), 0);
  assert.equal(clawbackAmount({ commissionCents: 30000, targetCents: 0, alreadyClawedCents: 7500 }), 22500);
  assert.equal(clawbackAmount({ commissionCents: 30000, targetCents: 0, alreadyClawedCents: 30000 }), 0);
});

// The checks above prove the arithmetic; the checks below run the production ledger SQL
// against a disposable PostgreSQL built from neon/schema.sql. Only the database
// connection is substituted, so unique indexes, state guards and rollups are real.
const database = new PGlite();
const booted = database.exec(readFileSync('neon/schema.sql', 'utf8').replace('CREATE EXTENSION IF NOT EXISTS pgcrypto;', ''));
const ledger = loadSource('src/lib/broker-ledger.ts');
const sql = async (strings, ...values) => {
  await booted;
  const text = strings.reduce((text, part, i) => text + (i ? `$${i}` : '') + part, '');
  return (await database.query(text, values)).rows;
};

after(async () => { await database.close(); });

/** A broker agreement and one won deal. Every scenario gets its own pair of rows. */
async function workspace({ commissionPercent = 30, supportPercent = 10, commissionMonths = 12, supportEnabled = true, active = true } = {}) {
  await booted;
  const profileId = randomUUID(), brokerId = randomUUID(), dealId = randomUUID();
  await database.query('INSERT INTO profiles(id,full_name,role) VALUES($1,$2,$3)', [profileId, 'Test Broker', 'sales_broker']);
  await database.query('INSERT INTO sales_brokers(id,auth_user_id,display_name,commission_bps,support_commission_bps,commission_months,support_commission_enabled,active) VALUES($1,$2,$3,$4,$5,$6,$7,$8)',
    [brokerId, profileId, 'Test Broker', commissionPercent * 100, supportPercent * 100, commissionMonths, supportEnabled, active]);
  await database.query("INSERT INTO broker_deals(id,broker_id,prospect_company,contact_name,contact_email,phone,invite_token_hash,commission_bps,stage,won_at) VALUES($1,$2,'Acme Doors','A Owner','owner@acme.test','6025550100',$3,7000,'won',now())", [dealId, brokerId, randomUUID()]);
  return { brokerId, dealId };
}

/** A paid subscription invoice: twelve service months at $250 plus $270 tax and $30 shipping. */
function paidInvoice({ invoiceId, chargeId, startMonth = 0, months = 12, amountPaid = 330000, tax = 27000, shipping = 3000, lineAmount = 300000, lines = true } = {}) {
  return {
    id: invoiceId, charge: chargeId, amount_paid: amountPaid, amount_shipping: shipping, status: 'paid',
    lines: lines ? { data: [{ amount: lineAmount, tax_amounts: [{ amount: tax }], period: { start: Date.UTC(2026, startMonth, 1) / 1000, end: Date.UTC(2026, startMonth + months, 1) / 1000 } }] } : null,
  };
}
const attributed = (dealId) => ({ metadata: { product: 'pre_dispatch', broker_deal_id: dealId } });
const refundedCharge = (chargeId, amountRefunded) => ({ id: chargeId, refunded: true, amount_refunded: amountRefunded });
const ledgerRows = async (dealId) => sql`SELECT kind,status,commission_cents,months_credited,sequence_number,gross_collected_cents,excluded_cents,refunded_cents,stripe_refund_id,eligible_at>now() AS immature FROM broker_commission_ledger WHERE deal_id=${dealId} ORDER BY kind,created_at`;
const dealRow = async (dealId) => (await sql`SELECT commission_cents,commission_status FROM broker_deals WHERE id=${dealId}`)[0];

test('an annual payment accrues held commission for every service month and survives webhook replay', async () => {
  const { dealId } = await workspace();
  const invoice = paidInvoice({ invoiceId: 'in_annual', chargeId: 'ch_annual' });
  await ledger.recordBrokerCommission(invoice, attributed(dealId), sql);
  const rows = await ledgerRows(dealId);
  assert.equal(rows.length, 1);
  assert.deepEqual(rows[0], { kind: 'sale', status: 'held', commission_cents: 90000, months_credited: 12, sequence_number: 1, gross_collected_cents: 330000, excluded_cents: 30000, refunded_cents: 0, stripe_refund_id: null, immature: true });
  assert.deepEqual(await dealRow(dealId), { commission_cents: 90000, commission_status: 'pending' });
  // Stripe redelivers events: the same invoice can accrue only once, with no restated rollup.
  await ledger.recordBrokerCommission(invoice, attributed(dealId), sql);
  assert.equal((await ledgerRows(dealId)).length, 1);
  assert.deepEqual(await dealRow(dealId), { commission_cents: 90000, commission_status: 'pending' });
  // The following year sits outside the twelve-month window and earns support commission only.
  await ledger.recordBrokerCommission(paidInvoice({ invoiceId: 'in_second', chargeId: 'ch_second', startMonth: 12 }), attributed(dealId), sql);
  const renewed = await ledgerRows(dealId);
  assert.deepEqual(renewed.map(({ kind, commission_cents, months_credited }) => [kind, commission_cents, months_credited]), [['sale', 90000, 12], ['support', 30000, 12]]);
  assert.deepEqual(await dealRow(dealId), { commission_cents: 120000, commission_status: 'pending' });
});


test('refunds restate unpaid commission in place and never reduce twice on redelivery', async () => {
  const { dealId } = await workspace();
  await ledger.recordBrokerCommission(paidInvoice({ invoiceId: 'in_partial', chargeId: 'ch_partial' }), attributed(dealId), sql);
  await ledger.clawBackBrokerCommission(refundedCharge('ch_partial', 30000), sql);
  const partial = (await ledgerRows(dealId))[0];
  assert.deepEqual({ status: partial.status, commission_cents: partial.commission_cents, refunded_cents: partial.refunded_cents },
    { status: 'held', commission_cents: 81000, refunded_cents: 30000 });
  assert.deepEqual(await dealRow(dealId), { commission_cents: 81000, commission_status: 'pending' });
  await ledger.clawBackBrokerCommission(refundedCharge('ch_partial', 30000), sql);
  assert.equal((await ledgerRows(dealId))[0].commission_cents, 81000);
  assert.deepEqual(await dealRow(dealId), { commission_cents: 81000, commission_status: 'pending' });
  // Returning the whole charge, tax and shipping included, returns the whole commission.
  await ledger.clawBackBrokerCommission(refundedCharge('ch_partial', 330000), sql);
  const closed = (await ledgerRows(dealId))[0];
  assert.deepEqual({ status: closed.status, commission_cents: closed.commission_cents, refunded_cents: closed.refunded_cents },
    { status: 'clawed_back', commission_cents: 0, refunded_cents: 300000 });
  assert.deepEqual(await dealRow(dealId), { commission_cents: 0, commission_status: 'pending' });
});

test('commission already paid out is recovered on clawback rows, once per refund', async () => {
  const { dealId } = await workspace();
  await ledger.recordBrokerCommission(paidInvoice({ invoiceId: 'in_paid', chargeId: 'ch_paid' }), attributed(dealId), sql);
  await booted;
  // Stand in for the admin payout that releases money outside this transaction.
  await database.query("UPDATE broker_commission_ledger SET status='paid', paid_at=now(), payout_reference='po_test' WHERE deal_id=$1", [dealId]);
  await ledger.clawBackBrokerCommission(refundedCharge('ch_paid', 30000), sql);
  let rows = await ledgerRows(dealId);
  assert.deepEqual(rows.map(({ kind, status, commission_cents }) => [kind, status, commission_cents]), [['clawback', 'paid', 9000], ['sale', 'paid', 90000]]);
  assert.equal(rows[0].stripe_refund_id, 'ch_paid:30000');
  assert.deepEqual(await dealRow(dealId), { commission_cents: 81000, commission_status: 'paid' });
  await ledger.clawBackBrokerCommission(refundedCharge('ch_paid', 30000), sql);
  assert.equal((await ledgerRows(dealId)).filter(({ kind }) => kind === 'clawback').length, 1);
  // A later, larger refund recovers only the difference, and the paid deal keeps its status.
  await ledger.clawBackBrokerCommission(refundedCharge('ch_paid', 60000), sql);
  rows = await ledgerRows(dealId);
  assert.deepEqual(rows.filter(({ kind }) => kind === 'clawback').map(({ stripe_refund_id, commission_cents }) => [stripe_refund_id, commission_cents]),
    [['ch_paid:30000', 9000], ['ch_paid:60000', 9000]]);
  assert.deepEqual(await dealRow(dealId), { commission_cents: 72000, commission_status: 'paid' });
});

test('invoices that cannot be verified or attributed accrue nothing, as do inactive brokers', async () => {
  const inactive = await workspace({ active: false });
  await ledger.recordBrokerCommission(paidInvoice({ invoiceId: 'in_inactive', chargeId: 'ch_inactive' }), attributed(inactive.dealId), sql);
  assert.equal((await ledgerRows(inactive.dealId)).length, 0);
  assert.deepEqual(await dealRow(inactive.dealId), { commission_cents: 0, commission_status: 'unearned' });
  const unattributed = await workspace();
  await ledger.recordBrokerCommission(paidInvoice({ invoiceId: 'in_unattributed', chargeId: 'ch_unattributed' }), { metadata: { product: 'pre_dispatch' } }, sql);
  await ledger.recordBrokerCommission(paidInvoice({ invoiceId: 'in_no_lines', chargeId: 'ch_no_lines', lines: false }), attributed(unattributed.dealId), sql);
  await ledger.recordBrokerCommission(paidInvoice({ invoiceId: 'in_zero', chargeId: 'ch_zero', amountPaid: 0, lineAmount: 0 }), attributed(unattributed.dealId), sql);
  assert.equal((await ledgerRows(unattributed.dealId)).length, 0);
  assert.deepEqual(await dealRow(unattributed.dealId), { commission_cents: 0, commission_status: 'unearned' });
});

