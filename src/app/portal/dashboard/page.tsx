import Link from "next/link";
import { redirect } from "next/navigation";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { Badge } from "@/components/ui/Badge";
import { createClient } from "@/lib/neon";
import { FileCheck2, Plus, Building2, Clock3 } from "lucide-react";
import type { Assessment } from "@/types";
import { BillingButton } from "@/components/portal/BillingButton";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
    const client = await createClient();
    const { data: { user } } = await client.auth.getUser();
    if (!user?.id) redirect("/auth/sign-in?next=/portal/dashboard");
    const { data: profile } = await client.from("profiles").select("full_name, role, organization_id").eq("id", user.id).single();
    const assessmentQuery = client.from("assessments").select("*");
    if (profile?.organization_id) {
        assessmentQuery.eq("organization_id", profile.organization_id);
    } else {
        assessmentQuery.eq("customer_user_id", user.id);
    }
    const { data } = await assessmentQuery.order("created_at", { ascending: false });
    const assessments = (Array.isArray(data) ? data : []) as unknown as Assessment[];
    const completed = assessments.filter((item) => item.status === "completed").length;
    const assessmentHref = profile?.role === "hoa_board" ? "/upload?ref=hoa" : profile?.role === "property_manager" ? "/upload?ref=pm" : "/upload";
    return <><Header /><main className="min-h-[75vh] bg-slate-950 py-10"><div className="mx-auto max-w-6xl px-4 sm:px-6"><div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end"><div><p className="text-sm font-semibold text-cyan-300">{profile?.organization_id ? "Organization workspace" : "My reports"}</p><h1 className="mt-1 text-3xl font-bold text-white">Welcome{profile?.full_name ? `, ${profile.full_name}` : ""}</h1><p className="mt-2 text-slate-400">Submit repair quotes and keep every independent assessment in one place.</p></div><div className="flex flex-wrap items-center gap-3">{profile?.organization_id ? <BillingButton /> : null}<Link href={assessmentHref}><span className="inline-flex items-center gap-2 rounded-xl bg-cyan-400 px-5 py-3 text-sm font-semibold text-white hover:bg-cyan-300"><Plus className="h-4 w-4" />New assessment</span></Link></div></div>
    <div className="mt-8 grid gap-4 sm:grid-cols-3"><Metric icon={<FileCheck2 />} label="Total assessments" value={assessments.length} /><Metric icon={<Clock3 />} label="In review" value={assessments.filter((item) => ["paid", "in_review"].includes(item.status)).length} /><Metric icon={<Building2 />} label="Reports ready" value={completed} /></div>
    <section className="mt-8 overflow-hidden rounded-2xl border border-white/10 bg-slate-900"><div className="border-b border-white/10 px-6 py-4"><h2 className="font-bold text-white">Assessment history</h2></div>{assessments.length === 0 ? <div className="p-10 text-center"><p className="font-medium text-slate-200">No assessments yet</p><p className="mt-1 text-sm text-slate-500">Submit a contractor quote to get your first independent report.</p></div> : <div className="divide-y divide-white/10">{assessments.map((item) => <div key={item.id} className="flex flex-col justify-between gap-3 px-6 py-5 sm:flex-row sm:items-center"><div><p className="font-semibold text-white">{item.property_label || `Property in ${item.zip_code}`}</p><p className="mt-1 text-sm text-slate-500">{item.contractor_name || "Contractor not provided"} · {new Date(item.created_at).toLocaleDateString()}</p></div><div className="flex items-center gap-3"><Badge>{item.status.replaceAll("_", " ")}</Badge>{item.status === "completed" && <Link className="text-sm font-semibold text-cyan-300 hover:underline" href={`/report/${item.id}`}>View report</Link>}</div></div>)}</div>}</section></div></main><Footer /></>;
}

function Metric({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) { return <div className="rounded-2xl border border-white/10 bg-slate-900 p-5"><div className="flex items-center gap-3 text-cyan-300">{icon}<span className="text-sm font-medium text-slate-400">{label}</span></div><p className="mt-3 text-3xl font-bold text-white">{value}</p></div>; }
