/**
 * Observability: Error tracking, logging, metrics
 * Integrated with: Sentry (error tracking), Winston (structured logging)
 */

import * as Sentry from "@sentry/nextjs";
import winston from "winston";

// ─────────────────────────────────────────────────────────────────
// Winston Logger (Structured Logging)
// ─────────────────────────────────────────────────────────────────

export const logger = winston.createLogger({
    level: process.env.LOG_LEVEL || "info",
    format: winston.format.combine(
        winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
        winston.format.errors({ stack: true }),
        winston.format.json()
    ),
    defaultMeta: { 
        service: "gguard",
        environment: process.env.NODE_ENV,
        version: process.env.NEXT_PUBLIC_APP_VERSION || "dev"
    },
    transports: [
        new winston.transports.Console({
            format: winston.format.combine(
                winston.format.colorize(),
                winston.format.printf(({ timestamp, level, message, ...meta }) => {
                    const metaStr = Object.keys(meta).length ? JSON.stringify(meta, null, 2) : "";
                    return `${timestamp} [${level}] ${message} ${metaStr}`;
                })
            ),
        }),
    ],
});

// Serverless filesystems are ephemeral or read-only. Keep production logs on
// stdout so the hosting platform can collect them and Sentry can alert on errors.

// ─────────────────────────────────────────────────────────────────
// Sentry Integration
// ─────────────────────────────────────────────────────────────────

export function initSentry() {
    if (!process.env.SENTRY_DSN) {
        logger.warn("SENTRY_DSN not configured, error tracking disabled");
        return;
    }

    Sentry.init({
        dsn: process.env.SENTRY_DSN,
        environment: process.env.NODE_ENV,
        tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,
        beforeSend(event) {
            // Filter out errors to not send
            if (event.exception) {
                const error = event.exception.values?.[0].value;
                // Don't track 404s, client disconnects, etc.
                if (error?.includes("not found") || error?.includes("Client closed request")) {
                    return null;
                }
            }
            return event;
        },
    });
}

// ─────────────────────────────────────────────────────────────────
// Error Context Utilities
// ─────────────────────────────────────────────────────────────────

export function captureException(error: unknown, context?: Record<string, unknown>) {
    const err = error instanceof Error ? error : new Error(String(error));
    
    logger.error("Captured exception", {
        error: err.message,
        stack: err.stack,
        ...context,
    });

    Sentry.captureException(err, {
        contexts: context ? { custom: context } : undefined,
    });
}

export function captureMessage(message: string, level: "info" | "warning" | "error" = "info", context?: Record<string, unknown>) {
    logger[level](message, context);
    Sentry.captureMessage(message, level === "error" ? "error" : level === "warning" ? "warning" : "info");
}

// ─────────────────────────────────────────────────────────────────
// Metrics/Performance
// ─────────────────────────────────────────────────────────────────

export function logApiCall(method: string, path: string, statusCode: number, durationMs: number, context?: Record<string, unknown>) {
    const level = statusCode >= 500 ? "error" : statusCode >= 400 ? "warn" : "info";
    logger[level](`API ${method} ${path}`, {
        method,
        path,
        statusCode,
        durationMs,
        ...context,
    });

    // Track in Sentry as well for analysis
    if (statusCode >= 500) {
        Sentry.captureMessage(`API Error: ${method} ${path} (${statusCode})`, "error");
    }
}

export function logDatabaseOperation(operation: string, table: string, durationMs: number, rowsAffected?: number, error?: Error) {
    if (error) {
        logger.error(`DB ${operation} on ${table}`, {
            operation,
            table,
            durationMs,
            rowsAffected,
            error: error.message,
        });
        captureException(error, { operation, table });
    } else {
        logger.debug(`DB ${operation} on ${table}`, {
            operation,
            table,
            durationMs,
            rowsAffected,
        });
    }
}

export function logExternalApiCall(service: string, method: string, statusCode: number, durationMs: number, error?: Error) {
    const level = error || statusCode >= 500 ? "error" : statusCode >= 400 ? "warn" : "info";
    logger[level](`External API: ${service} ${method}`, {
        service,
        method,
        statusCode,
        durationMs,
        error: error?.message,
    });

    if (error) {
        captureException(error, { service, method, statusCode });
    }
}
