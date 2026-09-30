#!/usr/bin/env node
/**
 * Debug Resend API
 */

import { Resend } from "resend";

const apiKey = process.env.RESEND_API_KEY;
console.log(`API Key: ${apiKey ? "✅ Set" : "❌ Missing"}\n`);

if (!apiKey) {
  process.exit(1);
}

const resend = new Resend(apiKey);

async function main() {
  console.log("Testing Resend API...\n");

  // Test 1: List domains
  console.log("1️⃣  Listing domains:");
  const domainsResp = await resend.domains.list();
  console.log(JSON.stringify(domainsResp, null, 2));
  console.log("\n---\n");

  // Test 2: Send test email
  console.log("2️⃣  Testing email send:");
  const emailResp = await resend.emails.send({
    from: "onboarding@resend.dev",
    to: process.env.ADMIN_NOTIFICATION_EMAIL || "test@example.com",
    subject: "GGuard Test Email",
    html: "<p>Test from GGuard production deployment</p>",
  });
  console.log(JSON.stringify(emailResp, null, 2));
}

main().catch(console.error);
