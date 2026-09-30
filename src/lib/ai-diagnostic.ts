import { generateText, Output, type UserContent } from "ai";
import { withAiBackup } from "@/lib/ai-provider";
import { z } from "zod";
import { createServiceClient } from "@/lib/neon";
import { readStoredObject } from "@/lib/storage";
import { generateAiDraft } from "@/lib/ai-draft";
import type { Assessment, AssessmentMedia } from "@/types";

export const diagnosticDraftSchema = z.object({
    recommendation: z.enum(["approve", "approve_with_questions", "request_revision", "insufficient_evidence", "safety_escalation"]),
    confidence: z.enum(["low", "medium", "high"]),
    summary: z.string().min(20).max(3000),
    findings: z.array(z.object({ issue: z.string().max(180), severity: z.enum(["low", "medium", "high", "critical"]), explanation: z.string().max(1200), estimated_cost_low_cents: z.number().int().nonnegative().optional(), estimated_cost_high_cents: z.number().int().nonnegative().optional() })).max(12),
    evidence_reviewed: z.array(z.string().max(300)).max(20),
    parts_needed: z.array(z.string().max(240)).max(20),
    fair_price_low_cents: z.number().int().nonnegative().max(10_000_000),
    fair_price_high_cents: z.number().int().nonnegative().max(10_000_000),
    quote_analysis: z.array(z.object({ item: z.string().max(240), quoted_cents: z.number().int().nonnegative().nullable(), assessment: z.enum(["supported", "question", "unsupported"]), note: z.string().max(800) })).max(30),
    questions_for_tech: z.array(z.string().max(500)).max(15),
    safety_notes: z.string().max(2000),
    balance_test_instructions: z.string().max(2500),
    limitations: z.array(z.string().max(500)).min(1).max(12),
});

export type DiagnosticDraft = z.infer<typeof diagnosticDraftSchema>;

export async function createAiDiagnosticDraft(assessmentId: string): Promise<void> {
    let modelVersion = "automated-analysis-unavailable";
    const db = createServiceClient();
    const [{ data: assessmentData }, { data: mediaData }] = await Promise.all([
        db.from("assessments").select("*").eq("id", assessmentId).single(),
        db.from("assessment_media").select("*").eq("assessment_id", assessmentId),
    ]);
    if (!assessmentData) throw new Error("Assessment not found for AI draft");
    const assessment = assessmentData as unknown as Assessment;
    if (!assessment.ai_processing_consent) throw new Error("AI processing consent is required");
    await db.from("assessments").update({ status: "ai_processing" }).eq("id", assessmentId);

    try {
        const media = (Array.isArray(mediaData) ? mediaData : []) as unknown as AssessmentMedia[];
        const supportedMedia = media.filter((item) => item.content_type.startsWith("image/") || item.content_type === "application/pdf");
        const evidence = await Promise.all(supportedMedia.map(async (item) => ({ item, bytes: await readStoredObject(item.storage_key) })));
        const content: UserContent = [
            { type: "text", text: buildCaseContext(assessment, media) },
            ...evidence.map(({ item, bytes }) => ({ type: "file" as const, data: bytes, mediaType: item.content_type, filename: item.file_name })),
        ];
        const generation = await withAiBackup("diagnostic", (config) => generateText({
            ...config,
            maxRetries: 0,
            output: Output.object({ schema: diagnosticDraftSchema }),
            instructions: SYSTEM_INSTRUCTIONS,
            messages: [{ role: "user", content }],
            maxOutputTokens: 6000,
            abortSignal: AbortSignal.timeout(50_000),
        }));
        modelVersion = `${generation.provider}:${generation.modelVersion}`;
        const draft = generation.result.output;
        if (!draft) throw new Error("AI returned no structured draft");
        await db.from("diagnoses").upsert({
            assessment_id: assessmentId, ...draft, ai_draft: JSON.stringify(draft), ai_draft_used: false,
            ai_model: modelVersion, ai_generated_at: new Date().toISOString(), ai_error: null,
        }, { onConflict: "assessment_id" });
        await db.from("assessments").update({ status: "awaiting_expert_review" }).eq("id", assessmentId);
    } catch (error) {
        const fallback = generateAiDraft(assessment.problems, assessment.description);
        const message = error instanceof Error ? error.message.slice(0, 500) : "Unknown AI generation error";
        await db.from("diagnoses").upsert({
            assessment_id: assessmentId, ...fallback, recommendation: "insufficient_evidence", confidence: "low",
            quote_analysis: [], limitations: ["Automated media analysis was unavailable; expert review of all evidence is required."],
            ai_draft: JSON.stringify(fallback), ai_draft_used: false, ai_model: modelVersion,
            ai_generated_at: new Date().toISOString(), ai_error: message,
        }, { onConflict: "assessment_id" });
        await db.from("assessments").update({ status: "awaiting_expert_review" }).eq("id", assessmentId);
    }
}

function buildCaseContext(assessment: Assessment, media: AssessmentMedia[]): string {
    return JSON.stringify({
        case_reference: assessment.id, customer_type: assessment.customer_type, zip_code: assessment.zip_code,
        door_type: assessment.door_type, reported_symptoms: assessment.problems,
        customer_description: assessment.description || "Not provided", contractor_quote_cents: assessment.contractor_quote_cents,
        evidence_inventory: media.map((item) => ({ type: item.media_type, filename: item.file_name, content_type: item.content_type })),
        note: media.some((item) => item.media_type === "video") ? "Video is available for mandatory human review but is not represented in the attached still-image evidence." : undefined,
    });
}

const SYSTEM_INSTRUCTIONS = `You create a DRAFT garage-door diagnostic consultation for mandatory review by a qualified GGuard human expert. Never claim certainty from incomplete remote evidence. Never instruct a customer to adjust, wind, remove, or touch springs, cables, drums, brackets, or components under tension. Distinguish visible evidence from inference. If evidence is insufficient, use insufficient_evidence. If an off-track door, broken spring/cable, unsupported door, or collapse risk is possible, use safety_escalation and tell the customer to stop operation and seek an on-site professional. Analyze contractor quote items only when visible or supplied. Prices are educational estimates, not guarantees. Do not identify people, infer sensitive traits, or repeat incidental personal information from media. Include limitations. The output is an internal draft and must not address the customer as though it has been verified.`;
