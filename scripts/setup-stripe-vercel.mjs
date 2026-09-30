#!/usr/bin/env node

/**
 * Set up Stripe price IDs in Vercel environment
 * 
 * Usage:
 *   node scripts/setup-stripe-vercel.mjs --production
 *   node scripts/setup-stripe-vercel.mjs --preview
 * 
 * Before running:
 * 1. Create price objects in Stripe Dashboard
 * 2. Copy the price IDs
 * 3. Run this script with the --production or --preview flag
 */

import { execSync } from "child_process";
import fs from "fs";

const PRICE_IDS = {
    // Assessment tiers (D2C)
    STRIPE_PRICE_STANDARD: "price_1QvnI0",
    STRIPE_PRICE_EXPRESS: "price_1QvnI1",
    STRIPE_PRICE_COMPREHENSIVE: "price_1QvnI2",

    // HOA plans
    STRIPE_PRICE_HOA_BASIC: "price_hoa_basic",
    STRIPE_PRICE_HOA_PREMIUM: "price_hoa_premium",
    STRIPE_PRICE_HOA_ENTERPRISE: "price_hoa_enterprise",

    // Property Manager plans
    STRIPE_PRICE_PM_STARTER: "price_pm_starter",
    STRIPE_PRICE_PM_PROFESSIONAL: "price_pm_professional",
    STRIPE_PRICE_PM_ENTERPRISE: "price_pm_enterprise",
};

const environment = process.argv[2]?.replace("--", "") || "preview";

if (!["production", "preview", "development"].includes(environment)) {
    console.error("Usage: node setup-stripe-vercel.mjs --[production|preview|development]");
    process.exit(1);
}

console.log(`🔧 Setting up Stripe price IDs for: ${environment}`);
console.log("⚠️  Make sure you update PRICE_IDS with YOUR Stripe price IDs first!");
console.log("");

const commands = Object.entries(PRICE_IDS).map(([key, value]) => {
    const args = environment === "development" ? [] : ["--${environment}", "--yes"];
    return `vercel env add ${key} ${value} ${args.join(" ")}`;
});

console.log("Commands to run:");
commands.forEach((cmd) => console.log(`  ${cmd}`));
console.log("");

const shouldExecute = process.argv.includes("--execute");
if (!shouldExecute) {
    console.log("To execute these commands, run with --execute flag:");
    console.log(`  node scripts/setup-stripe-vercel.mjs --${environment} --execute`);
    process.exit(0);
}

console.log("Executing commands...");
try {
    for (const [key, value] of Object.entries(PRICE_IDS)) {
        const args = environment === "development" ? "" : `--${environment}`;
        console.log(`Setting ${key}...`);
        execSync(`vercel env add ${key} ${value} ${args} --yes`, { stdio: "inherit" });
    }
    console.log("✅ Stripe price IDs configured in Vercel");
} catch (error) {
    console.error("❌ Failed to set environment variables");
    console.error(error);
    process.exit(1);
}
