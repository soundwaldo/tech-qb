import Link from "next/link";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { ArrowRight, Home } from "lucide-react";

export default function NotFound() {
    return (
        <>
            <Header />
            <main id="main-content" className="flex flex-1 flex-col justify-center bg-slate-950 px-6 py-20 text-center text-white">
                <p className="text-sm font-semibold uppercase tracking-[0.2em] text-cyan-300">404</p>
                <h1 className="mt-4 text-3xl font-bold tracking-tight sm:text-4xl">Page not found</h1>
                <p className="mx-auto mt-3 max-w-md leading-relaxed text-slate-400">
                    The link may be expired, unavailable, or entered incorrectly.
                </p>
                <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
                    <Link href="/" className="inline-flex items-center gap-2 rounded-xl bg-cyan-400 px-5 py-3 font-semibold text-slate-950 transition hover:bg-cyan-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-200 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950">
                        <Home className="h-4 w-4" aria-hidden="true" />
                        Return home
                    </Link>
                    <Link href="/#products" className="inline-flex items-center gap-2 rounded-xl border border-white/15 px-5 py-3 font-semibold text-slate-200 transition hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300">
                        Choose a product
                        <ArrowRight className="h-4 w-4" aria-hidden="true" />
                    </Link>
                </div>
            </main>
            <Footer />
        </>
    );
}