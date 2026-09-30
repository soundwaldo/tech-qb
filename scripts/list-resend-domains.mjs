#!/usr/bin/env node
/**
 * Get Resend Domain Details
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
    console.log("🔍 Fetching your Resend domains...\n");

    const response = await resend.domains.list();

    if (response.error) {
      console.error("❌ Error:", response.error);
      process.exit(1);
    }

    const domainsList = response.data?.data || [];

    if (!Array.isArray(domainsList) || domainsList.length === 0) {
      console.log("No domains found in your account.");
      console.log("Visit: https://resend.com/dashboard/domains");
      process.exit(0);
    }

    console.log(`📋 Found ${domainsList.length} domain(s):\n`);

    for (const [idx, domain] of domainsList.entries()) {
      const detailsResponse = await resend.domains.get(domain.id);
      const details = detailsResponse.data || domain;
      console.log(`${idx + 1}. ${domain.name}`);
      console.log(`   ID: ${domain.id}`);
      console.log(
        `   Status: ${domain.status === "verified" ? "✅ " + domain.status : "⏳ " + domain.status}`
      );

      if (details.records && Array.isArray(details.records)) {
        console.log(`   DNS Records:`);
        details.records.forEach((r) => {
          console.log(`     - ${r.record} (${r.name}): ${r.value}`);
          if (r.priority) console.log(`       Priority: ${r.priority}`);
        });
      }
      console.log();
    }

    // Check for ggaurdai.com
    const ggaurd = domainsList.find((d) => d.name === "ggaurdai.com");
    if (ggaurd) {
      console.log("✨ ggaurdai.com Configuration:");
      console.log(
        `   Status: ${ggaurd.status === "verified" ? "🎉 READY TO USE" : "⏳ Pending verification"}`
      );

      if (ggaurd.status === "verified") {
        console.log("\n📧 Email Configuration:");
        console.log("   Add to .env.local:");
        console.log("   EMAIL_FROM=GGuard Diagnostics <noreply@ggaurdai.com>");
        console.log("   Or:");
        console.log("   EMAIL_FROM=reports@ggaurdai.com");
      } else {
        console.log("\n📝 Add these DNS records to your registrar:");
        const detailsResponse = await resend.domains.get(ggaurd.id);
        const records = detailsResponse.data?.records || [];
        if (records.length) {
          records.forEach((r) => {
            console.log(`   Type: ${r.record}, Name: ${r.name}, Value: ${r.value}`);
            if (r.priority) console.log(`   Priority: ${r.priority}`);
          });
        }
      }
    }
  } catch (err) {
    console.error("❌ Error:", err.message);
    process.exit(1);
  }
}

main();
