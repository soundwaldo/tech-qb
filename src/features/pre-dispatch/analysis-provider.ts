import "server-only";
import { generateText, Output, type UserContent } from "ai";
import { readStoredObject } from "@/lib/storage";
import { withAiBackup } from "@/lib/ai-provider";
import { preDispatchAnalysisSchema, type PreDispatchAnalysisInput, type PreDispatchAnalysisProvider } from "./analysis-contract";

export class GatewayPreDispatchAnalysisProvider implements PreDispatchAnalysisProvider {
  name = "vercel-ai-gateway";
  modelVersion = "not-generated";

  async analyze(input: PreDispatchAnalysisInput) {
    const content: UserContent = [
      { type: "text", text: JSON.stringify({
        requestId: input.requestId,
        customerDescription: input.customerDescription,
        mediaInventory: input.media.map(m => ({ id: m.id, mimeType: m.mimeType, filename: m.filename })),
        note: "Video files remain available for human review. Only attached image evidence may be visually analyzed.",
      }) },
      ...input.media.filter(m => m.mimeType.startsWith("image/") && m.bytes).map(m => ({
        type: "file" as const, data: m.bytes!, mediaType: m.mimeType, filename: m.filename,
      })),
    ];
    const generation = await withAiBackup("pre-dispatch", config => generateText({
      ...config,
      maxRetries: 0,
      output: Output.object({ schema: preDispatchAnalysisSchema }),
      instructions: SYSTEM,
      messages: [{ role: "user", content }],
      maxOutputTokens: 2500,
      abortSignal: AbortSignal.timeout(50_000),
    }));
    if (!generation.result.output) throw new Error("AI returned no structured analysis");
    this.name = generation.provider;
    this.modelVersion = generation.modelVersion;
    return generation.result.output;
  }
}
export async function loadAnalysisMedia(rows:Array<{id:string;storage_key:string;mime_type:string;original_filename:string}>){return Promise.all(rows.map(async row=>({id:row.id,mimeType:row.mime_type,filename:row.original_filename,bytes:row.mime_type.startsWith("image/")?await readStoredObject(row.storage_key):undefined})))}
const SYSTEM=`Describe what the customer-provided garage-door evidence may indicate for a dispatcher and qualified technician. Identify the opener brand only from a visible logo, label, or unmistakable housing; otherwise use unknown. Record whether the complete opener rail is visible, whether all horizontal door sections are visible, and the visible section count. Use rail_and_panel_geometry when the motor head, complete rail, header connection, full door opening, and all door sections are visible; combine rail geometry, section count and proportions, and opening geometry to select a likely nominal height such as 7, 8, or 10 feet. This combined method may receive high confidence up to 0.95 when all cues agree, but remains an estimate. Use full_rail_geometry at 0.80 or greater when the complete rail and opening relationship are visible but not all sections. A readable manufacturer or dimension label uses visible_label and is the only method eligible for 1.0 confidence. Panel-only inference uses panel_geometry and must remain below 0.80 unless another reliable scale cue is visible. Otherwise return null with method unknown and confidence no greater than 0.20. Estimate door width only when the full opening and useful scale cues are visible. Classify the counterbalance system as standard torsion, reverse-wound torsion, Wayne Dalton TorqueMaster, extension springs, other, or unknown only from visible evidence. Every equipment observation must include independent confidence and evidence. Never claim certainty or a verified diagnosis. Do not recommend parts, tools, inventory, repair procedures, pricing, or appointment duration. Never instruct a customer to touch springs, cables, drums, brackets, or another tensioned or unstable component. Surface safety concerns and urgency without exaggeration. If evidence is insufficient, say so and use low confidence. Technician verification is always required. Do not identify people or infer sensitive traits from media.`;
