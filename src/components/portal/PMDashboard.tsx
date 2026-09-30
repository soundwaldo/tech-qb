"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { AlertTriangle, CheckCircle2, DollarSign, TrendingUp } from "lucide-react";
import { Input } from "@/components/ui/Input";
import { formatCurrency } from "@/lib/utils";
import { BillingButton } from "@/components/portal/BillingButton";

interface TenantSubmission {
  id: string;
  property_label: string;
  zip_code: string;
  status: string;
  problems: string[];
  created_at: string;
  diagnosis?: { summary: string; fair_price_low_cents: number; fair_price_high_cents: number } | null;
}

interface ContractorQuote {
  id: string;
  property_label: string;
  contractor_name: string;
  quote_cents: number;
  status: string;
  submitted_at: string;
  gguard_fair_low?: number;
  gguard_fair_high?: number;
  overpriced: boolean;
}

export function PMDashboard() {
  const [submissions, setSubmissions] = useState<TenantSubmission[]>([]);
  const [quotes, setQuotes] = useState<ContractorQuote[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"submissions" | "quotes" | "analysis">("submissions");
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [submissionsRes, quotesRes] = await Promise.all([
          fetch("/api/portal/pm/submissions"),
          fetch("/api/portal/pm/quotes"),
        ]);
        setSubmissions((await submissionsRes.json()) || []);
        setQuotes((await quotesRes.json()) || []);
      } catch (error) {
        console.error("Failed to fetch portal data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const stats = {
    totalSubmissions: submissions.length,
    totalQuotes: quotes.length,
    overpricedCount: quotes.filter((q) => q.overpriced).length,
    totalSpend: quotes.reduce((sum, q) => sum + q.quote_cents, 0),
    potentialSavings: quotes
      .filter((q) => q.overpriced && q.gguard_fair_high)
      .reduce((sum, q) => sum + Math.max(0, q.quote_cents - (q.gguard_fair_high || 0)), 0),
  };

  const getStatusBadge = (status: string) => {
    const badges: Record<string, { color: string; label: string }> = {
      delivered: { color: "bg-emerald-900/30 border-emerald-400/30 text-emerald-300", label: "Ready" },
      awaiting_expert_review: { color: "bg-blue-900/30 border-blue-400/30 text-blue-300", label: "Reviewing" },
      pending_payment: { color: "bg-amber-900/30 border-amber-400/30 text-amber-300", label: "Pending" },
    };
    const badge = badges[status] || { color: "bg-slate-700/30 border-slate-500/30", label: status };
    return (
      <span className={`inline-block rounded-full border px-3 py-1 text-xs font-medium ${badge.color}`}>
        {badge.label}
      </span>
    );
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap justify-end gap-3">
        <BillingButton />
        <Link href="/upload?ref=pm" className="rounded-lg border border-cyan-400 px-4 py-2 text-sm font-semibold text-cyan-300 hover:bg-cyan-400/10">
          New assessment
        </Link>
        <Link href="/submit-repair" className="rounded-lg bg-cyan-500 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-cyan-400">
          Submit repair record
        </Link>
      </div>
      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <div className="rounded-xl bg-slate-800/50 border border-slate-700 p-4">
          <p className="text-sm text-slate-400">Tenant Submissions</p>
          <p className="mt-1 text-2xl font-bold text-white">{stats.totalSubmissions}</p>
        </div>
        <div className="rounded-xl bg-blue-900/20 border border-blue-400/30 p-4">
          <p className="text-sm text-slate-400">Contractor Quotes</p>
          <p className="mt-1 text-2xl font-bold text-blue-400">{stats.totalQuotes}</p>
        </div>
        <div className="rounded-xl bg-red-900/20 border border-red-400/30 p-4">
          <p className="text-sm text-slate-400">Potentially Overpriced</p>
          <p className="mt-1 text-2xl font-bold text-red-400">{stats.overpricedCount}</p>
        </div>
        <div className="rounded-xl bg-emerald-900/20 border border-emerald-400/30 p-4">
          <p className="text-sm text-slate-400">Potential Savings</p>
          <p className="mt-1 text-2xl font-bold text-emerald-400">{formatCurrency(stats.potentialSavings)}</p>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex gap-2 border-b border-slate-700">
        {(["submissions", "quotes", "analysis"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-3 font-medium text-sm transition ${
              activeTab === tab
                ? "border-b-2 border-cyan-400 text-cyan-400"
                : "text-slate-400 hover:text-slate-300"
            }`}
          >
            {tab === "submissions" && "Tenant Submissions"}
            {tab === "quotes" && "Contractor Quotes"}
            {tab === "analysis" && "Cost Analysis"}
          </button>
        ))}
      </div>

      {/* Submissions Tab */}
      {activeTab === "submissions" && (
        <div className="space-y-4">
          <Input placeholder="Search property..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full md:w-80" />
          <div className="rounded-xl border border-slate-700 overflow-hidden bg-slate-800/30">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-700 bg-slate-900/50">
                    <th className="px-4 py-3 text-left font-semibold text-slate-300">Property</th>
                    <th className="px-4 py-3 text-left font-semibold text-slate-300">Problems</th>
                    <th className="px-4 py-3 text-left font-semibold text-slate-300">Status</th>
                    <th className="px-4 py-3 text-left font-semibold text-slate-300">Fair Price Range</th>
                    <th className="px-4 py-3 text-left font-semibold text-slate-300">Submitted</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-slate-400">
                        Loading...
                      </td>
                    </tr>
                  ) : submissions.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-slate-400">
                        No tenant submissions yet
                      </td>
                    </tr>
                  ) : (
                    submissions.map((sub) => (
                      <tr key={sub.id} className="border-b border-slate-700/50 hover:bg-slate-800/50">
                        <td className="px-4 py-3">
                          <div>
                            <p className="font-medium text-white">{sub.property_label}</p>
                            <p className="text-xs text-slate-400">{sub.zip_code}</p>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-300">{sub.problems.slice(0, 2).join(", ")}</td>
                        <td className="px-4 py-3">{getStatusBadge(sub.status)}</td>
                        <td className="px-4 py-3 text-slate-300">
                          {sub.diagnosis
                            ? `${formatCurrency(sub.diagnosis.fair_price_low_cents)} - ${formatCurrency(
                                sub.diagnosis.fair_price_high_cents
                              )}`
                            : "—"}
                        </td>
                        <td className="px-4 py-3 text-slate-400 text-xs">{new Date(sub.created_at).toLocaleDateString()}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Quotes Tab */}
      {activeTab === "quotes" && (
        <div className="space-y-4">
          <div className="rounded-xl border border-slate-700 overflow-hidden bg-slate-800/30">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-700 bg-slate-900/50">
                    <th className="px-4 py-3 text-left font-semibold text-slate-300">Property</th>
                    <th className="px-4 py-3 text-left font-semibold text-slate-300">Contractor</th>
                    <th className="px-4 py-3 text-left font-semibold text-slate-300">Quote</th>
                    <th className="px-4 py-3 text-left font-semibold text-slate-300">GGuard Fair Range</th>
                    <th className="px-4 py-3 text-left font-semibold text-slate-300">Flag</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-slate-400">
                        Loading...
                      </td>
                    </tr>
                  ) : quotes.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-slate-400">
                        No contractor quotes submitted
                      </td>
                    </tr>
                  ) : (
                    quotes.map((quote) => (
                      <tr key={quote.id} className={`border-b border-slate-700/50 hover:bg-slate-800/50 ${quote.overpriced ? "bg-red-900/10" : ""}`}>
                        <td className="px-4 py-3">
                          <p className="font-medium text-white">{quote.property_label}</p>
                        </td>
                        <td className="px-4 py-3 text-slate-300">{quote.contractor_name}</td>
                        <td className="px-4 py-3 font-semibold text-white">{formatCurrency(quote.quote_cents)}</td>
                        <td className="px-4 py-3 text-slate-300">
                          {quote.gguard_fair_low && quote.gguard_fair_high
                            ? `${formatCurrency(quote.gguard_fair_low)} - ${formatCurrency(quote.gguard_fair_high)}`
                            : "N/A"}
                        </td>
                        <td className="px-4 py-3">
                          {quote.overpriced ? (
                            <div className="flex items-center gap-2 text-red-400">
                              <AlertTriangle className="h-4 w-4" />
                              <span className="text-xs font-medium">+{formatCurrency(quote.quote_cents - (quote.gguard_fair_high || 0))}</span>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2 text-emerald-400">
                              <CheckCircle2 className="h-4 w-4" />
                              <span className="text-xs">Fair</span>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Analysis Tab */}
      {activeTab === "analysis" && (
        <div className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-xl border border-slate-700 bg-slate-800/50 p-6">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm text-slate-400">Total Portfolio Spend</p>
                  <p className="mt-2 text-3xl font-bold text-white">{formatCurrency(stats.totalSpend)}</p>
                </div>
                <DollarSign className="h-8 w-8 text-slate-600" />
              </div>
            </div>

            <div className="rounded-xl border border-emerald-400/30 bg-emerald-900/20 p-6">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm text-slate-400">Potential Savings Identified</p>
                  <p className="mt-2 text-3xl font-bold text-emerald-400">{formatCurrency(stats.potentialSavings)}</p>
                  <p className="mt-1 text-xs text-emerald-300">from {stats.overpricedCount} overpriced quotes</p>
                </div>
                <TrendingUp className="h-8 w-8 text-emerald-600" />
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-cyan-400/30 bg-cyan-900/20 p-6">
            <h3 className="font-semibold text-cyan-300 mb-4">Cost Optimization Tips</h3>
            <ul className="space-y-3 text-sm text-slate-300">
              <li className="flex gap-3">
                <span className="text-cyan-400 font-bold flex-shrink-0">1.</span>
                <span>Review the {stats.overpricedCount} flagged quotes above — they exceed GGuard&apos;s fair price estimates</span>
              </li>
              <li className="flex gap-3">
                <span className="text-cyan-400 font-bold flex-shrink-0">2.</span>
                <span>Negotiate with contractors or request competing quotes from GGuard recommendations</span>
              </li>
              <li className="flex gap-3">
                <span className="text-cyan-400 font-bold flex-shrink-0">3.</span>
                <span>Use GGuard diagnostics to educate tenants on what repairs are actually needed vs. upsells</span>
              </li>
              <li className="flex gap-3">
                <span className="text-cyan-400 font-bold flex-shrink-0">4.</span>
                <span>Track quote patterns by contractor to identify consistent pricing outliers</span>
              </li>
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
