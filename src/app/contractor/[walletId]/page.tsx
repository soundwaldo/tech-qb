import { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ShieldCheck, Wrench, Calendar, Hash, BadgeCheck, AlertCircle, Flag } from "lucide-react";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { getContractorProfile, getContractorLedger } from "@/lib/property-ledger";

interface PageProps {
    params: Promise<{ walletId: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
    const { walletId } = await params;
    const contractor = await getContractorProfile(walletId);
    if (!contractor) return { title: "Contractor Not Found | GGuard" };
    return {
        title: `${contractor.name} · Contractor Profile | GGuard`,
        description: `Tamper-evident repair history for ${contractor.name}. ${contractor.repairCount} submitted record(s).`,
    };
}

export default async function ContractorProfilePage({ params }: PageProps) {
    const { walletId } = await params;
    const [contractor, records] = await Promise.all([
        getContractorProfile(walletId),
        getContractorLedger(walletId),
    ]);

    if (!contractor) notFound();

    const isLicensed = contractor.identityType === "license";

    return (
        <>
            <Header />
            <main className="min-h-screen bg-slate-900 py-12 text-white">
                <div className="mx-auto max-w-4xl px-4 sm:px-6">

                    {/* Identity card */}
                    <div className="rounded-2xl border border-slate-700 bg-slate-800/60 p-8">
                        <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
                            <div>
                                <div className="flex items-center gap-2">
                                    <Wrench className="h-5 w-5 text-cyan-400" />
                                    <span className="text-xs font-semibold uppercase tracking-widest text-cyan-400">
                                        Contractor Profile
                                    </span>
                                </div>
                                <h1 className="mt-2 text-3xl font-bold">{contractor.name}</h1>
                                {contractor.trade && (
                                    <p className="mt-1 text-slate-400">{contractor.trade}</p>
                                )}
                                <div className="mt-3 flex flex-wrap items-center gap-3">
                                    {isLicensed ? (
                                        <span className="flex items-center gap-1.5 rounded-full bg-emerald-900/60 px-3 py-1 text-xs font-medium text-emerald-300 border border-emerald-700">
                                            <BadgeCheck className="h-3.5 w-3.5" />
                                            License-verified identity
                                        </span>
                                    ) : (
                                        <span className="flex items-center gap-1.5 rounded-full bg-amber-900/40 px-3 py-1 text-xs font-medium text-amber-300 border border-amber-700">
                                            <AlertCircle className="h-3.5 w-3.5" />
                                            Email-verified identity
                                        </span>
                                    )}
                                    {contractor.license && (
                                        <span className="rounded-full bg-slate-700 px-3 py-1 text-xs text-slate-300">
                                            License #{contractor.license}
                                        </span>
                                    )}
                                </div>
                            </div>
                            <div className="shrink-0 text-right">
                                <div className="text-4xl font-bold text-cyan-400">{contractor.repairCount}</div>
                                <div className="text-sm text-slate-400">verified repair{contractor.repairCount !== 1 ? "s" : ""}</div>
                            </div>
                        </div>

                        {/* Wallet ID */}
                        <div className="mt-6 rounded-xl border border-slate-700 bg-slate-900/60 p-4">
                            <div className="flex items-center gap-2 text-xs text-slate-400 mb-1">
                                <Hash className="h-3.5 w-3.5" />
                                Contractor Wallet ID
                            </div>
                            <p className="break-all font-mono text-xs text-cyan-300">{contractor.walletId}</p>
                            <p className="mt-2 text-xs text-slate-500">
                                This ID is deterministically derived from the contractor&apos;s{" "}
                                {isLicensed ? "name and license number" : "email address"}.
                                It cannot be forged — every record they submit links back to this identity.
                            </p>
                        </div>

                        <div className="mt-4 flex items-center gap-4 text-xs text-slate-500">
                            <span className="flex items-center gap-1">
                                <Calendar className="h-3.5 w-3.5" />
                                First record: {new Date(contractor.firstSeenAt).toLocaleDateString()}
                            </span>
                            <span className="flex items-center gap-1">
                                <Calendar className="h-3.5 w-3.5" />
                                Latest: {new Date(contractor.lastSeenAt).toLocaleDateString()}
                            </span>
                        </div>
                    </div>

                    {/* Repair history */}
                    <div className="mt-8">
                        <h2 className="mb-4 text-lg font-semibold text-white">
                            On-Chain Repair History
                        </h2>

                        {records.length === 0 ? (
                            <div className="rounded-xl border border-slate-700 bg-slate-800/40 p-8 text-center text-slate-400">
                                No repair records yet.
                            </div>
                        ) : (
                            <div className="space-y-4">
                                {records.map((record) => {
                                    return (
                                    <div
                                        key={record.id}
                                        className={`rounded-xl border bg-slate-800/40 p-5 ${
                                            record.isDisputed ? 'border-amber-700 bg-amber-900/20' : 'border-slate-700'
                                        }`}
                                    >
                                        <div className="flex items-start justify-between gap-4">
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    {record.isDisputed ? (
                                                        <Flag className="h-4 w-4 shrink-0 text-amber-400" />
                                                    ) : (
                                                        <ShieldCheck className={`h-4 w-4 shrink-0 ${
                                                            record.anchorStatus === "confirmed"
                                                                ? "text-emerald-400"
                                                                : "text-amber-400"
                                                        }`} />
                                                    )}
                                                    <span className={`text-xs font-medium ${
                                                        record.isDisputed ? 'text-amber-400' : (record.anchorStatus === "confirmed"
                                                            ? "text-emerald-400"
                                                            : "text-amber-400")
                                                    }`}>
                                                        {record.isDisputed 
                                                            ? "⚠️ Disputed - Under Review" 
                                                            : (record.anchorStatus === "confirmed" ? (record.anchorProvider === "mock" ? "Development proof" : "On-chain confirmed") : "Pending anchor")}
                                                    </span>
                                                    <span className="text-xs text-slate-500">
                                                        {new Date(record.createdAt).toLocaleDateString()}
                                                    </span>
                                                </div>
                                                <p className="mt-2 text-sm text-slate-300">{record.publicSummary}</p>
                                            </div>
                                        </div>

                                        <div className="mt-3 flex flex-wrap items-center gap-3">
                                            <Link
                                                href={record.propertyId ? `/properties/${record.propertyId}` : `/ledger/${record.propertyAddressId}`}
                                                className="text-xs text-cyan-400 hover:text-cyan-300 underline underline-offset-2"
                                            >
                                                View property ledger →
                                            </Link>
                                            {record.anchorTxId && (
                                                <span className="font-mono text-xs text-slate-500 truncate max-w-[200px]">
                                                    TX: {record.anchorTxId.slice(0, 20)}…
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    <div className="mt-8 text-center">
                        <Link href="/auth/sign-in?next=/submit-repair" className="text-sm text-cyan-400 hover:text-cyan-300">
                            Sign in to submit a repair record →
                        </Link>
                    </div>
                </div>
            </main>
            <Footer />
        </>
    );
}
