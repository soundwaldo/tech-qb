import { neon, type NeonQueryFunction } from "@neondatabase/serverless";

let client: NeonQueryFunction<false, false> | null = null;

export function getDb(): NeonQueryFunction<false, false> {
    if (!client) {
        const url = process.env.DATABASE_URL;
        if (!url) throw new Error("DATABASE_URL is not configured");
        client = neon(url);
    }
    return client;
}

export function first<T>(rows: unknown[]): T | null {
    return (rows[0] as T | undefined) ?? null;
}
