"use client";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { ShieldCheck } from "lucide-react";

export default function LoginPage() {
    const router = useRouter(); const [password, setPassword] = useState(""); const [error, setError] = useState(""); const [loading, setLoading] = useState(false);
    async function submit(event: FormEvent) { event.preventDefault(); setLoading(true); setError(""); const response = await fetch("/api/admin/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password }) }); const body = await response.json(); if (!response.ok) { setError(body.error || "Unable to sign in"); setLoading(false); return; } router.push("/admin"); router.refresh(); }
    return <><Header /><main className="flex min-h-[75vh] items-center bg-slate-950 py-12"><div className="mx-auto w-full max-w-md px-4"><div className="rounded-3xl border border-slate-800 bg-slate-900 p-8 shadow-xl"><ShieldCheck className="h-10 w-10 text-cyan-400" /><p className="mt-5 text-xs font-semibold uppercase tracking-[.2em] text-cyan-400">Expert access</p><h1 className="mt-2 text-2xl font-bold text-white">GGuard review workspace</h1><p className="mt-2 text-sm leading-6 text-slate-400">Restricted to authorized GGuard reviewers. Customers use private report links.</p><form onSubmit={submit} className="mt-6 space-y-4"><Input id="password" label="Admin password" type="password" required value={password} onChange={(event) => setPassword(event.target.value)} error={error || undefined} /><Button type="submit" loading={loading} className="w-full bg-cyan-500 text-slate-950 hover:bg-cyan-400">Open review queue</Button></form></div></div></main><Footer /></>;
}
