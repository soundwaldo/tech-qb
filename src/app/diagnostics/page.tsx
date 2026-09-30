import Link from "next/link";
import type { Metadata } from "next";
import { Button } from "@/components/ui/Button";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { SampleReport } from "@/components/landing/SampleReport";
import { TIER_PRICING, HOA_PLANS, PM_PLANS } from "@/types";
import { formatCurrency } from "@/lib/utils";
import { ShieldCheck, Users, FileCheck2, Zap, CheckCircle2 } from "lucide-react";

export const metadata: Metadata = {
  title: "Diagnostics | Repair Assessments",
  description: "Expert-reviewed garage-door repair assessments for homeowners, HOAs, and property managers. Separate from the contractor website widget.",
  alternates: { canonical: "/diagnostics" },
};

export default function DiagnosticsPage() {
  return (
    <>
      <Header />
      <main>
      <div className="bg-slate-800 px-4 py-3 text-center text-sm text-slate-300">Looking for a widget for your company website? <Link href="/pre-dispatch" className="text-emerald-300 underline">Explore GGuard Pre-Dispatch instead</Link>.</div>

      {/* Hero - Dark with cyan/teal accents */}
      <section className="relative overflow-hidden bg-slate-900 text-white">
        <div className="absolute inset-0 bg-gradient-to-br from-cyan-900/20 via-teal-900/20 to-blue-900/20" />
        <div className="relative mx-auto max-w-6xl px-4 py-24 sm:px-6">
          <div className="max-w-3xl">
            <p className="mb-4 font-semibold uppercase tracking-wide text-cyan-300">GGuard Diagnostics · Repair assessments</p>
            <h1 className="text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl">
              <span className="text-cyan-400">Know What You Need</span>
              <span className="block mt-2">Before You Call Anyone</span>
            </h1>
            <p className="mt-6 text-lg text-slate-300 leading-relaxed">
              Submit photos of your garage door. Our AI analyzes the images and a garage door expert reviews every assessment to verify accuracy. Get a report that tells you exactly what&apos;s wrong, what needs repair, and what doesn&apos;t. Know whether you need a technician and arrive at the conversation equipped with knowledge—not guesswork.
            </p>
            <p className="mt-3 text-sm text-cyan-300 font-medium flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4" />
              AI-powered analysis • Verified by garage door professionals
            </p>

            <div className="mt-10 flex flex-col gap-4 sm:flex-row">
              <Link href="/upload">
                <Button size="lg" className="w-full sm:w-auto bg-cyan-500 hover:bg-cyan-400 text-slate-900">
                  Get Your Assessment
                </Button>
              </Link>
              <Link href="/diagnostics#pricing">
                <Button variant="outline" size="lg" className="w-full sm:w-auto border-cyan-400 text-cyan-400 hover:bg-cyan-400/10">
                  View Assessment Pricing
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing - Homeowner */}
      <section id="pricing" className="border-t border-slate-800 bg-slate-900 py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <h2 className="text-center text-2xl font-bold text-white">
            Get Your Diagnostic Report
          </h2>
          <p className="mt-2 text-center text-slate-400">
            One-time assessments with expert review. Contractor website widgets are a separate product and purchase.
          </p>

          <div className="mt-10 grid gap-6 md:grid-cols-3">
            {Object.entries(TIER_PRICING).map(([tier, pricing]) => (
              <div
                key={tier}
                className="flex flex-col rounded-2xl border border-slate-700 bg-slate-800/50 p-6 backdrop-blur"
              >
                <h3 className="text-lg font-bold text-white">
                  {pricing.label}
                </h3>
                <p className="mt-1 text-sm text-slate-400">
                  {pricing.description}
                </p>
                <div className="mt-4">
                  <span className="text-3xl font-bold text-cyan-400">
                    {formatCurrency(pricing.amount_cents)}
                  </span>
                </div>
                <ul className="mt-4 space-y-2 text-sm text-slate-300">
                  <li className="flex items-center gap-2">
                    <ShieldCheck className="h-4 w-4 text-cyan-400" />
                    {tier === "comprehensive"
                      ? "Full system analysis"
                      : "Standard assessment"}
                  </li>
                  <li className="flex items-center gap-2">
                    <FileCheck2 className="h-4 w-4 text-cyan-400" />
                    Verified maintenance record
                  </li>
                </ul>
                <Link href={`/upload?tier=${tier}`} className="mt-6">
                  <Button variant="outline" className="w-full border-cyan-400 text-cyan-400 hover:bg-cyan-400/10">
                    Choose {pricing.label}
                  </Button>
                </Link>
              </div>
            ))}
          </div>

          {/* What You Receive */}
          <div className="mt-12 space-y-6">
            <div className="rounded-2xl border border-cyan-400/30 bg-cyan-400/10 p-6">
              <div className="flex items-start gap-4">
                <Users className="h-6 w-6 text-cyan-400 flex-shrink-0 mt-1" />
                <div>
                  <h3 className="text-lg font-bold text-cyan-300">
                    Human-Verified Analysis
                  </h3>
                  <p className="mt-2 text-sm text-slate-300">
                    Every report is reviewed by experienced professionals. AI powers the initial analysis, but a human expert verifies the diagnosis, checks the photos, and signs off on the findings. You&apos;re not trusting a black box—You&apos;re getting expert eyes on your door.</p>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-emerald-400/30 bg-emerald-400/10 p-6">
              <div className="flex items-start gap-4">
                <CheckCircle2 className="h-6 w-6 text-emerald-400 flex-shrink-0 mt-1" />
                <div>
                  <h3 className="text-lg font-bold text-emerald-300">
                    Refund Guarantee
                  </h3>
                  <p className="mt-2 text-sm text-slate-300">
                    If we can&apos;t provide a diagnosis due to insufficient photos or technical issues, you get a full refund. No questions asked. <Link href="/refund-policy" className="text-emerald-400 hover:text-emerald-300 font-semibold underline">Learn more</Link>.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* B2B Pricing - HOA & PM */}
      <section id="b2b-pricing" className="border-t border-slate-800 bg-slate-900 py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <h2 className="text-center text-2xl font-bold text-white">
            Portfolio Plans
          </h2>
          <p className="mt-2 text-center text-slate-400">
            Diagnostic assessment plans for HOAs and property managers. Website widgets are sold separately under Pre-Dispatch.
          </p>

          <div className="mt-10 grid gap-8 lg:grid-cols-2">
            {/* HOA Plans */}
            <div>
              <h3 className="text-lg font-bold text-cyan-400">HOA Plans (Annual)</h3>
              <div className="mt-4 space-y-3">
                {Object.entries(HOA_PLANS).map(([plan, pricing]) => (
                  <Link
                    key={plan}
                    href={`/portal/hoa?plan=${plan}`}
                    className="block rounded-xl border border-slate-700 bg-slate-800/30 p-4 transition hover:border-cyan-400"
                  >
                    <div className="flex justify-between">
                      <div>
                        <p className="font-medium text-white">{pricing.label}</p>
                        <p className="text-sm text-slate-400">{pricing.units} units</p>
                      </div>
                      <p className="font-bold text-cyan-400">{formatCurrency(pricing.price_cents)}/yr</p>
                    </div>
                  </Link>
                ))}
              </div>
            </div>

            {/* PM Plans */}
            <div>
              <h3 className="text-lg font-bold text-blue-400">Property Manager Plans (Monthly)</h3>
              <div className="mt-4 space-y-3">
                {Object.entries(PM_PLANS).map(([plan, pricing]) => (
                  <Link
                    key={plan}
                    href={`/portal/pm?plan=${plan}`}
                    className="block rounded-xl border border-slate-700 bg-slate-800/30 p-4 transition hover:border-blue-400"
                  >
                    <div className="flex justify-between">
                      <div>
                        <p className="font-medium text-white">{pricing.label}</p>
                        <p className="text-sm text-slate-400">{pricing.units} properties</p>
                      </div>
                      <p className="font-bold text-blue-400">{formatCurrency(pricing.price_cents)}/mo</p>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Who This Is For - Simplified */}
      <section id="how-it-works" className="border-t border-slate-800 bg-slate-900 py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <h2 className="text-center text-2xl font-bold text-white">
            Who Is This For?
          </h2>
          <div className="mt-10 grid gap-6 md:grid-cols-2">
            <div className="rounded-3xl border-2 border-cyan-400/50 bg-slate-800/50 p-8 backdrop-blur">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-cyan-400 text-slate-900">
                <Zap className="h-6 w-6" />
              </div>
              <h3 className="text-xl font-bold text-white">Homeowners</h3>
              <p className="mt-2 text-slate-300">
                Get a verified assessment before any work begins. Know the fair price,
                required parts, and the exact questions to ask your technician.
              </p>
              <Link href="/upload" className="mt-4 inline-block">
                <Button variant="primary" className="bg-cyan-500 hover:bg-cyan-400 text-slate-900">
                  Start Assessment
                </Button>
              </Link>
            </div>

            <div className="rounded-3xl border border-slate-700 bg-slate-800/30 p-8 backdrop-blur">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-500 text-white">
                <Users className="h-6 w-6" />
              </div>
              <h3 className="text-xl font-bold text-white">
                HOAs & Property Managers
              </h3>
              <p className="mt-2 text-slate-300">
                Review repair quotes across your portfolio with more context and
                maintain verifiable maintenance records for compliance.
              </p>
              <Link href="/portal" className="mt-4 inline-block">
                <Button variant="secondary" className="bg-blue-600 hover:bg-blue-500">
                  Access Portal
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Value proposition - Sample report */}
      <section id="reports" className="border-t border-slate-800 bg-slate-900 py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <h2 className="text-center text-2xl font-bold text-white">
            What You Receive
          </h2>
          <p className="mt-2 text-center text-slate-400">
            A detailed, expert-verified report with actionable insights.
          </p>
          <div className="mt-10">
            <SampleReport />
          </div>
        </div>
      </section>

      {/* Property Ledger CTA */}
      <section className="border-t border-slate-800 bg-slate-950 py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="rounded-3xl border border-cyan-800/50 bg-gradient-to-br from-cyan-950/60 to-teal-950/60 p-10 text-center">
            <FileCheck2 className="mx-auto h-12 w-12 text-cyan-400" />
            <h2 className="mt-4 text-2xl font-bold text-white">
              Property Maintenance Ledger
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-slate-300">
              Every GGuard assessment creates a permanent, tamper-proof record tied to
              the property address. Contractors can also submit repair invoices — building
              a complete, verifiable maintenance history that follows the property forever.
            </p>
            <div className="mt-8 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
              <Link href="/portal">
                <Button size="lg" className="w-full sm:w-auto bg-cyan-500 hover:bg-cyan-400 text-slate-900">
                  Manage Property Records
                </Button>
              </Link>
              <Link href="/upload">
                <Button variant="outline" size="lg" className="w-full sm:w-auto border-cyan-600 text-cyan-400 hover:bg-cyan-400/10">
                  Get a Diagnosis
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="border-t border-slate-800 bg-slate-900 py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <h2 className="text-center text-2xl font-bold text-white">
            The GGuard Advantage
          </h2>
          <div className="mt-10 grid gap-6 md:grid-cols-3">
            <div className="text-center">
              <CheckCircle2 className="mx-auto h-10 w-10 text-cyan-400" />
              <h3 className="mt-3 font-semibold text-white">Neutral Assessment</h3>
              <p className="mt-1 text-sm text-slate-400">
                We have no financial stake in repairs. Our only goal is accuracy.
              </p>
            </div>
            <div className="text-center">
              <ShieldCheck className="mx-auto h-10 w-10 text-cyan-400" />
              <h3 className="mt-3 font-semibold text-white">Verified Records</h3>
              <p className="mt-1 text-sm text-slate-400">
                Every assessment creates a tamper-proof maintenance record.
              </p>
            </div>
            <div className="text-center">
              <FileCheck2 className="mx-auto h-10 w-10 text-cyan-400" />
              <h3 className="mt-3 font-semibold text-white">Expert Questions</h3>
              <p className="mt-1 text-sm text-slate-400">
                Know exactly what to ask before signing any work order.
              </p>
            </div>
          </div>
        </div>
      </section>

      </main>
      <Footer />
    </>
  );
}
