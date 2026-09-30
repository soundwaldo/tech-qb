import { drainPreDispatchOutbox, processPreDispatchRetention } from "@/features/pre-dispatch/worker";

export const maxDuration = 300;

async function run(request: Request) {
  const supplied = request.headers.get("authorization");
  // Vercel Cron uses CRON_SECRET; a manual worker credential must not shadow it.
  const authorized = [process.env.CRON_SECRET, process.env.PRE_DISPATCH_WORKER_SECRET]
    .some((secret) => Boolean(secret) && supplied === `Bearer ${secret}`);
  if (!authorized) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const [outbox, retention] = await Promise.all([drainPreDispatchOutbox(8), processPreDispatchRetention()]);
  return Response.json({ outbox, retention }, { headers: { "cache-control": "no-store" } });
}

export const POST = run;
export const GET = run;
