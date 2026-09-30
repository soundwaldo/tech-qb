/**
 * Environment variable validation and setup
 * Runs at build time and startup to ensure all required vars are present
 */

const REQUIRED_VARS_PRODUCTION = [
    "DATABASE_URL",
    "RESEND_API_KEY",
    "STRIPE_SECRET_KEY",
    "STRIPE_WEBHOOK_SECRET",
    "STRIPE_BILLING_PORTAL_CONFIGURATION",
    "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY",
    "ADMIN_SESSION_SECRET",
    "ADMIN_PASSWORD",
    "PII_ENCRYPTION_KEY",
    "NEXT_PUBLIC_APP_URL",
];

const REQUIRED_VARS_DEVELOPMENT = [
    "DATABASE_URL",
    "NEXT_PUBLIC_APP_URL",
];

interface ValidationResult {
    valid: boolean;
    missing: string[];
    warnings: string[];
}

export function validateEnvironment(env: NodeJS.ProcessEnv = process.env): ValidationResult {
    const nodeEnv = env.NODE_ENV || "development";
    const isProduction = nodeEnv === "production";
    const requiredVars = isProduction ? REQUIRED_VARS_PRODUCTION : REQUIRED_VARS_DEVELOPMENT;

    const missing: string[] = [];
    const warnings: string[] = [];

    // Check required variables
    for (const varName of requiredVars) {
        if (!env[varName]) {
            missing.push(varName);
        }
    }

    // Check Stripe price IDs in production
    if (isProduction && env.STRIPE_SECRET_KEY && !env.STRIPE_SECRET_KEY.includes("placeholder")) {
        const priceTiers = [
            "STRIPE_PRICE_STANDARD",
            "STRIPE_PRICE_EXPRESS",
            "STRIPE_PRICE_COMPREHENSIVE",
        ];

        for (const tier of priceTiers) {
            if (!env[tier] || env[tier] === "price_xxx") {
                missing.push(tier);
            }
        }
    }

    const secretMode = env.STRIPE_SECRET_KEY?.startsWith("sk_live_") ? "live" : env.STRIPE_SECRET_KEY?.startsWith("sk_test_") ? "test" : null;
    const publishableMode = env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY?.startsWith("pk_live_") ? "live" : env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY?.startsWith("pk_test_") ? "test" : null;
    if (env.STRIPE_SECRET_KEY && !secretMode) warnings.push("STRIPE_SECRET_KEY must start with sk_test_ or sk_live_ (restricted CLI keys are not production app keys)");
    if (env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY && !publishableMode) warnings.push("NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY must start with pk_test_ or pk_live_");
    if (secretMode && publishableMode && secretMode !== publishableMode) missing.push("matching Stripe key modes (secret and publishable)");

    // Check optional but recommended variables
    if (!env.SENTRY_DSN && isProduction) {
        warnings.push("SENTRY_DSN not configured (error tracking disabled)");
    }

    // Check PII encryption key strength
    if (env.PII_ENCRYPTION_KEY && env.PII_ENCRYPTION_KEY.length < 32) {
        warnings.push("PII_ENCRYPTION_KEY should be at least 32 characters");
    }

    // Check admin password strength
    if (env.ADMIN_PASSWORD && env.ADMIN_PASSWORD.length < 12) {
        warnings.push("ADMIN_PASSWORD should be at least 12 characters");
    }

    return {
        valid: missing.length === 0,
        missing,
        warnings,
    };
}

export function printValidationResult(result: ValidationResult) {
    if (result.missing.length > 0) {
        console.error("❌ Missing required environment variables:");
        result.missing.forEach((v) => console.error(`   - ${v}`));
        return false;
    }

    if (result.warnings.length > 0) {
        console.warn("⚠️  Environment warnings:");
        result.warnings.forEach((w) => console.warn(`   - ${w}`));
    } else {
        console.log("✅ All environment variables configured");
    }

    return true;
}

// Run validation if imported directly
if (require.main === module) {
    const result = validateEnvironment();
    const ok = printValidationResult(result);
    process.exit(ok ? 0 : 1);
}
