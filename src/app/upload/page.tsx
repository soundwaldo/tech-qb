"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { ProblemPicker } from "@/components/upload/ProblemPicker";
import { MediaUploader } from "@/components/upload/MediaUploader";
import { TIER_PRICING, AssessmentTier, ProblemCode, DoorType } from "@/types";
import type { EvidenceCategory, EvidenceUpload, MediaType } from "@/types";
import { isValidZip, isValidEmail, formatCurrency } from "@/lib/utils";
import { useSessionInit } from "@/lib/use-session-init";
import { getEvidencePlan } from "@/lib/evidence-requirements";

type Step = 1 | 2 | 3;

function UploadContent() {
    const searchParams = useSearchParams();
    useSessionInit(); // Initialize session token cookie
    const [step, setStep] = useState<Step>(1);
    const [address, setAddress] = useState("");
    const [zipCode, setZipCode] = useState("");
    const [email, setEmail] = useState("");
    const [doorType, setDoorType] = useState<DoorType>("single");
    const [problems, setProblems] = useState<ProblemCode[]>([]);
    const [description, setDescription] = useState("");
    const [phone, setPhone] = useState("");
    const [propertyLabel, setPropertyLabel] = useState("");
    const [contractorName, setContractorName] = useState("");
    const [quoteAmount, setQuoteAmount] = useState("");
    const [aiConsent, setAiConsent] = useState(false);
    const requestedTier = searchParams.get("tier");
    const [tier, setTier] = useState<AssessmentTier>(
        requestedTier === "express" || requestedTier === "comprehensive" ? requestedTier : "standard",
    );
    const [evidence, setEvidence] = useState<EvidenceUpload[]>([]);
    const [quoteKey, setQuoteKey] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [submitted, setSubmitted] = useState(false);
    const [assessmentId, setAssessmentId] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    // Detect if user came from B2B portal
    const ref = searchParams.get("ref");
    const organizationInvite = searchParams.get("orgInvite") || undefined;
    const isB2B = ref === "hoa" || ref === "pm" || ref === "contractor" || Boolean(organizationInvite);
    const b2bType = ref === "hoa" || ref === "pm" ? ref : "pm";
    const evidencePlan = getEvidencePlan(problems);

    const canNext = (): boolean => {
        if (step === 1) return address.trim().length >= 5 && isValidZip(zipCode) && isValidEmail(email) && problems.length > 0;
        if (step === 2) {
            return evidence.some((item) => item.media_type === "photo");
        }
        if (step === 3) return aiConsent && (isB2B || !!tier);
        return false;
    };

    const handleCreateAssessment = async () => {
        try {
            setLoading(true);
            setError(null);

            const res = await fetch("/api/assessments", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "include", // Include HttpOnly cookies
                body: JSON.stringify({
                    zip_code: zipCode,
                    address,
                    door_type: doorType,
                    problems,
                    description,
                    phone: phone || undefined,
                    property_label: propertyLabel || undefined,
                    contractor_name: contractorName || undefined,
                    contractor_quote_cents: quoteAmount ? Math.round(Number(quoteAmount) * 100) : null,
                    quote_key: quoteKey,
                    evidence,
                    ai_processing_consent: aiConsent,
                    email,
                    tier,
                    organization_invite: organizationInvite,
                }),
            });

            const assessment = await res.json();
            if (!res.ok) throw new Error(assessment.error || "Could not create assessment");

            const { assessmentId: id, requiresPayment } = assessment;
            setAssessmentId(id);
            setSubmitted(true);

            if (!requiresPayment) {
                window.location.href = "/portal/dashboard";
                return;
            }

            const checkoutResponse = await fetch("/api/checkout", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    credentials: "include", // Include HttpOnly cookies
                    body: JSON.stringify({
                        assessmentId: id,
                        email,
                    }),
                });
            const checkout = await checkoutResponse.json();
            if (!checkoutResponse.ok || !checkout.url) {
                throw new Error(checkout.error || "Payment checkout could not be opened. Please try again.");
            }

            window.location.href = checkout.url;
        } catch (err) {
            const message = err instanceof Error ? err.message : "Failed to submit assessment";
            setError(message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <>
            <Header />
            <main className="flex-1 bg-slate-50/50 py-8 sm:py-12">
                <div className="mx-auto max-w-2xl px-4">
                    <div className="mb-6 rounded-xl border border-cyan-200 bg-cyan-50 p-4 text-slate-800">
                        <p className="font-semibold">GGuard Diagnostics — Repair Assessment</p>
                        <p className="mt-1 text-sm">This purchase is for an expert-reviewed assessment, not a contractor website widget. <Link href="/pre-dispatch" className="underline">Looking for Pre-Dispatch?</Link></p>
                    </div>
                    {/* Error Alert */}
                    {error && (
                        <div className="mb-6 rounded-lg border border-red-300 bg-red-50 p-4">
                            <p className="text-sm text-red-800">
                                <strong>Error:</strong> {error}
                            </p>
                        </div>
                    )}

                    {/* Progress indicator */}
                    <div className="mb-8">
                        <div className="flex items-center justify-center gap-2">
                            {[1, 2, 3].map((s) => (
                                <div key={s} className="flex items-center">
                                    <div
                                        className={`h-2.5 w-8 rounded-full transition ${
                                            s === step ? "bg-teal-600" : s < step ? "bg-teal-300" : "bg-slate-200"
                                        }`}
                                    />
                                    {s < 3 && <div className={`mx-2 h-0.5 w-4 ${s < step ? "bg-teal-300" : "bg-slate-200"}`} />}
                                </div>
                            ))}
                        </div>
                        <div className="mt-3 text-center">
                            <p className="text-xs font-medium text-slate-500 uppercase">
                                {step === 1 ? "Step 1: Your Property & Issues" : step === 2 ? "Step 2: Upload Photos & Video" : "Step 3: Review & Submit"}
                            </p>
                        </div>
                    </div>

                    <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
                        {step === 1 && (
                            <div>
                                <h2 className="text-xl font-bold text-slate-900">
                                    Tell Us About Your Door
                                </h2>
                                <p className="mt-1 text-sm text-slate-500">
                                    Quick questions to get started. Takes ~2 minutes.
                                </p>

                                <div className="mt-6 space-y-4">
                                    {/* Contact Info */}
                                    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3.5">
                                        <p className="text-xs font-semibold text-slate-700 uppercase mb-3">Your Contact Info</p>
                                        <Input
                                            label="Email"
                                            type="email"
                                            placeholder="you@example.com"
                                            value={email}
                                            onChange={(e) => setEmail(e.target.value)}
                                            error={email && !isValidEmail(email) ? "Invalid email" : undefined}
                                        />
                                    </div>

                                    {/* Property Info */}
                                    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3.5">
                                        <p className="text-xs font-semibold text-slate-700 uppercase mb-3">Property Location</p>
                                        <Input
                                            label="Street Address"
                                            placeholder="123 Main St"
                                            value={address}
                                            onChange={(e) => setAddress(e.target.value)}
                                            required
                                        />
                                        <Input
                                            label="ZIP Code"
                                            placeholder="85001"
                                            value={zipCode}
                                            onChange={(e) => setZipCode(e.target.value)}
                                            error={zipCode && !isValidZip(zipCode) ? "Invalid ZIP" : undefined}
                                        />
                                        <div className="mt-3">
                                            <label className="mb-2 block text-sm font-medium text-slate-700">
                                                Door Type
                                            </label>
                                            <div className="grid grid-cols-2 gap-3">
                                                {(["single", "double"] as DoorType[]).map((d) => (
                                                    <button
                                                        key={d}
                                                        type="button"
                                                        onClick={() => setDoorType(d)}
                                                        aria-pressed={doorType === d}
                                                        className={`rounded-lg border-2 p-3 text-center text-sm font-medium transition ${doorType === d
                                                            ? "border-teal-700 bg-teal-100 text-slate-950 shadow-sm"
                                                            : "border-slate-400 bg-slate-100 text-slate-900 hover:border-teal-600 hover:bg-teal-50"
                                                            }`}
                                                    >
                                                        {d === "single" ? "Single Door" : "Double Door"}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Issues Section */}
                                    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3.5">
                                        <p className="text-xs font-semibold text-slate-700 uppercase mb-3">What&apos;s The Problem?</p>
                                        <ProblemPicker value={problems} onChange={setProblems} />
                                    </div>

                                    {/* Notes */}
                                    <textarea
                                        className="w-full rounded-lg border border-slate-400 bg-white px-4 py-2.5 text-sm text-slate-950 placeholder:text-slate-500 outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-500/30"
                                        rows={2}
                                        aria-label="Additional details"
                                        placeholder="Any additional details? (optional)"
                                        value={description}
                                        onChange={(e) => setDescription(e.target.value)}
                                    />
                                    <div className="rounded-lg border border-teal-300 bg-teal-50 p-3 text-sm font-medium text-teal-950">
                                        Next: {evidencePlan.summary}
                                    </div>
                                </div>
                            </div>
                        )}

                        {step === 2 && (
                            <div>
                                <h2 className="text-xl font-bold text-slate-900">
                                    Show Us What You&apos;re Seeing
                                </h2>
                                <p className="mt-1 text-sm text-slate-500">
                                    Add photos or a short video from your camera, phone gallery, or computer.
                                </p>

                                <div className="mt-6 space-y-4">
                                    <div>
                                        <p className="mb-2 text-xs font-semibold uppercase text-slate-500">
                                            Guided evidence checklist
                                        </p>
                                        <MediaUploader
                                            mode="evidence"
                                            problems={problems}
                                            existingUploads={evidence}
                                            onUploadComplete={(key: string, type: MediaType, category?: EvidenceCategory) => {
                                                if (!category || (type !== "photo" && type !== "video")) return;
                                                setEvidence((current) => [
                                                    ...current.filter((item) => item.category !== category),
                                                    { key, category, media_type: type },
                                                ]);
                                            }}
                                            onRemove={(key) =>
                                                setEvidence((current) => current.filter((item) => item.key !== key))
                                            }
                                        />
                                        <div className="mt-4 rounded-xl border border-teal-200 bg-teal-50 p-3 text-xs leading-5 text-teal-950">
                                            If the submitted photos don&apos;t show enough detail, we may email you to request a photo of a specific area before finalizing your report.
                                        </div>
                                        <div className="mt-4 rounded-2xl border border-slate-300 bg-slate-50 p-4">
                                            <label htmlFor="issue-description" className="block text-sm font-bold text-slate-950">
                                                Can&apos;t safely photograph the issue?
                                            </label>
                                            <p className="mt-1 text-xs leading-5 text-slate-700">Describe what you see, hear or experience. This is optional, but it helps when an area is unsafe or difficult to photograph.</p>
                                            <textarea
                                                id="issue-description"
                                                className="mt-3 w-full rounded-lg border border-slate-400 bg-white px-4 py-3 text-sm text-slate-950 placeholder:text-slate-500 outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-500/30"
                                                rows={3}
                                                placeholder="Example: The door stops halfway and the right cable looks loose."
                                                value={description}
                                                onChange={(event) => setDescription(event.target.value)}
                                            />
                                        </div>
                                        {!canNext() ? (
                                            <p aria-live="polite" className="mt-3 rounded-lg border border-blue-200 bg-blue-50 p-3 text-xs font-medium text-blue-900">
                                                {evidencePlan.summary}
                                            </p>
                                        ) : null}
                                    </div>

                                    <div>
                                        <p className="mb-2 text-xs font-semibold uppercase text-slate-500">
                                            Contractor Quote (optional)
                                        </p>
                                        <MediaUploader
                                            mode="quote"
                                            existingKeys={quoteKey ? [quoteKey] : []}
                                            onUploadComplete={(_key, type) => {
                                                if (type === "quote_pdf" || type === "quote_image") setQuoteKey(_key);
                                            }}
                                            onRemove={() => setQuoteKey(null)}
                                        />
                                    </div>
                                </div>
                            </div>
                        )}

                        {step === 3 && (
                            <div>
                                <h2 className="text-xl font-bold text-slate-900">
                                    Review & Complete
                                </h2>
                                <p className="mt-1 text-sm text-slate-500">
                                    {isB2B
                                        ? `Your ${b2bType === "hoa" ? "HOA" : "PM"} plan includes this assessment.`
                                        : "Select your assessment tier and confirm your submission."
                                    }
                                </p>

                                <div className="mt-6 space-y-4">
                                    {/* Submission Summary */}
                                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                                        <p className="text-xs font-semibold text-slate-700 uppercase mb-3">Submission Summary</p>
                                        <div className="space-y-2 text-sm text-slate-700">
                                            <div className="flex justify-between">
                                                <span>Location:</span>
                                                <span className="font-medium">{address || zipCode || "Not provided"}</span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span>Issues:</span>
                                                <span className="font-medium">{problems.length} selected</span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span>Media:</span>
                                                <span className="font-medium">{evidence.length} uploaded</span>
                                            </div>
                                            {!isB2B && (
                                                <div className="flex justify-between pt-2 border-t border-slate-200">
                                                    <span>Assessment Tier:</span>
                                                    <span className="font-medium text-teal-700">
                                                        {TIER_PRICING[tier].label}
                                                    </span>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {!isB2B && (
                                        <>
                                            <p className="text-sm font-medium text-slate-700 mt-4">Select Assessment Tier</p>
                                            <div className="space-y-3">
                                                {Object.entries(TIER_PRICING).map(([t, pricing]) => (
                                                    <button
                                                        key={t}
                                                        type="button"
                                                        onClick={() => setTier(t as AssessmentTier)}
                                                        className={`w-full rounded-lg border-2 p-3 text-left transition ${tier === t
                                                            ? "border-teal-600 bg-teal-50"
                                                            : "border-slate-200 bg-white"
                                                            }`}
                                                    >
                                                        <div className="flex items-start justify-between gap-2">
                                                            <div className="flex-1">
                                                                <p className="font-semibold text-slate-800 text-sm">
                                                                    {pricing.label}
                                                                </p>
                                                                <p className="text-xs text-slate-500 mt-0.5">
                                                                    {pricing.description}
                                                                </p>
                                                            </div>
                                                            <p className="text-lg font-bold text-teal-700 flex-shrink-0">
                                                                {formatCurrency(pricing.amount_cents)}
                                                            </p>
                                                        </div>
                                                    </button>
                                                ))}
                                            </div>
                                        </>
                                    )}

                                    {isB2B && (
                                        <div className="rounded-lg border-2 border-cyan-400 bg-cyan-50 p-3">
                                            <p className="font-semibold text-cyan-700 text-sm">
                                                {b2bType === "hoa" ? "HOA" : "Property Manager"} Assessment
                                            </p>
                                            <p className="text-xs text-cyan-600 mt-1">
                                                No payment required — using your organization&apos;s subscription.
                                            </p>
                                        </div>
                                    )}

                                    {/* AI Consent */}
                                    <label className="flex items-start gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs leading-5 text-slate-700 mt-4">
                                        <input type="checkbox" checked={aiConsent} onChange={(event) => setAiConsent(event.target.checked)} className="mt-1 h-4 w-4 accent-teal-700 flex-shrink-0" />
                                        <span>I consent to AI analysis of my photos to prepare a diagnostic review that will be verified by a GGuard garage door expert before I see it.</span>
                                    </label>

                                    {/* Optional Fields */}
                                    <div className="border-t border-slate-200 pt-4 mt-4">
                                        <p className="text-xs font-semibold text-slate-600 uppercase mb-3">Additional Details (optional)</p>
                                        
                                        <div>
                                            <Input
                                                label="Property Label"
                                                placeholder="e.g., Main Garage, Unit 204"
                                                value={propertyLabel}
                                                onChange={(e) => setPropertyLabel(e.target.value)}
                                            />
                                        </div>

                                        <div className="mt-3">
                                            <p className="text-xs font-semibold text-slate-700 mb-2">Have a Contractor Quote?</p>
                                            <div className="grid gap-3 sm:grid-cols-2">
                                                <Input
                                                    label="Contractor Name"
                                                    placeholder="Company name"
                                                    value={contractorName}
                                                    onChange={(e) => setContractorName(e.target.value)}
                                                />
                                                <Input
                                                    label="Quote Amount"
                                                    type="number"
                                                    min="0"
                                                    step="0.01"
                                                    placeholder="650.00"
                                                    value={quoteAmount}
                                                    onChange={(e) => setQuoteAmount(e.target.value)}
                                                />
                                            </div>
                                        </div>

                                        <div className="mt-3">
                                            <Input
                                                label="Phone"
                                                type="tel"
                                                placeholder="(555) 123-4567"
                                                value={phone}
                                                onChange={(e) => setPhone(e.target.value)}
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {submitted && assessmentId && (
                            <div className="text-center py-8">
                                <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-teal-100">
                                    <span className="text-2xl text-teal-700">✓</span>
                                </div>
                                <h2 className="text-xl font-bold text-slate-900">
                                    Assessment Submitted!
                                </h2>
                                    <p className="mt-2 text-sm text-slate-600">
                                    We&apos;ve received your submission and are analyzing it.
                                </p>
                                <div className="mt-6 space-y-3 rounded-2xl border border-blue-200 bg-blue-50 p-4 text-left">
                                    <p className="text-xs font-semibold text-blue-900 uppercase">What Happens Next?</p>
                                    <ol className="space-y-2 text-sm text-blue-800">
                                        <li className="flex gap-3">
                                            <span className="font-bold flex-shrink-0">1.</span>
                                            <span><strong>AI Analysis:</strong> Our AI examines your photos and prepares findings.</span>
                                        </li>
                                        <li className="flex gap-3">
                                            <span className="font-bold flex-shrink-0">2.</span>
                                            <span><strong>Expert Review:</strong> A garage door professional verifies the analysis.</span>
                                        </li>
                                        <li className="flex gap-3">
                                            <span className="font-bold flex-shrink-0">3.</span>
                                            <span><strong>Your Report:</strong> You&apos;ll receive a detailed diagnostic report.</span>
                                        </li>
                                    </ol>
                                </div>
                                <div className="mt-6 space-y-2">
                                    <p className="text-xs text-slate-600">
                                        📧 Check your email for updates: <strong className="text-slate-800">{email}</strong>
                                    </p>
                                    <p className="text-xs text-slate-600">
                                        Assessment ID: <code className="bg-slate-100 px-2 py-1 rounded text-slate-800 font-mono text-xs">{assessmentId}</code>
                                    </p>
                                </div>
                                <Link href="/upload" className="mt-6 inline-block">
                                    <Button>Submit Another Assessment</Button>
                                </Link>
                            </div>
                        )}

                        {!submitted && (
                            <div className="mt-8 flex justify-between">
                                <button
                                    type="button"
                                    onClick={() => setStep((s) => (s > 1 ? ((s - 1) as Step) : s))}
                                    disabled={step === 1}
                                    className="text-sm font-medium text-slate-600 hover:text-teal-700 disabled:opacity-50"
                                >
                                    Back
                                </button>

                                {step < 3 ? (
                                    <Button
                                        onClick={() => setStep((s) => (s < 3 ? ((s + 1) as Step) : s))}
                                        disabled={!canNext()}
                                    >
                                        {step === 1 ? "Continue to Photos & Video" : "Continue to Review"}
                                    </Button>
                                ) : (
                                    <Button onClick={handleCreateAssessment} loading={loading} disabled={!canNext() || !aiConsent}>
                                        {isB2B ? "Submit Assessment" : `Pay ${formatCurrency(TIER_PRICING[tier].amount_cents)}`}
                                    </Button>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </main>
            <Footer />
        </>
    );
}

export default function UploadPage() {
    return <Suspense fallback={<main className="flex min-h-[70vh] items-center justify-center bg-slate-50 text-slate-600">Preparing secure upload…</main>}><UploadContent /></Suspense>;
}
