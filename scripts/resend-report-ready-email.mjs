#!/usr/bin/env node
import { neon } from "@neondatabase/serverless";
import { Resend } from "resend";
import Stripe from "stripe";

const assessmentId = process.env.TARGET_ASSESSMENT_ID?.trim();
const targetEmail = process.env.TARGET_EMAIL?.trim().toLowerCase();
const databaseUrl = process.env.DATABASE_URL;
const resendKey = process.env.RESEND_API_KEY;
const stripeKey = process.env.STRIPE_SECRET_KEY;
const from = process.env.EMAIL_FROM;
const appUrl = (process.env.NEXT_PUBLIC_APP_URL || "https://ggaurdai.com").replace(/\/$/, "");

if (!assessmentId || !databaseUrl || !resendKey || !from || (!targetEmail && !stripeKey)) {
  console.error("TARGET_ASSESSMENT_ID, database and Resend configuration, plus TARGET_EMAIL or Stripe configuration are required");
  process.exit(1);
}

const sql = neon(databaseUrl);
const rows = await sql`
  SELECT a.id, a.session_token, a.status, a.stripe_checkout_session_id,
         d.summary, d.fair_price_low_cents, d.fair_price_high_cents,
         (SELECT public_id FROM report_manifests WHERE assessment_id = a.id ORDER BY version DESC LIMIT 1) AS public_id
  FROM assessments a
  JOIN diagnoses d ON d.assessment_id = a.id
  WHERE a.id = ${assessmentId}
  LIMIT 1
`;

const report = rows[0];
if (!report || !["completed", "delivered"].includes(String(report.status))) {
  console.error("A completed report was not found for that assessment");
  process.exit(1);
}
if (report.status === "delivered") {
  console.log(`Report ${String(report.id).slice(0, 8).toUpperCase()} is already marked delivered; no duplicate email was sent.`);
  process.exit(0);
}
let to = targetEmail;
if (!to && stripeKey) {
  if (!report.stripe_checkout_session_id) {
    console.error("The assessment has no Stripe checkout session for recipient lookup");
    process.exit(1);
  }
  const stripe = new Stripe(stripeKey);
  const checkout = await stripe.checkout.sessions.retrieve(report.stripe_checkout_session_id);
  to = checkout.customer_details?.email || checkout.customer_email || undefined;
}
if (!to) {
  console.error("Stripe has no customer email for this assessment");
  process.exit(1);
}

const formatCurrency = (cents) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(Number(cents) / 100);
const escapeHtml = (value) => String(value).replace(/[&<>'"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[character]);
const reportUrl = `${appUrl}/report/${encodeURIComponent(report.id)}?access=${encodeURIComponent(report.session_token)}`;
const verifyUrl = report.public_id ? `${appUrl}/verify/${encodeURIComponent(report.public_id)}` : null;
const html = `<div style="font-family:system-ui,sans-serif;max-width:560px;margin:0 auto"><h1 style="color:#0f766e">Your report is ready</h1><p><strong>Summary:</strong> ${escapeHtml(report.summary)}</p><p><strong>Fair price range:</strong> ${formatCurrency(report.fair_price_low_cents)}–${formatCurrency(report.fair_price_high_cents)}</p><p><a href="${reportUrl}" style="background:#0f766e;color:white;padding:12px 20px;border-radius:8px;text-decoration:none;display:inline-block">View full report</a></p>${verifyUrl ? `<p style="margin-top:24px;font-size:13px;color:#64748b">A verifiable maintenance record was added to the registry:<br/><a href="${verifyUrl}">${verifyUrl}</a></p>` : ""}<p style="color:#64748b;font-size:12px">GGuard Diagnostics · The CARFAX for Home Maintenance</p></div>`;

const response = await new Resend(resendKey).emails.send({ from, to, subject: "Your GGuard assessment is ready", html });
if (response.error || !response.data?.id) {
  console.error("Resend rejected the report email:", response.error?.message || "No email ID returned");
  process.exit(1);
}

await sql`UPDATE assessments SET status = 'delivered', updated_at = now() WHERE id = ${assessmentId}`;
console.log(`Delivered report ${String(report.id).slice(0, 8).toUpperCase()}; Resend email ID ${response.data.id}.`);
