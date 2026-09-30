"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { Button } from "@/components/ui/Button";
import { CheckCircle2 } from "lucide-react";

function SuccessContent() {
    const searchParams = useSearchParams();
    const sessionId = searchParams.get("session_id");

    return (
        <>
            <Header />
            <main className="flex-1 bg-slate-50/50 py-20">
                <div className="mx-auto max-w-md px-4 text-center">
                    <CheckCircle2 className="mx-auto h-16 w-16 text-emerald-600" />
                    <h1 className="mt-4 text-2xl font-bold text-slate-900">
                        Payment received!
                    </h1>
                    <p className="mt-2 text-slate-600">
                        Your assessment is in the queue. We&apos;ll email you when the report is
                        ready.
                    </p>
                    {sessionId && (
                        <p className="mt-1 text-xs text-slate-400">
                            Session: {sessionId.slice(0, 16)}…
                        </p>
                    )}
                    <Link href="/" className="mt-6 inline-block">
                        <Button>Back to home</Button>
                    </Link>
                </div>
            </main>
            <Footer />
        </>
    );
}

export default function SuccessPage() {
    return (
        <Suspense fallback={<div className="flex min-h-screen items-center justify-center">Loading…</div>}>
            <SuccessContent />
        </Suspense>
    );
}
