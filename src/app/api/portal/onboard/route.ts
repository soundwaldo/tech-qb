import { z } from "zod";
import { getDb } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/server";
import { createAssessmentInviteToken } from "@/lib/invite-token";
import { createSubscriptionCheckout } from "@/lib/stripe";
import {
  SUBSCRIPTION_PLAN_IDS,
  isPlanForOrganization,
  organizationTypeForPortal,
  type AnySubscriptionPlan,
} from "@/lib/subscription-plans";

const inputSchema = z.object({
  type: z.enum(["contractor", "hoa", "pm"]),
  organizationName: z.string().trim().min(2).max(160),
  email: z.string().email().max(254),
  plan: z.enum(SUBSCRIPTION_PLAN_IDS),
}).superRefine((input, context) => {
  if (!isPlanForOrganization(input.plan, organizationTypeForPortal(input.type))) {
    context.addIssue({ code: "custom", path: ["plan"], message: "Plan does not match organization type" });
  }
});

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
    const parsed = inputSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return Response.json({ error: "Invalid organization details" }, { status: 400 });
    const { type, organizationName, email, plan } = parsed.data;
    const organizationType = organizationTypeForPortal(type);
    const db = getDb();
    const existing = await db`SELECT organization_id FROM profiles WHERE id = ${user.id} LIMIT 1`;
    let org: Record<string, unknown>;
    if (existing[0]?.organization_id) {
      const rows = await db`
        SELECT id, customer_type, stripe_customer_id, stripe_subscription_id, subscription_status
        FROM organizations WHERE id = ${existing[0].organization_id} LIMIT 1
      `;
      org = rows[0];
      if (!org || org.customer_type !== organizationType) {
        return Response.json({ error: "Profile already belongs to another organization type" }, { status: 409 });
      }
      if (["active", "trialing"].includes(String(org.subscription_status))) {
        return Response.json({ error: "Organization already has an active subscription" }, { status: 409 });
      }
      await db`
        UPDATE organizations SET name = ${organizationName}, subscription_plan = ${plan},
          subscription_status = 'incomplete', report_credits = 0, updated_at = now()
        WHERE id = ${org.id}
      `;
    } else {
      const organizations = await db`
        INSERT INTO organizations (name, customer_type, subscription_plan, subscription_status, report_credits)
        VALUES (${organizationName}, ${organizationType}, ${plan}, 'incomplete', 0)
        RETURNING id, customer_type, stripe_customer_id, stripe_subscription_id, subscription_status
      `;
      org = organizations[0];
    }
    await db`
      INSERT INTO profiles (id, full_name, role, organization_id)
      VALUES (${user.id}, ${user.name || null}, ${type === "contractor" ? "contractor" : "property_manager"}, ${org.id})
      ON CONFLICT (id) DO UPDATE SET full_name = COALESCE(EXCLUDED.full_name, profiles.full_name), role = EXCLUDED.role, organization_id = EXCLUDED.organization_id, updated_at = now()
    `;
    const invite = createAssessmentInviteToken({ organizationId: String(org.id), customerType: organizationType });
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin;
    const checkout = await createSubscriptionCheckout({
      organizationId: String(org.id),
      plan: plan as AnySubscriptionPlan,
      email: user.email || email,
      customerId: typeof org.stripe_customer_id === "string" ? org.stripe_customer_id : null,
      successUrl: `${appUrl}/portal/dashboard?billing=success`,
      cancelUrl: `${appUrl}/portal/${type}?billing=cancelled`,
    });

    return Response.json({
      organizationId: org.id,
      inviteUrl: `${appUrl}/upload?orgInvite=${encodeURIComponent(invite)}`,
      checkoutUrl: checkout.url,
      success: true,
      message: "Organization created; complete payment to activate credits",
    });
  } catch (error) {
    console.error("Onboarding error:", error);
    return Response.json({ error: "Onboarding failed" }, { status: 500 });
  }
}
