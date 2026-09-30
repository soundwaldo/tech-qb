"use client";

import Link from "next/link";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { Button } from "@/components/ui/Button";
import { Building2, Users, Calendar, BarChart3, Clock, Wrench } from "lucide-react";

export default function PortalSelectorPage() {
    return (
        <>
            <Header />
            <main className="flex-1 bg-slate-900 py-20">
                <div className="mx-auto max-w-4xl px-4">
                    <h1 className="text-center text-3xl font-bold text-white">
                        Choose Your Portal
                    </h1>
                    <p className="mt-2 text-center text-slate-400">
                        Contractor website widgets and diagnostic assessment plans are separate products.
                    </p>

                    <div className="mt-10 grid gap-6 md:grid-cols-3">
                        <Link href="/portal/pre-dispatch" className="block">
                            <div className="rounded-3xl border-2 border-emerald-400/50 bg-slate-800/50 p-8 backdrop-blur transition hover:border-emerald-400">
                                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500 text-slate-950"><Wrench className="h-6 w-6" /></div>
                                <h2 className="text-xl font-bold text-white">Pre-Dispatch Widget</h2>
                                <p className="mt-2 text-sm text-slate-300">For contractor websites: manage customer intake, widget installation, and your widget subscription. Diagnostic report credits are not included.</p>
                                <Button className="mt-6 w-full bg-emerald-500 text-slate-950 hover:bg-emerald-400">Open Widget Workspace</Button>
                            </div>
                        </Link>
                        <Link href="/portal/hoa" className="block">
                            <div className="rounded-3xl border-2 border-cyan-400/50 bg-slate-800/50 p-8 backdrop-blur transition hover:border-cyan-400">
                                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-cyan-500 text-slate-900">
                                    <Building2 className="h-6 w-6" />
                                </div>
                                <h2 className="text-xl font-bold text-white">HOA Portal</h2>
                                <p className="mt-2 text-sm text-slate-300">
                                    Annual billing for community-wide maintenance verification.
                                    Perfect for HOAs with 25-200 units.
                                </p>
                                <ul className="mt-4 space-y-2 text-sm text-slate-400">
                                    <li className="flex items-center gap-2">
                                        <Calendar className="h-4 w-4 text-cyan-400" />
                                        Annual billing cycle
                                    </li>
                                    <li className="flex items-center gap-2">
                                        <BarChart3 className="h-4 w-4 text-cyan-400" />
                                        Multi-unit dashboard
                                    </li>
                                    <li className="flex items-center gap-2">
                                        <Users className="h-4 w-4 text-cyan-400" />
                                        HOA compliance reports
                                    </li>
                                </ul>
                                <Button className="mt-6 w-full bg-cyan-500 hover:bg-cyan-400 text-slate-900">
                                    Set Up HOA Portal
                                </Button>
                            </div>
                        </Link>

                        <Link href="/portal/pm" className="block">
                            <div className="rounded-3xl border-2 border-blue-400/50 bg-slate-800/50 p-8 backdrop-blur transition hover:border-blue-400">
                                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-600 text-white">
                                    <Users className="h-6 w-6" />
                                </div>
                                <h2 className="text-xl font-bold text-white">Property Manager Portal</h2>
                                <p className="mt-2 text-sm text-slate-300">
                                    Monthly billing for portfolio-wide quote validation.
                                    Ideal for PMs managing 10-100 properties.
                                </p>
                                <ul className="mt-4 space-y-2 text-sm text-slate-400">
                                    <li className="flex items-center gap-2">
                                        <Clock className="h-4 w-4 text-blue-400" />
                                        Monthly billing cycle
                                    </li>
                                    <li className="flex items-center gap-2">
                                        <BarChart3 className="h-4 w-4 text-blue-400" />
                                        Portfolio cost tracking
                                    </li>
                                    <li className="flex items-center gap-2">
                                        <Building2 className="h-4 w-4 text-blue-400" />
                                        Multi-property dashboard
                                    </li>
                                </ul>
                                <Button className="mt-6 w-full bg-blue-600 hover:bg-blue-500">
                                    Set Up PM Portal
                                </Button>
                            </div>
                        </Link>
                    </div>
                </div>
            </main>
            <Footer />
        </>
    );
}
