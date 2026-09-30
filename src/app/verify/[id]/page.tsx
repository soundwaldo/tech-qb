import { notFound } from "next/navigation";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { Badge } from "@/components/ui/Badge";
import { createServiceClient } from "@/lib/neon";
import { format } from "date-fns";

export default async function VerifyPage({
    params,
}: {
    params: Promise<{ id: string }>;
}) {
    const { id } = await params;
    const service = createServiceClient();

    const { data: reportRecord } = await service
        .from("public_report_verifications")
        .select("*")
        .eq("public_id", id)
        .maybeSingle();
    const { data: maintenanceRecord } = reportRecord ? { data: null } : await service
        .from("public_verifications")
        .select("*")
        .eq("public_id", id)
        .maybeSingle();
    const record = (reportRecord || maintenanceRecord) as Record<string, unknown> | null;

    if (!record) {
        notFound();
    }

    return (
        <>
            <Header />
            <main className="flex-1 bg-slate-950 py-12">
                <div className="mx-auto max-w-lg px-4">
                    <div className="rounded-3xl border border-white/10 bg-slate-900 p-8 text-center">
                        <Badge className="bg-emerald-500/15 text-emerald-300">
                            Verified
                        </Badge>

                        <h1 className="mt-4 text-2xl font-bold text-white">
                            Maintenance Record
                        </h1>

                        <div className="mt-6 space-y-3 text-left">
                            <div>
                                <p className="text-xs font-semibold uppercase text-slate-400">
                                    Location
                                </p>
                                <p className="text-slate-200">
                                    {"city" in record ? `${String(record.city)}, ${String(record.zip_code)}` : "Private property reference"}
                                </p>
                            </div>

                            <div>
                                <p className="text-xs font-semibold uppercase text-slate-400">
                                    Repair Type
                                </p>
                                <p className="text-slate-200">{"repair_type" in record ? String(record.repair_type) : "GGuard diagnostic assessment"}</p>
                            </div>

                            <div>
                                <p className="text-xs font-semibold uppercase text-slate-400">
                                    Completed
                                </p>
                                <p className="text-slate-200">
                                    {format(new Date("completed_date" in record ? String(record.completed_date) : String(record.verified_at)), "MMMM d, yyyy")}
                                </p>
                            </div>

                            <div>
                                <p className="text-xs font-semibold uppercase text-slate-400">
                                    Verification Hash
                                </p>
                                <p className="break-all font-mono text-xs text-slate-400">
                                    {String(record.content_hash)}
                                </p>
                            </div>
                        </div>

                        <p className="mt-6 text-xs text-slate-500">
                            This record proves the repair was verified by GGuard Diagnostics.
                            No personal data is shown.
                        </p>
                    </div>
                </div>
            </main>
            <Footer />
        </>
    );
}
