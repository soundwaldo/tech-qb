import Link from "next/link";
import type { Metadata } from "next";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";

export const metadata: Metadata = {
  title: "Diagnostics & Contractor Website Widget",
  description: "Choose GGuard Diagnostics for repair assessments or GGuard Pre-Dispatch for a contractor website intake widget. Separate products and pricing.",
  alternates: { canonical: "/" },
};

export default function Home() {
  return <>
    <Header />
    <main className="flex-1 bg-slate-900 text-white">
      <section className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
        <p className="text-sm font-semibold uppercase tracking-widest text-slate-400">Two products. Different jobs.</p>
        <h1 className="mt-4 max-w-3xl text-4xl font-bold tracking-tight sm:text-5xl">Choose the right GGuard product.</h1>
        <p className="mt-6 max-w-3xl text-lg text-slate-300">Need help understanding a repair? Choose Diagnostics. Want customers to send job details through your company website? Choose Pre-Dispatch.</p>
        <div id="products" className="mt-12 grid gap-6 md:grid-cols-2">
          <article className="flex flex-col rounded-2xl border border-cyan-500/50 bg-slate-800 p-6 sm:p-8">
            <p className="font-medium text-cyan-300">For homeowners, HOAs & property managers</p>
            <h2 className="mt-3 text-3xl font-bold">GGuard Diagnostics</h2>
            <p className="mt-4 text-slate-300">Submit garage-door evidence for a repair assessment reviewed by a human expert. Understand the findings, limitations, and questions to ask a technician.</p>
            <p className="mt-5 font-semibold text-cyan-300">Pay for an assessment or a portfolio assessment plan.</p>
            <p className="mt-2 text-sm text-slate-400">No website installation. No contractor widget subscription included.</p>
            <Link href="/diagnostics" className="mt-8 rounded-lg bg-cyan-400 px-5 py-3 text-center font-semibold text-slate-950 hover:bg-cyan-300">Explore Diagnostics</Link>
            <Link href="/diagnostics#pricing" className="mt-4 text-center text-cyan-300 underline">Assessment pricing</Link>
          </article>
          <article className="flex flex-col rounded-2xl border border-emerald-500/50 bg-slate-800 p-6 sm:p-8">
            <p className="font-medium text-emerald-300">For garage-door contractors & dispatch teams</p>
            <h2 className="mt-3 text-3xl font-bold">GGuard Pre-Dispatch</h2>
            <p className="mt-4 text-slate-300">Add a branded intake widget to your company website. Collect customer details, photos, and short video before dispatching a technician.</p>
            <p className="mt-5 font-semibold text-emerald-300">A website widget subscription, billed monthly or annually.</p>
            <p className="mt-2 text-sm text-slate-400">Preliminary intake, not an expert-reviewed diagnostic report. Report credits are not included.</p>
            <Link href="/pre-dispatch" className="mt-8 rounded-lg bg-emerald-400 px-5 py-3 text-center font-semibold text-slate-950 hover:bg-emerald-300">Explore the Contractor Widget</Link>
            <Link href="/pre-dispatch#pricing" className="mt-4 text-center text-emerald-300 underline">Widget subscription pricing</Link>
          </article>
        </div>
        <section id="pricing" className="mt-12 rounded-xl border border-slate-700 p-6">
          <h2 className="text-xl font-semibold">Separate products. Separate purchases.</h2>
          <p className="mt-2 text-slate-300">An assessment purchase does not activate a website widget. A widget subscription does not buy an independent expert-reviewed assessment. Choose a product above to see its pricing and signup flow.</p>
        </section>
        <p id="how-it-works" className="mt-8 text-slate-400">Each product has its own workflow. <Link href="/diagnostics#how-it-works" className="text-cyan-300 underline">Diagnostics process</Link> or <Link href="/pre-dispatch" className="text-emerald-300 underline">widget process</Link>.</p>
        <p id="reports" className="mt-4 text-slate-400">Looking for a diagnostic report? <Link href="/diagnostics#reports" className="text-cyan-300 underline">View the report example</Link>.</p>
      </section>
    </main>
    <Footer />
  </>;
}
