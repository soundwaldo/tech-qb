"use client";

import { useState } from "react";

export function BillingButton() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function openBillingPortal() {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/billing/portal", { method: "POST" });
      const body = await response.json();
      if (!response.ok || !body.url) throw new Error(body.error || "Billing could not be opened");
      window.location.assign(body.url);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Billing could not be opened");
      setLoading(false);
    }
  }

  return <div className="text-right">
    <button type="button" onClick={openBillingPortal} disabled={loading} className="rounded-lg border border-slate-500 px-4 py-2 text-sm font-semibold text-slate-200 hover:border-cyan-400 hover:text-cyan-300 disabled:opacity-60">
      {loading ? "Opening billing..." : "Manage billing"}
    </button>
    {error ? <p role="alert" className="mt-2 text-xs text-red-300">{error}</p> : null}
  </div>;
}
