import { z } from "zod";
import { createAdminSession, verifyAdminPassword } from "@/lib/admin-auth";
import { checkRateLimit, RateLimits } from "@/lib/rate-limit";

export async function POST(request: Request) {
    const rate = await checkRateLimit(RateLimits.auth);
    if (!rate.allowed) return Response.json({ error: "Too many login attempts" }, { status: 429, headers: { "Retry-After": String(Math.ceil((rate.resetAt - Date.now()) / 1000)) } });
    const parsed = z.object({ password: z.string().min(1).max(200) }).safeParse(await request.json().catch(() => null));
    if (!parsed.success) return Response.json({ error: "Invalid request" }, { status: 400 });
    try {
        if (!verifyAdminPassword(parsed.data.password)) return Response.json({ error: "Invalid credentials" }, { status: 401 });
        await createAdminSession(); return Response.json({ ok: true });
    } catch (error) { console.error("Admin login configuration error", error); return Response.json({ error: "Admin login is not configured" }, { status: 503 }); }
}
