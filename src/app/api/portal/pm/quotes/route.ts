import { getCurrentUser } from "@/lib/auth/server";
import { getDb } from "@/lib/db";

export async function GET(request: Request) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const db = getDb();
    const profiles = await db`SELECT organization_id FROM profiles WHERE id = ${user.id} LIMIT 1`;
    const profile = profiles[0];

    if (!profile?.organization_id) {
      return Response.json([], { status: 200 });
    }

    // Fetch all assessments with contractor quotes for this PM
    const assessments = await db`
      SELECT a.id, a.property_label, a.contractor_name, a.contractor_quote_cents, a.status, a.created_at,
             d.fair_price_low_cents, d.fair_price_high_cents
      FROM assessments a LEFT JOIN diagnoses d ON d.assessment_id = a.id
      WHERE a.organization_id = ${profile.organization_id} AND a.customer_type = 'property_manager'
      ORDER BY a.created_at DESC
    `;

    type AssessmentRow = {
      id: string;
      property_label: string | null;
      contractor_name: string | null;
      contractor_quote_cents: number | null;
      status: string;
      created_at: string;
      fair_price_low_cents: number | null;
      fair_price_high_cents: number | null;
    };

    const rows = assessments as AssessmentRow[];

    // Calculate overpricing
    const formatted = rows
      .filter((a) => a.contractor_quote_cents != null)
      .map((a) => {
        const quoteCents = a.contractor_quote_cents ?? 0;
        const isOverpriced =
          a.fair_price_high_cents != null && quoteCents > a.fair_price_high_cents;

        return {
          id: a.id,
          property_label: a.property_label || "Unnamed Property",
          contractor_name: a.contractor_name || "Unknown",
          quote_cents: quoteCents,
          status: a.status,
          submitted_at: a.created_at,
          gguard_fair_low: a.fair_price_low_cents,
          gguard_fair_high: a.fair_price_high_cents,
          overpriced: isOverpriced,
        };
      });

    return Response.json(formatted);
  } catch (error) {
    console.error("PM quotes error:", error);
    return Response.json([], { status: 200 });
  }
}
