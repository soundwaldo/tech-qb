import "server-only";
import { createNeonAuth } from "@neondatabase/auth/next/server";
import { createHash } from "crypto";

function required(name: "NEON_AUTH_BASE_URL"): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required`);
  return value;
}

const derivedFallback = process.env.DATABASE_URL
  ? createHash("sha256").update(`gguard-neon-auth:${process.env.DATABASE_URL}`).digest("hex")
  : "";
const cookieSecret = process.env.NEON_AUTH_COOKIE_SECRET || process.env.ADMIN_SESSION_SECRET || process.env.PII_ENCRYPTION_KEY || derivedFallback;
if (!cookieSecret || cookieSecret.length < 32) {
  throw new Error("NEON_AUTH_COOKIE_SECRET must be at least 32 characters");
}

export const neonAuth = createNeonAuth({
  baseUrl: required("NEON_AUTH_BASE_URL"),
  cookies: { secret: cookieSecret, sameSite: "lax" },
});

export async function getCurrentUser(): Promise<{ id: string; name?: string | null; email?: string | null } | null> {
  const { data } = await neonAuth.getSession();
  const user = data?.user;
  if (!user?.id) return null;
  return { id: user.id, name: user.name, email: user.email };
}
