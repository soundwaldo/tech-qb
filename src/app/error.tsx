"use client";

import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <main className="mx-auto flex min-h-[60vh] max-w-xl flex-col justify-center px-6 text-center">
      <h1 className="text-3xl font-bold text-slate-950">Something went wrong</h1>
      <p className="mt-3 text-slate-600">Please try again. If the problem continues, contact GGuard support.</p>
      <button className="mx-auto mt-6 rounded-lg bg-teal-700 px-5 py-3 font-semibold text-white" onClick={reset}>Try again</button>
    </main>
  );
}
