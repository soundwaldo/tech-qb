import Link from "next/link";
import { ShieldCheck } from "lucide-react";

const linkClass = "transition-colors hover:text-white focus-visible:rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300";

export function Footer() {
    return (
        <footer className="border-t border-white/10 bg-slate-950 text-slate-400">
            <div className="mx-auto grid max-w-7xl gap-10 px-4 py-14 sm:px-6 md:grid-cols-2 lg:grid-cols-4 lg:px-8">
                <div className="md:col-span-2 lg:col-span-1">
                    <Link href="/" className="inline-flex items-center gap-2 font-bold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300" aria-label="GGuard AI home">
                        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-cyan-400 text-slate-950">
                            <ShieldCheck className="h-5 w-5" strokeWidth={2.5} />
                        </span>
                        GGuard<span className="text-cyan-300">AI</span>
                    </Link>
                    <p className="mt-4 max-w-sm text-sm leading-relaxed text-slate-400">
                        Two distinct products: Diagnostics for expert-reviewed repair assessments, and Pre-Dispatch for contractor website intake. Each has its own pricing and purchase flow.
                    </p>
                </div>

                <nav aria-label="Products">
                    <h4 className="mb-4 text-xs font-semibold uppercase tracking-widest text-slate-500">Products</h4>
                    <ul className="space-y-2.5 text-sm">
                        <li>
                            <Link href="/diagnostics" className={linkClass}>
                                Diagnostics — Repair Assessments
                            </Link>
                        </li>
                        <li>
                            <Link href="/diagnostics#pricing" className={linkClass}>
                                Assessment Pricing
                            </Link>
                        </li>
                        <li>
                            <Link href="/pre-dispatch" className={linkClass}>
                                Pre-Dispatch — Contractor Widget
                            </Link>
                        </li>
                        <li>
                            <Link href="/pre-dispatch#pricing" className={linkClass}>
                                Widget Subscription Pricing
                            </Link>
                        </li>
                        <li>
                            <Link href="/pre-dispatch/demo" className={linkClass}>
                                Live Demo (sample data)
                            </Link>
                        </li>
                        <li>
                            <Link href="/portal" className={linkClass}>
                                HOA / PM Portal
                            </Link>
                        </li>
                    </ul>
                </nav>

                <nav aria-label="Records and verification">
                    <h4 className="mb-4 text-xs font-semibold uppercase tracking-widest text-slate-500">Records</h4>
                    <ul className="space-y-2.5 text-sm">
                        <li>
                            <Link href="/verify" className={linkClass}>
                                Verify a Record
                            </Link>
                        </li>
                        <li>
                            <Link href="/properties" className={linkClass}>
                                Property UUID Registry
                            </Link>
                        </li>
                        <li>
                            <Link href="/records" className={linkClass}>
                                Email My Records
                            </Link>
                        </li>
                    </ul>
                </nav>

                <nav aria-label="Company">
                    <h4 className="mb-4 text-xs font-semibold uppercase tracking-widest text-slate-500">Company</h4>
                    <ul className="space-y-2.5 text-sm">
                        <li>
                            <a href="mailto:clayton@ggaurdai.com" className={linkClass}>
                                Contact
                            </a>
                        </li>
                        <li>
                            <Link href="/refund-policy" className={linkClass}>
                                Refund Policy
                            </Link>
                        </li>
                        <li>
                            <Link href="/admin" className={linkClass}>
                                Expert Login
                            </Link>
                        </li>
                        <li>
                            <Link href="/privacy" className={linkClass}>
                                Privacy
                            </Link>
                        </li>
                        <li>
                            <Link href="/terms" className={linkClass}>
                                Terms
                            </Link>
                        </li>
                    </ul>
                </nav>
            </div>
            <div className="border-t border-white/5 py-5">
                <p className="mx-auto max-w-7xl px-4 text-center text-xs text-slate-500 sm:px-6 lg:px-8">
                    © {new Date().getFullYear()} GGuard AI · Diagnostics & Pre-Dispatch · ggaurdai.com
                </p>
            </div>
        </footer>
    );
}