"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { ShieldCheck } from "lucide-react";

export default function VerifyLookupPage() {
  const router = useRouter();
  const [recordId, setRecordId] = useState("");

  function submit(event: FormEvent) {
    event.preventDefault();
    const normalized = recordId.trim();
    if (normalized) router.push(`/verify/${encodeURIComponent(normalized)}`);
  }

  return <><Header /><main className="flex min-h-[70vh] items-center bg-slate-950 py-12"><div className="mx-auto w-full max-w-lg px-4"><form onSubmit={submit} className="rounded-3xl border border-white/10 bg-slate-900 p-8"><ShieldCheck className="h-10 w-10 text-cyan-300" /><h1 className="mt-4 text-2xl font-bold text-white">Verify a GGuard record</h1><p className="mt-2 text-sm leading-6 text-slate-400">Enter the public verification ID printed on the report, invoice record, or QR-code destination. Personal property information is not displayed.</p><div className="mt-6"><Input id="record-id" label="Public verification ID" value={recordId} onChange={(event) => setRecordId(event.target.value)} placeholder="Enter verification ID" required autoComplete="off" /></div><Button type="submit" className="mt-4 w-full">Verify record</Button></form></div></main><Footer /></>;
}
