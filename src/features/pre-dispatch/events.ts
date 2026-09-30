import { createHmac, timingSafeEqual } from "node:crypto";

export type PreDispatchEvent = {
  eventId: string;
  eventType: "predispatch.request.created" | "predispatch.request.analyzed" | "predispatch.analysis.failed";
  eventVersion: "1.0";
  createdAt: string;
  company: { externalReference: string };
  request: { id: string; publicReference: string; status: string };
  customer: { name: string; phone: string; email: string | null };
  serviceLocation: { address1: string; address2: string | null; city: string; state: string; postalCode: string };
  intake: { description: string };
  analysis: null | { id: string; potentialIssueDescription: string; urgency: string; confidence: number; safetyFlags: string[]; evidenceObservations: string[];equipmentObservations:Record<string,unknown>; limitations: string[]; technicianVerificationRequired: true };
  maintenanceRecord: { id: string; status: "technician_verification_pending" };
  media: { photoCount: number; videoCount: number };
};

export function signWebhookPayload(secret: string, timestamp: string, body: string) { return createHmac("sha256", secret).update(`${timestamp}.${body}`).digest("hex"); }
export function verifyWebhookSignature(secret: string, timestamp: string, body: string, signature: string, now = Date.now()) {
  if (Math.abs(now - Number(timestamp) * 1000) > 300_000) return false;
  const expected = Buffer.from(signWebhookPayload(secret, timestamp, body)); const actual = Buffer.from(signature.replace(/^sha256=/, ""));
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
export function retryDelayMs(attempt: number) { return Math.min(60 * 60_000, Math.max(30_000, 30_000 * 2 ** Math.max(0, attempt - 1))); }
