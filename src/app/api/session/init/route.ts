import { getOrCreateSessionToken } from "@/lib/session-middleware";

/**
 * Initialize session cookie. Should be called once on app load.
 * Returns the session token (for reference only, cookie is HttpOnly)
 */
export async function GET() {
    const token = await getOrCreateSessionToken();
    return Response.json({ sessionId: token }, {
        headers: {
            "Cache-Control": "no-store, no-cache, must-revalidate",
        },
    });
}
