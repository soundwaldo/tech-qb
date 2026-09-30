import { createHash } from "crypto";

/**
 * SHA-256 hash of a string (server-side).
 */
export function sha256(input: string): string {
    return createHash("sha256").update(input, "utf8").digest("hex");
}

/**
 * Build the verifiable content hash for a maintenance record.
 * Combines media hashes + diagnosis payload into a single proof.
 */
export function buildContentHash(params: {
    mediaHashes: string[];
    summary: string;
    findings: unknown;
    fairPriceLow: number;
    fairPriceHigh: number;
    partsNeeded: string[];
    assessmentId: string;
}): string {
    const payload = JSON.stringify({
        media: [...params.mediaHashes].sort(),
        summary: params.summary,
        findings: params.findings,
        fair_price_low_cents: params.fairPriceLow,
        fair_price_high_cents: params.fairPriceHigh,
        parts_needed: [...params.partsNeeded].sort(),
        assessment_id: params.assessmentId,
    });
    return sha256(payload);
}

/**
 * Browser-side SHA-256 for file hashing before upload.
 */
export async function sha256Browser(buffer: ArrayBuffer): Promise<string> {
    const hashBuffer = await crypto.subtle.digest("SHA-256", buffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}
