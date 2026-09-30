import { cookies } from "next/headers";
import { generateSessionToken } from "./utils";

const SESSION_COOKIE_NAME = "gguard_session";
const SESSION_COOKIE_MAX_AGE = 7 * 24 * 60 * 60; // 7 days

/**
 * Get or create a session token from HttpOnly cookie
 * Server-side only
 */
export async function getOrCreateSessionToken(): Promise<string> {
    const cookieStore = await cookies();
    let token = cookieStore.get(SESSION_COOKIE_NAME)?.value;

    if (!token) {
        token = generateSessionToken();
        cookieStore.set(SESSION_COOKIE_NAME, token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "lax",
            maxAge: SESSION_COOKIE_MAX_AGE,
            path: "/",
        });
    }

    return token;
}

/**
 * Get existing session token from cookie (returns empty string if not found)
 * Server-side only
 */
export async function getSessionTokenFromCookie(): Promise<string> {
    const cookieStore = await cookies();
    return cookieStore.get(SESSION_COOKIE_NAME)?.value || "";
}

/**
 * Set HttpOnly session cookie
 * Server-side only
 */
export async function setSessionCookie(token: string): Promise<void> {
    const cookieStore = await cookies();
    cookieStore.set(SESSION_COOKIE_NAME, token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: SESSION_COOKIE_MAX_AGE,
        path: "/",
    });
}

/**
 * Clear session cookie
 * Server-side only
 */
export async function clearSessionCookie(): Promise<void> {
    const cookieStore = await cookies();
    cookieStore.delete(SESSION_COOKIE_NAME);
}
