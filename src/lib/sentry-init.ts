/**
 * Sentry initialization for error tracking
 * Set SENTRY_DSN environment variable to enable
 */

import * as Sentry from "@sentry/nextjs";

export function initializeSentry() {
    if (!process.env.SENTRY_DSN) {
        console.log("ℹ️ Sentry DSN not configured - error tracking disabled");
        return;
    }

    if (typeof window !== "undefined") {
        // Client-side initialization
        Sentry.init({
            dsn: process.env.SENTRY_DSN,
            environment: process.env.NODE_ENV,
            tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,
        });
    } else {
        // Server-side initialization
        Sentry.init({
            dsn: process.env.SENTRY_DSN,
            environment: process.env.NODE_ENV,
            tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,
        });
    }

    console.log("✅ Sentry initialized for error tracking");
}

export { Sentry };
