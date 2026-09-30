import { checkRateLimit, RateLimits } from "@/lib/rate-limit";
import { after } from "next/server";
import { preDispatchFlags } from "@/features/pre-dispatch/config";
import { verifyUploadToken } from "@/features/pre-dispatch/security";
import { finalizeRequest } from "@/features/pre-dispatch/repository";
import { drainPreDispatchOutbox } from "@/features/pre-dispatch/worker";

export const maxDuration = 300;

export async function POST(request: Request) {
  if (!preDispatchFlags.enabled || !preDispatchFlags.submissions) return Response.json({ error: "Unavailable" }, { status: 404 });
  const rate = await checkRateLimit(RateLimits.assessment); if (!rate.allowed) return Response.json({ error: "Submission limit reached" }, { status: 429 });
  try { const body = await request.json(); if (body.honeypot) return Response.json({ accepted: true }); const claims = verifyUploadToken(String(body.sessionToken || "")); const result = await finalizeRequest(body, claims.cid, claims.sid);
    if(!result.duplicate&&preDispatchFlags.worker)after(async()=>{try{await drainPreDispatchOutbox()}catch(error){console.error("[pre-dispatch] Immediate workflow processing failed; recovery cron will retry.",error)}});
    return Response.json({ requestId: result.id, publicReference: result.public_reference, customerStatusUrl:`/pre-dispatch/status/${encodeURIComponent(result.customerAccessToken)}`, duplicate: result.duplicate }, { status: result.duplicate ? 200 : 201 });
  } catch (error) { return Response.json({ error: error instanceof Error ? error.message : "Submission failed" }, { status: 400 }); }
}
