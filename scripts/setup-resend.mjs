#!/usr/bin/env node
/**
 * Resend Domain Setup Script
 * Adds and verifies domain for production email sending
 */

import { Resend } from "resend";

const apiKey = process.env.RESEND_API_KEY;
if (!apiKey) {
  console.error("❌ RESEND_API_KEY environment variable not set");
  process.exit(1);
}

const resend = new Resend(apiKey);
const domain = process.env.RESEND_DOMAIN || "ggaurdai.com";

async function main() {
  try {
    console.log("🚀 Resend Domain Setup\n");

    // List existing domains
    console.log("📋 Checking existing domains...\n");
    const domainsResponse = await resend.domains.list();
    const domains = domainsResponse?.data?.data || [];

    if (domainsResponse?.error) {
      console.error("❌ Error listing domains:", domainsResponse.error);
      process.exit(1);
    }

    const existingDomain = Array.isArray(domains) ? domains.find((d) => d.name === domain) : null;
    if (existingDomain) {
      const detailsResponse = await resend.domains.get(existingDomain.id);
      if (detailsResponse?.error || !detailsResponse?.data) {
        console.error("❌ Error retrieving domain details:", detailsResponse?.error);
        process.exit(1);
      }
      const domainDetails = detailsResponse.data;
      console.log(`✅ Domain already exists: ${domainDetails.name}`);
      console.log(`   Status: ${domainDetails.status}`);
      console.log(`   ID: ${domainDetails.id}\n`);

      if (domainDetails.status === "verified") {
        console.log("🎉 Domain is already verified and ready to use!\n");
        console.log("Environment Configuration:");
        console.log(`  EMAIL_FROM=GGuard Diagnostics <noreply@${domain}>`);
        process.exit(0);
      }

      displayDNSRecords(domainDetails);
      process.exit(0);
    }

    // Add new domain
    console.log(`➕ Adding/retrieving domain: ${domain}\n`);
    const createResponse = await resend.domains.create({
      name: domain,
    });

    // Domain already exists or was created
    if (createResponse?.data) {
      displayDomainInfo(createResponse.data, domain);
      process.exit(0);
    }

    // If domain already registered, try to get it
    if (
      createResponse?.error?.statusCode === 403 &&
      createResponse?.error?.message?.includes("registered already")
    ) {
      console.log(`✅ Domain already registered: ${domain}`);
      console.log(
        `📌 Retrieve domain details from Resend dashboard or try fetching with ID\n`
      );
      console.log(
        "To verify DNS records, visit: https://resend.com/dashboard/domains"
      );
      process.exit(0);
    }

    if (createResponse?.error) {
      console.error("❌ Error adding domain:", createResponse.error);
      process.exit(1);
    }
  } catch (err) {
    console.error("❌ Unexpected error:", err);
    process.exit(1);
  }
}

function displayDNSRecords(domain) {
  console.log("📝 DNS Records Required:\n");

  if (domain.records && Array.isArray(domain.records)) {
    domain.records.forEach((record, idx) => {
      console.log(`Record ${idx + 1}:`);
      console.log(`  Type:     ${record.record}`);
      console.log(`  Name:     ${record.name}`);
      console.log(`  Value:    ${record.value}`);
      if (record.priority) console.log(`  Priority: ${record.priority}`);
      console.log();
    });
  } else {
    console.log("⏳ DNS records will appear once domain is verified.");
    console.log("   Visit https://resend.com/dashboard/domains to add manually.\n");
  }

  console.log("📌 Next Steps:");
  console.log("1. Add the above DNS records to your domain registrar");
  console.log("2. Wait 15-72 hours for DNS propagation");
  console.log("3. Resend will auto-verify when records are detected");
  console.log("4. Update .env.local when verified:");
  console.log(`   EMAIL_FROM=GGuard Diagnostics <noreply@${domain.name}>`);
}

function displayDomainInfo(domain, domainName) {
  console.log(`✅ Domain info retrieved: ${domain.name || domainName}`);
  console.log(`   ID: ${domain.id}`);
  console.log(`   Status: ${domain.status || "pending"}\n`);

  displayDNSRecords(domain);
}

main();
