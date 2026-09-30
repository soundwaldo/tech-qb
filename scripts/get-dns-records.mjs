#!/usr/bin/env node
/**
 * Get DNS records for domain verification
 */

import { Resend } from "resend";

const apiKey = process.env.RESEND_API_KEY;
if (!apiKey) {
  console.error("❌ RESEND_API_KEY not set");
  process.exit(1);
}

const resend = new Resend(apiKey);

async function main() {
  try {
    const response = await resend.domains.list();

    if (response.error || !response.data?.data) {
      console.error("❌ Error fetching domains:", response.error);
      process.exit(1);
    }

    const domain = response.data.data.find((d) => d.name === "ggaurdai.com");

    if (!domain) {
      console.error("❌ Domain ggaurdai.com not found");
      process.exit(1);
    }

    console.log("🎯 Domain Verification Setup for ggaurdai.com\n");
    console.log(`📊 Current Status: ${domain.status}`);
    console.log(`🆔 Domain ID: ${domain.id}`);
    console.log(`📍 Region: ${domain.region}`);
    console.log(`✉️  Sending: ${domain.capabilities?.sending || "enabled"}\n`);

    // Get detailed domain info
    const detailResponse = await resend.domains.get(domain.id);

    if (detailResponse.error) {
      console.error("Could not fetch detailed records, visit dashboard:");
      console.log("📌 https://resend.com/dashboard/domains\n");
      console.log("Steps:");
      console.log("1. Click on ggaurdai.com");
      console.log("2. Copy the SPF, DKIM, and MX records shown");
      console.log("3. Add them to your domain registrar");
      console.log("4. Wait for DNS propagation (15-72 hours)");
      process.exit(0);
    }

    const detailDomain = detailResponse.data;

    console.log("📝 DNS Records to Add:\n");

    if (detailDomain.records && Array.isArray(detailDomain.records)) {
      detailDomain.records.forEach((record, idx) => {
        console.log(`Record ${idx + 1}: ${record.record.toUpperCase()}`);
        console.log(`├─ Name:  ${record.name}`);
        console.log(`├─ Value: ${record.value}`);
        if (record.priority) console.log(`├─ Priority: ${record.priority}`);
        console.log(`└─ Type:  ${record.record}`);
        console.log();
      });
    } else {
      console.log("Detailed records not available yet.");
      console.log("Visit: https://resend.com/dashboard/domains\n");
    }

    console.log("⚡ Production-Ready Configuration (once verified):");
    console.log("-------------------------------------------");
    console.log("Add to .env.local or .env.production:");
    console.log();
    console.log('EMAIL_FROM="GGuard Diagnostics <noreply@ggaurdai.com>"');
    console.log("or");
    console.log('EMAIL_FROM="reports@ggaurdai.com"');
    console.log();
    console.log("📌 Domain verification status: https://resend.com/dashboard/domains");
  } catch (err) {
    console.error("❌ Error:", err.message);
    process.exit(1);
  }
}

main();
