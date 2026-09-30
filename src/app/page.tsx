import Link from "next/link";
import type { Metadata } from "next";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { ArrowRight, ChevronDown, FileCheck2, MousePointerClick, ShieldCheck } from "lucide-react";

export const metadata: Metadata = {
  title: "Diagnostics & Contractor Website Widget",
  description: "Choose GGuard Diagnostics for repair assessments or GGuard Pre-Dispatch for a contractor website intake widget. Separate products and pricing.",
  alternates: { canonical: "/" },
};

export default function Home() {
  return (
    <>
      <Header />
      <main id="main-content" className="flex-1 bg-slate-950 text-white">
        <section className="relative isolate overflow-hidden">
          <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10">
            <div className="hero-grid absolute inset-0" />
            <div className="absolute -top-40 left-1/2 h-[420px] w-[680px] -translate-x-1/2 rounded-full bg-cyan-500/15 blur-3xl" />
            <div className="absolute -right-32 top-56 h-80 w-80 rounded-full bg-emerald-500/10 blur-3xl" />
          </div>
          <div className="mx-auto max-w-6xl px-4 pb-14 pt-14 sm:px-6 sm:pt-20">
            <p className="fade-up inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-slate-300">
              Two products. Different jobs.
            </p>
            <h1 className="fade-up fade-up-1 mt-6 max-w-3xl text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl">
              Choose the right <span className="bg-gradient-to-r from-cyan-300 via-cyan-200 to-emerald-300 bg-clip-text text-transparent">GGuard product.</span>
            </h1>
            <p className="fade-up fade-up-2 mt-6 max-w-2xl text-lg leading-relaxed text-slate-300">
              Need help understanding a repair? Choose Diagnostics. Want customers to send job details through your company website? Choose Pre-Dispatch.
            </p>
            <div className="fade-up fade-up-3 mt-8 flex flex-wrap items-center gap-x-6 gap-y-3">
              <a href="#products" className="inline-flex items-center gap-2 rounded-xl bg-white px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950">
                See the two products
                <ChevronDown className="h-4 w-4" aria-hidden="true" />
              </a>
              <a href="#how-it-works" className="text-sm font-medium text-slate-300 underline underline-offset-4 transition hover:text-white">
                How it works
              </a>
            </div>
          </div>
        </section>

        <section id="products" className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
          <div className="grid gap-6 md:grid-cols-2">
            <article className="group flex flex-col rounded-3xl border border-cyan-500/40 bg-gradient-to-b from-slate-800/80 to-slate-900 p-6 transition duration-300 hover:-translate-y-1 hover:border-cyan-300/70 hover:shadow-[0_24px_60px_-24px_rgba(34,211,238,0.45)] sm:p-8">
              <div className="flex items-start justify-between gap-4">
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-cyan-400/15 text-cyan-300 ring-1 ring-inset ring-cyan-300/30">
                  <FileCheck2 className="h-6 w-6" aria-hidden="true" />
                </span>
                <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-right text-xs font-medium text-slate-300">
                  For homeowners, HOAs &amp; property managers
                </span>
              </div>
              <h2 className="mt-6 text-3xl font-bold tracking-tight">GGuard Diagnostics</h2>
              <p className="mt-4 leading-relaxed text-slate-300">
                Submit garage-door evidence for a repair assessment reviewed by a human expert. Understand the findings, limitations, and questions to ask a technician.
              </p>
              <p className="mt-5 font-semibold text-cyan-300">Pay for an assessment or a portfolio assessment plan.</p>
              <p className="mt-2 text-sm text-slate-400">No website installation. No contractor widget subscription included.</p>
              <div className="mt-auto pt-8">
                <Link href="/diagnostics" className="flex w-full items-center justify-center gap-2 rounded-xl bg-cyan-400 px-5 py-3 text-center font-semibold text-slate-950 transition hover:bg-cyan-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-200 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900">
                  Explore Diagnostics
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
                </Link>
                <Link href="/diagnostics#pricing" className="mt-4 block text-center text-sm text-cyan-300 underline underline-offset-4 transition hover:text-cyan-200">
                  Assessment pricing
                </Link>
              </div>
            </article>

            <article className="group flex flex-col rounded-3xl border border-emerald-500/40 bg-gradient-to-b from-slate-800/80 to-slate-900 p-6 transition duration-300 hover:-translate-y-1 hover:border-emerald-300/70 hover:shadow-[0_24px_60px_-24px_rgba(16,185,129,0.45)] sm:p-8">
              <div className="flex items-start justify-between gap-4">
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-emerald-400/15 text-emerald-300 ring-1 ring-inset ring-emerald-300/30">
                  <MousePointerClick className="h-6 w-6" aria-hidden="true" />
                </span>
                <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-right text-xs font-medium text-slate-300">
                  For garage-door contractors &amp; dispatch teams
                </span>
              </div>
              <h2 className="mt-6 text-3xl font-bold tracking-tight">GGuard Pre-Dispatch</h2>
              <p className="mt-4 leading-relaxed text-slate-300">
                Add a branded intake widget to your company website. Collect customer details, photos, and short video before dispatching a technician.
              </p>
              <p className="mt-5 font-semibold text-emerald-300">A website widget subscription, billed monthly or annually.</p>
              <p className="mt-2 text-sm text-slate-400">Preliminary intake, not an expert-reviewed diagnostic report. Report credits are not included.</p>
              <div className="mt-auto pt-8">
                <Link href="/pre-dispatch" className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-400 px-5 py-3 text-center font-semibold text-slate-950 transition hover:bg-emerald-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-200 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900">
                  Explore the Contractor Widget
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
                </Link>
                <Link href="/pre-dispatch#pricing" className="mt-4 block text-center text-sm text-emerald-300 underline underline-offset-4 transition hover:text-emerald-200">
                  Widget subscription pricing
                </Link>
              </div>
            </article>
          </div>

          <section id="pricing" className="mt-12">
            <div className="flex gap-4 rounded-3xl border border-amber-400/30 bg-amber-400/[0.06] p-6 sm:p-8">
              <ShieldCheck className="h-6 w-6 shrink-0 text-amber-300" aria-hidden="true" />
              <div>
                <h2 className="text-xl font-semibold text-amber-100">Separate products. Separate purchases.</h2>
                <p className="mt-2 leading-relaxed text-slate-300">
                  An assessment purchase does not activate a website widget. A widget subscription does not buy an independent expert-reviewed assessment. Choose a product above to see its pricing and signup flow.
                </p>
              </div>
            </div>
          </section>
        </section>

        <section id="how-it-works" className="mx-auto max-w-6xl px-4 pb-16 sm:px-6">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">Each product has its own workflow</p>
          <h2 className="mt-2 text-3xl font-bold tracking-tight">Pick a product, follow its flow</h2>
          <div className="mt-8 grid gap-4 md:grid-cols-3">
            <article className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-cyan-400/15 text-sm font-bold text-cyan-300 ring-1 ring-inset ring-cyan-300/30">1</span>
              <h3 className="mt-4 font-semibold">Choose your product</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-400">
                Start with Diagnostics for an expert-reviewed repair assessment, or Pre-Dispatch for a website intake widget.
              </p>
            </article>
            <article className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-cyan-400/15 text-sm font-bold text-cyan-300 ring-1 ring-inset ring-cyan-300/30">2</span>
              <h3 className="mt-4 font-semibold">Follow that workflow</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-400">
                Each product keeps its own steps and purchase flow:{" "}
                <Link href="/diagnostics#how-it-works" className="text-cyan-300 underline underline-offset-4 transition hover:text-cyan-200">
                  Diagnostics process
                </Link>{" "}
                or{" "}
                <Link href="/pre-dispatch" className="text-emerald-300 underline underline-offset-4 transition hover:text-emerald-200">
                  widget process
                </Link>
                .
              </p>
            </article>
            <article id="reports" className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-cyan-400/15 text-sm font-bold text-cyan-300 ring-1 ring-inset ring-cyan-300/30">3</span>
              <h3 className="mt-4 font-semibold">Review your report</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-400">
                Looking for a diagnostic report?{" "}
                <Link href="/diagnostics#reports" className="text-cyan-300 underline underline-offset-4 transition hover:text-cyan-200">
                  View the report example
                </Link>
                .
              </p>
            </article>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}