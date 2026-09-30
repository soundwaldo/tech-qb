import { createClient, createServiceClient } from "@/lib/neon";

export async function GET() {
  try {
    const auth = await createClient();
    const { data: { user } } = await auth.auth.getUser();

    if (!user) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const service = createServiceClient();

    // Get user's profile to find organization
    const { data: profile } = await service
      .from("profiles")
      .select("organization_id")
      .eq("id", user.id)
      .single();

    if (!profile?.organization_id) {
      return Response.json({ hasOrganization: false }, { status: 200 });
    }

    // Verify it's a PM organization
    const { data: org } = await service
      .from("organizations")
      .select("id, subscription_plan, subscription_status, report_credits")
      .eq("id", profile.organization_id)
      .in("subscription_plan", ["pm_starter", "pm_professional", "pm_enterprise"])
      .single();

    const active = !!org && ["active", "trialing"].includes(String(org.subscription_status));
    return Response.json({ hasOrganization: active, organizationExists: !!org, subscriptionStatus: org?.subscription_status ?? null, reportCredits: org?.report_credits ?? 0 }, { status: 200 });
  } catch (error) {
    console.error("Organization check error:", error);
    return Response.json({ error: "Check failed" }, { status: 500 });
  }
}
