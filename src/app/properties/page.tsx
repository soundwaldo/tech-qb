import type { Metadata } from "next";
import { Building2, LockKeyhole, ShieldCheck } from "lucide-react";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { PropertyLookupForm } from "@/components/properties/PropertyLookupForm";

export const metadata: Metadata = {
    title: "Property Registry | GGuard",
    description: "Look up the permanent public UUID and privacy-safe verified history for a GGuard property.",
};

export default function PropertyRegistryPage() {
    return <><Header /><main className="min-h-[70vh] bg-slate-950 py-12"><div className="mx-auto max-w-xl px-4"><div className="rounded-3xl border border-white/10 bg-slate-900 p-7 sm:p-9"><Building2 className="h-10 w-10 text-cyan-300" /><h1 className="mt-4 text-3xl font-bold text-white">Property UUID Registry</h1><p className="mt-3 text-sm leading-6 text-slate-300">Find the permanent GGuard identity assigned when an assessment or repair record is first created for a property.</p><PropertyLookupForm /><div className="mt-6 grid gap-3 sm:grid-cols-2"><div className="rounded-xl bg-white/5 p-3"><ShieldCheck className="h-5 w-5 text-cyan-300" /><p className="mt-2 text-xs leading-5 text-slate-300"><strong>Public:</strong> UUID, region, completed record category, date and integrity proof.</p></div><div className="rounded-xl bg-white/5 p-3"><LockKeyhole className="h-5 w-5 text-cyan-300" /><p className="mt-2 text-xs leading-5 text-slate-300"><strong>Private:</strong> exact address display, media, contact details, bids, invoices and active issues.</p></div></div></div></div></main><Footer /></>;
}
