import { createPresignedUpload, isDirectObjectStorageConfigured, verifyStoredObject } from "@/lib/storage";
import { checkRateLimit, RateLimits } from "@/lib/rate-limit";
import { scanPreDispatchMedia } from "@/features/pre-dispatch/malware-scanner";
import { preDispatchFlags } from "@/features/pre-dispatch/config";
import { mediaDeclarationSchema } from "@/features/pre-dispatch/schemas";
import { verifyUploadToken, safeFilename } from "@/features/pre-dispatch/security";
import { registerMedia, markMediaUploaded } from "@/features/pre-dispatch/repository";

export const maxDuration = 120;

function token(request: Request) { const value = request.headers.get("authorization"); if (!value?.startsWith("Bearer ")) throw new Error("Missing token"); return verifyUploadToken(value.slice(7)); }
export async function POST(request: Request) {
  if (!preDispatchFlags.enabled || !preDispatchFlags.submissions) return Response.json({ error: "Unavailable" }, { status: 404 });
  if (process.env.NODE_ENV === "production" && !isDirectObjectStorageConfigured()) return Response.json({ error: "Uploads are temporarily unavailable" }, { status: 503 });
  const rate = await checkRateLimit(RateLimits.upload); if (!rate.allowed) return Response.json({ error: "Upload limit reached" }, { status: 429 });
  try { const claims = token(request); const file = mediaDeclarationSchema.parse(await request.json());if(!claims.mediaTypes.includes(file.mimeType)||file.sizeBytes>(file.type==="image"?claims.maxPhotoBytes:claims.maxVideoBytes))throw new Error("File is outside this upload token's policy"); const safe = safeFilename(file.originalFilename); const storageKey = `pre-dispatch/${claims.cid}/${claims.sid}/${safe}`;
    const asset = await registerMedia({ companyId: claims.cid, sessionId: claims.sid, type: file.type, storageKey, originalFilename: file.originalFilename, safeFilename: safe, mimeType: file.mimeType, sizeBytes: file.sizeBytes });
    const upload = await createPresignedUpload({ storageKey, contentType: file.mimeType, expiresIn: 600 }); const usesBlobProxy=!isDirectObjectStorageConfigured()&&Boolean(process.env.BLOB_READ_WRITE_TOKEN);const uploadUrl=usesBlobProxy?`/api/pre-dispatch/uploads/content?asset=${asset.id}`:upload.uploadUrl;return Response.json({ mediaAssetId: asset.id, uploadUrl, uploadHeaders:usesBlobProxy?{authorization:request.headers.get("authorization")}:undefined, expiresIn: upload.expiresIn });
  } catch (error) { return Response.json({ error: error instanceof Error ? error.message : "Invalid upload" }, { status: 400 }); }
}
export async function PATCH(request: Request) {
  if (!preDispatchFlags.enabled || !preDispatchFlags.submissions) return Response.json({ error: "Unavailable" }, { status: 404 });
  if (process.env.NODE_ENV === "production" && !isDirectObjectStorageConfigured()) return Response.json({ error: "Uploads are temporarily unavailable" }, { status: 503 });
  try {
    const claims = token(request);
    const rate = await checkRateLimit({ ...RateLimits.upload, namespace: "predispatch:verify" });
    if (!rate.allowed) return Response.json({ error: "Verification limit reached" }, { status: 429 });
    const body = await request.json() as { mediaAssetId?: string };
    if (!body.mediaAssetId) throw new Error("mediaAssetId is required");
    const rows = await (await import("@/lib/db")).getDb()`SELECT storage_key,mime_type,size_bytes,type,processing_status,sha256,malware_scan_status FROM pre_dispatch_media_assets WHERE id=${body.mediaAssetId} AND company_id=${claims.cid} AND upload_session_id=${claims.sid} AND processing_status IN ('pending','verified') LIMIT 1`;
    const asset = rows[0];
    if (!asset) throw new Error("Media does not belong to this upload session");
    if (asset.processing_status === "verified" && asset.malware_scan_status === "clean" && asset.sha256) {
      return Response.json({ verified: true, sha256: asset.sha256 });
    }
    const maxBytes = asset.type === "image" ? claims.maxPhotoBytes : claims.maxVideoBytes;
    const verified = await verifyStoredObject({ storageKey: String(asset.storage_key), expectedBytes: Number(asset.size_bytes), expectedMimeType: String(asset.mime_type), maxBytes });
    const scan = await scanPreDispatchMedia({ storageKey: String(asset.storage_key), sha256: verified.sha256, sizeBytes: verified.sizeBytes, mimeType: verified.contentType });
    await markMediaUploaded(body.mediaAssetId, claims.cid, claims.sid, verified.sha256, scan.provider);
    return Response.json({ verified: true, sha256: verified.sha256 });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Invalid upload" }, { status: 400 });
  }
}
