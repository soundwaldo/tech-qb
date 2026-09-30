import { randomBytes, randomUUID } from "node:crypto";
import { getDb } from "@/lib/db";
import { decryptPII, encryptPII } from "@/lib/pii-encryption";
import { signWebhookPayload } from "@/features/pre-dispatch/events";
import { requireTenantManager } from "@/features/pre-dispatch/repository";
import { assertSafeWebhookUrl, postSafeWebhook } from "@/features/pre-dispatch/webhook-security";

export async function GET() {
  try {
    const company = await requireTenantManager();
    const webhooks = await getDb()`SELECT id,endpoint_url,secret_hint,active,created_at,updated_at FROM pre_dispatch_webhook_configs WHERE company_id=${company.id} ORDER BY created_at DESC`;
    return Response.json({ webhooks });
  } catch { return Response.json({ error: "Unauthorized" }, { status: 401 }); }
}

export async function POST(request: Request) {
  try {
    const company = await requireTenantManager();
    const body = await request.json() as { endpointUrl?: string };
    const url = await assertSafeWebhookUrl(String(body.endpointUrl));
    const secret = `whsec_${randomBytes(32).toString("base64url")}`;
    const rows = await getDb()`INSERT INTO pre_dispatch_webhook_configs(id,company_id,endpoint_url,encrypted_secret,secret_hint) VALUES(${randomUUID()},${company.id},${url.toString()},${encryptPII(secret)},${secret.slice(-6)}) RETURNING id,endpoint_url,secret_hint,active`;
    return Response.json({ webhook: rows[0], secret }, { status: 201 });
  } catch (error) { return Response.json({ error: error instanceof Error ? error.message : "Invalid webhook" }, { status: 400 }); }
}

export async function DELETE(request: Request) {
  try {
    const company = await requireTenantManager();
    const id = new URL(request.url).searchParams.get("id");
    const rows = await getDb()`UPDATE pre_dispatch_webhook_configs SET active=false,updated_at=now() WHERE id=${id} AND company_id=${company.id} RETURNING id`;
    return rows[0] ? Response.json({ disabled: true }) : Response.json({ error: "Not found" }, { status: 404 });
  } catch { return Response.json({ error: "Unauthorized" }, { status: 401 }); }
}

export async function PATCH(request: Request) {
  try {
    const company = await requireTenantManager();
    const body = await request.json() as { id?: string; action?: "rotate" | "test" };
    const sql = getDb();
    const rows = await sql`SELECT id,endpoint_url,encrypted_secret FROM pre_dispatch_webhook_configs WHERE id=${body.id} AND company_id=${company.id} AND active=true`;
    const config = rows[0] as { id: string; endpoint_url: string; encrypted_secret: string } | undefined;
    if (!config) throw new Error("Webhook not found");
    if (body.action === "rotate") {
      const secret = `whsec_${randomBytes(32).toString("base64url")}`;
      await sql`UPDATE pre_dispatch_webhook_configs SET encrypted_secret=${encryptPII(secret)},secret_hint=${secret.slice(-6)},updated_at=now() WHERE id=${config.id} AND company_id=${company.id}`;
      return Response.json({ secret });
    }
    if (body.action === "test") {
      const eventId = randomUUID(); const timestamp = String(Math.floor(Date.now() / 1000));
      const payload = JSON.stringify({ eventId, eventType: "predispatch.webhook.test", eventVersion: "1.0", createdAt: new Date().toISOString(), company: { externalReference: company.slug }, sampleData: true });
      const response = await postSafeWebhook(config.endpoint_url,{ "content-type": "application/json", "x-gguard-event-id": eventId, "x-gguard-event-version": "1.0", "x-gguard-timestamp": timestamp, "x-gguard-signature": `sha256=${signWebhookPayload(decryptPII(config.encrypted_secret), timestamp, payload)}` },payload);
      return Response.json({ delivered: response.ok, responseCode: response.status }, { status: response.ok ? 200 : 502 });
    }
    throw new Error("Invalid action");
  } catch (error) { return Response.json({ error: error instanceof Error ? error.message : "Invalid webhook action" }, { status: 400 }); }
}
