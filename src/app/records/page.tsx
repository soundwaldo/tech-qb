"use client";

import { FormEvent, useState } from "react";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { MailCheck } from "lucide-react";

export default function RecordsByEmailPage() {
    const [email, setEmail] = useState("");
    const [message, setMessage] = useState("");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);

    async function submit(event: FormEvent) {
        event.preventDefault();
        setLoading(true);
        setMessage("");
        setError("");
        try {
            const response = await fetch("/api/records/email-access", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email }) });
            const body = await response.json() as { message?: string; error?: string };
            if (!response.ok) setError(body.error || "Unable to request records.");
            else setMessage(body.message || "Check your email for private record links.");
        } catch {
            setError("Unable to request records right now.");
        } finally {
            setLoading(false);
        }
    }

    return <><Header /><main className="flex min-h-[70vh] items-center bg-slate-950 py-12"><div className="mx-auto w-full max-w-lg px-4"><form onSubmit={submit} className="rounded-3xl border border-white/10 bg-slate-900 p-8"><MailCheck className="h-10 w-10 text-cyan-300" /><h1 className="mt-4 text-2xl font-bold text-white">Email my records</h1><p className="mt-2 text-sm leading-6 text-slate-400">Enter the email used for your assessment. For privacy, we will never reveal on this page whether an address has records.</p><div className="mt-6"><Input id="record-email" label="Email address" type="email" value={email} onChange={(event) => setEmail(event.target.value)} required autoComplete="email" error={error || undefined} /></div><Button type="submit" loading={loading} className="mt-4 w-full">Send private links</Button>{message && <p role="status" className="mt-4 rounded-lg bg-emerald-500/10 p-3 text-sm text-emerald-300">{message}</p>}</form></div></main><Footer /></>;
}
