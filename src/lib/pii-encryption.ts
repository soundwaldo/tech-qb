import crypto from "crypto";

/**
 * PII Encryption Utilities
 * Encrypts and decrypts sensitive data (email, phone, address) at rest
 * Uses AES-256-GCM for authenticated encryption with associated data (AEAD)
 * 
 * The encryption key should be at least 32 bytes (256 bits) and stored securely in environment
 */

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 16; // 128 bits
const AUTH_TAG_LENGTH = 16; // 128 bits

// Lazily get and validate the key
function getEncryptionKey(): Buffer {
    const ENCRYPTION_KEY = process.env.PII_ENCRYPTION_KEY;
    
    if (!ENCRYPTION_KEY) {
        throw new Error("PII_ENCRYPTION_KEY environment variable is required for PII encryption");
    }
    
    // Ensure key is exactly 32 bytes
    if (ENCRYPTION_KEY.length < 32) throw new Error("PII_ENCRYPTION_KEY must be at least 32 characters");
    return crypto.createHash("sha256").update(ENCRYPTION_KEY, "utf8").digest();
}

/**
 * Encrypts plaintext PII data
 * Returns: base64-encoded string in format: salt:iv:encryptedData:authTag
 * This allows the IV and salt to be different for each encryption (better security)
 */
export function encryptPII(plaintext: string): string {
    if (!plaintext) return ""; // Don't encrypt empty strings
    
    try {
        const keyBuffer = getEncryptionKey();
        const iv = crypto.randomBytes(IV_LENGTH);
        const cipher = crypto.createCipheriv(ALGORITHM, keyBuffer, iv);
        
        let encrypted = cipher.update(plaintext, "utf8", "hex");
        encrypted += cipher.final("hex");
        
        const authTag = cipher.getAuthTag();
        
        // Format: base64(iv + authTag + encrypted)
        const combined = Buffer.concat([iv, authTag, Buffer.from(encrypted, "hex")]);
        return combined.toString("base64");
    } catch (error) {
        console.error("PII encryption failed:", error);
        throw new Error(`Failed to encrypt PII: ${String(error)}`);
    }
}

/** Deterministic, keyed lookup value that never stores plaintext email. */
export function deriveEmailLookupHash(email: string): string {
    return crypto
        .createHmac("sha256", getEncryptionKey())
        .update(email.trim().toLowerCase(), "utf8")
        .digest("hex");
}
export function derivePIILookupHash(namespace:string,value:string):string{return crypto.createHmac("sha256",getEncryptionKey()).update(`${namespace}:${value}`,"utf8").digest("hex")}

/** Deterministic keyed lookup for a normalized property address. */
export function derivePropertyLookupHash(normalizedAddress: string): string {
    return crypto
        .createHmac("sha256", getEncryptionKey())
        .update(`property:${normalizedAddress}`, "utf8")
        .digest("hex");
}

/**
 * Decrypts encrypted PII data
 * Expects: base64-encoded string from encryptPII()
 */
export function decryptPII(encrypted: string): string {
    if (!encrypted) return ""; // Don't decrypt empty strings
    
    try {
        const keyBuffer = getEncryptionKey();
        const combined = Buffer.from(encrypted, "base64");
        
        // Extract components
        const iv = combined.slice(0, IV_LENGTH);
        const authTag = combined.slice(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
        const encryptedData = combined.slice(IV_LENGTH + AUTH_TAG_LENGTH);
        
        const decipher = crypto.createDecipheriv(ALGORITHM, keyBuffer, iv);
        decipher.setAuthTag(authTag);
        
        let decrypted = decipher.update(encryptedData.toString("hex"), "hex", "utf8");
        decrypted += decipher.final("utf8");
        
        return decrypted;
    } catch (error) {
        console.error("PII decryption failed:", error);
        throw new Error(`Failed to decrypt PII: ${String(error)}`);
    }
}

/**
 * Batch encrypt multiple PII fields
 * Returns object with encrypted values
 */
export function encryptPIIFields(fields: Record<string, string | null | undefined>): Record<string, string | null> {
    const encrypted: Record<string, string | null> = {};
    
    for (const [key, value] of Object.entries(fields)) {
        if (value) {
            encrypted[key] = encryptPII(value);
        } else {
            encrypted[key] = null;
        }
    }
    
    return encrypted;
}

/**
 * Batch decrypt multiple PII fields
 * Returns object with decrypted values
 */
export function decryptPIIFields(fields: Record<string, string | null | undefined>): Record<string, string | null> {
    const decrypted: Record<string, string | null> = {};
    
    for (const [key, value] of Object.entries(fields)) {
        if (value) {
            try {
                decrypted[key] = decryptPII(value);
            } catch (error) {
                console.error(`Failed to decrypt field ${key}:`, error);
                decrypted[key] = null; // Return null on decryption failure
            }
        } else {
            decrypted[key] = null;
        }
    }
    
    return decrypted;
}
