#!/usr/bin/env node
import { Resend } from "resend";

const apiKey = process.env.RESEND_API_KEY;
const from = process.env.EMAIL_FROM;
const to = process.env.ADMIN_NOTIFICATION_EMAIL;

if (!apiKey || !from || !to) {
  console.error("RESEND_API_KEY, EMAIL_FROM, and ADMIN_NOTIFICATION_EMAIL are required");
  process.exit(1);
}

const resend = new Resend(apiKey);
const sent = await resend.emails.send({
  from,
  to,
  subject: "GGuard email delivery check",
  html: "<p>Your verified GGuard sending domain is working.</p>",
});

if (sent.error || !sent.data?.id) {
  console.error("Resend rejected the test email:", sent.error?.message || "No email ID returned");
  process.exit(1);
}

await new Promise((resolve) => setTimeout(resolve, 3000));
const status = await resend.emails.get(sent.data.id);
if (status.error || !status.data) {
  console.error("Unable to retrieve test email status:", status.error?.message || "No status returned");
  process.exit(1);
}

console.log(`Test email accepted by Resend with status: ${status.data.last_event}`);
