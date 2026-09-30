import { createHmac, timingSafeEqual } from "crypto";

const INVITE_VERSION = "v1";
const INVITE_TTL_SECONDS = 60 * 60 * 24 * 30;

function getSecret(): string {
    const secret = process.env.ADMIN_SESSION_SECRET;
    if (!secret || secret.length < 32) {
        throw new Error("ADMIN_SESSION_SECRET must contain at least 32 characters");
    }
    return secret;
}

function sign(payload: string): string {
    return createHmac("sha256", getSecret()).update(payload).digest("hex");
}

export function createRepairInviteToken(params: {
    organizationId: string;
    customerType: "hoa" | "property_manager" | "contractor";
    expiresInSeconds?: number;
}): string {
    const expiresAt = Math.floor(Date.now() / 1000) + (params.expiresInSeconds ?? INVITE_TTL_SECONDS);
    const payload = `${INVITE_VERSION}.${params.organizationId}.${params.customerType}.${expiresAt}`;
    return `${payload}.${sign(payload)}`;
}

export function verifyRepairInviteToken(token: string): { organizationId: string; customerType: "hoa" | "property_manager" | "contractor"; expiresAt: number } | null {
    const parts = token.split(".");
    if (parts.length !== 5) return null;

    const [version, organizationId, customerType, expiresAtRaw, signature] = parts;
    if (version !== INVITE_VERSION) return null;
    if (customerType !== "hoa" && customerType !== "property_manager" && customerType !== "contractor") return null;

    const expiresAt = Number(expiresAtRaw);
    if (!Number.isInteger(expiresAt) || expiresAt < Math.floor(Date.now() / 1000)) return null;

    const payload = `${version}.${organizationId}.${customerType}.${expiresAt}`;
    const expected = Buffer.from(sign(payload), "hex");
    const supplied = Buffer.from(signature, "hex");
    if (expected.length !== supplied.length) return null;
    if (!timingSafeEqual(expected, supplied)) return null;

    return {
        organizationId,
        customerType: customerType as "hoa" | "property_manager" | "contractor",
        expiresAt,
    };
}

export function createAssessmentInviteToken(params: { organizationId: string; customerType: "hoa" | "property_manager" | "contractor"; expiresInSeconds?: number }): string {
    const expiresAt = Math.floor(Date.now() / 1000) + (params.expiresInSeconds ?? INVITE_TTL_SECONDS);
    const payload = `assessment.${INVITE_VERSION}.${params.organizationId}.${params.customerType}.${expiresAt}`;
    return `${payload}.${sign(payload)}`;
}

export function verifyAssessmentInviteToken(token: string): { organizationId: string; customerType: "hoa" | "property_manager" | "contractor"; expiresAt: number } | null {
    const parts = token.split(".");
    if (parts.length !== 6) return null;
    const [scope, version, organizationId, customerType, expiresAtRaw, signature] = parts;
    if (scope !== "assessment" || version !== INVITE_VERSION || (customerType !== "hoa" && customerType !== "property_manager" && customerType !== "contractor")) return null;
    const expiresAt = Number(expiresAtRaw);
    if (!Number.isInteger(expiresAt) || expiresAt < Math.floor(Date.now() / 1000)) return null;
    const payload = `${scope}.${version}.${organizationId}.${customerType}.${expiresAt}`;
    const expected = Buffer.from(sign(payload), "hex");
    const supplied = Buffer.from(signature, "hex");
    if (expected.length !== supplied.length || !timingSafeEqual(expected, supplied)) return null;
    return { organizationId, customerType: customerType as "hoa" | "property_manager" | "contractor", expiresAt };
}
