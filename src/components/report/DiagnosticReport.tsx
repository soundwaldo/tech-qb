import { Badge } from "@/components/ui/Badge";
import { formatCurrency } from "@/lib/utils";
import type { Assessment, Diagnosis, ReportRecommendation } from "@/types";
import { AlertTriangle, CheckCircle2, ClipboardCheck, HelpCircle, ShieldAlert } from "lucide-react";

const recommendationCopy: Record<ReportRecommendation, { label: string; detail: string; tone: string }> = {
    approve: { label: "Approve", detail: "The proposed work and pricing appear supported by the evidence reviewed.", tone: "bg-emerald-100 text-emerald-800" },
    approve_with_questions: { label: "Approve with questions", detail: "The proposal is generally reasonable, with items to clarify before authorization.", tone: "bg-amber-100 text-amber-900" },
    request_revision: { label: "Request a revised quote", detail: "Some proposed work or pricing is not adequately supported by the evidence.", tone: "bg-orange-100 text-orange-900" },
    insufficient_evidence: { label: "More evidence needed", detail: "A responsible recommendation cannot be made from the available evidence.", tone: "bg-slate-200 text-slate-800" },
    safety_escalation: { label: "Safety escalation", detail: "Stop operating the door and arrange prompt professional attention.", tone: "bg-red-100 text-red-900" },
};

export function DiagnosticReport({ assessment, diagnosis }: { assessment: Assessment; diagnosis: Diagnosis }) {
    const recommendation = recommendationCopy[diagnosis.recommendation];
    return (
        <article className="space-y-4 overflow-hidden sm:space-y-6 print:space-y-4">
            <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:rounded-3xl sm:p-8">
                <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-start">
                    <div className="min-w-0">
                        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-teal-700 sm:tracking-[0.2em]">Independent diagnostic report</p>
                        <h1 className="mt-2 break-words text-2xl font-bold text-slate-950 sm:text-3xl">{assessment.property_label || `Property in ${assessment.zip_code}`}</h1>
                        <p className="mt-2 break-words text-sm text-slate-500">Report #{assessment.id.slice(0, 8).toUpperCase()} · Version {diagnosis.report_version}</p>
                    </div>
                    <Badge className={`${recommendation.tone} self-start whitespace-normal py-1 text-center`}>{recommendation.label}</Badge>
                </div>
                <div className="mt-5 rounded-2xl bg-slate-950 p-4 text-white sm:mt-6 sm:p-5">
                    <p className="text-sm font-semibold text-cyan-300">GGuard recommendation</p>
                    <p className="mt-2 text-base font-medium leading-7 sm:text-lg">{recommendation.detail}</p>
                </div>
                <div className="mt-5 grid gap-3 sm:mt-6 sm:grid-cols-3 sm:gap-4">
                    <Fact label="Contractor" value={assessment.contractor_name || "Not provided"} />
                    <Fact label="Quoted total" value={assessment.contractor_quote_cents == null ? "Not provided" : formatCurrency(assessment.contractor_quote_cents)} />
                    <Fact label="Confidence" value={`${diagnosis.confidence[0].toUpperCase()}${diagnosis.confidence.slice(1)}`} />
                </div>
            </section>

            {diagnosis.safety_notes && (
                <section className="rounded-2xl border border-red-200 bg-red-50 p-4 sm:p-5">
                    <div className="flex gap-3"><ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-red-700" /><div><h2 className="font-bold text-red-950">Safety notice</h2><p className="mt-1 text-sm leading-6 text-red-900">{diagnosis.safety_notes}</p></div></div>
                </section>
            )}

            <ReportSection icon={<ClipboardCheck className="h-5 w-5" />} title="Expert assessment">
                <p className="leading-7 text-slate-700">{diagnosis.summary}</p>
                <div className="mt-5 space-y-3">{diagnosis.findings.map((finding, index) => (
                    <div key={`${finding.issue}-${index}`} className="min-w-0 rounded-xl border border-slate-200 p-4">
                        <div className="flex flex-col items-start gap-2 sm:flex-row sm:justify-between sm:gap-3"><h3 className="break-words font-semibold text-slate-950">{finding.issue}</h3><Badge className="shrink-0">{finding.severity}</Badge></div>
                        <p className="mt-2 text-sm leading-6 text-slate-600">{finding.explanation}</p>
                    </div>
                ))}</div>
            </ReportSection>

            <ReportSection icon={<CheckCircle2 className="h-5 w-5" />} title="Fair cost guidance">
                <p className="break-words text-2xl font-bold text-teal-800 sm:text-3xl">{formatCurrency(diagnosis.fair_price_low_cents)}–{formatCurrency(diagnosis.fair_price_high_cents)}</p>
                <p className="mt-2 text-sm text-slate-500">Estimated reasonable range based on the evidence reviewed. Local conditions, parts specifications, and warranties may affect final pricing.</p>
                {diagnosis.quote_analysis.length > 0 && <div className="mt-5 overflow-hidden rounded-xl border border-slate-200">{diagnosis.quote_analysis.map((line, index) => (
                    <div key={`${line.item}-${index}`} className="grid gap-2 border-b border-slate-200 p-4 last:border-0 sm:grid-cols-[1fr_auto]">
                        <div className="min-w-0"><p className="break-words font-medium text-slate-900">{line.item}</p><p className="mt-1 break-words text-sm text-slate-600">{line.note}</p></div>
                        <Badge className={`${line.assessment === "supported" ? "bg-emerald-100 text-emerald-800" : line.assessment === "unsupported" ? "bg-red-100 text-red-800" : "bg-amber-100 text-amber-900"} self-start`}>{line.assessment}</Badge>
                    </div>
                ))}</div>}
            </ReportSection>

            <ReportSection icon={<HelpCircle className="h-5 w-5" />} title="Questions to ask before approval">
                <ol className="space-y-3">{diagnosis.questions_for_tech.map((question, index) => <li key={question} className="flex gap-3 text-slate-700"><span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-teal-100 text-xs font-bold text-teal-800">{index + 1}</span><span>{question}</span></li>)}</ol>
            </ReportSection>

            {diagnosis.limitations.length > 0 && <ReportSection icon={<AlertTriangle className="h-5 w-5" />} title="Limitations"><ul className="list-disc space-y-2 pl-5 text-sm text-slate-600">{diagnosis.limitations.map((item) => <li key={item}>{item}</li>)}</ul></ReportSection>}
            <p className="px-2 text-xs leading-5 text-slate-500">This remote assessment is based only on submitted information and is not a substitute for an on-site safety inspection. Never adjust garage-door springs, cables, or other components under tension.</p>
        </article>
    );
}

function Fact({ label, value }: { label: string; value: string }) { return <div className="min-w-0 rounded-xl bg-slate-50 p-3 sm:bg-transparent sm:p-0"><p className="text-xs font-semibold uppercase text-slate-400">{label}</p><p className="mt-1 break-words font-medium text-slate-900">{value}</p></div>; }
function ReportSection({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) { return <section className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-6"><div className="mb-4 flex items-start gap-2 text-teal-800 sm:items-center">{icon}<h2 className="text-lg font-bold leading-6 text-slate-950">{title}</h2></div>{children}</section>; }
