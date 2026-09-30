import { z } from "zod";
import { createClient, createServiceClient } from "@/lib/neon";
import { TIER_PRICING } from "@/types";
import { slaDueAt } from "@/lib/utils";
import { getSessionTokenFromCookie } from "@/lib/session-middleware";
import { deriveEmailLookupHash, encryptPIIFields } from "@/lib/pii-encryption";
import { getDb } from "@/lib/db";
import { derivePropertyAddressId } from "@/lib/property-ledger";
import { verifyAssessmentInviteToken } from "@/lib/invite-token";
import { checkRateLimit, RateLimits } from "@/lib/rate-limit";
import { getOrCreateProperty, linkProperty } from "@/lib/property-registry";

const schema = z.object({
    address: z.string().trim().min(5).max(200),
    zip_code: z.string().regex(/^\d{5}(?:-\d{4})?$/),
    door_type: z.enum(["single", "double"]),
    problems: z.array(z.enum(["wont_open", "wont_close", "loud_grinding", "broken_spring", "sensor_blinking", "door_off_track", "opener_not_working", "remote_not_working", "uneven_door", "cable_issues", "panel_damage", "other"])).min(1).max(12),
    description: z.string().max(2000).optional(),
    email: z.string().email().max(254),
    phone: z.string().max(30).nullish(),
    tier: z.enum(["standard", "express", "comprehensive"]),
    evidence: z.array(z.object({
        key: z.string().max(300),
        category: z.enum(["opener", "spring_system", "full_door", "issue_closeup", "operation_video"]),
        media_type: z.enum(["photo", "video"]),
    })).min(1).max(5),
    quote_key: z.string().max(300).nullable().optional(),
    property_label: z.string().max(120).nullish(),
    contractor_name: z.string().max(120).nullish(),
    contractor_quote_cents: z.number().int().nonnegative().max(10_000_000).nullable().optional(),
    ai_processing_consent: z.literal(true),
    organization_invite: z.string().max(1000).optional(),
});

export async function POST(request: Request) {
    const session_token = await getSessionTokenFromCookie();
    if (!session_token) return Response.json({ error: "Session token missing. Please initialize session." }, { status: 401 });
    const rate = await checkRateLimit(RateLimits.assessment);
    if (!rate.allowed) return Response.json({ error: "Assessment creation limit reached" }, { status: 429 });

    const parsed = schema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return Response.json({ error: "Please check the required assessment details." }, { status: 400 });
    const input = parsed.data;
    const expectedPrefix = `uploads/${session_token}/`;
    const keys = [...input.evidence.map((item) => item.key), ...(input.quote_key ? [input.quote_key] : [])];
    if (keys.some((key) => !key.startsWith(expectedPrefix))) return Response.json({ error: "Invalid upload ownership." }, { status: 403 });

    const evidenceByCategory = new Map(input.evidence.map((item) => [item.category, item]));
    if (evidenceByCategory.size !== input.evidence.length) {
        return Response.json({ error: "Only one upload is allowed for each evidence category." }, { status: 400 });
    }
    if (!input.evidence.some((item) => item.media_type === "photo")) {
        return Response.json({ error: "Add at least one safe garage-door photo before continuing." }, { status: 400 });
    }
    const issueEvidence = evidenceByCategory.get("issue_closeup");
    if (issueEvidence && issueEvidence.media_type !== "photo") {
        return Response.json({ error: "The issue close-up must be a photo." }, { status: 400 });
    }
    const operationVideo = evidenceByCategory.get("operation_video");
    if (operationVideo && operationVideo.media_type !== "video") {
        return Response.json({ error: "The operation recording must be a video." }, { status: 400 });
    }
    if (input.evidence.some((item) => !item.key.includes(`/${item.media_type}/`))) {
        return Response.json({ error: "Evidence type does not match the uploaded file." }, { status: 400 });
    }
    const auth = await createClient();
    const { data: { user } } = await auth.auth.getUser();
    const service = createServiceClient();
    let organizationId: string | null = null;
    let customerType: "homeowner" | "hoa" | "property_manager" | "contractor" = "homeowner";
    const organizationInvite = input.organization_invite ? verifyAssessmentInviteToken(input.organization_invite) : null;
    if (input.organization_invite && !organizationInvite) return Response.json({ error: "Organization invite is invalid or expired" }, { status: 403 });
    if (organizationInvite) {
        organizationId = organizationInvite.organizationId;
        customerType = organizationInvite.customerType;
    }
    if (user) {
        const db = getDb();
        await db`
          INSERT INTO profiles (id, full_name, role)
          VALUES (${user.id}, ${user.name || null}, 'homeowner')
          ON CONFLICT (id) DO UPDATE SET full_name = COALESCE(EXCLUDED.full_name, profiles.full_name), updated_at = now()
        `;
        const { data: profile } = await service.from("profiles").select("organization_id, role").eq("id", user.id).single();
        const profileRow = (profile as { organization_id?: string | null; role?: string | null } | null) ?? null;
        if (profileRow?.organization_id && organizationInvite && profileRow.organization_id !== organizationInvite.organizationId) {
            return Response.json({ error: "Organization invite does not match your account" }, { status: 403 });
        }
        if (profileRow?.organization_id) organizationId = profileRow.organization_id;
        if (profileRow?.organization_id && !organizationInvite) {
            const orgRows = await db`SELECT customer_type FROM organizations WHERE id = ${profileRow.organization_id} LIMIT 1`;
            const storedType = String(orgRows[0]?.customer_type || "property_manager");
            customerType = storedType === "hoa" ? "hoa" : storedType === "contractor" ? "contractor" : "property_manager";
        }
    }
    const property = await getOrCreateProperty(input.address, input.zip_code);
    if (organizationId) {
        const db = getDb();
        const claimed = await db`
          UPDATE organizations SET report_credits = report_credits - 1, updated_at = now()
          WHERE id = ${organizationId} AND subscription_status = 'active' AND report_credits > 0
          RETURNING id
        `;
        if (!claimed.length) return Response.json({ error: "Organization has no active assessment credits" }, { status: 402 });
    }
    const pricing = TIER_PRICING[input.tier];
    
    // Encrypt PII before storing
    const encryptedPII = encryptPIIFields({
        email: input.email,
        phone: input.phone || null,
        street_address: input.address || null,
    });
    
    const { data: assessment, error } = await service.from("assessments").insert({
        session_token: session_token, 
        street_address: encryptedPII.street_address, 
        property_address_id: derivePropertyAddressId(input.address, input.zip_code),
        property_id: property.id,
        email: encryptedPII.email,
        email_lookup_hash: deriveEmailLookupHash(input.email),
        phone: encryptedPII.phone,
        zip_code: input.zip_code, 
        door_type: input.door_type,
        problems: input.problems, description: input.description,
        tier: input.tier, amount_cents: pricing.amount_cents, status: organizationId ? "paid" : "draft", customer_user_id: user?.id || null,
        due_at: slaDueAt(pricing.sla_hours), organization_id: organizationId, customer_type: customerType,
        property_label: input.property_label, contractor_name: input.contractor_name,
        contractor_quote_cents: input.contractor_quote_cents,
        ai_processing_consent: input.ai_processing_consent,
        refund_eligible: true,
    }).select().single();
    if (error || !assessment) {
        if (organizationId) await getDb()`UPDATE organizations SET report_credits = report_credits + 1, updated_at = now() WHERE id = ${organizationId}`;
        return Response.json({ error: "Could not create assessment." }, { status: 500 });
    }

    await Promise.all([
        user?.id ? linkProperty({ propertyId: property.id, userId: user.id, relationshipType: "homeowner" }) : Promise.resolve(),
        organizationId ? linkProperty({ propertyId: property.id, organizationId, relationshipType: customerType === "hoa" ? "hoa" : customerType === "contractor" ? "contractor" : "managed_by" }) : Promise.resolve(),
    ]);

    const mediaRows = [
        ...input.evidence.map((item) => ({ assessment_id: assessment.id, media_type: item.media_type, evidence_category: item.category, storage_key: item.key, file_name: item.key.split("/").pop() || "media", content_type: item.media_type === "video" ? "video/webm" : "image/jpeg", size_bytes: 0 })),
        ...(input.quote_key ? [{ assessment_id: assessment.id, media_type: input.quote_key.includes("/quote_image/") ? "quote_image" : "quote_pdf", storage_key: input.quote_key, file_name: input.quote_key.split("/").pop() || "quote", content_type: input.quote_key.includes("/quote_image/") ? "image/jpeg" : "application/pdf", size_bytes: 0 }] : []),
    ];
    if (mediaRows.length) {
        const { error: mediaError } = await service.from("assessment_media").insert(mediaRows as Array<Record<string, unknown>>);
        if (mediaError) return Response.json({ error: "Assessment created, but evidence could not be attached.", assessmentId: assessment.id }, { status: 500 });
    }
    return Response.json({ assessmentId: assessment.id, propertyId: property.id, propertyUrl: `/properties/${property.id}`, requiresPayment: !organizationId });
}
