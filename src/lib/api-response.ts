/**
 * Standardized API response format
 * All API routes return consistent error/success responses with proper status codes
 */

import type { NextResponse } from "next/server";
import { captureException, logger } from "./observability";

// ─────────────────────────────────────────────────────────────────
// Response Types
// ─────────────────────────────────────────────────────────────────

export interface ApiSuccessResponse<T = unknown> {
    success: true;
    data: T;
    meta?: {
        timestamp: string;
        version: string;
    };
}

export interface ApiErrorResponse {
    success: false;
    error: {
        code: string;
        message: string;
        details?: Record<string, unknown>;
        traceId?: string;
    };
    meta?: {
        timestamp: string;
    };
}

export type ApiResponse<T = unknown> = ApiSuccessResponse<T> | ApiErrorResponse;

// ─────────────────────────────────────────────────────────────────
// Error Codes
// ─────────────────────────────────────────────────────────────────

export const ERROR_CODES = {
    // Client errors (4xx)
    BAD_REQUEST: "BAD_REQUEST",
    UNAUTHORIZED: "UNAUTHORIZED",
    FORBIDDEN: "FORBIDDEN",
    NOT_FOUND: "NOT_FOUND",
    CONFLICT: "CONFLICT",
    UNPROCESSABLE_ENTITY: "UNPROCESSABLE_ENTITY",
    RATE_LIMITED: "RATE_LIMITED",
    PAYLOAD_TOO_LARGE: "PAYLOAD_TOO_LARGE",

    // Server errors (5xx)
    INTERNAL_ERROR: "INTERNAL_ERROR",
    SERVICE_UNAVAILABLE: "SERVICE_UNAVAILABLE",
    DATABASE_ERROR: "DATABASE_ERROR",
    EXTERNAL_SERVICE_ERROR: "EXTERNAL_SERVICE_ERROR",
    TIMEOUT: "TIMEOUT",

    // Application-specific
    VALIDATION_ERROR: "VALIDATION_ERROR",
    AUTHENTICATION_FAILED: "AUTHENTICATION_FAILED",
    SESSION_EXPIRED: "SESSION_EXPIRED",
    PAYMENT_ERROR: "PAYMENT_ERROR",
    EMAIL_ERROR: "EMAIL_ERROR",
    STORAGE_ERROR: "STORAGE_ERROR",
} as const;

export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES];

// ─────────────────────────────────────────────────────────────────
// Response Builders
// ─────────────────────────────────────────────────────────────────

export function successResponse<T>(data: T, status: number = 200): { response: ApiSuccessResponse<T>; status: number } {
    return {
        response: {
            success: true,
            data,
            meta: {
                timestamp: new Date().toISOString(),
                version: "1.0",
            },
        },
        status,
    };
}

export function errorResponse(
    code: ErrorCode,
    message: string,
    status: number,
    details?: Record<string, unknown>,
    traceId?: string
): { response: ApiErrorResponse; status: number } {
    return {
        response: {
            success: false,
            error: {
                code,
                message,
                details,
                traceId,
            },
            meta: {
                timestamp: new Date().toISOString(),
            },
        },
        status,
    };
}

// ─────────────────────────────────────────────────────────────────
// HTTP Handler Wrapper (for API routes)
// ─────────────────────────────────────────────────────────────────

export async function withErrorHandling(
    handler: (request: Request) => Promise<Response>,
    request: Request,
    routeName: string,
    method: string
): Promise<Response> {
    const startTime = Date.now();
    const traceId = crypto.getRandomValues(new Uint8Array(16)).toString();

    try {
        const response = await handler(request);
        const durationMs = Date.now() - startTime;
        const statusCode = response.status;

        // TODO: Implement logApiCall from observability module
        // logApiCall(method, routeName, statusCode, durationMs, { traceId });

        // Add trace ID to response headers
        const headers = new Headers(response.headers);
        headers.set("X-Trace-ID", traceId);

        return new Response(response.body, {
            status: response.status,
            headers,
        });
    } catch (error) {
        const durationMs = Date.now() - startTime;
        const err = error instanceof Error ? error : new Error(String(error));

        logger.error(`API Error in ${routeName}`, {
            method,
            route: routeName,
            error: err.message,
            stack: err.stack,
            durationMs,
            traceId,
        });

        captureException(err, {
            route: routeName,
            method,
            traceId,
        });

        const { response, status } = errorResponse(
            ERROR_CODES.INTERNAL_ERROR,
            "An unexpected error occurred",
            500,
            { details: process.env.NODE_ENV === "development" ? err.message : undefined },
            traceId
        );

        // TODO: Implement logApiCall from observability module
        // logApiCall(method, routeName, 500, durationMs, { traceId, error: err.message });

        return Response.json(response, { status });
    }
}

// ─────────────────────────────────────────────────────────────────
// Common API Responses
// ─────────────────────────────────────────────────────────────────

export const CommonResponses = {
    badRequest: (message: string, details?: Record<string, unknown>) =>
        errorResponse(ERROR_CODES.BAD_REQUEST, message, 400, details),

    unauthorized: (message: string = "Authentication required") =>
        errorResponse(ERROR_CODES.UNAUTHORIZED, message, 401),

    forbidden: (message: string = "Access denied") =>
        errorResponse(ERROR_CODES.FORBIDDEN, message, 403),

    notFound: (resource: string) =>
        errorResponse(ERROR_CODES.NOT_FOUND, `${resource} not found`, 404),

    conflict: (message: string) =>
        errorResponse(ERROR_CODES.CONFLICT, message, 409),

    validationError: (message: string, details?: Record<string, unknown>) =>
        errorResponse(ERROR_CODES.VALIDATION_ERROR, message, 422, details),

    rateLimited: () =>
        errorResponse(ERROR_CODES.RATE_LIMITED, "Too many requests. Please try again later.", 429),

    payloadTooLarge: () =>
        errorResponse(ERROR_CODES.PAYLOAD_TOO_LARGE, "Request body is too large", 413),

    internalError: (traceId?: string) =>
        errorResponse(ERROR_CODES.INTERNAL_ERROR, "An unexpected error occurred", 500, undefined, traceId),

    databaseError: (traceId?: string) =>
        errorResponse(ERROR_CODES.DATABASE_ERROR, "Database operation failed", 500, undefined, traceId),

    externalServiceError: (service: string, traceId?: string) =>
        errorResponse(ERROR_CODES.EXTERNAL_SERVICE_ERROR, `${service} service is unavailable`, 502, undefined, traceId),

    timeout: (traceId?: string) =>
        errorResponse(ERROR_CODES.TIMEOUT, "Request timed out", 504, undefined, traceId),
};
