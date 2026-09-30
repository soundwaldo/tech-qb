import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BadgeCheck, Building2, CalendarDays, Hash, ShieldCheck, Wrench } from "lucide-react";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { getPublicProperty, getPublicPropertyRecords } from "@/lib/property-registry";

interface PageProps { params: Promise<{ id: string }> }

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
    const { id } = await params;
    return {
        title: `Property ${id.slice(0, 8)} | GGuard Registry`,
        description: "Privacy-safe verified property maintenance history.",
        robots: { index: false, follow: false },
    };
}

export default async function PublicPropertyPage({ params }: PageProps) {
    const { id } = await params;
    const property = await getPublicProperty(id);
    if (!property) notFound();
    const records = await getPublicPropertyRecords(property.id);

    return <><Header /><main className="min-h-[70vh] bg-slate-950 py-10"><div className="mx-auto max-w-3xl px-4"><section className="rounded-3xl border border-white/10 bg-slate-900 p-6 shadow-sm sm:p-8"><div className="flex items-start gap-4"><span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-cyan-400/15"><Building2 className="h-6 w-6 text-cyan-300" /></span><div><p className="text-xs font-bold uppercase tracking-wider text-cyan-300">Permanent public identity</p><h1 className="mt-1 text-2xl font-bold text-white">GGuard Property Record</h1><p className="mt-2 break-all font-mono text-xs text-slate-400">{property.id}</p></div></div><dl className="mt-6 grid gap-3 sm:grid-cols-2"><div className="rounded-xl bg-white/5 p-4"><dt className="text-xs font-bold uppercase text-slate-500">Public region</dt><dd className="mt-1 font-semibold text-slate-100">{property.publicRegion}</dd></div><div className="rounded-xl bg-white/5 p-4"><dt className="text-xs font-bold uppercase text-slate-500">Registered</dt><dd className="mt-1 font-semibold text-slate-100">{new Date(property.createdAt).toLocaleDateString()}</dd></div></dl><p className="mt-4 text-xs leading-5 text-slate-400">The exact street address, customer information, photos, videos, bids and invoices are private and are not included in this public view.</p></section><section className="mt-6"><h2 className="text-lg font-bold text-white">Completed public history</h2>{records.length === 0 ? <div className="mt-3 rounded-2xl border border-white/10 bg-slate-900 p-8 text-center text-sm text-slate-400">No completed public records yet. Draft assessments and active property issues are never disclosed here.</div> : <div className="mt-3 space-y-3">{records.map((record) => <article key={record.id} className="rounded-2xl border border-white/10 bg-slate-900 p-5"><div className="flex flex-wrap items-center justify-between gap-3"><div className="flex items-center gap-2">{record.recordType === "repair" ? <Wrench className="h-5 w-5 text-cyan-300" /> : <ShieldCheck className="h-5 w-5 text-blue-700" />}<h3 className="font-bold text-white">{record.summary}</h3></div><span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-800"><BadgeCheck className="mr-1 inline h-3.5 w-3.5" />Verified record</span></div><div className="mt-4 grid gap-3 text-sm sm:grid-cols-2"><p className="flex items-center gap-2 text-slate-300"><CalendarDays className="h-4 w-4" />{new Date(record.completedAt).toLocaleDateString()}</p><p className="text-slate-300">Category: <span className="font-medium">{record.category.replaceAll("_", " ")}</span></p>{record.contractorName ? <p className="text-slate-300">Contractor: <span className="font-medium">{record.contractorName}</span>{record.contractorLicense ? ` · License ${record.contractorLicense}` : ""}</p> : null}<p className="text-slate-300">Proof: <span className="font-medium">{record.anchorStatus === "confirmed" && record.anchorProvider !== "mock" ? `On-chain (${record.anchorProvider})` : "GGuard integrity hash"}</span></p></div><div className="mt-4 rounded-lg bg-slate-100 p-3"><p className="flex items-center gap-2 text-xs font-bold uppercase text-slate-500"><Hash className="h-3.5 w-3.5" />Content hash</p><p className="mt-1 break-all font-mono text-xs text-slate-300">{record.contentHash}</p></div></article>)}</div>}</section></div></main><Footer /></>;
}
