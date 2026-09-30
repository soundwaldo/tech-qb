import { randomBytes, randomUUID } from "node:crypto";

export function newInternalId() { return randomUUID(); }
export function newPublicReference() {
  const alphabet = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
  const bytes = randomBytes(6);
  return `GG-${Array.from(bytes, (byte) => alphabet[byte % alphabet.length]).join("")}`;
}
export function buildIntakeSummary(input: { description: string; mediaCount: number }) {
  const description = input.description.trim().replace(/\s+/g, " ");
  return `Customer description: ${description} ${input.mediaCount} media item${input.mediaCount === 1 ? " was" : "s were"} submitted. Technician verification is required.`;
}
export function assertTenant(recordCompanyId: string, actorCompanyId: string) {
  if (recordCompanyId !== actorCompanyId) throw new Error("Tenant access denied");
}
