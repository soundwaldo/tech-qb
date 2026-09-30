#!/usr/bin/env node
import crypto from "crypto";
import { neon } from "@neondatabase/serverless";
import { Resend } from "resend";
import Stripe from "stripe";

const email = process.env.TARGET_EMAIL?.trim().toLowerCase();
const encryptionKey = process.env.PII_ENCRYPTION_KEY;
const databaseUrl = process.env.DATABASE_URL;
const resendKey = process.env.RESEND_API_KEY;
const from = process.env.EMAIL_FROM;
const stripeKey = process.env.STRIPE_SECRET_KEY;

if (!email || !encryptionKey || !databaseUrl || !resendKey || !from) {
  console.error("TARGET_EMAIL and the configured database, PII, and Resend variables are required");
  process.exit(1);
}

const key = crypto.createHash("sha256").update(encryptionKey, "utf8").digest();
const lookupHash = crypto.createHmac("sha256", key).update(email, "utf8").digest("hex");
const sql = neon(databaseUrl);
let rows = await sql`
  SELECT id, tier, amount_cents, status
  FROM assessments
  WHERE email_lookup_hash = ${lookupHash}
  ORDER BY paid_at DESC NULLS LAST, created_at DESC
  LIMIT 1
`;

if (!rows.length) {
  const legacyRows = await sql`
    SELECT id, tier, amount_cents, status, email
    FROM assessments
    WHERE email IS NOT NULL
    ORDER BY paid_at DESC NULLS LAST, created_at DESC
  `;
  const legacyMatch = legacyRows.find((row) => {
    const stored = String(row.email || "");
    if (stored.trim().toLowerCase() === email) return true;
    try {
      const combined = Buffer.from(stored, "base64");
      const iv = combined.subarray(0, 16);
      const authTag = combined.subarray(16, 32);
      const encrypted = combined.subarray(32);
      const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
      decipher.setAuthTag(authTag);
      const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8");
      return decrypted.trim().toLowerCase() === email;
    } catch {
      return false;
    }
  });
  rows = legacyMatch ? [legacyMatch] : [];
}

if (!rows.length || !['paid', 'processing', 'in_review', 'completed', 'delivered'].includes(String(rows[0].status))) {
  const webhookRows = await sql`
    SELECT payload
    FROM stripe_webhook_events
    WHERE event_type = 'checkout.session.completed'
      AND payload::text ILIKE ${`%${email}%`}
    ORDER BY created_at DESC
    LIMIT 1
  `;
  const paidSession = webhookRows[0]?.payload?.object;
  const assessmentId = paidSession?.metadata?.assessment_id;
  if (paidSession?.payment_status === "paid" && assessmentId) {
    const assessmentRows = await sql`
      SELECT id, tier, amount_cents, status
      FROM assessments
      WHERE id = ${assessmentId}
      LIMIT 1
    `;
    const assessment = assessmentRows[0];
    if (!assessment || Number(assessment.amount_cents) !== Number(paidSession.amount_total)) {
      console.error("Stored Stripe payment matched the email, but its assessment amount could not be reconciled");
      process.exit(1);
    }
    if (!['paid', 'processing', 'in_review', 'completed', 'delivered'].includes(String(assessment.status))) {
      await sql`
        UPDATE assessments
        SET status = 'paid', stripe_checkout_session_id = ${paidSession.id}, paid_at = now(), updated_at = now()
        WHERE id = ${assessment.id}
      `;
      assessment.status = "paid";
    }
    rows = [assessment];
  }
}

if ((!rows.length || !['paid', 'processing', 'in_review', 'completed', 'delivered'].includes(String(rows[0].status))) && stripeKey) {
  const stripe = new Stripe(stripeKey);
  const sessions = await stripe.checkout.sessions.list({ limit: 100 });
  const paidSession = sessions.data.find((session) => {
    const sessionEmail = session.customer_details?.email || session.customer_email;
    return session.payment_status === "paid" && sessionEmail?.trim().toLowerCase() === email;
  });
  const assessmentId = paidSession?.metadata?.assessment_id;
  if (paidSession && assessmentId) {
    const assessmentRows = await sql`
      SELECT id, tier, amount_cents, status
      FROM assessments
      WHERE id = ${assessmentId}
      LIMIT 1
    `;
    const assessment = assessmentRows[0];
    if (!assessment || Number(assessment.amount_cents) !== Number(paidSession.amount_total)) {
      console.error("Stripe payment matched the email, but its assessment amount could not be reconciled");
      process.exit(1);
    }
    if (!['paid', 'processing', 'in_review', 'completed', 'delivered'].includes(String(assessment.status))) {
      await sql`
        UPDATE assessments
        SET status = 'paid', stripe_checkout_session_id = ${paidSession.id}, paid_at = now(), updated_at = now()
        WHERE id = ${assessment.id}
      `;
      assessment.status = "paid";
    }
    rows = [assessment];
  }
}

if (!rows.length || !['paid', 'processing', 'in_review', 'completed', 'delivered'].includes(String(rows[0].status))) {
  console.error("No paid assessment matched that email address");
  process.exit(1);
}

const assessment = rows[0];
const slaHours = assessment.tier === "express" ? 2 : 24;
const reference = String(assessment.id).slice(0, 8).toUpperCase();
const amount = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" })
  .format(Number(assessment.amount_cents) / 100);
const resend = new Resend(resendKey);

const messages = [
  {
    from,
    to: email,
    subject: "We received your GGuard assessment request",
    html: `<div style="font-family:system-ui,sans-serif;max-width:560px;margin:0 auto"><h1 style="color:#0f766e">Assessment received</h1><p>Thanks for trusting GGuard. A human expert will review your media and quote.</p><ul><li><strong>Reference:</strong> ${reference}</li><li><strong>Tier:</strong> ${assessment.tier}</li><li><strong>Expected turnaround:</strong> within ${slaHours} hour(s)</li></ul><p>You'll get another email when your report is ready.</p></div>`,
  },
  {
    from,
    to: email,
    subject: `Payment confirmed — ${amount}`,
    html: `<div style="font-family:system-ui,sans-serif;max-width:560px;margin:0 auto"><h1 style="color:#0f766e">Payment confirmed</h1><p>We received ${amount} for your <strong>${assessment.tier}</strong> assessment.</p><p>Our experts are on it.</p></div>`,
  },
];

for (const message of messages) {
  const response = await resend.emails.send(message);
  if (response.error || !response.data?.id) {
    console.error("Resend rejected an assessment email:", response.error?.message || "No email ID returned");
    process.exit(1);
  }
}

console.log(`Resent assessment and payment emails for reference ${reference}; assessment status is ${assessment.status}.`);
