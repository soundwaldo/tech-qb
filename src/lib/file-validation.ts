/**
 * Detects file type from buffer using magic numbers (file signatures)
 * Returns detected MIME type or null if unknown
 */
export function detectFileType(buffer: Buffer): string | null {
    // Check for JPEG
    if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
        return "image/jpeg";
    }

    // Check for PNG
    if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47) {
        return "image/png";
    }

    // Check for WebP
    if (
        buffer[0] === 0x52 &&
        buffer[1] === 0x49 &&
        buffer[2] === 0x46 &&
        buffer[3] === 0x46 &&
        buffer[8] === 0x57 &&
        buffer[9] === 0x45 &&
        buffer[10] === 0x42 &&
        buffer[11] === 0x50
    ) {
        return "image/webp";
    }

    // Check for HEIC/HEIF before generic ISO base media (MP4)
    if (buffer.length > 12 && buffer.subarray(4, 8).toString("ascii") === "ftyp") {
        const brand = buffer.subarray(8, 12).toString("ascii");
        if (["heic", "heix", "hevc", "hevx", "mif1", "msf1"].includes(brand)) return "image/heic";
    }

    // Check for MP4
    if (
        buffer.includes(Buffer.from("ftyp"), 0, "ascii") &&
        buffer.length > 12
    ) {
        return "video/mp4";
    }

    // Check for QuickTime MOV
    if (
        buffer[0] === 0x00 &&
        buffer[1] === 0x00 &&
        buffer[2] === 0x00 &&
        (buffer[3] === 0x14 || buffer[3] === 0x18 || buffer[3] === 0x1c || buffer[3] === 0x20) &&
        buffer[4] === 0x66 &&
        buffer[5] === 0x74 &&
        buffer[6] === 0x79 &&
        buffer[7] === 0x70
    ) {
        return "video/quicktime";
    }

    // Check for WebM
    if (
        buffer[0] === 0x1a &&
        buffer[1] === 0x45 &&
        buffer[2] === 0xdf &&
        buffer[3] === 0xa3
    ) {
        return "video/webm";
    }

    // Check for PDF
    if (
        buffer[0] === 0x25 &&
        buffer[1] === 0x50 &&
        buffer[2] === 0x44 &&
        buffer[3] === 0x46
    ) {
        return "application/pdf";
    }

    return null;
}

/**
 * Validate that claimed MIME type matches actual file content
 * Returns true if valid, false if mismatch detected
 */
export function validateFileType(buffer: Buffer, claimedType: string, minBytes: number = 32): boolean {
    if (buffer.length < minBytes) return false;

    const detected = detectFileType(buffer);
    if (!detected) return false;

    // Allow some common type mismatches
    const typeGroups: Record<string, string[]> = {
        "image/jpeg": ["image/jpeg", "image/jpg"],
        "image/png": ["image/png"],
        "image/webp": ["image/webp"],
        "image/heic": ["image/heic", "image/heif"],
        "video/mp4": ["video/mp4"],
        "video/quicktime": ["video/quicktime", "video/mov"],
        "video/webm": ["video/webm"],
        "application/pdf": ["application/pdf"],
    };

    const validTypes = typeGroups[detected] || [detected];
    return validTypes.includes(claimedType);
}

/**
 * Get allowed file extensions for a given MIME type
 */
export function getAllowedExtensions(mimeType: string): string[] {
    const map: Record<string, string[]> = {
        "image/jpeg": [".jpg", ".jpeg"],
        "image/png": [".png"],
        "image/webp": [".webp"],
        "image/heic": [".heic", ".heif"],
        "video/mp4": [".mp4"],
        "video/quicktime": [".mov"],
        "video/webm": [".webm"],
        "application/pdf": [".pdf"],
    };
    return map[mimeType] || [];
}
