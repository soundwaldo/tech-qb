import { notFound } from "next/navigation";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { DiagnosticReport } from "@/components/report/DiagnosticReport";
import { createServiceClient } from "@/lib/neon";
import { isAdminAuthenticated } from "@/lib/admin-auth";
import { getCurrentUser } from "@/lib/auth/server";
import type { Assessment, Diagnosis } from "@/types";

export const metadata = { title: "Diagnostic Report | GGuard Diagnostics", robots: { index: false, follow: false } };

export default async function ReportPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ access?: string }> }) {
    const [{ id }, { access }] = await Promise.all([params, searchParams]);
    const service = createServiceClient();
    const { data: assessment } = await service.from("assessments").select("*").eq("id", id).single();
    const assessmentRow = (assessment as { session_token?: string; customer_user_id?: string | null; organization_id?: string | null; status?: string } | null) ?? null;
    if (!assessmentRow) notFound();

    const [user, adminAuthorized] = await Promise.all([getCurrentUser(), isAdminAuthenticated()]);
    let accountAuthorized = Boolean(user?.id && user.id === assessmentRow.customer_user_id);
    if (!accountAuthorized && user?.id && assessmentRow.organization_id) {
        const { data: profile } = await service.from("profiles").select("organization_id").eq("id", user.id).single();
        accountAuthorized = profile?.organization_id === assessmentRow.organization_id;
    }
    const authorized = access === assessmentRow.session_token || adminAuthorized || accountAuthorized;
    if (!authorized || !["completed", "delivered"].includes(assessmentRow.status || "")) notFound();
    const { data: diagnosis } = await service.from("diagnoses").select("*").eq("assessment_id", id).single();
    if (!diagnosis) notFound();
    return <><Header /><main className="bg-slate-50 py-5 sm:py-10"><div className="mx-auto max-w-4xl px-3 sm:px-6"><DiagnosticReport assessment={assessmentRow as unknown as Assessment} diagnosis={diagnosis as unknown as Diagnosis} /></div></main><Footer /></>;
}
