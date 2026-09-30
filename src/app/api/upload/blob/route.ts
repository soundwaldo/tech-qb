import { put } from "@vercel/blob";
import { NextRequest, NextResponse } from "next/server";
import { validateFileType } from "@/lib/file-validation";
import { getSessionTokenFromCookie } from "@/lib/session-middleware";
import { checkRateLimit, RateLimits } from "@/lib/rate-limit";

export const runtime = "nodejs";

/**
 * PUT /api/upload/blob
 * Proxies file uploads to Vercel Blob Storage.
 * Validates file type via magic number detection to prevent malware uploads.
 * 
 * Client sends: PUT request with raw file bytes and ?key= and ?type= params
 */
export async function PUT(request: NextRequest) {
    const sessionToken = await getSessionTokenFromCookie();
    if (!sessionToken) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const rate = await checkRateLimit(RateLimits.upload);
    if (!rate.allowed) return NextResponse.json({ error: "Upload limit reached" }, { status: 429 });
    if (!process.env.BLOB_READ_WRITE_TOKEN) {
        return NextResponse.json(
            { error: "Vercel Blob not configured" },
            { status: 500 }
        );
    }

    try {
        const url = new URL(request.url);
        const storageKey = url.searchParams.get("key");
        const contentType = url.searchParams.get("type") || "application/octet-stream";

        if (!storageKey) {
            return NextResponse.json(
                { error: "Missing key query parameter" },
                { status: 400 }
            );
        }
        if (!storageKey.startsWith(`uploads/${sessionToken}/`)) {
            return NextResponse.json({ error: "Invalid upload ownership" }, { status: 403 });
        }

        const maxBytes = 75 * 1024 * 1024;
        const declaredBytes = Number(request.headers.get("content-length") || 0);
        if (declaredBytes > maxBytes) return NextResponse.json({ error: "File exceeds 75 MB" }, { status: 413 });

        // Read raw file bytes from request body
        const buffer = Buffer.from(await request.arrayBuffer());
        if (!buffer.length || buffer.length > maxBytes) return NextResponse.json({ error: "Invalid file size" }, { status: 413 });

        // Validate file type via magic number detection
        try {
            if (!validateFileType(buffer, contentType)) throw new Error("MIME signature mismatch");
        } catch (validationError) {
            console.warn(`File validation failed: ${String(validationError)}`);
            return NextResponse.json(
                { error: "File type mismatch or unsupported format" },
                { status: 400 }
            );
        }

        // Upload to Vercel Blob
        const blob = await put(storageKey, buffer, {
            access: "private",
            contentType,
        });

        return NextResponse.json(
            { url: blob.url, storageKey },
            { status: 200 }
        );
    } catch (error) {
        console.error("Vercel Blob upload failed:", error);
        return NextResponse.json(
            { error: "Upload failed" },
            { status: 500 }
        );
    }
}
