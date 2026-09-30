import { createHash } from "node:crypto";
import { headers } from "next/headers";
import { getDb } from "./db";
import { logger } from "./observability";

export interface RateLimitConfig {
  key: "ip" | "session" | "user";
  limit: number;
  window: number;
  message?: string;
  namespace?: string;
}

function firstForwardedAddress(value: string | null) {
  return value?.split(",", 1)[0]?.trim() || "unknown";
}

async function identifierFor(key: RateLimitConfig["key"]) {
  const values = await headers();
  if (key === "ip") return firstForwardedAddress(values.get("x-forwarded-for") || values.get("cf-connecting-ip"));
  if (key === "user") return values.get("authorization") || "anonymous";
  return values.get("authorization") || values.get("cookie") || firstForwardedAddress(values.get("x-forwarded-for")) || "anonymous";
}

export async function checkRateLimit(config: RateLimitConfig, trustedIdentifier?: string) {
  const identifier = trustedIdentifier ?? await identifierFor(config.key);
  const digest = createHash("sha256").update(`${config.namespace || `${config.limit}:${config.window}`}:${config.key}:${identifier}`).digest("hex");
  const bucketKey = `${config.key}:${digest}`;
  const resetAt = new Date(Date.now() + config.window);
  const rows = await getDb()`
    INSERT INTO api_rate_limit_buckets(bucket_key,request_count,reset_at)
    VALUES(${bucketKey},1,${resetAt})
    ON CONFLICT(bucket_key) DO UPDATE SET
      request_count=CASE WHEN api_rate_limit_buckets.reset_at<=now() THEN 1 ELSE api_rate_limit_buckets.request_count+1 END,
      reset_at=CASE WHEN api_rate_limit_buckets.reset_at<=now() THEN EXCLUDED.reset_at ELSE api_rate_limit_buckets.reset_at END,
      updated_at=now()
    RETURNING request_count,reset_at`;
  const count = Number(rows[0].request_count);
  const actualResetAt = new Date(String(rows[0].reset_at)).getTime();
  const allowed = count <= config.limit;
  if (!allowed) logger.warn("Rate limit exceeded", { key: config.key, limit: config.limit, bucket: digest.slice(0, 12) });
  return { allowed, remaining: Math.max(0, config.limit - count), resetAt: actualResetAt };
}

export function withRateLimit(config: RateLimitConfig) {
  return (handler: (request: Request) => Promise<Response>) => async (request: Request) => {
    const result = await checkRateLimit(config);
    if (!result.allowed) return Response.json({ success:false,error:{ code:"RATE_LIMITED",message:config.message || "Too many requests. Please try again later." } }, { status:429,headers:{ "Retry-After":String(Math.max(1,Math.ceil((result.resetAt-Date.now())/1000))),"X-RateLimit-Limit":String(config.limit),"X-RateLimit-Remaining":"0","X-RateLimit-Reset":String(result.resetAt) } });
    const response = await handler(request);
    const responseHeaders = new Headers(response.headers);
    responseHeaders.set("X-RateLimit-Limit", String(config.limit));
    responseHeaders.set("X-RateLimit-Remaining", String(result.remaining));
    responseHeaders.set("X-RateLimit-Reset", String(result.resetAt));
    return new Response(response.body,{status:response.status,headers:responseHeaders});
  };
}

export const RateLimits = {
  public:{key:"ip",limit:100,window:15*60*1000} as RateLimitConfig,
  auth:{key:"ip",limit:10,window:15*60*1000} as RateLimitConfig,
  upload:{key:"session",limit:50,window:60*60*1000,message:"Upload limit reached. Please try again later."} as RateLimitConfig,
  assessment:{key:"session",limit:10,window:60*60*1000,message:"Assessment creation limit reached for this hour."} as RateLimitConfig,
  payment:{key:"session",limit:5,window:60*60*1000,message:"Too many checkout attempts. Please try again later."} as RateLimitConfig,
};
