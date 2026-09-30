import { z } from "zod";
import { findPropertyByAddress } from "@/lib/property-registry";
import { checkRateLimit, RateLimits } from "@/lib/rate-limit";

const lookupSchema = z.object({
    address: z.string().trim().min(5).max(200),
    zipCode: z.string().trim().regex(/^\d{5}(?:-\d{4})?$/),
});

export async function POST(request: Request) {
    const rate = await checkRateLimit(RateLimits.public);
    if (!rate.allowed) return Response.json({ error: "Too many registry lookups. Please try again later." }, { status: 429 });

    const parsed = lookupSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return Response.json({ error: "Enter a complete street address and valid ZIP code." }, { status: 400 });

    const property = await findPropertyByAddress(parsed.data.address, parsed.data.zipCode);
    if (!property) {
        return Response.json(
            { error: "No public property registry record was found for that address." },
            { status: 404, headers: { "Cache-Control": "no-store" } }
        );
    }

    return Response.json(
        { propertyId: property.id, propertyUrl: `/properties/${property.id}`, publicRegion: property.publicRegion },
        { headers: { "Cache-Control": "no-store" } }
    );
}
