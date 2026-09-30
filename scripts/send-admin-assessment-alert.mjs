#!/usr/bin/env node
import { neon } from "@neondatabase/serverless";
import { Resend } from "resend";

const reference = process.env.ASSESSMENT_REFERENCE?.trim().toLowerCase();
const databaseUrl = process.env.DATABASE_URL;
const apiKey = process.env.RESEND_API_KEY;
const from = process.env.EMAIL_FROM;
const to = process.env.ADMIN_NOTIFICATION_EMAIL;
const appUrl = (process.env.NEXT_PUBLIC_APP_URL || "https://ggaurdai.com").replace(/\/$/, "");

if (!reference || !databaseUrl || !apiKey || !from || !to) {
  console.error("Assessment reference and configured database and email variables are required");
  process.exit(1);
}

const sql = neon(databaseUrl);
const rows = await sql`
  SELECT id, tier, customer_type, status
  FROM assessments
  WHERE lower(id::text) LIKE ${`${reference}%`}
  LIMIT 2
`;

if (rows.length !== 1) {
  console.error(`Expected one assessment for reference ${reference.toUpperCase()}, found ${rows.length}`);
  process.exit(1);
}

const assessment = rows[0];
const shortReference = String(assessment.id).slice(0, 8).toUpperCase();
const resend = new Resend(apiKey);
const response = await resend.emails.send({
  from,
  to,
  subject: `Paid assessment ready for review · ${shortReference}`,
  html: `<div style="font-family:system-ui,sans-serif;max-width:560px;margin:0 auto"><h1 style="color:#0f766e">Paid assessment ready for review</h1><p>A ${assessment.customer_type} customer completed payment.</p><ul><li><strong>Reference:</strong> ${shortReference}</li><li><strong>Tier:</strong> ${assessment.tier}</li><li><strong>Status:</strong> ${assessment.status}</li></ul><p><a href="${appUrl}/admin/${assessment.id}" style="background:#0f766e;color:white;padding:12px 20px;border-radius:8px;text-decoration:none;display:inline-block">Open secure review</a></p></div>`,
});

if (response.error || !response.data?.id) {
  console.error("Resend rejected the admin alert:", response.error?.message || "No email ID returned");
  process.exit(1);
}

await new Promise((resolve) => setTimeout(resolve, 3000));
const status = await resend.emails.get(response.data.id);
if (status.error || !status.data) {
  console.error("Unable to retrieve admin alert status:", status.error?.message || "No status returned");
  process.exit(1);
}

console.log(`Admin alert for ${shortReference}: ${status.data.last_event}`);
