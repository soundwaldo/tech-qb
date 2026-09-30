import { z } from "zod";
import { getDb } from "@/lib/db";
import { deriveEmailLookupHash } from "@/lib/pii-encryption";
import { checkRateLimit, RateLimits } from "@/lib/rate-limit";
import { sendRecordAccessEmail } from "@/lib/email";

const schema = z.object({ email: z.string().email().max(254) });
const genericResponse = { message: "If completed records match that email, private links will arrive shortly." };

export async function POST(request: Request) {
    const rate = await checkRateLimit(RateLimits.auth);
    if (!rate.allowed) return Response.json(genericResponse, { status: 202 });

    const parsed = schema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return Response.json({ error: "Enter a valid email address." }, { status: 400 });

    try {
        const lookup = deriveEmailLookupHash(parsed.data.email);
        const rows = await getDb()`
          SELECT id, session_token FROM assessments
          WHERE email_lookup_hash = ${lookup} AND status IN ('completed', 'delivered')
          ORDER BY created_at DESC LIMIT 20
        `;
        if (rows.length) {
            await sendRecordAccessEmail({
                to: parsed.data.email,
                records: rows.map((row) => ({ assessmentId: String(row.id), accessToken: String(row.session_token) })),
            });
        }
    } catch (error) {
        console.error("Record access delivery failed:", error);
    }

    return Response.json(genericResponse, { status: 202 });
}
