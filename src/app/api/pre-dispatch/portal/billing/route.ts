import { requireTenantManager } from "@/features/pre-dispatch/repository";
import { createBillingPortalSession, getStripe } from "@/lib/stripe";
import { checkRateLimit, RateLimits } from "@/lib/rate-limit";

export async function POST(request: Request) {
  try {
  const company = await requireTenantManager({ allowExpiredBilling: true });
  const rate = await checkRateLimit({ ...RateLimits.payment, namespace: "predispatch:billing" }, company.id);
  if (!rate.allowed) {
    return Response.json(
      { error: "Too many checkout attempts. Please try again later." },
      { status: 429, headers: { "Retry-After": String(Math.max(1, Math.ceil((rate.resetAt - Date.now()) / 1000))) } },
    );
  }

    const db = (await import("@/lib/db")).getDb();
    const origin = process.env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin;
    const accounts = await db`SELECT stripe_customer_id FROM pre_dispatch_companies WHERE id=${company.id}`;
    if (accounts[0]?.stripe_customer_id) {
      const portal = await createBillingPortalSession({ customerId: String(accounts[0].stripe_customer_id), returnUrl: `${origin}/portal/pre-dispatch/settings` });
      return Response.json({ url: portal.url });
    }
    const body = await request.json().catch(() => ({})) as { interval?: unknown };
    const interval = body.interval === "year" ? "year" : "month";
    const price = interval === "year" ? process.env.STRIPE_PRICE_PRE_DISPATCH_ANNUAL : process.env.STRIPE_PRICE_PRE_DISPATCH;
    if (!price) throw new Error(`${interval === "year" ? "Annual" : "Monthly"} Pre-Dispatch billing is not configured`);

    const dealRows = await db`SELECT id FROM broker_deals WHERE company_id=${company.id} LIMIT 1`;
    const brokerDealId = dealRows[0]?.id ? String(dealRows[0].id) : undefined;
    const metadata = { product: "pre_dispatch", billing_interval: interval, company_id: company.id, ...(brokerDealId ? { broker_deal_id: brokerDealId } : {}) };
    if (brokerDealId) await db`UPDATE broker_deals SET stage='checkout',updated_at=now() WHERE id=${brokerDealId} AND stage<>'won'`;

    const session = await getStripe().checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price, quantity: 1 }],
      customer_email: company.notification_email,
      client_reference_id: company.id,
      metadata,
      subscription_data: { metadata },
      success_url: `${origin}/portal/pre-dispatch/settings?billing=success`,
      cancel_url: `${origin}/portal/pre-dispatch/settings?billing=cancelled`,
      allow_promotion_codes: true,
    }, { idempotencyKey: `predispatch:${company.id}:${interval}:${Math.floor(Date.now() / 1800000)}` });
    if (!session.url) throw new Error("Stripe did not return a checkout URL");
    return Response.json({ url: session.url });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Billing unavailable" }, { status: 400 });
  }
}
