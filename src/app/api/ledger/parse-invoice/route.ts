import { NextRequest, NextResponse } from "next/server";
import { generateText } from "ai";
import { withAiBackup } from "@/lib/ai-provider";
import { z } from "zod";
import { verifyRepairInviteToken } from "@/lib/invite-token";
import { getCurrentUser } from "@/lib/auth/server";
import { isAdminAuthenticated } from "@/lib/admin-auth";
import { checkRateLimit } from "@/lib/rate-limit";

export const maxDuration = 120;

/**
 * POST /api/ledger/parse-invoice
 *
 * Accepts a base64-encoded invoice image or PDF page screenshot.
 * Returns extracted fields to pre-fill the repair submission form.
 * No auth required — extraction only, nothing is stored.
 */

const extractedInvoiceSchema = z.object({
    propertyAddress: z.string().optional(),
    zipCode: z.string().optional(),
    trade: z.string().optional(),
    contractorName: z.string().optional(),
    contractorLicense: z.string().optional(),
    contractorEmail: z.string().optional(),
    summary: z.string().optional(),
    costDollars: z.string().optional(),
    repairedAt: z.string().optional(), // ISO date YYYY-MM-DD
});

export type ParsedInvoice = z.infer<typeof extractedInvoiceSchema>;

export async function POST(req: NextRequest) {
    let body: unknown;
    try {
        body = await req.json();
    } catch {
        return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    const { imageBase64, mimeType, inviteToken } = body as {
        imageBase64?: string;
        mimeType?: string;
        inviteToken?: string;
    };

    const authorized = Boolean(await getCurrentUser() || await isAdminAuthenticated() || (inviteToken && verifyRepairInviteToken(inviteToken)));
    if (!authorized) return NextResponse.json({ error: "A valid account or pilot invite is required" }, { status: 401 });
    const rate = await checkRateLimit({ key: "ip", limit: 10, window: 60 * 60 * 1000 });
    if (!rate.allowed) return NextResponse.json({ error: "Invoice parsing limit reached" }, { status: 429 });

    if (!imageBase64) {
        return NextResponse.json({ error: "imageBase64 is required" }, { status: 400 });
    }
    if (imageBase64.length > 14_000_000) return NextResponse.json({ error: "Invoice image is too large" }, { status: 413 });

    const validMimeTypes = ["image/jpeg", "image/png", "image/webp", "image/gif"];
    if (!validMimeTypes.includes(mimeType ?? "")) return NextResponse.json({ error: "Unsupported invoice image type" }, { status: 400 });

    try {
        const { result: { text } } = await withAiBackup("invoice", (config) => generateText({
            ...config,
            maxRetries: 0,
            abortSignal: AbortSignal.timeout(50_000),
            maxOutputTokens: 2000,
            messages: [
                {
                    role: "user",
                    content: [
                        {
                            type: "image",
                            image: imageBase64,
                        },
                        {
                            type: "text",
                            text: `You are extracting data from a contractor invoice or work order.

Extract the following fields and return ONLY valid JSON matching this structure:
{
  "propertyAddress": "street address of the service location (not contractor address)",
  "zipCode": "5-digit zip code of the service location",
  "trade": "type of work: HVAC / Plumbing / Electrical / Roofing / Garage Door / Flooring / Painting / Appliances / General Contractor / Other",
  "contractorName": "company or contractor name",
  "contractorLicense": "license number if present, else null",
  "contractorEmail": "email address if present, else null",
  "summary": "description of the work performed — copy from invoice description or work order notes",
  "costDollars": "total amount as a decimal number string, e.g. '450.00'",
  "repairedAt": "date work was completed in YYYY-MM-DD format"
}

Rules:
- Return ONLY the JSON object, no markdown, no explanation
- If a field is not found, use null
- For trade, pick the closest match from the list above
- For propertyAddress, use the SERVICE location, not the contractor's business address
- For costDollars, use the total amount paid, not a deposit or partial amount`,
                        },
                    ],
                },
            ],
        }));

        // Parse the JSON response
        let extracted: unknown;
        try {
            // Strip any markdown code fences if model adds them
            const clean = text.replace(/```json?\n?/g, "").replace(/```/g, "").trim();
            extracted = JSON.parse(clean);
        } catch {
            return NextResponse.json({ error: "AI returned unparseable response", raw: text }, { status: 422 });
        }

        // Validate and sanitize
        const result = extractedInvoiceSchema.safeParse(extracted);
        if (!result.success) {
            return NextResponse.json({ error: "Extraction incomplete", raw: extracted }, { status: 422 });
        }

        // Normalize null to undefined
        const clean: ParsedInvoice = {};
        for (const [key, val] of Object.entries(result.data)) {
            if (val !== null && val !== "") {
                (clean as Record<string, unknown>)[key] = val;
            }
        }

        return NextResponse.json({ extracted: clean });
    } catch (err) {
        console.error("[/api/ledger/parse-invoice] AI extraction failed:", err);
        return NextResponse.json({ error: "Invoice parsing failed" }, { status: 500 });
    }
}
