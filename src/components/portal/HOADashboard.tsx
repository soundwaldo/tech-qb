"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Building2, CheckCircle2, Clock, AlertCircle, Download } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { BillingButton } from "@/components/portal/BillingButton";

interface AssessmentRow {
  id: string;
  property_label: string;
  zip_code: string;
  status: string;
  door_type: string;
  created_at: string;
  diagnosis?: { summary: string; confidence: number } | null;
}

export function HOADashboard() {
  const [assessments, setAssessments] = useState<AssessmentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    // Fetch HOA assessments
    const fetchAssessments = async () => {
      try {
        const res = await fetch("/api/portal/hoa/assessments");
        const data = await res.json();
        setAssessments(data || []);
      } catch (error) {
        console.error("Failed to fetch assessments:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchAssessments();
  }, []);

  const filtered = useMemo(() => {
    let results = assessments;

    if (statusFilter !== "all") {
      results = results.filter((a) => a.status === statusFilter);
    }

    if (searchTerm) {
      results = results.filter(
        (a) =>
          a.property_label?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          a.zip_code?.includes(searchTerm)
      );
    }

    return results;
  }, [assessments, statusFilter, searchTerm]);

  const stats = {
    total: assessments.length,
    completed: assessments.filter((a) => a.status === "delivered").length,
    pending: assessments.filter((a) => ["draft", "ai_processing", "awaiting_expert_review"].includes(a.status)).length,
    complianceRate: Math.round(
      (assessments.filter((a) => a.status === "delivered").length / Math.max(assessments.length, 1)) * 100
    ),
  };

  const getStatusBadge = (status: string) => {
    const badges: Record<string, { color: string; label: string; icon: React.ReactNode }> = {
      delivered: { color: "bg-emerald-900/30 border-emerald-400/30", label: "Completed", icon: <CheckCircle2 className="h-4 w-4 text-emerald-400" /> },
      awaiting_expert_review: { color: "bg-blue-900/30 border-blue-400/30", label: "In Review", icon: <Clock className="h-4 w-4 text-blue-400" /> },
      ai_processing: { color: "bg-purple-900/30 border-purple-400/30", label: "Processing", icon: <Clock className="h-4 w-4 text-purple-400" /> },
      draft: { color: "bg-slate-700/30 border-slate-500/30", label: "Draft", icon: <AlertCircle className="h-4 w-4 text-slate-400" /> },
      needs_more_evidence: { color: "bg-amber-900/30 border-amber-400/30", label: "Needs Photos", icon: <AlertCircle className="h-4 w-4 text-amber-400" /> },
    };
    const badge = badges[status] || badges.draft;
    return (
      <div className={`flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium ${badge.color}`}>
        {badge.icon}
        <span>{badge.label}</span>
      </div>
    );
  };

  const downloadReport = () => {
    alert("Export feature coming soon. Would generate CSV of all assessments.");
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap justify-end gap-3">
        <BillingButton />
        <Link href="/upload?ref=hoa" className="rounded-lg border border-cyan-400 px-4 py-2 text-sm font-semibold text-cyan-300 hover:bg-cyan-400/10">
          New assessment
        </Link>
        <Link href="/submit-repair" className="rounded-lg bg-cyan-500 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-cyan-400">
          Submit repair record
        </Link>
      </div>
      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <div className="rounded-xl bg-slate-800/50 border border-slate-700 p-4">
          <p className="text-sm text-slate-400">Total Assessments</p>
          <p className="mt-1 text-2xl font-bold text-white">{stats.total}</p>
        </div>
        <div className="rounded-xl bg-emerald-900/20 border border-emerald-400/30 p-4">
          <p className="text-sm text-slate-400">Completed</p>
          <p className="mt-1 text-2xl font-bold text-emerald-400">{stats.completed}</p>
        </div>
        <div className="rounded-xl bg-blue-900/20 border border-blue-400/30 p-4">
          <p className="text-sm text-slate-400">In Progress</p>
          <p className="mt-1 text-2xl font-bold text-blue-400">{stats.pending}</p>
        </div>
        <div className="rounded-xl bg-cyan-900/20 border border-cyan-400/30 p-4">
          <p className="text-sm text-slate-400">Compliance Rate</p>
          <p className="mt-1 text-2xl font-bold text-cyan-400">{stats.complianceRate}%</p>
        </div>
      </div>

      {/* Filters & Export */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex gap-2 flex-wrap">
          <Input
            placeholder="Search address or ZIP..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full md:w-64"
          />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-sm text-white"
          >
            <option value="all">All Status</option>
            <option value="delivered">Completed</option>
            <option value="awaiting_expert_review">In Review</option>
            <option value="ai_processing">Processing</option>
            <option value="needs_more_evidence">Needs Photos</option>
          </select>
        </div>
        <Button onClick={downloadReport} className="flex items-center gap-2 bg-cyan-500 hover:bg-cyan-400 text-slate-900">
          <Download className="h-4 w-4" />
          Export CSV
        </Button>
      </div>

      {/* Assessments Table */}
      <div className="rounded-xl border border-slate-700 overflow-hidden bg-slate-800/30">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-700 bg-slate-900/50">
                <th className="px-4 py-3 text-left font-semibold text-slate-300">Property</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-300">Door Type</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-300">Status</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-300">Diagnosis</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-300">Submitted</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-300">Action</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-slate-400">
                    Loading assessments...
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-slate-400">
                    No assessments found
                  </td>
                </tr>
              ) : (
                filtered.map((assessment) => (
                  <tr key={assessment.id} className="border-b border-slate-700/50 hover:bg-slate-800/50 transition">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Building2 className="h-4 w-4 text-cyan-400 flex-shrink-0" />
                        <div>
                          <p className="font-medium text-white">{assessment.property_label || "Unlabeled"}</p>
                          <p className="text-xs text-slate-400">{assessment.zip_code}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-300">{assessment.door_type === "single" ? "Single" : "Double"}</td>
                    <td className="px-4 py-3">{getStatusBadge(assessment.status)}</td>
                    <td className="px-4 py-3">
                      {assessment.diagnosis ? (
                        <div className="text-xs">
                          <p className="text-white font-medium line-clamp-1">{assessment.diagnosis.summary}</p>
                          <p className="text-slate-400">{Math.round(assessment.diagnosis.confidence * 100)}% confidence</p>
                        </div>
                      ) : (
                        <p className="text-slate-500">—</p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-400">
                      {new Date(assessment.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3">
                      <button className="text-cyan-400 hover:text-cyan-300 text-sm font-medium">View</button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Compliance Insights */}
      {stats.total > 0 && (
        <div className="rounded-xl border border-cyan-400/30 bg-cyan-900/20 p-6">
          <h3 className="font-semibold text-cyan-300 mb-3">Compliance Insights</h3>
          <div className="space-y-2 text-sm text-slate-300">
            <p>✓ {stats.completed} properties have completed diagnostics</p>
            <p>⏳ {stats.pending} assessments pending completion</p>
            <p>→ Compliance rate: {stats.complianceRate}% of community has current diagnostics</p>
            {stats.complianceRate < 80 && (
              <p className="text-amber-400 font-medium mt-3">
                Recommend reaching out to units without diagnostics to improve compliance coverage.
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
