"use client";

import { PROBLEM_OPTIONS, ProblemCode } from "@/types";
import { Check } from "lucide-react";

interface ProblemPickerProps {
    value: ProblemCode[];
    onChange: (value: ProblemCode[]) => void;
}

export function ProblemPicker({ value, onChange }: ProblemPickerProps) {
    const toggle = (code: ProblemCode) => {
        if (value.includes(code)) {
            onChange(value.filter((c) => c !== code));
        } else {
            onChange([...value, code]);
        }
    };

    return (
        <div className="space-y-2">
            <p className="text-sm font-medium text-slate-300 mb-4">
                Select all issues that apply to your garage door
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {PROBLEM_OPTIONS.map((opt) => {
                    const selected = value.includes(opt.code);
                    return (
                        <button
                            key={opt.code}
                            type="button"
                            onClick={() => toggle(opt.code)}
                            aria-pressed={selected}
                            className={`flex items-start gap-3 rounded-lg border-2 p-3 text-left transition ${
                                selected
                                    ? "border-cyan-400 bg-cyan-400/10"
                                    : "border-white/15 bg-slate-900 hover:border-cyan-300/70"
                            }`}
                        >
                            <div className={`flex-shrink-0 w-5 h-5 rounded border-2 flex items-center justify-center mt-0.5 ${
                                selected
                                    ? "bg-cyan-400 border-cyan-400"
                                    : "border-slate-500 bg-slate-950"
                            }`}>
                                {selected && <Check className="w-4 h-4 text-slate-950" />}
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                    <span className="text-lg">{opt.icon}</span>
                                    <p className="font-medium text-slate-100">{opt.label}</p>
                                </div>
                                <p className="text-xs text-slate-500 mt-1">{opt.description}</p>
                            </div>
                        </button>
                    );
                })}
            </div>
        </div>
    );
}
