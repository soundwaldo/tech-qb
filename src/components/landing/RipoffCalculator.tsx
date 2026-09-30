"use client";

import { useMemo, useState } from "react";
import { formatCurrency } from "@/lib/utils";
import { AlertTriangle, CheckCircle2 } from "lucide-react";

/** Typical overcharge patterns by repair type (illustrative market data). */
const SCENARIOS = [
    {
        id: "spring",
        label: "Broken Spring",
        quoted: 650,
        fair: 350,
        note: "Pair of torsion springs + labor",
    },
    {
        id: "sensors",
        label: "Sensor Replacement",
        quoted: 280,
        fair: 40,
        note: "Often just needs realignment (DIY)",
    },
    {
        id: "rollers",
        label: "Roller Replacement",
        quoted: 420,
        fair: 180,
        note: "Full set of nylon rollers",
    },
    {
        id: "opener",
        label: "Opener Motor",
        quoted: 1200,
        fair: 550,
        note: "Mid-range belt-drive unit",
    },
    {
        id: "cables",
        label: "Cable Replacement",
        quoted: 480,
        fair: 220,
        note: "Both cables + rebalance",
    },
];

export function RipoffCalculator() {
    const [idx, setIdx] = useState(2);
    const scenario = SCENARIOS[idx];

    const savings = useMemo(
        () => scenario.quoted - scenario.fair,
        [scenario]
    );
    const pct = useMemo(
        () => Math.round((savings / scenario.quoted) * 100),
        [savings, scenario]
    );

    return (
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-lg sm:p-8">
            <div className="mb-6 flex items-start justify-between gap-4">
                <div>
                    <h3 className="text-xl font-bold text-slate-900">
                        The Rip-off Calculator
                    </h3>
                    <p className="mt-1 text-sm text-slate-500">
                        See how much contractors commonly overcharge vs. fair market cost.
                    </p>
                </div>
                <span className="rounded-full bg-red-50 px-3 py-1 text-xs font-semibold text-red-700">
                    Live demo
                </span>
            </div>

            <label className="mb-2 block text-sm font-medium text-slate-700">
                Repair type: <span className="text-teal-700">{scenario.label}</span>
            </label>
            <input
                type="range"
                min={0}
                max={SCENARIOS.length - 1}
                step={1}
                value={idx}
                onChange={(e) => setIdx(Number(e.target.value))}
                className="gguard-slider mb-8"
            />

            <div className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-2xl border border-red-100 bg-red-50/60 p-5">
                    <div className="mb-2 flex items-center gap-2 text-sm font-medium text-red-700">
                        <AlertTriangle className="h-4 w-4" />
                        Typical contractor quote
                    </div>
                    <div className="text-3xl font-bold text-red-700">
                        {formatCurrency(scenario.quoted * 100)}
                    </div>
                    <p className="mt-1 text-xs text-red-600/80">{scenario.note}</p>
                </div>

                <div className="rounded-2xl border border-emerald-100 bg-emerald-50/60 p-5">
                    <div className="mb-2 flex items-center gap-2 text-sm font-medium text-emerald-700">
                        <CheckCircle2 className="h-4 w-4" />
                        Fair market cost
                    </div>
                    <div className="text-3xl font-bold text-emerald-700">
                        {formatCurrency(scenario.fair * 100)}
                    </div>
                    <p className="mt-1 text-xs text-emerald-700/80">
                        GGuard verified range midpoint
                    </p>
                </div>
            </div>

            <div className="mt-6 rounded-2xl bg-slate-900 px-5 py-4 text-center text-white">
                <p className="text-sm text-slate-300">You could be overpaying by</p>
                <p className="text-3xl font-bold text-amber-400">
                    {formatCurrency(savings * 100)}{" "}
                    <span className="text-lg font-medium text-slate-300">({pct}%)</span>
                </p>
                <p className="mt-1 text-xs text-slate-400">
                    A $39 GGuard assessment pays for itself many times over.
                </p>
            </div>
        </div>
    );
}
