import { checkRateLimit, RateLimits } from "@/lib/rate-limit";
import { preDispatchFlags, uploadLimits, acceptedMediaTypes } from "@/features/pre-dispatch/config";
import { createUploadSession, findPublicCompany } from "@/features/pre-dispatch/repository";
import { createEmbedToken, createUploadToken } from "@/features/pre-dispatch/security";
import { slugSchema } from "@/features/pre-dispatch/schemas";

export async function POST(request: Request) {
  if (!preDispatchFlags.enabled || !preDispatchFlags.submissions) return Response.json({ error: "Pre-Dispatch submissions are unavailable" }, { status: 404 });
  const rate = await checkRateLimit({ ...RateLimits.public, limit: 20 }); if (!rate.allowed) return Response.json({ error: "Too many attempts" }, { status: 429 });
  try {
    const body = await request.json() as { companySlug?: string; widgetKey?: string; embed?: boolean }; const identifier = body.widgetKey || slugSchema.parse(body.companySlug);
    const company = await findPublicCompany(identifier); if (!company) return Response.json({ error: "Widget unavailable" }, { status: 404 });
    const origin = request.headers.get("origin"); const allowed = (company as CompanyWithOrigins).allowed_origins || [];
    if (body.embed && (!origin || !allowed.length || !allowed.includes(origin))) return Response.json({ error: "Origin not allowed" }, { status: 403 });
    const session = await createUploadSession(company,body.embed?origin:null); const response=Response.json({ sessionId: session.id, sessionToken: createUploadToken(company.id, session.id, session.expiresAt), embedToken:body.embed&&origin?createEmbedToken(company.id,session.id,company.slug,origin,session.expiresAt):null,idempotencyKey: session.idempotencyKey, expiresAt: session.expiresAt.toISOString(), company: { slug:company.slug,displayName: company.display_name, logoUrl: company.logo_url, brandColor: company.brand_color, phone: company.phone,welcomeMessage:company.welcome_message,launcherCopy:company.launcher_copy,launcherPosition:company.launcher_position }, limits: uploadLimits, supportedMediaTypes: acceptedMediaTypes });if(body.embed&&origin)response.headers.set("access-control-allow-origin",origin);response.headers.set("cache-control","no-store");response.headers.set("vary","Origin");return response;
  } catch { return Response.json({ error: "Invalid widget configuration" }, { status: 400 }); }
}
type CompanyWithOrigins = { allowed_origins?: string[] };
export async function GET(request:Request){if(!preDispatchFlags.enabled||!preDispatchFlags.submissions)return Response.json({error:"Unavailable"},{status:404});const rate=await checkRateLimit({...RateLimits.public,limit:60});if(!rate.allowed)return Response.json({error:"Too many attempts"},{status:429});try{const url=new URL(request.url);const company=await findPublicCompany(String(url.searchParams.get("widgetKey")||""));if(!company)return Response.json({error:"Widget unavailable"},{status:404});const origin=request.headers.get("origin");const allowed=(company as CompanyWithOrigins).allowed_origins||[];if(!origin||!allowed.includes(origin))return Response.json({error:"Origin not allowed"},{status:403});const response=Response.json({slug:company.slug,displayName:company.display_name,brandColor:company.brand_color,launcherCopy:company.launcher_copy,launcherPosition:company.launcher_position});response.headers.set("access-control-allow-origin",origin);response.headers.set("vary","Origin");return response}catch{return Response.json({error:"Invalid widget configuration"},{status:400})}}
export async function OPTIONS(){return new Response(null,{status:204,headers:{"access-control-allow-methods":"GET, POST, OPTIONS","access-control-max-age":"600","vary":"Origin"}})}
