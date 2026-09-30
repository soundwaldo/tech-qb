import Link from "next/link";
import { ShieldCheck } from "lucide-react";

export function Footer() {
    return (
        <footer className="border-t border-slate-200 bg-slate-900 text-slate-300">
            <div className="mx-auto grid max-w-6xl gap-10 px-4 py-14 sm:px-6 md:grid-cols-4">
                <div className="md:col-span-2">
                    <div className="mb-3 flex items-center gap-2 font-bold text-white">
                        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-teal-600">
                            <ShieldCheck className="h-4 w-4" />
                        </span>
                        GGuard AI
                    </div>
                    <p className="max-w-sm text-sm leading-relaxed text-slate-400">
                        Two distinct products: Diagnostics for expert-reviewed repair
                        assessments, and Pre-Dispatch for contractor website intake.
                        Each has its own pricing and purchase flow.
                    </p>
                </div>

                <div>
                    <h4 className="mb-3 text-sm font-semibold text-white">Products & Records</h4>
                    <ul className="space-y-2 text-sm">
                        <li>
                            <Link href="/diagnostics" className="hover:text-white">
                                Diagnostics — Repair Assessments
                            </Link>
                        </li>
                        <li>
                            <Link href="/diagnostics#pricing" className="hover:text-white">
                                Assessment Pricing
                            </Link>
                        </li>
                        <li>
                            <Link href="/pre-dispatch" className="hover:text-white">
                                Pre-Dispatch — Contractor Widget
                            </Link>
                        </li>
                        <li><Link href="/pre-dispatch#pricing" className="hover:text-white">Widget Subscription Pricing</Link></li>
                        <li>
                            <Link href="/portal" className="hover:text-white">
                                HOA / PM Portal
                            </Link>
                        </li>
                        <li>
                            <Link href="/verify" className="hover:text-white">
                                Verify a Record
                            </Link>
                        </li>
                        <li>
                            <Link href="/properties" className="hover:text-white">
                                Property UUID Registry
                            </Link>
                        </li>
                        <li>
                            <Link href="/records" className="hover:text-white">
                                Email My Records
                            </Link>
                        </li>
                    </ul>
                </div>

                <div>
                    <h4 className="mb-3 text-sm font-semibold text-white">Company</h4>
                    <ul className="space-y-2 text-sm">
                        <li>
                            <a href="mailto:clayton@ggaurdai.com" className="hover:text-white">
                                Contact
                            </a>
                        </li>
                        <li>
                            <Link href="/refund-policy" className="hover:text-white">
                                Refund Policy
                            </Link>
                        </li>
                        <li>
                            <Link href="/admin" className="hover:text-white">
                                Expert Login
                            </Link>
                        </li>
                        <li className="flex gap-3">
                            <Link href="/privacy" className="hover:text-white">Privacy</Link>
                            <Link href="/terms" className="hover:text-white">Terms</Link>
                        </li>
                    </ul>
                </div>
            </div>
            <div className="border-t border-slate-800 py-4 text-center text-xs text-slate-500">
                © {new Date().getFullYear()} GGuard AI · Diagnostics & Pre-Dispatch · ggaurdai.com
            </div>
        </footer>
    );
}
