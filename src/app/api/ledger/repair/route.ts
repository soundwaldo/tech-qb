import { NextRequest, NextResponse } from "next/server";
import { anchorRepairRecord, RepairPayload } from "@/lib/property-ledger";
import { verifyRepairInviteToken } from "@/lib/invite-token";
import { getCurrentUser } from "@/lib/auth/server";
import { getDb } from "@/lib/db";

/**
 * POST /api/ledger/repair
 *
 * Authenticated endpoint. Every submission is attributed to an account and,
 * when applicable, its HOA or property-management organization.
 *
 * Body: RepairPayload
 *
 * GET /api/ledger/repair?address=...&zip=...
 * Returns the full ledger for a property address (public read).
 */

export async function POST(req: NextRequest) {
    let body: unknown;
    try {
        body = await req.json();
    } catch {
        return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    const payload = body as Partial<RepairPayload> & { inviteToken?: string };

    const inviteToken = payload.inviteToken || "";
    const invite = inviteToken ? verifyRepairInviteToken(inviteToken) : null;
    if (inviteToken && !invite) {
        return NextResponse.json({ error: "The organization invite is invalid or expired." }, { status: 403 });
    }

    const user = await getCurrentUser();
    if (!user?.id) {
        return NextResponse.json(
            { error: "Sign in is required so this repair record can be attributed to its submitter." },
            { status: 401 }
        );
    }

    const db = getDb();
    await db`
      INSERT INTO profiles (id, full_name, role)
      VALUES (${user.id}, ${user.name || null}, 'homeowner')
      ON CONFLICT (id) DO UPDATE SET full_name = COALESCE(EXCLUDED.full_name, profiles.full_name), updated_at = now()
    `;
    const profileRows = await db`SELECT organization_id, role FROM profiles WHERE id = ${user.id} LIMIT 1`;
    const profile = profileRows[0] as { organization_id?: string | null; role?: string | null } | undefined;
    if (invite && profile?.organization_id && profile.organization_id !== invite.organizationId) {
        return NextResponse.json({ error: "The invite does not match your account organization." }, { status: 403 });
    }
    if (invite && !profile?.organization_id) {
        await db`UPDATE profiles SET organization_id = ${invite.organizationId}, role = 'property_manager', updated_at = now() WHERE id = ${user.id}`;
    }
    const organizationId = profile?.organization_id || invite?.organizationId || null;
    const submitterRole = invite && !profile?.organization_id
        ? "property_manager"
        : profile?.role || "homeowner";

    // Validate required fields
    if (
        !payload.propertyAddress ||
        !payload.zipCode ||
        !payload.trade ||
        !payload.summary ||
        !payload.contractorName ||
        !payload.repairedAt ||
        typeof payload.costCents !== "number"
    ) {
        return NextResponse.json(
            {
                error: "Missing required fields",
                required: [
                    "propertyAddress",
                    "zipCode",
                    "trade",
                    "summary",
                    "contractorName",
                    "repairedAt",
                    "costCents",
                ],
            },
            { status: 400 }
        );
    }

    // Sanitize: costCents must be non-negative integer
    if (!Number.isInteger(payload.costCents) || payload.costCents < 0) {
        return NextResponse.json(
            { error: "costCents must be a non-negative integer (cents)" },
            { status: 400 }
        );
    }

    // Sanitize: repairedAt must be valid ISO date
    const repairDate = new Date(payload.repairedAt);
    if (isNaN(repairDate.getTime()) || repairDate > new Date()) {
        return NextResponse.json(
            { error: "repairedAt must be a valid past date in ISO format" },
            { status: 400 }
        );
    }

    // Sanitize: zip code format
    const zipRegex = /^\d{5}(?:-\d{4})?$/;
    if (!zipRegex.test(payload.zipCode.trim())) {
        return NextResponse.json(
            { error: "zipCode must be a valid US zip code" },
            { status: 400 }
        );
    }

    try {
        const record = await anchorRepairRecord({
            propertyAddress: payload.propertyAddress.trim(),
            zipCode: payload.zipCode.trim(),
            trade: payload.trade.trim(),
            summary: payload.summary.trim(),
            contractorName: payload.contractorName.trim(),
            contractorLicense: payload.contractorLicense?.trim(),
            contractorEmail: payload.contractorEmail?.trim(),
            costCents: payload.costCents,
            repairedAt: repairDate.toISOString(),
            mediaHashes: Array.isArray(payload.mediaHashes) ? payload.mediaHashes : [],
            relatedAssessmentId: payload.relatedAssessmentId,
            organizationId,
            submittedByUserId: user.id,
            submitterRole,
        });

        const response = NextResponse.json(
            {
                success: true,
                recordId: record.id,
                propertyAddressId: record.propertyAddressId,
                propertyId: record.propertyId,
                contentHash: record.contentHash,
                anchorStatus: record.anchorStatus,
                anchorTxId: record.anchorTxId,
                anchorProvider: record.anchorProvider,
                contractorWalletId: record.contractorWalletId,
                contractorProfileUrl: record.contractorWalletId
                    ? `/contractor/${record.contractorWalletId}`
                    : null,
                verifyUrl: record.propertyId ? `/properties/${record.propertyId}` : null,
            },
            { status: 201 }
        );

        return response;
    } catch (err) {
        console.error("[/api/ledger/repair] Failed:", err);
        return NextResponse.json(
            { error: "Failed to submit repair record" },
            { status: 500 }
        );
    }
}

export async function GET(req: NextRequest) {
    void req;
    return NextResponse.json(
        {
            error: "This legacy address-based ledger endpoint has been retired for privacy.",
            replacement: "/api/properties/lookup",
        },
        { status: 410, headers: { "Cache-Control": "no-store" } }
    );
}
