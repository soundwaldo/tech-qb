import { z } from "zod";
import { acceptedMediaTypes, uploadLimits } from "./config";

const approvedLogoUrl = z.union([z.literal(""),z.url().refine((value)=>{const host=new URL(value).hostname;return host==="blob.vercelusercontent.com"||host.endsWith(".public.blob.vercel-storage.com")},"Logo must use approved GGuard/Vercel Blob storage")]).optional();

export const slugSchema = z.string().trim().toLowerCase().min(3).max(60).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
export const companySchema = z.object({
  companyName: z.string().trim().min(2).max(120), contactName: z.string().trim().min(2).max(120),
  workEmail: z.email(), notificationEmail: z.email(), phone: z.string().trim().min(7).max(30),
  websiteUrl: z.union([z.url(), z.literal("")]).optional(), logoUrl: approvedLogoUrl,
  brandColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).default("#0f766e"), displayName: z.string().trim().min(2).max(120),
  slug: slugSchema, termsAccepted: z.literal(true),
});

export const mediaDeclarationSchema = z.object({
  originalFilename: z.string().trim().min(1).max(180).refine((v) => !/[\\/]/.test(v), "Filename cannot contain a path"),
  mimeType: z.enum(acceptedMediaTypes), sizeBytes: z.number().int().positive(), type: z.enum(["image", "video"]),
}).superRefine((file, ctx) => {
  if (file.type === "image" && !file.mimeType.startsWith("image/")) ctx.addIssue({ code: "custom", message: "Image type mismatch" });
  if (file.type === "video" && !file.mimeType.startsWith("video/")) ctx.addIssue({ code: "custom", message: "Video type mismatch" });
  const max = file.type === "image" ? uploadLimits.maxPhotoBytes : uploadLimits.maxVideoBytes;
  if (file.sizeBytes > max) ctx.addIssue({ code: "custom", message: "File is too large" });
  const extension=file.originalFilename.toLowerCase().match(/\.[a-z0-9]+$/)?.[0];const permitted:Record<string,string[]>={"image/jpeg":[".jpg",".jpeg"],"image/png":[".png"],"image/webp":[".webp"],"image/heic":[".heic",".heif"],"video/mp4":[".mp4"],"video/quicktime":[".mov"],"video/webm":[".webm"]};if(!extension||!permitted[file.mimeType]?.includes(extension))ctx.addIssue({code:"custom",message:"Filename extension does not match the media type"});
});

export const intakeSchema = z.object({
  sessionToken: z.string().min(20), idempotencyKey: z.uuid(), honeypot: z.literal("").optional(),
  firstName: z.string().trim().min(1).max(80), lastName: z.string().trim().min(1).max(80), mobilePhone: z.string().trim().min(7).max(30),
  email: z.union([z.email(), z.literal("")]).optional(), serviceAddress1: z.string().trim().min(3).max(180), serviceAddress2: z.string().trim().max(100).optional(),
  city: z.string().trim().min(2).max(100), state: z.string().trim().length(2).transform((v) => v.toUpperCase()), postalCode: z.string().regex(/^\d{5}(?:-\d{4})?$/),
  preferredContactMethod: z.enum(["phone", "text", "email"]).optional(), preferredTiming: z.string().max(100).optional(),
  problemDescription: z.string().trim().min(10).max(3000),
  consentAccepted: z.literal(true), aiProcessingConsent: z.literal(true),
  mediaAssetIds: z.array(z.uuid()).min(1).max(uploadLimits.maxPhotos + uploadLimits.maxVideos)
    .refine((ids) => new Set(ids).size === ids.length, "Media assets must be unique"),
}).superRefine((input, context) => {
  if (input.preferredContactMethod === "email" && !input.email) {
    context.addIssue({ code: "custom", path: ["email"], message: "Enter an email address when email is your preferred contact method" });
  }
});

export function normalizePhone(value: string) { const digits = value.replace(/\D/g, ""); return digits.length === 10 ? `+1${digits}` : `+${digits}`; }
export function normalizeEmail(value?: string) { return value?.trim().toLowerCase() || null; }
