import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

// Source-contract check for broker commission accounting. The arithmetic itself is unit
// tested against a real PostgreSQL in tests/unit/broker-commission.test.cjs; this gate
// keeps the wiring that makes it run: attribution written at checkout, accrual and refund
// recovery called from the webhook, and a hold window before money can be approved.

test.describe("Launch gate", () => {
  test("attributes attributed invoices, holds commission for the refund window, and recovers commission on refunds", () => {
    const billing = readFileSync(resolve("src/app/api/pre-dispatch/portal/billing/route.ts"), "utf8");
    const webhook = readFileSync(resolve("src/app/api/webhook/stripe/route.ts"), "utf8");
    const ledger = readFileSync(resolve("src/lib/broker-ledger.ts"), "utf8");
    expect(billing).toContain("broker_deal_id");
    expect(webhook).toContain("recordBrokerCommission(invoice,subscription,db)");
    expect(webhook).toContain("clawBackBrokerCommission(charge,db)");
    expect(ledger).toContain("netCommissionable");
    expect(ledger).toContain("invoiceServiceMonths");
    expect(ledger).toContain("planCommissionInstallments");
    expect(ledger).toContain("broker_commission_ledger");
    expect(ledger).toContain("now()+interval '30 days'");
    expect(ledger).toContain("ON CONFLICT(stripe_invoice_id,kind)");
    expect(ledger).toContain("refundCommissionTarget");
    expect(ledger).toContain("clawbackAmount");
  });
});
