import { z } from "zod";
import { createPresignedUpload, buildStorageKey } from "@/lib/storage";
import { getSessionTokenFromCookie } from "@/lib/session-middleware";
import { checkRateLimit, RateLimits } from "@/lib/rate-limit";

const requestSchema = z.object({
    fileName: z.string().min(1).max(120),
    contentType: z.enum(["image/jpeg", "image/png", "image/webp", "video/mp4", "video/quicktime", "video/webm", "application/pdf"]),
    sizeBytes: z.number().int().positive().max(75 * 1024 * 1024),
    mediaType: z.enum(["photo", "video", "quote_pdf", "quote_image"]),
});

export async function POST(request: Request) {
    const sessionToken = await getSessionTokenFromCookie();
    if (!sessionToken) return Response.json({ error: "Session token missing. Please initialize session." }, { status: 401 });
    const rate = await checkRateLimit(RateLimits.upload);
    if (!rate.allowed) return Response.json({ error: "Upload limit reached" }, { status: 429 });

    const parsed = requestSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return Response.json({ error: "Unsupported file or invalid upload request" }, { status: 400 });
    const { fileName, contentType, mediaType } = parsed.data;
    const storageKey = buildStorageKey({ sessionToken, fileName, mediaType });
    // Increased from 300s (5 min) to 1800s (30 min) to reduce UX friction on slow connections
    const result = await createPresignedUpload({ storageKey, contentType, expiresIn: 1800 });
    return Response.json({ uploadUrl: result.uploadUrl, storageKey: result.storageKey, expiresIn: result.expiresIn });
}
