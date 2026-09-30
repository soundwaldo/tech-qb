import { createHmac, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";

const COOKIE_NAME = "gguard_admin";
const SESSION_SECONDS = 60 * 60 * 8;

function secret(): string {
    const value = process.env.ADMIN_SESSION_SECRET;
    if (!value || value.length < 32) throw new Error("ADMIN_SESSION_SECRET must contain at least 32 characters");
    return value;
}

function sign(expires: string): string { return createHmac("sha256", secret()).update(expires).digest("hex"); }

export async function createAdminSession(): Promise<void> {
    const expires = String(Math.floor(Date.now() / 1000) + SESSION_SECONDS);
    (await cookies()).set(COOKIE_NAME, `${expires}.${sign(expires)}`, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "strict", path: "/", maxAge: SESSION_SECONDS });
}

export async function isAdminAuthenticated(): Promise<boolean> {
    try {
        const value = (await cookies()).get(COOKIE_NAME)?.value;
        if (!value) return false;
        const [expires, signature] = value.split(".");
        if (!expires || !signature || Number(expires) <= Math.floor(Date.now() / 1000)) return false;
        const expected = Buffer.from(sign(expires), "hex"); const supplied = Buffer.from(signature, "hex");
        return expected.length === supplied.length && timingSafeEqual(expected, supplied);
    } catch { return false; }
}

export function verifyAdminPassword(password: string): boolean {
    const expected = process.env.ADMIN_PASSWORD;
    if (!expected || expected.length < 12) throw new Error("ADMIN_PASSWORD must contain at least 12 characters");
    const left = Buffer.from(password); const right = Buffer.from(expected);
    return left.length === right.length && timingSafeEqual(left, right);
}
