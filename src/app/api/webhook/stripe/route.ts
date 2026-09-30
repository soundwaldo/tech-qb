import Stripe from "stripe";
import { constructWebhookEvent, getStripe } from "@/lib/stripe";
import { createServiceClient } from "@/lib/neon";
import { sendAssessmentReceived, sendPaymentConfirmation, sendPaidAssessmentToAdmin } from "@/lib/email";
import { createAiDiagnosticDraft } from "@/lib/ai-diagnostic";
import { TIER_PRICING } from "@/types";
import { getDb } from "@/lib/db";
import { clawBackBrokerCommission, recordBrokerCommission } from "@/lib/broker-ledger";
import { creditsForPlan, isPlanForOrganization, type AnySubscriptionPlan, type OrganizationType } from "@/lib/subscription-plans";

export const maxDuration = 180;

export async function POST(request: Request) {
    const signature = request.headers.get("stripe-signature");
    if (!signature) {
        return new Response("Missing signature", { status: 400 });
    }

    const body = await request.text();
    let event;

    try {
        event = constructWebhookEvent(body, signature);
    } catch (e) {
        console.error("Webhook signature error:", e);
        return new Response("Invalid signature", { status: 400 });
    }

    const service = createServiceClient();
    const db = getDb();
    const claimed = await db`
      INSERT INTO stripe_webhook_events (stripe_event_id, event_type, processed, payload, processing_at, attempts)
      VALUES (${event.id}, ${event.type}, false, ${event.data}, now(), 1)
      ON CONFLICT (stripe_event_id) DO UPDATE SET processing_at = now(), attempts = stripe_webhook_events.attempts + 1, last_error = NULL
      WHERE stripe_webhook_events.processed = false
        AND (stripe_webhook_events.processing_at IS NULL OR stripe_webhook_events.processing_at < now() - interval '5 minutes')
      RETURNING id
    `;
    if (!claimed.length) return new Response("Already processed or processing", { status: 200 });

    try {
    if (event.type === "checkout.session.completed" || event.type === "checkout.session.async_payment_succeeded") {
        const session = event.data.object as Stripe.Checkout.Session;
        if (session.mode === "subscription" && session.metadata?.product === "pre_dispatch") await handlePreDispatchCheckout(session, db);
        else if (session.mode === "subscription") await handleSubscriptionCheckout(session, db);
        else await handlePaidAssessment(session, service);
    } else if (event.type === "checkout.session.expired" || event.type === "checkout.session.async_payment_failed") {
        await releaseFailedAssessmentCheckout(event.data.object as Stripe.Checkout.Session, service);
    } else if (event.type === "charge.refunded") {
        const charge=event.data.object as Stripe.Charge;
        await markFullyRefundedAssessment(charge, service);
        await clawBackBrokerCommission(charge,db);
    } else if (["customer.subscription.created", "customer.subscription.updated", "customer.subscription.deleted"].includes(event.type)) {
        await syncSubscription(event.data.object as Stripe.Subscription, db);
    } else if (event.type === "invoice.paid") {
        await grantSubscriptionCredits(event.data.object as Stripe.Invoice, db);
    } else if (event.type === "invoice.payment_failed") {
        await markSubscriptionPastDue(event.data.object as Stripe.Invoice, db);
    }

    // Mark as processed
    await service
        .from("stripe_webhook_events")
        .update({ processed: true, processing_at: null, last_error: null })
        .eq("stripe_event_id", event.id);

    return new Response("OK", { status: 200 });
    } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown webhook processing error";
        console.error("Stripe webhook processing error:", error);
        await service
            .from("stripe_webhook_events")
            .update({ processed: false, processing_at: null, last_error: message })
            .eq("stripe_event_id", event.id);
        return new Response("Webhook processing failed", { status: 500 });
    }
}

type ServiceClient = ReturnType<typeof createServiceClient>;

async function handlePaidAssessment(session: Stripe.Checkout.Session, service: ServiceClient): Promise<void> {
    if (session.mode !== "payment" || session.payment_status !== "paid") return;

    const assessmentId = session.metadata?.assessment_id;
    if (!assessmentId) return;

    const { data: current } = await service.from("assessments").select("*").eq("id", assessmentId).single();
    if (!current) throw new Error("Paid assessment was not found");
    if (session.client_reference_id && session.client_reference_id !== assessmentId) throw new Error("Checkout reference mismatch");
    if (session.currency !== "usd") throw new Error("Payment currency mismatch");
    if (session.amount_total !== current.amount_cents) throw new Error("Payment amount mismatch");
    if (session.metadata?.tier !== current.tier) throw new Error("Assessment tier mismatch");
    if (current.stripe_checkout_session_id && current.stripe_checkout_session_id !== session.id) throw new Error("Checkout session mismatch");

    const paymentIntentId = typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent?.id;
    const workflowHasAdvanced = ["ai_processing", "awaiting_expert_review", "needs_more_evidence", "in_review", "completed", "delivered"].includes(String(current.status));
    if (workflowHasAdvanced) return;

    const { data: assessment } = await service
        .from("assessments")
        .update({
            status: "paid",
            stripe_checkout_session_id: session.id,
            stripe_payment_intent_id: paymentIntentId ?? null,
            paid_at: new Date().toISOString(),
        })
        .eq("id", assessmentId)
        .select()
        .single();
    if (!assessment) throw new Error("Paid assessment could not be updated");

    const customerEmail = session.customer_details?.email;
    const tier = assessment.tier as "standard" | "express" | "comprehensive";
    if (customerEmail) {
        await sendAssessmentReceived({
            to: customerEmail,
            assessmentId,
            tier,
            slaHours: TIER_PRICING[tier].sla_hours,
        });
        await sendPaymentConfirmation({
            to: customerEmail,
            amountCents: Number(assessment.amount_cents),
            tier,
        });
    }

    await createAiDiagnosticDraft(assessmentId);
    await sendPaidAssessmentToAdmin({
        assessmentId,
        customerEmail: customerEmail || "Not supplied by Stripe",
        propertyLabel: assessment.property_label as string | null,
        customerType: String(assessment.customer_type || "homeowner"),
        tier,
    });
}

async function releaseFailedAssessmentCheckout(session: Stripe.Checkout.Session, service: ServiceClient): Promise<void> {
    const assessmentId = session.metadata?.assessment_id;
    if (!assessmentId || session.mode !== "payment") return;
    await service.from("assessments")
        .update({ status: "draft", stripe_checkout_session_id: null })
        .eq("id", assessmentId)
        .eq("stripe_checkout_session_id", session.id)
        .eq("status", "pending_payment");
}

async function markFullyRefundedAssessment(charge: Stripe.Charge, service: ServiceClient): Promise<void> {
    if (!charge.refunded || charge.amount_refunded < charge.amount) return;
    const paymentIntentId = typeof charge.payment_intent === "string" ? charge.payment_intent : charge.payment_intent?.id;
    if (!paymentIntentId) return;
    await service.from("assessments")
        .update({ status: "refunded", refund_eligible: false })
        .eq("stripe_payment_intent_id", paymentIntentId);
}

async function handleSubscriptionCheckout(session: Stripe.Checkout.Session, db: ReturnType<typeof getDb>): Promise<void> {
    const organizationId = session.metadata?.organization_id;
    const plan = session.metadata?.plan as AnySubscriptionPlan | undefined;
    if (!organizationId || !plan) throw new Error("Subscription Checkout metadata is missing");
    if (session.client_reference_id && session.client_reference_id !== organizationId) throw new Error("Subscription Checkout reference mismatch");

    const subscriptionId = typeof session.subscription === "string" ? session.subscription : session.subscription?.id;
    const customerId = typeof session.customer === "string" ? session.customer : session.customer?.id;
    if (!subscriptionId || !customerId) throw new Error("Subscription Checkout has no customer or subscription");

    await db`
      UPDATE organizations SET stripe_customer_id = ${customerId}, stripe_subscription_id = ${subscriptionId},
        subscription_plan = ${plan}, updated_at = now()
      WHERE id = ${organizationId}
    `;
    const subscription = await getStripe().subscriptions.retrieve(subscriptionId);
    await syncSubscription(subscription, db);
}

async function handlePreDispatchCheckout(session:Stripe.Checkout.Session,db:ReturnType<typeof getDb>){const companyId=session.metadata?.company_id;const subscriptionId=typeof session.subscription==="string"?session.subscription:session.subscription?.id;const customerId=typeof session.customer==="string"?session.customer:session.customer?.id;if(!companyId||!subscriptionId||!customerId)throw new Error("Pre-Dispatch Checkout metadata is missing");if(session.client_reference_id&&session.client_reference_id!==companyId)throw new Error("Pre-Dispatch Checkout reference mismatch");await db`UPDATE pre_dispatch_companies SET stripe_customer_id=${customerId},stripe_subscription_id=${subscriptionId},updated_at=now() WHERE id=${companyId}`;const dealId=session.metadata?.broker_deal_id;if(dealId)await db`UPDATE broker_deals SET stage='won',won_at=COALESCE(won_at,now()),updated_at=now() WHERE id=${dealId} AND company_id=${companyId}`;await syncPreDispatchSubscription(await getStripe().subscriptions.retrieve(subscriptionId),db)}

async function syncPreDispatchSubscription(subscription:Stripe.Subscription,db:ReturnType<typeof getDb>){const companyId=subscription.metadata.company_id;if(subscription.metadata.product!=="pre_dispatch"||!companyId)throw new Error("Pre-Dispatch subscription metadata is missing");const customerId=typeof subscription.customer==="string"?subscription.customer:subscription.customer.id;const normalized=normalizeSubscriptionStatus(subscription.status);const productStatus=normalized==="active"?"active":normalized==="trialing"?"trial":normalized;await db`UPDATE pre_dispatch_companies SET stripe_customer_id=${customerId},stripe_subscription_id=${subscription.id},product_status=${productStatus},subscription_plan='pre_dispatch',widget_enabled=CASE WHEN ${productStatus} IN ('active','trial') THEN widget_enabled ELSE false END,updated_at=now() WHERE id=${companyId}`}

async function syncSubscription(subscription: Stripe.Subscription, db: ReturnType<typeof getDb>): Promise<void> {
    if(subscription.metadata.product==="pre_dispatch"){await syncPreDispatchSubscription(subscription,db);return}
    const organizationId = subscription.metadata.organization_id;
    const plan = subscription.metadata.plan as AnySubscriptionPlan | undefined;
    if (!organizationId || !plan) throw new Error("Stripe subscription metadata is missing");

    const organizations = await db`SELECT customer_type FROM organizations WHERE id = ${organizationId} LIMIT 1`;
    const organizationType = organizations[0]?.customer_type as OrganizationType | undefined;
    if (!organizationType || !isPlanForOrganization(plan, organizationType)) throw new Error("Stripe subscription plan does not match organization");

    const customerId = typeof subscription.customer === "string" ? subscription.customer : subscription.customer.id;
    const status = normalizeSubscriptionStatus(subscription.status);
    await db`
      UPDATE organizations SET stripe_customer_id = ${customerId}, stripe_subscription_id = ${subscription.id},
        subscription_plan = ${plan}, subscription_status = ${status},
        report_credits = CASE WHEN ${status} = 'cancelled' THEN 0 ELSE report_credits END,
        updated_at = now()
      WHERE id = ${organizationId}
    `;
}

async function grantSubscriptionCredits(invoice: Stripe.Invoice, db: ReturnType<typeof getDb>): Promise<void> {
    if (invoice.status !== "paid" || !["subscription_create", "subscription_cycle"].includes(String(invoice.billing_reason))) return;
    const subscriptionId = subscriptionIdFromInvoice(invoice);
    if (!subscriptionId) return;

    const subscription = await getStripe().subscriptions.retrieve(subscriptionId);
    if(subscription.metadata.product==="pre_dispatch"){await syncPreDispatchSubscription(subscription,db);await recordBrokerCommission(invoice,subscription,db);return}
    const organizationId = subscription.metadata.organization_id;
    const plan = subscription.metadata.plan as AnySubscriptionPlan | undefined;
    if (!organizationId || !plan) throw new Error("Paid subscription invoice metadata is missing");
    const credits = creditsForPlan(plan);
    const customerId = typeof subscription.customer === "string" ? subscription.customer : subscription.customer.id;
    await db`
      UPDATE organizations SET stripe_customer_id = ${customerId}, stripe_subscription_id = ${subscription.id},
        subscription_plan = ${plan}, subscription_status = ${normalizeSubscriptionStatus(subscription.status)},
        report_credits = ${credits}, last_stripe_invoice_id = ${invoice.id}, updated_at = now()
      WHERE id = ${organizationId} AND last_stripe_invoice_id IS DISTINCT FROM ${invoice.id}
    `;
}

async function markSubscriptionPastDue(invoice: Stripe.Invoice, db: ReturnType<typeof getDb>): Promise<void> {
    const subscriptionId = subscriptionIdFromInvoice(invoice);
    if (!subscriptionId) return;
    const subscription=await getStripe().subscriptions.retrieve(subscriptionId);
    if(subscription.metadata.product==="pre_dispatch"){await syncPreDispatchSubscription(subscription,db);return}
    await db`
      UPDATE organizations SET subscription_status = 'past_due', updated_at = now()
      WHERE stripe_subscription_id = ${subscriptionId}
    `;
}

function subscriptionIdFromInvoice(invoice: Stripe.Invoice): string | null {
    const raw = invoice as unknown as {
        subscription?: string | { id?: string } | null;
        parent?: { subscription_details?: { subscription?: string | { id?: string } | null } | null } | null;
    };
    const subscription = raw.subscription ?? raw.parent?.subscription_details?.subscription;
    return typeof subscription === "string" ? subscription : subscription?.id ?? null;
}

function normalizeSubscriptionStatus(status: Stripe.Subscription.Status): string {
    if (status === "canceled" || status === "incomplete_expired") return "cancelled";
    if (status === "paused") return "paused";
    if (status === "unpaid") return "unpaid";
    if (status === "incomplete") return "incomplete";
    if (status === "past_due") return "past_due";
    if (status === "trialing") return "trialing";
    return "active";
}
