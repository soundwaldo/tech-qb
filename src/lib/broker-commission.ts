import "server-only";

// Broker commissions are earned per paid service month, never per invoice.
// A single annual invoice covers twelve service months, so the remaining
// commission_months window is prorated against the period the invoice pays for.
// The commissionable basis is verified net of tax and shipping; an invoice whose
// line breakdown cannot be verified accrues nothing rather than accruing on gross.

export type InvoiceLineLike = {
    amount: number;
    tax_amounts?: Array<{ amount: number }> | null;
    period?: { start: number | null; end: number | null } | null;
};

export type InvoiceLike = {
    amount_paid: number;
    amount_shipping?: number | null;
    lines?: { data?: InvoiceLineLike[] } | null;
};

export type CommissionRow = {
    kind: "sale" | "support";
    commissionBps: number;
    commissionCents: number;
    monthsCredited: number;
    sequenceNumber: number;
};

const SECONDS_PER_DAY = 86400;
const AVERAGE_DAYS_PER_MONTH = 30.4375;
const MAX_CREDIT_MONTHS = 120;

const isWholeCents = (value: unknown): value is number =>
    typeof value === "number" && Number.isInteger(value) && value >= 0;

/** Whole service months the invoice pays for. Annual invoices count as twelve. */
export function invoiceServiceMonths(invoice: InvoiceLike): number | null {
    const lines = invoice.lines?.data ?? [];
    if (!lines.length) return null;
    let start = Number.POSITIVE_INFINITY;
    let end = Number.NEGATIVE_INFINITY;
    for (const line of lines) {
        const from = line.period?.start;
        const to = line.period?.end;
        if (typeof from !== "number" || typeof to !== "number" || !Number.isFinite(from) || !Number.isFinite(to) || to <= from) return null;
        start = Math.min(start, from);
        end = Math.max(end, to);
    }
    if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return null;
    const months = Math.round((end - start) / SECONDS_PER_DAY / AVERAGE_DAYS_PER_MONTH);
    return Math.min(MAX_CREDIT_MONTHS, Math.max(1, months));
}

/** Cash actually collected, less tax and shipping. Null means the basis is unverifiable. */
export function netCommissionable(invoice: InvoiceLike): { grossCents: number; excludedCents: number; netCents: number } | null {
    const gross = invoice.amount_paid;
    if (!isWholeCents(gross) || gross <= 0) return null;
    const lines = invoice.lines?.data;
    if (!lines?.length) return null;
    let tax = 0;
    for (const line of lines) {
        if (!isWholeCents(line.amount)) return null;
        for (const entry of line.tax_amounts ?? []) {
            if (!isWholeCents(entry.amount)) return null;
            tax += entry.amount;
        }
    }
    const shipping = invoice.amount_shipping ?? 0;
    if (!isWholeCents(shipping)) return null;
    const excludedCents = Math.min(gross, tax + shipping);
    return { grossCents: gross, excludedCents, netCents: gross - excludedCents };
}

/**
 * Plan the ledger rows one paid invoice earns. Months that fall outside the
 * broker's commission window earn the support rate only when it is enabled.
 */
export function planCommissionInstallments(input: {
    monthsPaid: number;
    monthsCredited: number;
    commissionMonths: number;
    commissionBps: number;
    supportBps: number;
    supportEnabled: boolean;
    netCents: number;
}): CommissionRow[] {
    const monthsPaid = Math.max(1, Math.floor(input.monthsPaid));
    const monthsCredited = Math.max(0, Math.floor(input.monthsCredited));
    const windowRemaining = Math.max(0, Math.floor(input.commissionMonths) - monthsCredited);
    const saleMonths = Math.min(monthsPaid, windowRemaining);
    const supportMonths = monthsPaid - saleMonths;
    const rows: CommissionRow[] = [];
    if (saleMonths > 0 && input.commissionBps > 0) {
        const baseCents = Math.round((input.netCents * saleMonths) / monthsPaid);
        rows.push({
            kind: "sale",
            commissionBps: input.commissionBps,
            commissionCents: Math.round((baseCents * input.commissionBps) / 10000),
            monthsCredited: saleMonths,
            sequenceNumber: monthsCredited + 1,
        });
    }
    if (supportMonths > 0 && input.supportEnabled && input.supportBps > 0) {
        const baseCents = Math.round((input.netCents * supportMonths) / monthsPaid);
        rows.push({
            kind: "support",
            commissionBps: input.supportBps,
            commissionCents: Math.round((baseCents * input.supportBps) / 10000),
            monthsCredited: supportMonths,
            sequenceNumber: monthsCredited + saleMonths + 1,
        });
    }
    return rows;
}

/**
 * The commission that should remain after a refund. Refunds beyond the
 * commissionable basis are capped so recovery can never exceed what accrued.
 */
export function refundCommissionTarget(input: { netCents: number; commissionBps: number; refundCents: number }): { targetCents: number; refundCents: number; fullyRefunded: boolean } {
    const refunded = Math.max(0, Math.min(input.netCents, Math.floor(input.refundCents)));
    return {
        targetCents: Math.round(((input.netCents - refunded) * input.commissionBps) / 10000),
        refundCents: refunded,
        fullyRefunded: refunded >= input.netCents,
    };
}

/**
 * Additional commission to recover from a ledger row. Already-clawed amounts are
 * subtracted so repeated or growing refunds never recover more than accrued.
 */
export function clawbackAmount(input: { commissionCents: number; targetCents: number; alreadyClawedCents: number }): number {
    return Math.max(0, Math.floor(input.commissionCents - input.targetCents - input.alreadyClawedCents));
}
