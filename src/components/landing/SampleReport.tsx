"use client";

import { Badge } from "@/components/ui/Badge";
import { AlertTriangle, CheckCircle2, AlertCircle, ShieldCheck } from "lucide-react";

export function SampleReport() {
    return (
        <div className="grid gap-6 lg:grid-cols-2">
            {/* Before Diagnostics */}
            <div className="rounded-3xl border border-slate-700 bg-slate-800/50 backdrop-blur overflow-hidden">
                <div className="flex items-center justify-between border-b border-slate-700 px-5 py-3">
                    <div className="flex items-center gap-2 text-sm font-semibold text-slate-300">
                        <AlertTriangle className="h-4 w-4 text-amber-400" />
                        Before Assessment
                    </div>
                    <Badge className="bg-amber-900/50 text-amber-300">Uncertain</Badge>
                </div>
                <div className="space-y-4 p-5">
                    <div className="flex items-start gap-3">
                        <div className="rounded-full bg-slate-700 p-2 flex-shrink-0 mt-0.5">
                            <AlertCircle className="h-4 w-4 text-slate-400" />
                        </div>
                        <div>
                            <p className="text-sm font-medium text-slate-300">What&apos;s wrong?</p>
                            <p className="text-xs text-slate-400 mt-1">Door has issues but you don&apos;t know the cause</p>
                        </div>
                    </div>
                    <div className="flex items-start gap-3">
                        <div className="rounded-full bg-slate-700 p-2 flex-shrink-0 mt-0.5">
                            <AlertCircle className="h-4 w-4 text-slate-400" />
                        </div>
                        <div>
                            <p className="text-sm font-medium text-slate-300">Do I need a tech?</p>
                            <p className="text-xs text-slate-400 mt-1">Unsure if professional help is necessary</p>
                        </div>
                    </div>
                    <div className="flex items-start gap-3">
                        <div className="rounded-full bg-slate-700 p-2 flex-shrink-0 mt-0.5">
                            <AlertCircle className="h-4 w-4 text-slate-400" />
                        </div>
                        <div>
                            <p className="text-sm font-medium text-slate-300">What will it cost?</p>
                            <p className="text-xs text-slate-400 mt-1">Contractor quotes feel high but you have no baseline</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* GGuard assessment */}
            <div className="relative overflow-hidden rounded-3xl border-2 border-cyan-400 bg-slate-800/50 backdrop-blur">
                <div className="flex items-center justify-between border-b border-cyan-400/30 bg-cyan-400/10 px-5 py-3">
                    <div className="flex items-center gap-2 text-sm font-semibold text-cyan-400">
                        <ShieldCheck className="h-4 w-4" />
                        After GGuard Assessment
                    </div>
                    <Badge className="bg-cyan-400/20 text-cyan-300">Verified</Badge>
                </div>
                <div className="space-y-4 p-5">
                    <div className="rounded-lg bg-cyan-400/5 border border-cyan-400/20 p-3 text-xs text-cyan-200">
                        <p className="font-semibold mb-1">✓ Reviewed by professional</p>
                        <p>A garage door expert has verified this assessment for accuracy</p>
                    </div>
                    <div className="flex items-start gap-3">
                        <div className="rounded-full bg-cyan-400/20 p-2 flex-shrink-0 mt-0.5">
                            <CheckCircle2 className="h-4 w-4 text-cyan-400" />
                        </div>
                        <div>
                            <p className="text-sm font-medium text-cyan-300">Clear diagnosis</p>
                            <p className="text-xs text-slate-300 mt-1">Both torsion springs failed. Cables intact. Door safety compromised.</p>
                        </div>
                    </div>
                    <div className="flex items-start gap-3">
                        <div className="rounded-full bg-cyan-400/20 p-2 flex-shrink-0 mt-0.5">
                            <CheckCircle2 className="h-4 w-4 text-cyan-400" />
                        </div>
                        <div>
                            <p className="text-sm font-medium text-cyan-300">You definitely need a tech</p>
                            <p className="text-xs text-slate-300 mt-1">This is not DIY—safety equipment required. Professional repair essential.</p>
                        </div>
                    </div>
                    <div className="flex items-start gap-3">
                        <div className="rounded-full bg-cyan-400/20 p-2 flex-shrink-0 mt-0.5">
                            <CheckCircle2 className="h-4 w-4 text-cyan-400" />
                        </div>
                        <div>
                            <p className="text-sm font-medium text-cyan-300">Know the fair market price</p>
                            <p className="text-xs text-slate-300 mt-1">Parts + labor should be $250–$400. You now know if a quote is fair.</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
