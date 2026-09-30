#!/usr/bin/env node

/**
 * GGuard Phase 0: Production Readiness Validation & Setup
 * 
 * Checks infrastructure, environment variables, and dependencies
 * Run after pulling Phase 0 updates
 */

import fs from "fs";
import path from "path";
import { execSync } from "child_process";

const ROOT = process.cwd();
const CHECKS = [];

function check(name, fn) {
    try {
        const result = fn();
        CHECKS.push({ name, status: result ? "✅" : "⚠️", message: result });
        return result;
    } catch (error) {
        CHECKS.push({
            name,
            status: "❌",
            message: error instanceof Error ? error.message : String(error),
        });
        return false;
    }
}

console.log("🔍 GGuard Phase 0: Production Readiness Check\n");

// ─────────────────────────────────────────────────────────────────
// Dependencies
// ─────────────────────────────────────────────────────────────────

check("@sentry/nextjs installed", () => {
    const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, "package.json"), "utf-8"));
    return "dependencies" in pkg && "@sentry/nextjs" in pkg.dependencies;
});

check("winston installed", () => {
    const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, "package.json"), "utf-8"));
    return "dependencies" in pkg && "winston" in pkg.dependencies;
});

// ─────────────────────────────────────────────────────────────────
// Files Created
// ─────────────────────────────────────────────────────────────────

check("src/lib/observability.ts created", () => {
    return fs.existsSync(path.join(ROOT, "src/lib/observability.ts"));
});

check("src/lib/api-response.ts created", () => {
    return fs.existsSync(path.join(ROOT, "src/lib/api-response.ts"));
});

check("src/lib/rate-limit.ts created", () => {
    return fs.existsSync(path.join(ROOT, "src/lib/rate-limit.ts"));
});

check("src/middleware.ts created", () => {
    return fs.existsSync(path.join(ROOT, "src/middleware.ts"));
});

check("src/lib/env-validation.ts created", () => {
    return fs.existsSync(path.join(ROOT, "src/lib/env-validation.ts"));
});

// ─────────────────────────────────────────────────────────────────
// Environment Variables
// ─────────────────────────────────────────────────────────────────

check("DATABASE_URL configured", () => {
    return Boolean(process.env.DATABASE_URL);
});

check("RESEND_API_KEY configured", () => {
    return Boolean(process.env.RESEND_API_KEY);
});

check("ADMIN_SESSION_SECRET length >= 32", () => {
    const secret = process.env.ADMIN_SESSION_SECRET || "";
    return secret.length >= 32 ? "✅" : `Only ${secret.length} chars (needs 32+)`;
});

check("PII_ENCRYPTION_KEY length >= 32", () => {
    const key = process.env.PII_ENCRYPTION_KEY || "";
    return key.length >= 32 ? "✅" : `Only ${key.length} chars (needs 32+)`;
});

check("STRIPE_SECRET_KEY configured", () => {
    return Boolean(process.env.STRIPE_SECRET_KEY && !process.env.STRIPE_SECRET_KEY.includes("placeholder"));
});

check("STRIPE_WEBHOOK_SECRET configured", () => {
    return Boolean(process.env.STRIPE_WEBHOOK_SECRET);
});

check("NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY configured", () => {
    return Boolean(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY);
});

// ─────────────────────────────────────────────────────────────────
// Build & Tests
// ─────────────────────────────────────────────────────────────────

check("Build compiles successfully", () => {
    try {
        execSync("npm run build", { stdio: "ignore", cwd: ROOT });
        return "✅";
    } catch {
        return "Build failed - check TypeScript errors";
    }
});

// ─────────────────────────────────────────────────────────────────
// Report
// ─────────────────────────────────────────────────────────────────

console.log("Check Results:");
console.log("─".repeat(60));

const passed = CHECKS.filter((c) => c.status === "✅").length;
const warned = CHECKS.filter((c) => c.status === "⚠️").length;
const failed = CHECKS.filter((c) => c.status === "❌").length;

for (const check of CHECKS) {
    console.log(`${check.status} ${check.name.padEnd(40)} ${check.message}`);
}

console.log("─".repeat(60));
console.log(`\nSummary: ${passed} passed, ${warned} warned, ${failed} failed`);

if (failed > 0) {
    console.log("\n❌ Critical issues found. Run:");
    console.log("   npm run build                    # Check TypeScript errors");
    console.log("   node scripts/setup-stripe-vercel.mjs --preview  # Setup Stripe prices");
    process.exit(1);
} else if (warned > 0) {
    console.log("\n⚠️  Some optional configurations missing.");
    console.log("   Review PRODUCTION_AUDIT.md for recommendations");
    process.exit(0);
} else {
    console.log("\n✅ All Phase 0 checks passed!");
    console.log("\nNext steps:");
    console.log("   1. Add SENTRY_DSN to .env.local for error tracking");
    console.log("   2. Set STRIPE_PRICE_* variables in Vercel");
    console.log("   3. Commit changes: git add -A && git commit -m 'phase-0: production-readiness'");
    console.log("   4. Push to main: git push origin main");
    process.exit(0);
}
