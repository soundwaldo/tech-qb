import { z } from "zod";
import { createCheckoutSession } from "@/lib/stripe";
import { createServiceClient } from "@/lib/neon";
import { getSessionTokenFromCookie } from "@/lib/session-middleware";
import { deriveEmailLookupHash, encryptPII } from "@/lib/pii-encryption";
import { checkRateLimit, RateLimits } from "@/lib/rate-limit";

const schema = z.object({ assessmentId: z.string().uuid(), email: z.string().email().max(254) });

export async function POST(request: Request) {
    const session_token = await getSessionTokenFromCookie();
    if (!session_token) return Response.json({ error: "Session missing" }, { status: 401 });
    const rate = await checkRateLimit(RateLimits.payment);
    if (!rate.allowed) return Response.json({ error: "Checkout attempt limit reached" }, { status: 429 });

    const parsed = schema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return Response.json({ error: "Invalid checkout request" }, { status: 400 });
    const service = createServiceClient();
    const { data: assessment } = await service.from("assessments").select("id, tier, session_token, organization_id, status").eq("id", parsed.data.assessmentId).single();
    const assessmentRow = (assessment as { id?: string; tier?: string; session_token?: string; organization_id?: string | null; status?: string } | null) ?? null;
    if (!assessmentRow || assessmentRow.session_token !== session_token) return Response.json({ error: "Assessment not found" }, { status: 404 });
    if (assessmentRow.organization_id) return Response.json({ error: "Organization assessments do not require individual checkout" }, { status: 409 });
    if (assessmentRow.status !== "draft") return Response.json({ error: "Checkout has already been started" }, { status: 409 });
    const origin = process.env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin;
    try {
        const encryptedEmail = encryptPII(parsed.data.email);
        const session = await createCheckoutSession({ assessmentId: assessmentRow.id!, tier: assessmentRow.tier as "standard" | "express" | "comprehensive", email: parsed.data.email, successUrl: `${origin}/success?session_id={CHECKOUT_SESSION_ID}`, cancelUrl: `${origin}/upload` });
        const { data: updated } = await service.from("assessments")
            .update({ status: "pending_payment", stripe_checkout_session_id: session.id, email: encryptedEmail, email_lookup_hash: deriveEmailLookupHash(parsed.data.email) })
            .eq("id", assessmentRow.id!)
            .select("id")
            .single();
        if (!updated) throw new Error("Assessment checkout state could not be saved");
        return Response.json({ url: session.url });
    } catch (error) {
        console.error("Checkout error:", error);
        return Response.json({ error: "Checkout could not be started" }, { status: 502 });
    }
}
