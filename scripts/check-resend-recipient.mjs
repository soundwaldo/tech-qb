#!/usr/bin/env node
import { Resend } from "resend";

const apiKey = process.env.RESEND_API_KEY;
const email = process.env.TARGET_EMAIL?.trim().toLowerCase();
if (!apiKey || !email) {
  console.error("RESEND_API_KEY and TARGET_EMAIL are required");
  process.exit(1);
}

const resend = new Resend(apiKey);
const response = await resend.emails.list({ limit: 25 });
if (response.error) {
  console.error("Unable to list Resend emails:", response.error.message);
  process.exit(1);
}

const matches = (response.data?.data || [])
  .filter((item) => item.to.some((recipient) => recipient.toLowerCase() === email))
  .filter((item) => item.subject.startsWith("We received your GGuard") || item.subject.startsWith("Payment confirmed"))
  .slice(0, 2);

if (matches.length !== 2) {
  console.error(`Expected two recent assessment emails, found ${matches.length}`);
  process.exit(1);
}

for (const item of matches) {
  console.log(`${item.subject}: ${item.last_event}`);
}
