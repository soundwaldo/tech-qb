import { createHash, randomBytes } from "crypto";
import type { Assessment, Diagnosis } from "@/types";

export function createVerifiedManifest(params: {
    assessment: Assessment;
    diagnosis: Diagnosis;
    mediaHashes: Array<{ media_type: string; sha256: string }>;
    version: number;
    previousContentHash: string | null;
    verifiedAt: string;
}) {
    const manifest = {
        schema: "ggaurd.report-manifest/1.0",
        record_type: "diagnostic_assessment",
        assessment_id: params.assessment.id,
        diagnosis_id: params.diagnosis.id,
        version: params.version,
        previous_content_hash: params.previousContentHash,
        verified_at: params.verifiedAt,
        inputs: {
            zip_code: params.assessment.zip_code,
            door_type: params.assessment.door_type,
            symptoms: [...params.assessment.problems].sort(),
            evidence: [...params.mediaHashes].sort((a, b) => `${a.media_type}:${a.sha256}`.localeCompare(`${b.media_type}:${b.sha256}`)),
        },
        verified_report: {
            recommendation: params.diagnosis.recommendation,
            confidence: params.diagnosis.confidence,
            summary: params.diagnosis.summary,
            findings: params.diagnosis.findings,
            fair_price_low_cents: params.diagnosis.fair_price_low_cents,
            fair_price_high_cents: params.diagnosis.fair_price_high_cents,
            parts_needed: [...params.diagnosis.parts_needed].sort(),
            questions_for_tech: params.diagnosis.questions_for_tech,
            safety_notes: params.diagnosis.safety_notes,
            limitations: params.diagnosis.limitations,
        },
        refund_policy: {
            eligibility: "Full refund if we cannot provide a diagnosis due to insufficient or unclear photos",
            process: "Contact support with your assessment ID and reason. Refunds processed within 5-7 business days.",
            conditions: "Refund applies when: (1) photos do not show required angles, (2) image quality too poor to analyze, (3) technical issues prevent diagnosis completion",
        },
    };
    const contentHash = createHash("sha256").update(canonicalJson(manifest)).digest("hex");
    return { manifest, contentHash, publicId: randomBytes(10).toString("hex").toUpperCase() };
}

function canonicalJson(value: unknown): string {
    if (value === null || typeof value !== "object") return JSON.stringify(value);
    if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(record[key])}`).join(",")}}`;
}
