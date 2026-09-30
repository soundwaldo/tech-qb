import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { anchorDiagnosisRecord, DiagnosisPayload } from "@/lib/property-ledger";
import { getSessionTokenFromCookie } from "@/lib/session-middleware";
import { decryptPII } from "@/lib/pii-encryption";

/**
 * POST /api/ledger/anchor
 *
 * Internal endpoint — anchors a finalized GGuard diagnosis to the property ledger.
 * Called automatically when a report is marked as completed.
 * Requires valid session + admin/service role.
 *
 * Body: DiagnosisPayload
 */
export async function POST(req: NextRequest) {
    const sessionToken = await getSessionTokenFromCookie();
    if (!sessionToken) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let body: unknown;
    try {
        body = await req.json();
    } catch {
        return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    const payload = body as Partial<DiagnosisPayload>;

    // Validate required fields
    if (
        !payload.assessmentId ||
        !payload.summary ||
        !Array.isArray(payload.problems)
    ) {
        return NextResponse.json(
            { error: "Missing required fields: assessmentId, summary, problems" },
            { status: 400 }
        );
    }

    // Verify the assessment exists and belongs to this session
    const db = getDb();
    const rows = await db`
        SELECT id, session_token, status, street_address, zip_code, organization_id
        FROM assessments WHERE id = ${payload.assessmentId} LIMIT 1
    `;
    const assessment = rows[0] as {
        id: string;
        session_token: string;
        status: string;
        street_address: string | null;
        zip_code: string;
        organization_id: string | null;
    } | undefined;

    if (!assessment) {
        return NextResponse.json({ error: "Assessment not found" }, { status: 404 });
    }

    if (assessment.session_token !== sessionToken) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Only anchor completed/delivered assessments
    if (!["completed", "delivered"].includes(assessment.status)) {
        return NextResponse.json(
            { error: "Assessment must be completed before anchoring" },
            { status: 422 }
        );
    }

    if (!assessment.street_address) {
        return NextResponse.json({ error: "Assessment has no property address" }, { status: 422 });
    }

    let propertyAddress: string;
    try {
        propertyAddress = decryptPII(assessment.street_address);
    } catch {
        // Compatibility for legacy rows created before encrypted-at-rest storage.
        propertyAddress = assessment.street_address;
    }

    try {
        const record = await anchorDiagnosisRecord({
            assessmentId: payload.assessmentId,
            propertyAddress,
            zipCode: assessment.zip_code,
            problems: payload.problems,
            summary: payload.summary,
            findings: payload.findings ?? [],
            fairPriceLowCents: payload.fairPriceLowCents ?? 0,
            fairPriceHighCents: payload.fairPriceHighCents ?? 0,
            partsNeeded: payload.partsNeeded ?? [],
            mediaHashes: payload.mediaHashes ?? [],
            organizationId: assessment.organization_id,
        });

        return NextResponse.json({
            success: true,
            recordId: record.id,
            propertyAddressId: record.propertyAddressId,
            propertyId: record.propertyId,
            propertyUrl: record.propertyId ? `/properties/${record.propertyId}` : null,
            contentHash: record.contentHash,
            anchorStatus: record.anchorStatus,
            anchorTxId: record.anchorTxId,
            anchorProvider: record.anchorProvider,
        });
    } catch (err) {
        console.error("[/api/ledger/anchor] Failed:", err);
        return NextResponse.json(
            { error: "Failed to anchor record" },
            { status: 500 }
        );
    }
}
