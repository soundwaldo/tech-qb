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

    // Fetch all tenant submissions for this PM organization
    const assessments = await db`
      SELECT a.id, a.property_label, a.zip_code, a.problems, a.status, a.created_at,
             d.id AS diagnosis_id, d.summary AS diagnosis_summary,
             d.fair_price_low_cents, d.fair_price_high_cents
      FROM assessments a LEFT JOIN diagnoses d ON d.assessment_id = a.id
      WHERE a.organization_id = ${profile.organization_id} AND a.customer_type = 'property_manager'
      ORDER BY a.created_at DESC
    `;

    type AssessmentRow = {
      id: string;
      property_label: string | null;
      zip_code: string;
      status: string;
      problems: string[] | null;
      created_at: string;
      diagnosis_id: string | null;
      diagnosis_summary: string | null;
      fair_price_low_cents: number | null;
      fair_price_high_cents: number | null;
    };

    const rows = assessments as AssessmentRow[];

    const formatted = rows.map((a) => ({
      id: a.id,
      property_label: a.property_label || `Property in ${a.zip_code}`,
      zip_code: a.zip_code,
      status: a.status,
      problems: a.problems || [],
      created_at: a.created_at,
      diagnosis: a.diagnosis_id ? { id: a.diagnosis_id, summary: a.diagnosis_summary, fair_price_low_cents: a.fair_price_low_cents, fair_price_high_cents: a.fair_price_high_cents } : null,
    }));

    return Response.json(formatted);
  } catch (error) {
    console.error("PM submissions error:", error);
    return Response.json({ error: "Could not load submissions" }, { status: 500 });
  }
}
