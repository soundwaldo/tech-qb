import { createClient, createServiceClient } from "@/lib/neon";

export async function GET() {
  try {
    const auth = await createClient();
    const { data: { user } } = await auth.auth.getUser();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const service = createServiceClient();
    const { data: profile } = await service.from("profiles").select("organization_id").eq("id", user.id).single();
    if (!profile?.organization_id) return Response.json({ hasOrganization: false, organizationExists: false }, { status: 200 });

    const { data: org } = await service.from("organizations")
      .select("id, customer_type, subscription_plan, subscription_status, report_credits")
      .eq("id", profile.organization_id)
      .eq("customer_type", "contractor")
      .single();
    const active = !!org && ["active", "trialing"].includes(String(org.subscription_status));
    return Response.json({ hasOrganization: active, organizationExists: !!org, subscriptionStatus: org?.subscription_status ?? null, reportCredits: org?.report_credits ?? 0 }, { status: 200 });
  } catch (error) {
    console.error("Contractor organization check error:", error);
    return Response.json({ error: "Check failed" }, { status: 500 });
  }
}
