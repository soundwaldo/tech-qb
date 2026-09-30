'use client';

import { useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import type { ParsedInvoice } from "@/app/api/ledger/parse-invoice/route";

const TRADES = [
    "HVAC", "Plumbing", "Electrical", "Roofing", "Garage Door",
    "Foundation", "Flooring", "Painting", "Landscaping", "Pest Control",
    "Windows & Doors", "Appliances", "General Contractor", "Other",
];

interface SubmitResult {
    recordId: string;
    propertyAddressId: string;
    contentHash: string;
    anchorTxId: string | null;
    anchorStatus: string;
    contractorWalletId: string | null;
    contractorProfileUrl: string | null;
    verifyUrl: string;
}

export function SubmitRepairForm({ initialInviteToken }: { initialInviteToken: string }) {
    const [form, setForm] = useState({
        propertyAddress: "",
        zipCode: "",
        trade: "",
        summary: "",
        contractorName: "",
        contractorLicense: "",
        contractorEmail: "",
        costDollars: "",
        repairedAt: new Date().toISOString().split("T")[0],
        relatedAssessmentId: "",
    });
    const [submitting, setSubmitting] = useState(false);
    const [parsing, setParsing] = useState(false);
    const [parseError, setParseError] = useState<string | null>(null);
    const [result, setResult] = useState<SubmitResult | null>(null);
    const [error, setError] = useState<string | null>(null);
    const inviteToken = initialInviteToken;
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
    };

    const handleInvoiceUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // Validate type
        const allowed = ["image/jpeg", "image/png", "image/webp"];
        if (!allowed.includes(file.type)) {
            setParseError("Please upload a JPG, PNG, or WebP image of the invoice. For PDF invoices, take a screenshot first.");
            return;
        }
        if (file.size > 10 * 1024 * 1024) {
            setParseError("Image must be under 10MB.");
            return;
        }

        setParsing(true);
        setParseError(null);

        try {
            // Convert to base64
            const buffer = await file.arrayBuffer();
            const base64 = btoa(String.fromCharCode(...new Uint8Array(buffer)));

            const res = await fetch("/api/ledger/parse-invoice", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ imageBase64: base64, mimeType: file.type, inviteToken }),
            });

            const data = await res.json() as { extracted?: ParsedInvoice; error?: string };

            if (!res.ok || !data.extracted) {
                setParseError("Couldn't extract data from this image. Fill the form manually.");
                return;
            }

            // Pre-fill form with extracted values, keeping existing values if AI returned nothing
            setForm((prev) => ({
                ...prev,
                propertyAddress: data.extracted!.propertyAddress || prev.propertyAddress,
                zipCode: data.extracted!.zipCode || prev.zipCode,
                trade: data.extracted!.trade || prev.trade,
                contractorName: data.extracted!.contractorName || prev.contractorName,
                contractorLicense: data.extracted!.contractorLicense || prev.contractorLicense,
                contractorEmail: data.extracted!.contractorEmail || prev.contractorEmail,
                summary: data.extracted!.summary || prev.summary,
                costDollars: data.extracted!.costDollars || prev.costDollars,
                repairedAt: data.extracted!.repairedAt || prev.repairedAt,
            }));
        } catch {
            setParseError("Upload failed. Please fill the form manually.");
        } finally {
            setParsing(false);
            // Reset file input
            if (fileInputRef.current) fileInputRef.current.value = "";
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSubmitting(true);
        setError(null);
        setResult(null);

        const costCents = Math.round(parseFloat(form.costDollars || "0") * 100);
        if (isNaN(costCents) || costCents < 0) {
            setError("Please enter a valid cost amount.");
            setSubmitting(false);
            return;
        }

        try {
            const res = await fetch("/api/ledger/repair", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    propertyAddress: form.propertyAddress,
                    zipCode: form.zipCode,
                    trade: form.trade,
                    summary: form.summary,
                    contractorName: form.contractorName,
                    contractorLicense: form.contractorLicense || undefined,
                    contractorEmail: form.contractorEmail || undefined,
                    costCents,
                    repairedAt: form.repairedAt,
                    relatedAssessmentId: form.relatedAssessmentId || undefined,
                    inviteToken,
                }),
            });

            const data = await res.json() as { error?: string } & Partial<SubmitResult>;

            if (!res.ok) {
                setError(data.error ?? "Submission failed. Please try again.");
                return;
            }

            setResult(data as SubmitResult);
        } catch {
            setError("Network error. Please check your connection and try again.");
        } finally {
            setSubmitting(false);
        }
    };

    if (result) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
                <div className="bg-white rounded-2xl border border-slate-200 p-8 max-w-lg w-full text-center">
                    <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <svg className="w-8 h-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                    </div>
                    <h1 className="text-xl font-bold text-slate-900 mb-2">Record Anchored</h1>
                    <p className="text-slate-500 text-sm mb-6">
                        Your repair record has been permanently added to this property&apos;s maintenance ledger.
                    </p>

                    <div className="bg-slate-50 rounded-xl p-4 text-left space-y-3 mb-6">
                        {result.contractorWalletId && (
                            <div className="border border-teal-200 bg-teal-50 rounded-lg p-3">
                                <p className="text-xs font-semibold text-teal-800 mb-1 flex items-center gap-1">
                                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                                    </svg>
                                    Your Contractor Wallet ID
                                </p>
                                <p className="text-xs font-mono text-teal-900 break-all">{result.contractorWalletId}</p>
                                <p className="mt-1 text-xs text-teal-700">
                                    This is your permanent identity on GGuard. All your repair records are linked to this wallet.
                                </p>
                                {result.contractorProfileUrl && (
                                    <a
                                        href={result.contractorProfileUrl}
                                        className="mt-2 inline-block text-xs text-teal-800 font-medium underline underline-offset-2"
                                    >
                                        View your contractor profile →
                                    </a>
                                )}
                            </div>
                        )}
                        <div>
                            <p className="text-xs text-slate-500 mb-1">Record ID</p>
                            <p className="text-xs font-mono text-slate-700 break-all">{result.recordId}</p>
                        </div>
                        <div>
                            <p className="text-xs text-slate-500 mb-1">Content Hash (SHA-256)</p>
                            <p className="text-xs font-mono text-slate-700 break-all">{result.contentHash}</p>
                        </div>
                        {result.anchorTxId && (
                            <div>
                                <p className="text-xs text-slate-500 mb-1">Blockchain TX</p>
                                <p className="text-xs font-mono text-teal-700 break-all">{result.anchorTxId}</p>
                            </div>
                        )}
                        <div>
                            <p className="text-xs text-slate-500 mb-1">Status</p>
                            <span className="inline-block text-xs bg-teal-100 text-teal-800 px-2 py-0.5 rounded-full font-medium">
                                {result.anchorStatus}
                            </span>
                        </div>
                    </div>

                    <div className="flex flex-col sm:flex-row gap-3">
                        <a
                            href={result.verifyUrl}
                            className="flex-1 bg-teal-700 text-white text-sm font-medium px-4 py-2.5 rounded-lg hover:bg-teal-800 transition-colors text-center"
                        >
                            View Property Ledger
                        </a>
                        <button
                            onClick={() => { setResult(null); setForm((prev) => ({ ...prev, summary: "", costDollars: "" })); }}
                            className="flex-1 border border-slate-200 text-slate-700 text-sm font-medium px-4 py-2.5 rounded-lg hover:bg-slate-50 transition-colors"
                        >
                            Submit Another
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-50">
            <header className="bg-white border-b border-slate-200">
                <div className="max-w-2xl mx-auto px-4 py-4 flex items-center gap-3">
                    <div className="w-8 h-8 bg-teal-700 rounded-lg flex items-center justify-center">
                        <span className="text-white text-sm font-bold">G</span>
                    </div>
                    <div>
                        <p className="text-xs text-slate-500 font-medium">GGuard Property Ledger</p>
                        <p className="text-sm font-semibold text-slate-900">Submit Repair Record</p>
                    </div>
                </div>
            </header>

            <main className="max-w-2xl mx-auto px-4 py-8">
                <div className="bg-white rounded-xl border border-slate-200 p-6 mb-6">
                    <h2 className="font-semibold text-slate-900 mb-1">Permanent Repair Record</h2>
                    <p className="text-sm text-slate-500">
                        This record will be permanently anchored to the property&apos;s maintenance ledger.
                        Its content hash provides tamper evidence, and your signed-in account is recorded as the submitter.
                    </p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6">
                    <section className="bg-teal-50 border border-teal-200 rounded-xl p-6">
                        <div className="flex items-start gap-4">
                            <div className="w-10 h-10 bg-teal-100 rounded-lg flex items-center justify-center flex-shrink-0">
                                <svg className="w-5 h-5 text-teal-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                                </svg>
                            </div>
                            <div className="flex-1">
                                <h3 className="font-semibold text-teal-900 text-sm mb-1">Upload Invoice to Auto-Fill</h3>
                                <p className="text-xs text-teal-700 mb-3">
                                    Take a photo or screenshot of the invoice. AI will extract the property address,
                                    contractor, work description, cost, and date automatically.
                                </p>
                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    accept="image/jpeg,image/png,image/webp"
                                    onChange={handleInvoiceUpload}
                                    disabled={parsing}
                                    className="hidden"
                                    id="invoice-upload"
                                />
                                <label
                                    htmlFor="invoice-upload"
                                    className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium cursor-pointer transition-colors ${
                                        parsing
                                            ? "bg-teal-200 text-teal-600 cursor-not-allowed"
                                            : "bg-teal-700 text-white hover:bg-teal-800"
                                    }`}
                                >
                                    {parsing ? (
                                        <>
                                            <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                            </svg>
                                            Reading invoice...
                                        </>
                                    ) : (
                                        <>
                                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                            </svg>
                                            Upload Invoice Photo
                                        </>
                                    )}
                                </label>
                                <p className="text-xs text-teal-600 mt-2">JPG, PNG, or WebP · Max 10MB · Or fill the form manually below</p>
                                {parseError && (
                                    <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mt-2">
                                        {parseError}
                                    </p>
                                )}
                            </div>
                        </div>
                    </section>
                    <section className="bg-white rounded-xl border border-slate-200 p-6 space-y-4">
                        <h3 className="font-medium text-slate-900 text-sm">Property Information</h3>
                        <div>
                            <label className="block text-xs font-medium text-slate-700 mb-1.5">
                                Street Address <span className="text-red-500">*</span>
                            </label>
                            <Input
                                name="propertyAddress"
                                value={form.propertyAddress}
                                onChange={handleChange}
                                placeholder="123 Main St"
                                required
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-slate-700 mb-1.5">
                                ZIP Code <span className="text-red-500">*</span>
                            </label>
                            <Input
                                name="zipCode"
                                value={form.zipCode}
                                onChange={handleChange}
                                placeholder="12345"
                                pattern="^\d{5}(?:-\d{4})?$"
                                required
                            />
                        </div>
                    </section>

                    <section className="bg-white rounded-xl border border-slate-200 p-6 space-y-4">
                        <h3 className="font-medium text-slate-900 text-sm">Repair Details</h3>
                        <div>
                            <label className="block text-xs font-medium text-slate-700 mb-1.5">
                                Trade / Work Type <span className="text-red-500">*</span>
                            </label>
                            <select
                                name="trade"
                                value={form.trade}
                                onChange={handleChange}
                                required
                                className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-teal-600 focus:border-transparent"
                            >
                                <option value="">Select a trade...</option>
                                {TRADES.map((t) => <option key={t} value={t}>{t}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-slate-700 mb-1.5">
                                Date Completed <span className="text-red-500">*</span>
                            </label>
                            <Input
                                type="date"
                                name="repairedAt"
                                value={form.repairedAt}
                                onChange={handleChange}
                                max={new Date().toISOString().split("T")[0]}
                                required
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-slate-700 mb-1.5">
                                Work Performed <span className="text-red-500">*</span>
                            </label>
                            <textarea
                                name="summary"
                                value={form.summary}
                                onChange={handleChange}
                                placeholder="Describe what was repaired or replaced in detail..."
                                required
                                rows={4}
                                className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-teal-600 focus:border-transparent resize-none"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-slate-700 mb-1.5">
                                Total Cost <span className="text-red-500">*</span>
                            </label>
                            <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">$</span>
                                <Input
                                    type="number"
                                    name="costDollars"
                                    value={form.costDollars}
                                    onChange={handleChange}
                                    placeholder="0.00"
                                    min="0"
                                    step="0.01"
                                    required
                                    className="pl-7"
                                />
                            </div>
                        </div>
                    </section>

                    <section className="bg-white rounded-xl border border-slate-200 p-6 space-y-4">
                        <h3 className="font-medium text-slate-900 text-sm">Contractor Information</h3>
                        <div>
                            <label className="block text-xs font-medium text-slate-700 mb-1.5">
                                Company / Name <span className="text-red-500">*</span>
                            </label>
                            <Input
                                name="contractorName"
                                value={form.contractorName}
                                onChange={handleChange}
                                placeholder="ACME Plumbing LLC"
                                required
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-slate-700 mb-1.5">
                                License Number <span className="text-slate-400 font-normal">(optional)</span>
                            </label>
                            <Input
                                name="contractorLicense"
                                value={form.contractorLicense}
                                onChange={handleChange}
                                placeholder="LIC-123456"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-slate-700 mb-1.5">
                                Contact Email <span className="text-slate-400 font-normal">(optional)</span>
                            </label>
                            <Input
                                type="email"
                                name="contractorEmail"
                                value={form.contractorEmail}
                                onChange={handleChange}
                                placeholder="info@acmeplumbing.com"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-slate-700 mb-1.5">
                                Related GGuard Assessment ID <span className="text-slate-400 font-normal">(optional)</span>
                            </label>
                            <Input
                                name="relatedAssessmentId"
                                value={form.relatedAssessmentId}
                                onChange={handleChange}
                                placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                            />
                            <p className="text-xs text-slate-400 mt-1">Link this repair to a prior GGuard diagnosis if available.</p>
                        </div>
                    </section>

                    {error && (
                        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-700">
                            {error}
                        </div>
                    )}

                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-xs text-amber-800">
                        By submitting, you confirm this information is accurate and consent to it being permanently
                        recorded in a public, tamper-evident maintenance ledger. Corrections are handled through visible dispute notes rather than silently rewriting the submitted record.
                    </div>

                    <Button type="submit" size="lg" className="w-full" loading={submitting} disabled={submitting}>
                        {submitting ? "Anchoring to ledger..." : "Submit Permanent Record"}
                    </Button>
                </form>
            </main>
        </div>
    );
}
