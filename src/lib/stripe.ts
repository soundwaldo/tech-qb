import Stripe from "stripe";
import { AssessmentTier, SubscriptionPlan, HOAPlan, PMPlan, TIER_PRICING, B2B_PLANS, HOA_PLANS, PM_PLANS } from "@/types";

let stripeInstance: Stripe | null = null;

export function getStripe(): Stripe {
    if (!stripeInstance) {
        const key = process.env.STRIPE_SECRET_KEY;
        if (!key) {
            throw new Error("STRIPE_SECRET_KEY is not configured");
        }
        if (!key.startsWith("sk_test_") && !key.startsWith("sk_live_")) {
            throw new Error("STRIPE_SECRET_KEY must be a Stripe secret key (sk_test_ or sk_live_)");
        }
        const publishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
        if (publishableKey) {
            const secretMode = key.startsWith("sk_live_") ? "live" : "test";
            const publishableMode = publishableKey.startsWith("pk_live_") ? "live" : publishableKey.startsWith("pk_test_") ? "test" : "invalid";
            if (publishableMode === "invalid" || publishableMode !== secretMode) {
                throw new Error("Stripe secret and publishable keys must be valid and use the same mode");
            }
        }
        stripeInstance = new Stripe(key, {
            apiVersion: "2025-02-24.acacia" as Stripe.LatestApiVersion,
            typescript: true,
        });
    }
    return stripeInstance;
}

export function isStripeConfigured(): boolean {
    return Boolean(
        process.env.STRIPE_SECRET_KEY &&
        !process.env.STRIPE_SECRET_KEY.includes("placeholder")
    );
}

const TIER_PRICE_ENV: Record<AssessmentTier, string> = {
    standard: "STRIPE_PRICE_STANDARD",
    express: "STRIPE_PRICE_EXPRESS",
    comprehensive: "STRIPE_PRICE_COMPREHENSIVE",
};

const HOA_PRICE_ENV: Record<string, string> = {
    hoa_basic: "STRIPE_PRICE_HOA_BASIC",
    hoa_premium: "STRIPE_PRICE_HOA_PREMIUM",
    hoa_enterprise: "STRIPE_PRICE_HOA_ENTERPRISE",
};

const PM_PRICE_ENV: Record<string, string> = {
    pm_starter: "STRIPE_PRICE_PM_STARTER",
    pm_professional: "STRIPE_PRICE_PM_PROFESSIONAL",
    pm_enterprise: "STRIPE_PRICE_PM_ENTERPRISE",
};

export async function createCheckoutSession(params: {
    assessmentId: string;
    tier: AssessmentTier;
    email: string;
    successUrl: string;
    cancelUrl: string;
}): Promise<Stripe.Checkout.Session> {
    const stripe = getStripe();
    const pricing = TIER_PRICING[params.tier];
    const priceId = process.env[TIER_PRICE_ENV[params.tier]];
    if (process.env.NODE_ENV === "production" && !priceId) {
        throw new Error(`${TIER_PRICE_ENV[params.tier]} is required in production`);
    }

    return stripe.checkout.sessions.create({
        mode: "payment",
        client_reference_id: params.assessmentId,
        customer_email: params.email,
        line_items: [
            priceId
                ? { price: priceId, quantity: 1 }
                : {
                    price_data: {
                        currency: "usd",
                        unit_amount: pricing.amount_cents,
                        product_data: {
                            name: `GGuard ${pricing.label} Assessment`,
                            description: pricing.description,
                        },
                    },
                    quantity: 1,
                },
        ],
        metadata: {
            assessment_id: params.assessmentId,
            tier: params.tier,
        },
        success_url: params.successUrl,
        cancel_url: params.cancelUrl,
        payment_intent_data: {
            metadata: {
                assessment_id: params.assessmentId,
                tier: params.tier,
            },
        },
    }, { idempotencyKey: `assessment-checkout-${params.assessmentId}` });
}

export async function createSubscriptionCheckout(params: {
    organizationId: string;
    plan: SubscriptionPlan | HOAPlan | PMPlan;
    email: string;
    successUrl: string;
    cancelUrl: string;
    customerId?: string | null;
}): Promise<Stripe.Checkout.Session> {
    const stripe = getStripe();

    // Resolve plan label/price from whichever catalog the plan belongs to
    const allPriceEnv: Record<string, string> = {
        ...Object.fromEntries(Object.keys(B2B_PLANS).map(k => [k, `STRIPE_PRICE_${k.toUpperCase()}`] as [string, string])),
        ...Object.fromEntries(Object.entries(HOA_PRICE_ENV)),
        ...Object.fromEntries(Object.entries(PM_PRICE_ENV)),
    };
    const priceId = process.env[allPriceEnv[params.plan] ?? ""] || undefined;
    if (process.env.NODE_ENV === "production" && !priceId) {
        throw new Error(`${allPriceEnv[params.plan] || "Stripe subscription price"} is required in production`);
    }

    const planData =
        (B2B_PLANS as Record<string, { price_cents: number; label: string; description: string }>)[params.plan] ??
        (HOA_PLANS as Record<string, { price_cents: number; label: string; description: string }>)[params.plan] ??
        (PM_PLANS as Record<string, { price_cents: number; label: string; description: string }>)[params.plan];
    if (!planData) throw new Error("Unknown Stripe subscription plan");

    const isHoa = params.plan.startsWith("hoa_");
    const billingInterval: "month" | "year" = isHoa ? "year" : "month";

    const sessionParams: Stripe.Checkout.SessionCreateParams = {
        mode: "subscription",
        client_reference_id: params.organizationId,
        customer_email: params.customerId ? undefined : params.email,
        customer: params.customerId || undefined,
        line_items: [
            priceId
                ? { price: priceId, quantity: 1 }
                : {
                    price_data: {
                        currency: "usd",
                        unit_amount: planData.price_cents,
                        recurring: { interval: billingInterval },
                        product_data: {
                            name: `GGuard ${planData.label}`,
                            description: planData.description,
                        },
                    },
                    quantity: 1,
                },
        ],
        metadata: {
            organization_id: params.organizationId,
            plan: params.plan,
        },
        subscription_data: {
            metadata: {
                organization_id: params.organizationId,
                plan: params.plan,
            },
        },
        success_url: params.successUrl,
        cancel_url: params.cancelUrl,
    };

    return stripe.checkout.sessions.create(sessionParams, {
        idempotencyKey: `subscription-checkout-${params.organizationId}-${params.plan}`,
    });
}

export async function createBillingPortalSession(params: {
    customerId: string;
    returnUrl: string;
}): Promise<Stripe.BillingPortal.Session> {
    const configuration = process.env.STRIPE_BILLING_PORTAL_CONFIGURATION;
    if (process.env.NODE_ENV === "production" && !configuration) {
        throw new Error("STRIPE_BILLING_PORTAL_CONFIGURATION is required in production");
    }
    return getStripe().billingPortal.sessions.create({
        customer: params.customerId,
        configuration: configuration || undefined,
        return_url: params.returnUrl,
    });
}

export function constructWebhookEvent(
    body: string | Buffer,
    signature: string
): Stripe.Event {
    const stripe = getStripe();
    const secret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!secret) {
        throw new Error("STRIPE_WEBHOOK_SECRET is not configured");
    }
    return stripe.webhooks.constructEvent(body, signature, secret);
}
