"use client";

import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Menu, X, ShieldCheck } from "lucide-react";

const NAV = [
    { href: "/diagnostics", label: "Diagnostics" },
    { href: "/pre-dispatch", label: "Contractor Widget" },
    { href: "/verify", label: "Verify" },
    { href: "/properties", label: "Registry" },
    { href: "/portal", label: "Portal" },
];

export function Header() {
    const [open, setOpen] = useState(false);

    return (
        <header className="sticky top-0 z-50 border-b border-slate-800/80 bg-slate-900/90 backdrop-blur-md">
            <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
                <Link href="/" className="flex items-center gap-2 font-bold text-white">
                    <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-cyan-500">
                        <ShieldCheck className="h-5 w-5 text-slate-900" />
                    </span>
                    <span>
                        GGuard<span className="text-cyan-400">AI</span>
                    </span>
                </Link>

                <nav className="hidden items-center gap-6 md:flex">
                    {NAV.map((item) => (
                        <Link
                            key={item.href}
                            href={item.href}
                            className="text-sm font-medium text-slate-300 transition hover:text-cyan-400"
                        >
                            {item.label}
                        </Link>
                    ))}
                </nav>

                <div className="hidden items-center gap-3 md:flex">
                    <Link href="/#products">
                        <Button size="sm" className="bg-cyan-500 hover:bg-cyan-400 text-slate-900">
                            Choose a Product
                        </Button>
                    </Link>
                </div>

                <button
                    className="rounded-lg p-2 text-slate-300 md:hidden"
                    onClick={() => setOpen(!open)}
                    aria-label="Toggle menu"
                    aria-expanded={open}
                    aria-controls="mobile-navigation"
                >
                    {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
                </button>
            </div>

            {open && (
                <div id="mobile-navigation" className="border-t border-slate-800 bg-slate-900 px-4 py-4 md:hidden">
                    <nav className="flex flex-col gap-3">
                        {NAV.map((item) => (
                            <Link
                                key={item.href}
                                href={item.href}
                                className="text-sm font-medium text-slate-300"
                                onClick={() => setOpen(false)}
                            >
                                {item.label}
                            </Link>
                        ))}
                        <Link href="/#products" onClick={() => setOpen(false)}>
                            <Button size="sm" className="w-full bg-cyan-500 hover:bg-cyan-400 text-slate-900">
                                Choose a Product
                            </Button>
                        </Link>
                    </nav>
                </div>
            )}
        </header>
    );
}
