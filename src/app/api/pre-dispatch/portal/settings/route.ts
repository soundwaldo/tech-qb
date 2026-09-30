import { getTenantWidgetHealth, requireTenantManager, rotateTenantWidgetKey, updateTenantCompany } from "@/features/pre-dispatch/repository";

export async function GET(){try{const company=await requireTenantManager();return Response.json({health:await getTenantWidgetHealth(company.id)},{headers:{"cache-control":"no-store"}})}catch(error){return Response.json({error:error instanceof Error?error.message:"Unauthorized"},{status:401})}}

export async function PATCH(request: Request) {
  try {
    const company = await requireTenantManager();
    const body = await request.json();
    if (body.action === "rotate-widget-key") return Response.json({ publicWidgetKey: await rotateTenantWidgetKey(company.id) });
    return Response.json({ company: await updateTenantCompany(company.id, body) });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Invalid settings" }, { status: 400 });
  }
}
