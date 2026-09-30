"use client";

import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";
import Link from "next/link";

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <main className="mx-auto flex min-h-[60vh] max-w-xl flex-col justify-center px-6 text-center">
      <p className="text-sm font-semibold uppercase tracking-[0.2em] text-cyan-300">Error</p>
      <h1 className="mt-3 text-3xl font-bold tracking-tight text-white">Something went wrong</h1>
      <p className="mt-3 leading-relaxed text-slate-400">Please try again. If the problem continues, contact GGuard support.</p>
      <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
        <button className="rounded-xl bg-cyan-400 px-5 py-3 font-semibold text-slate-950 transition hover:bg-cyan-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-200 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950" onClick={reset}>
          Try again
        </button>
        <Link href="/" className="rounded-xl border border-white/15 px-5 py-3 font-semibold text-slate-200 transition hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300">
          Return home
        </Link>
      </div>
    </main>
  );
}