"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Menu, X, ShieldCheck, ArrowRight, ArrowUpRight } from "lucide-react";

const NAV = [
    { href: "/diagnostics", label: "Diagnostics" },
    { href: "/pre-dispatch", label: "Contractor Widget" },
    { href: "/verify", label: "Verify a record" },
    { href: "/properties", label: "Property registry" },
    { href: "/portal", label: "Customer portal" },
];

export function Header() {
    const [open, setOpen] = useState(false);
    const [scrolled, setScrolled] = useState(false);
    const pathname = usePathname();
    const headerRef = useRef<HTMLElement>(null);
    const toggleRef = useRef<HTMLButtonElement>(null);

    // Elevate the header once content scrolls beneath it.
    useEffect(() => {
        const onScroll = () => setScrolled(window.scrollY > 8);
        onScroll();
        window.addEventListener("scroll", onScroll, { passive: true });
        return () => window.removeEventListener("scroll", onScroll);
    }, []);

    // While the mobile menu is open: lock page scroll, close on Escape or
    // outside click, and move focus to the first item.
    useEffect(() => {
        if (!open) return;
        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = "hidden";
        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key === "Escape") {
                setOpen(false);
                toggleRef.current?.focus();
            }
        };
        const onPointerDown = (event: PointerEvent) => {
            const target = event.target;
            if (target instanceof Node && headerRef.current && !headerRef.current.contains(target)) {
                setOpen(false);
            }
        };
        window.addEventListener("keydown", onKeyDown);
        window.addEventListener("pointerdown", onPointerDown);
        document.querySelector<HTMLElement>("#mobile-navigation a")?.focus();
        return () => {
            document.body.style.overflow = previousOverflow;
            window.removeEventListener("keydown", onKeyDown);
            window.removeEventListener("pointerdown", onPointerDown);
        };
    }, [open]);

    const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

    return (
        <>
            <a
                href="#main-content"
                className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-xl focus:bg-cyan-400 focus:px-4 focus:py-2.5 focus:text-sm focus:font-semibold focus:text-slate-950"
                onClick={() => {
                    const main = document.querySelector("main");
                    if (main && !main.id) main.id = "main-content";
                }}
            >
                Skip to main content
            </a>
            <header
                ref={headerRef}
                className={`sticky top-0 z-50 border-b bg-slate-950/95 text-white shadow-lg shadow-slate-950/10 backdrop-blur-xl transition-[border-color,box-shadow] ${scrolled ? "border-white/10 shadow-xl shadow-slate-950/30" : "border-transparent"}`}
            >
                <div className="mx-auto flex h-[72px] max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
                    <Link href="/" className="group flex shrink-0 items-center gap-3 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300" aria-label="GGuard AI home">
                        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-400 text-slate-950 shadow-lg shadow-cyan-950/30 transition group-hover:rotate-3">
                            <ShieldCheck className="h-5 w-5" strokeWidth={2.5} />
                        </span>
                        <span className="text-lg font-bold tracking-tight">GGuard<span className="text-cyan-300">AI</span></span>
                    </Link>

                    <nav aria-label="Main navigation" className="hidden items-center gap-1 xl:flex">
                        {NAV.map((item) => {
                            const active = isActive(item.href);
                            return (
                                <Link
                                    key={item.href}
                                    href={item.href}
                                    aria-current={active ? "page" : undefined}
                                    className={`relative rounded-lg px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 ${active ? "bg-white/10 text-white after:absolute after:-bottom-1 after:left-1/2 after:h-0.5 after:w-6 after:-translate-x-1/2 after:rounded-full after:bg-cyan-300" : "text-slate-300 hover:bg-white/5 hover:text-white"}`}
                                >
                                    {item.label}
                                </Link>
                            );
                        })}
                    </nav>

                    <div className="flex shrink-0 items-center gap-3">
                        <Link href="/#products" className="hidden items-center gap-1.5 rounded-xl bg-cyan-400 px-4 py-2 text-sm font-semibold text-slate-950 shadow-md shadow-cyan-950/20 transition hover:bg-cyan-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-200 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 md:inline-flex">
                            Choose a product <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
                        </Link>
                        <button
                            ref={toggleRef}
                            className="inline-flex min-h-11 min-w-11 items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 text-slate-100 transition hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 xl:hidden"
                            onClick={() => setOpen((value) => !value)}
                            aria-label="Toggle menu"
                            aria-expanded={open}
                            aria-controls="mobile-navigation"
                        >
                            <span className="hidden text-sm font-medium sm:inline">Menu</span>
                            {open ? <X className="h-5 w-5" aria-hidden="true" /> : <Menu className="h-5 w-5" aria-hidden="true" />}
                        </button>
                    </div>
                </div>

                <div
                    id="mobile-navigation"
                    className={`menu-enter border-t border-white/10 bg-slate-950 px-4 pb-5 pt-3 xl:hidden ${open ? "" : "hidden"}`}
                >
                    <nav aria-label="Mobile navigation" className="mx-auto flex max-w-7xl flex-col gap-1">
                        {NAV.map((item) => {
                            const active = isActive(item.href);
                            return (
                                <Link
                                    key={item.href}
                                    href={item.href}
                                    aria-current={active ? "page" : undefined}
                                    onClick={() => setOpen(false)}
                                    className={`flex min-h-11 items-center justify-between rounded-xl px-4 text-[15px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 ${active ? "bg-cyan-400/10 text-cyan-200" : "text-slate-200 hover:bg-white/5 hover:text-white"}`}
                                >
                                    {item.label}
                                    {active && <span className="text-xs text-cyan-300">Current</span>}
                                </Link>
                            );
                        })}
                        <Link href="/#products" className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-cyan-400 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-200 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950" onClick={() => setOpen(false)}>
                            Choose a product <ArrowRight className="h-4 w-4" aria-hidden="true" />
                        </Link>
                    </nav>
                </div>
            </header>
        </>
    );
}