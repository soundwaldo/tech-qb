import "server-only";
import {
    S3Client,
    PutObjectCommand,
    GetObjectCommand,
    DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { fromTemporaryCredentials } from "@aws-sdk/credential-providers";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { del, get } from "@vercel/blob";
import { MediaType } from "@/types";
import { v4 as uuidv4 } from "uuid";
import { createHash } from "crypto";
import { validateFileType } from "@/lib/file-validation";
import { getMockObject } from "@/features/pre-dispatch/mock-storage";

function hasR2Configuration(): boolean {
    return Boolean(
        process.env.R2_ENDPOINT &&
        process.env.R2_ACCESS_KEY_ID &&
        process.env.R2_SECRET_ACCESS_KEY &&
        process.env.R2_BUCKET
    );
}

function hasS3Configuration(): boolean {
    return Boolean(
        process.env.AWS_ACCESS_KEY_ID &&
        process.env.AWS_SECRET_ACCESS_KEY &&
        process.env.S3_BUCKET &&
        process.env.AWS_REGION
    );
}

function usesObjectStorage(): boolean {
    return hasR2Configuration() || hasS3Configuration();
}

export function isDirectObjectStorageConfigured(): boolean {
    return usesObjectStorage();
}

function getS3Client(): S3Client {
    const endpoint = process.env.R2_ENDPOINT || process.env.S3_ENDPOINT;
    const region = process.env.R2_REGION || process.env.AWS_REGION || "auto";
    const accessKeyId =
        process.env.R2_ACCESS_KEY_ID || process.env.AWS_ACCESS_KEY_ID || "";
    const secretAccessKey =
        process.env.R2_SECRET_ACCESS_KEY || process.env.AWS_SECRET_ACCESS_KEY || "";
    const sessionToken = process.env.AWS_SESSION_TOKEN;
    const roleArn = process.env.AWS_ROLE_ARN;
    const directCredentials = {
        accessKeyId,
        secretAccessKey,
        ...(sessionToken ? { sessionToken } : {}),
    };
    const credentials =
        roleArn && !hasR2Configuration()
            ? fromTemporaryCredentials({
                  masterCredentials: directCredentials,
                  clientConfig: { region },
                  params: {
                      RoleArn: roleArn,
                      RoleSessionName: "gguard-vercel-storage",
                      DurationSeconds: 3600,
                  },
              })
            : accessKeyId
              ? directCredentials
              : undefined;

    return new S3Client({
        region,
        endpoint: endpoint || undefined,
        credentials,
        forcePathStyle: Boolean(endpoint), // required for R2 / MinIO
    });
}

function getBucket(): string {
    return (
        process.env.R2_BUCKET ||
        process.env.S3_BUCKET ||
        "gguard-media"
    );
}

export function isStorageConfigured(): boolean {
    // R2/S3 direct uploads take precedence. Blob remains a legacy fallback.
    return usesObjectStorage() || Boolean(process.env.BLOB_READ_WRITE_TOKEN);
}

/**
 * Build a private storage key for an upload.
 */
export function buildStorageKey(params: {
    sessionToken: string;
    mediaType: MediaType;
    fileName: string;
}): string {
    const ext = params.fileName.includes(".")
        ? params.fileName.split(".").pop()
        : "bin";
    const safe = params.fileName
        .replace(/[^a-zA-Z0-9._-]/g, "_")
        .slice(0, 64);
    return `uploads/${params.sessionToken}/${params.mediaType}/${uuidv4()}-${safe}.${ext}`;
}

/**
 * Generate a presigned PUT URL for direct browser → storage upload.
 * For Vercel Blob: returns an API endpoint the client calls.
 * For S3/R2: returns a presigned URL.
 * For dev: returns a mock URL.
 */
export async function createPresignedUpload(params: {
    storageKey: string;
    contentType: string;
    expiresIn?: number;
}): Promise<{ uploadUrl: string; storageKey: string; expiresIn: number }> {
    const expiresIn = params.expiresIn ?? 600; // 10 min

    if (!isStorageConfigured()) {
        // Dev mock: return a fake URL the client can "upload" to (API will accept)
        return {
            uploadUrl: `/api/upload/mock?key=${encodeURIComponent(params.storageKey)}`,
            storageKey: params.storageKey,
            expiresIn,
        };
    }

    // A complete R2/S3 configuration always wins so large uploads bypass Vercel.
    if (usesObjectStorage()) {
        const client = getS3Client();
        const command = new PutObjectCommand({
            Bucket: getBucket(),
            Key: params.storageKey,
            ContentType: params.contentType,
        });

        const uploadUrl = await getSignedUrl(client, command, { expiresIn });
        return { uploadUrl, storageKey: params.storageKey, expiresIn };
    }

    if (process.env.BLOB_READ_WRITE_TOKEN) {
        return {
            uploadUrl: `/api/upload/blob?key=${encodeURIComponent(params.storageKey)}&type=${encodeURIComponent(params.contentType)}`,
            storageKey: params.storageKey,
            expiresIn,
        };
    }

    throw new Error("Private upload storage is not configured");
}

/**
 * Generate a short-lived URL for viewing media (GET).
 * For Vercel Blob: returns the direct blob URL.
 * For S3/R2: returns a presigned URL.
 */
export async function createPresignedDownload(
    storageKey: string,
    expiresIn = 3600
): Promise<string> {
    if (!isStorageConfigured()) {
        return `/api/upload/mock?key=${encodeURIComponent(storageKey)}&download=1`;
    }

    // Private Blob content must never be exposed as a reconstructed public URL.
    if (!usesObjectStorage() && process.env.BLOB_READ_WRITE_TOKEN) {
        throw new Error("Private Blob evidence must be read server-side with readStoredObject");
    }

    // Fall back to S3/R2
    const client = getS3Client();
    const command = new GetObjectCommand({
        Bucket: getBucket(),
        Key: storageKey,
    });
    return getSignedUrl(client, command, { expiresIn });
}

export async function readStoredObject(storageKey: string): Promise<Uint8Array> {
    if (!usesObjectStorage() && process.env.BLOB_READ_WRITE_TOKEN) {
        const result = await get(storageKey, { access: "private" });
        if (!result || result.statusCode !== 200 || !result.stream) throw new Error(`Stored evidence is missing: ${storageKey}`);
        return new Uint8Array(await new Response(result.stream).arrayBuffer());
    }
    if (!isStorageConfigured()) throw new Error("Private storage is not configured");
    const response = await getS3Client().send(new GetObjectCommand({ Bucket: getBucket(), Key: storageKey }));
    if (!response.Body) throw new Error(`Stored evidence is missing: ${storageKey}`);
    return response.Body.transformToByteArray();
}

export async function hashStoredObject(storageKey: string): Promise<string> {
    if (!isStorageConfigured()) {
        return createHash("sha256").update(`development:${storageKey}`).digest("hex");
    }

    const bytes = await readStoredObject(storageKey);
    return createHash("sha256").update(bytes).digest("hex");
}

export async function verifyStoredObject(params:{storageKey:string;expectedBytes:number;expectedMimeType:string;maxBytes:number}):Promise<{sha256:string;sizeBytes:number;contentType:string}>{
    let bytes:Uint8Array;let contentType=params.expectedMimeType;
    if(!isStorageConfigured()){
        const mock=getMockObject(params.storageKey);if(!mock)throw new Error("Uploaded object is missing");bytes=mock.bytes;contentType=mock.contentType;
        if(!bytes.length||bytes.length>params.maxBytes||bytes.length!==params.expectedBytes)throw new Error("Stored object size does not match its declaration");
        if(contentType!==params.expectedMimeType||!validateFileType(Buffer.from(bytes),params.expectedMimeType))throw new Error("Stored file type is invalid");
        return{sha256:createHash("sha256").update(bytes).digest("hex"),sizeBytes:bytes.length,contentType};
    }
    if(!usesObjectStorage())throw new Error("Pre-Dispatch production uploads require private R2/S3 direct storage");
    const response=await getS3Client().send(new GetObjectCommand({Bucket:getBucket(),Key:params.storageKey}));
    if(!response.Body)throw new Error("Uploaded object is missing");
    contentType=response.ContentType||"";
    if(contentType!==params.expectedMimeType)throw new Error("Stored content type does not match its declaration");
    const hash=createHash("sha256");let sizeBytes=0;let prefix=Buffer.alloc(0);
    for await(const chunk of response.Body as AsyncIterable<Uint8Array>){sizeBytes+=chunk.byteLength;if(sizeBytes>params.maxBytes)throw new Error("Stored object exceeds its configured limit");hash.update(chunk);if(prefix.length<512)prefix=Buffer.concat([prefix,Buffer.from(chunk)]).subarray(0,512)}
    if(!sizeBytes||sizeBytes!==params.expectedBytes)throw new Error("Stored object size does not match its declaration");
    if(!validateFileType(prefix,params.expectedMimeType))throw new Error("Stored file signature is invalid");
    return{sha256:hash.digest("hex"),sizeBytes,contentType};
}

export async function deleteStoredObject(storageKey:string){
    if(!isStorageConfigured())return;
    if(!usesObjectStorage()&&process.env.BLOB_READ_WRITE_TOKEN){await del(storageKey);return}
    await getS3Client().send(new DeleteObjectCommand({Bucket:getBucket(),Key:storageKey}));
}
