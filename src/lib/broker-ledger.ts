import "server-only";
import type Stripe from "stripe";
import type { NeonQueryFunction } from "@neondatabase/serverless";
import { clawbackAmount, invoiceServiceMonths, netCommissionable, planCommissionInstallments, refundCommissionTarget } from "@/lib/broker-commission";

// Commission accounting runs inside the Stripe webhook, where the same event can be
// redelivered and where refunds arrive after accrual. Every write is therefore idempotent:
// accruals are unique on (stripe_invoice_id, kind) and recoveries on
// (clawback_of_id, stripe_refund_id), so a replayed webhook changes nothing rather than
// double-paying. Held rows mature after the refund window before an admin can approve them.

type Db = NeonQueryFunction<false, false>;

/** Mirror the ledger onto the deal so broker and admin lists do not re-sum rows. */
export async function rollUpDealCommission(dealId: string, db: Db) {
    await db`UPDATE broker_deals d SET commission_cents=COALESCE((SELECT sum(CASE WHEN kind='clawback' THEN -commission_cents ELSE commission_cents END)::int FROM broker_commission_ledger WHERE deal_id=d.id AND status<>'clawed_back' AND status<>'void'),0),commission_status=CASE WHEN d.commission_status='void' THEN 'void' WHEN EXISTS(SELECT 1 FROM broker_commission_ledger WHERE deal_id=d.id AND kind<>'clawback' AND status='paid') AND NOT EXISTS(SELECT 1 FROM broker_commission_ledger WHERE deal_id=d.id AND kind<>'clawback' AND status IN ('held','pending','approved')) THEN 'paid' WHEN EXISTS(SELECT 1 FROM broker_commission_ledger WHERE deal_id=d.id AND status='approved')THEN 'approved' WHEN EXISTS(SELECT 1 FROM broker_commission_ledger WHERE deal_id=d.id)THEN 'pending' ELSE d.commission_status END,updated_at=now() WHERE d.id=${dealId}`;
}

/**
 * Accrue the commission one paid subscription invoice earns. Only the months the
 * invoice actually pays for are credited, against the window still remaining on the
 * broker's agreement, on a basis verified net of tax and shipping.
 */
export async function recordBrokerCommission(invoice: Stripe.Invoice, subscription: Stripe.Subscription, db: Db) {
    const dealId=subscription.metadata.broker_deal_id;
    if(!dealId||invoice.amount_paid<=0)return;
    // Accrual is decided once per invoice. Re-deriving the month window from the ledger
    // after a redelivery would silently pay the next rate again, so a replay stops here.
    const alreadyAccrued=await db`SELECT 1 FROM broker_commission_ledger WHERE deal_id=${dealId} AND stripe_invoice_id=${invoice.id} AND kind<>'clawback' LIMIT 1`;
    if(alreadyAccrued.length)return;
    const rows=await db`SELECT d.id,d.broker_id,b.commission_bps,b.support_commission_bps,b.commission_months,b.support_commission_enabled,COALESCE((SELECT sum(l.months_credited)::int FROM broker_commission_ledger l WHERE l.deal_id=d.id AND l.kind='sale'),0) AS months_credited,(SELECT count(*)::int FROM broker_commission_ledger l WHERE l.stripe_invoice_id=${invoice.id}) AS accrued FROM broker_deals d JOIN sales_brokers b ON b.id=d.broker_id WHERE d.id=${dealId} AND b.active=true LIMIT 1`;
    const deal=rows[0];if(!deal||Number(deal.accrued)>0)return;const net=netCommissionable(invoice);if(!net)return;const monthsPaid=invoiceServiceMonths(invoice);if(!monthsPaid)return;
    const raw=invoice as unknown as{charge?:string|{id?:string}|null};const chargeId=typeof raw.charge==="string"?raw.charge:raw.charge?.id||null;const plans=planCommissionInstallments({monthsPaid,monthsCredited:Number(deal.months_credited),commissionMonths:Number(deal.commission_months),commissionBps:Number(deal.commission_bps),supportBps:Number(deal.support_commission_bps),supportEnabled:Boolean(deal.support_commission_enabled),netCents:net.netCents});if(!plans.length)return;
    for(const plan of plans)await db`INSERT INTO broker_commission_ledger(id,broker_id,deal_id,stripe_invoice_id,stripe_charge_id,sequence_number,gross_collected_cents,excluded_cents,months_credited,commission_bps,commission_cents,kind,status,eligible_at) VALUES(gen_random_uuid(),${deal.broker_id},${deal.id},${invoice.id},${chargeId},${plan.sequenceNumber},${net.grossCents},${net.excludedCents},${plan.monthsCredited},${plan.commissionBps},${plan.commissionCents},${plan.kind},'held',now()+interval '30 days') ON CONFLICT(stripe_invoice_id,kind) WHERE kind<>'clawback' DO NOTHING`;
    await rollUpDealCommission(deal.id,db);
}

/**
 * Reconcile commission against a refund. Unpaid rows are restated in place; rows
 * already released to the broker are recovered through an immutable clawback row.
 */
export async function clawBackBrokerCommission(charge: Stripe.Charge, db: Db) {
    if(!charge.refunded||charge.amount_refunded<=0)return;
    const refundKey=charge.id+":"+charge.amount_refunded;
    const rows=await db`SELECT id,deal_id,broker_id,stripe_invoice_id,sequence_number,gross_collected_cents,excluded_cents,commission_bps,commission_cents,status,(SELECT COALESCE(sum(c.commission_cents),0)::int FROM broker_commission_ledger c WHERE c.kind='clawback' AND c.clawback_of_id=broker_commission_ledger.id) AS clawed_back_cents FROM broker_commission_ledger WHERE stripe_charge_id=${charge.id} AND kind IN ('sale','support')`;
    for(const row of rows){
        const netCents=Math.max(0,(Number(row.gross_collected_cents)||0)-(Number(row.excluded_cents)||0));
        const target=refundCommissionTarget({netCents,commissionBps:Number(row.commission_bps),refundCents:charge.amount_refunded});
        let changed=false;
        if(row.status==="paid"){
            // Money already released cannot be rewritten: recover it on an immutable clawback row.
            const clawback=clawbackAmount({commissionCents:Number(row.commission_cents),targetCents:target.targetCents,alreadyClawedCents:Number(row.clawed_back_cents)});
            if(clawback>0){
                await db`INSERT INTO broker_commission_ledger(id,broker_id,deal_id,stripe_invoice_id,stripe_charge_id,stripe_refund_id,clawback_of_id,sequence_number,gross_collected_cents,excluded_cents,refunded_cents,commission_bps,commission_cents,kind,status,eligible_at,payout_reference,void_reason) VALUES(gen_random_uuid(),${row.broker_id},${row.deal_id},${row.stripe_invoice_id},${charge.id},${refundKey},${row.id},${row.sequence_number},0,0,${target.refundCents},${row.commission_bps},${clawback},'clawback','paid',now(),${'Stripe refund '+refundKey},'Charge refunded after commission was paid') ON CONFLICT(clawback_of_id,stripe_refund_id) WHERE kind='clawback' AND clawback_of_id IS NOT NULL DO NOTHING`;
                changed=true;
            }
        } else if(target.targetCents<Number(row.commission_cents)){
            if(target.fullyRefunded)await db`UPDATE broker_commission_ledger SET refunded_cents=${target.refundCents},commission_cents=${target.targetCents},status='clawed_back',void_reason='Stripe charge refunded',updated_at=now() WHERE id=${row.id}`;
            else await db`UPDATE broker_commission_ledger SET refunded_cents=${target.refundCents},commission_cents=${target.targetCents},updated_at=now() WHERE id=${row.id}`;
            changed=true;
        }
        if(changed)await rollUpDealCommission(row.deal_id,db);
    }
}

