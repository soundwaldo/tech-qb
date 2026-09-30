import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth/server';
import { isAdminAuthenticated } from '@/lib/admin-auth';

/**
 * POST /api/ledger/[recordId]/dispute
 *
 * Allows PMs to flag a repair record as disputed within 14 days of creation.
 * Dispute does NOT delete the blockchain record (immutable) but flags it for review.
 * Record remains visible and counts toward contractor NFT progress.
 *
 * Body: {
 *   reason: string (e.g., "Invoice voided", "Work not completed", "Duplicate")
 * }
 *
 * Response: {
 *   success: boolean,
 *   recordId: string,
 *   isDisputed: boolean,
 *   disputeRaisedAt: string (ISO)
 * }
 */

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ recordId: string }> }
) {
  try {
    const { recordId } = await params;
    let body: unknown;

    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }

    const { reason } = body as Partial<{ reason: string }>;

    if (!reason || typeof reason !== 'string' || reason.trim().length === 0) {
      return NextResponse.json(
        { error: 'Dispute reason required (non-empty string)' },
        { status: 400 }
      );
    }

    // Validate recordId format (UUID-like)
    if (!recordId || typeof recordId !== 'string') {
      return NextResponse.json(
        { error: 'Invalid record ID' },
        { status: 400 }
      );
    }

    const db = getDb();
    const user = await getCurrentUser();
    const admin = await isAdminAuthenticated();
    if (!user && !admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    // Fetch record to check if it exists and when it was created
    const recordResult = await db`
      SELECT id, created_at, is_disputed, organization_id FROM property_ledger WHERE id = ${recordId}
    `;

    const records = (recordResult as unknown[]) || [];
    if (records.length === 0) {
      return NextResponse.json(
        { error: 'Record not found' },
        { status: 404 }
      );
    }

    const record = records[0] as Record<string, unknown>;
    if (!admin) {
      const profiles = await db`SELECT organization_id FROM profiles WHERE id = ${user!.id} LIMIT 1`;
      if (!profiles[0]?.organization_id || profiles[0].organization_id !== record.organization_id) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
    }
    const daysSinceCreated = (Date.now() - new Date(record.created_at as string).getTime()) / (1000 * 86400);

    // Check 14-day window
    if (daysSinceCreated > 14) {
      return NextResponse.json(
        {
          error: 'Dispute window closed',
          message: `Records can only be disputed within 14 days of creation. This record is ${daysSinceCreated.toFixed(1)} days old.`,
        },
        { status: 400 }
      );
    }

    // If already disputed, allow re-reason (append to notes)
    if (record.is_disputed) {
      await db`
        UPDATE property_ledger 
        SET dispute_notes = COALESCE(dispute_notes, '') || '\n' || ${new Date().toISOString() + ': ' + reason},
            dispute_reason = ${reason}
        WHERE id = ${recordId}
      `;
    } else {
      // First dispute
      await db`
        UPDATE property_ledger
        SET is_disputed = TRUE,
            dispute_reason = ${reason},
            dispute_raised_at = now(),
            dispute_notes = ${`${new Date().toISOString()}: ${reason}`}
        WHERE id = ${recordId}
      `;
    }

    return NextResponse.json({
      success: true,
      recordId,
      isDisputed: true,
      disputeRaisedAt: new Date().toISOString(),
      message: '✅ Record flagged for review. The repair record remains on the ledger and counts toward contractor reputation.',
    });

  } catch (error) {
    console.error('Dispute endpoint error:', error);
    return NextResponse.json(
      { error: 'Failed to process dispute' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/ledger/[recordId]/dispute
 *
 * Check dispute status of a record
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ recordId: string }> }
) {
  try {
    const { recordId } = await params;

    const db = getDb();
    const result = await db`
      SELECT id, is_disputed, dispute_reason, dispute_raised_at, dispute_notes FROM property_ledger WHERE id = ${recordId}
    `;

    const records = (result as unknown[]) || [];
    if (records.length === 0) {
      return NextResponse.json(
        { error: 'Record not found' },
        { status: 404 }
      );
    }

    const record = records[0] as Record<string, unknown>;
    return NextResponse.json({
      recordId: record.id,
      isDisputed: record.is_disputed,
      disputeReason: record.dispute_reason,
      disputeRaisedAt: record.dispute_raised_at,
      disputeNotes: record.dispute_notes,
    });

  } catch (error) {
    console.error('Dispute status endpoint error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch dispute status' },
      { status: 500 }
    );
  }
}
