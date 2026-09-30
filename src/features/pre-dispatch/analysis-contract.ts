import { z } from "zod";

export const preDispatchAnalysisSchema = z.object({
  potentialIssueDescription: z.string().min(20).max(2000),
  urgency: z.enum(["routine", "soon", "high", "emergency_review"]),
  safetyFlags: z.array(z.string().max(180)).max(12),
  evidenceObservations: z.array(z.string().max(300)).max(20),
  equipmentObservations: z.object({
    openerBrand: z.object({ value:z.string().min(1).max(120),confidence:z.number().min(0).max(1),evidence:z.string().max(300) }),
    doorWidthFeet: z.object({ value:z.number().positive().max(40).nullable(),confidence:z.number().min(0).max(1),evidence:z.string().max(300) }),
    fullOpenerRailVisible: z.boolean(),
    allDoorSectionsVisible: z.boolean(),
    visibleSectionCount: z.number().int().min(0).max(12),
    doorHeightFeet: z.object({ value:z.number().positive().max(24).nullable(),confidence:z.number().min(0).max(1),method:z.enum(["visible_label","rail_and_panel_geometry","full_rail_geometry","panel_geometry","unknown"]),evidence:z.string().max(300) }),
    counterbalanceSystem: z.object({ value:z.enum(["standard_torsion","reverse_wound_torsion","wayne_dalton_torquemaster","extension_springs","other","unknown"]),confidence:z.number().min(0).max(1),evidence:z.string().max(300) }),
  }),
  overallConfidence: z.number().min(0).max(1),
  evidenceReferences: z.array(z.object({
    mediaAssetId: z.uuid(),
    observation: z.string().max(300),
  })).max(20),
  limitations: z.array(z.string().max(400)).min(1).max(12),
  technicianVerificationRequired: z.literal(true),
}).superRefine((analysis,context)=>{
  const equipment=analysis.equipmentObservations;const height=equipment.doorHeightFeet;
  if(height.method==="rail_and_panel_geometry"&&(!equipment.fullOpenerRailVisible||!equipment.allDoorSectionsVisible))context.addIssue({code:"custom",path:["equipmentObservations","doorHeightFeet","method"],message:"Rail-and-panel geometry requires the complete rail and all door sections"});
  if(height.method==="full_rail_geometry"&&!equipment.fullOpenerRailVisible)context.addIssue({code:"custom",path:["equipmentObservations","fullOpenerRailVisible"],message:"Full-rail geometry requires the complete rail"});
  if(height.method!=="visible_label"&&height.confidence>=1)context.addIssue({code:"custom",path:["equipmentObservations","doorHeightFeet","confidence"],message:"Only a readable dimension label can be treated as certain"});
  if(height.method==="unknown"&&(height.value!==null||height.confidence>.2))context.addIssue({code:"custom",path:["equipmentObservations","doorHeightFeet"],message:"Unknown height must be null with low confidence"});
});

export type PreDispatchAnalysisResult = z.infer<typeof preDispatchAnalysisSchema>;
export type PreDispatchAnalysisInput = {
  requestId: string;
  media: Array<{ id: string; mimeType: string; filename: string; bytes?: Uint8Array }>;
  customerDescription: string;
};
export interface PreDispatchAnalysisProvider {
  readonly name: string;
  readonly modelVersion: string;
  analyze(input: PreDispatchAnalysisInput): Promise<PreDispatchAnalysisResult>;
}
