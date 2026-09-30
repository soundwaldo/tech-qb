"use client";

import { useState } from "react";
import { Camera, CheckCircle2, FileImage, FileText, ShieldAlert, Upload, Video, X } from "lucide-react";
import { compressForUpload } from "@/lib/media-compression";
import { getEvidencePlan, type EvidenceSlot } from "@/lib/evidence-requirements";
import type { EvidenceCategory, EvidenceUpload, MediaType, ProblemCode } from "@/types";

interface MediaUploaderProps {
    onUploadComplete: (key: string, type: MediaType, category?: EvidenceCategory) => void;
    onRemove: (key: string) => void;
    existingUploads?: EvidenceUpload[];
    existingKeys?: string[];
    mode?: "evidence" | "quote";
    problems?: ProblemCode[];
}

export function MediaUploader({
    onUploadComplete,
    onRemove,
    existingUploads = [],
    existingKeys = [],
    mode = "evidence",
    problems = [],
}: MediaUploaderProps) {
    const [pendingUploads, setPendingUploads] = useState(0);
    const [uploadError, setUploadError] = useState<string | null>(null);

    const uploadWithRetry = async (url: string, file: File, maxAttempts = 3): Promise<Response> => {
        let lastError: Error | null = null;
        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
            try {
                const response = await fetch(url, {
                    method: "PUT",
                    body: file,
                    headers: { "Content-Type": file.type },
                });
                if (response.ok) return response;
                throw new Error(`Upload failed with status ${response.status}`);
            } catch (error) {
                lastError = error instanceof Error ? error : new Error("Upload failed");
                if (attempt < maxAttempts) {
                    await new Promise((resolve) => setTimeout(resolve, 2 ** (attempt - 1) * 1000));
                }
            }
        }
        throw lastError || new Error("Upload failed after retries");
    };

    const handleFile = async (file: File, category?: EvidenceCategory) => {
        setPendingUploads((count) => count + 1);
        setUploadError(null);
        try {
            const optimizedFile = await compressForUpload(file);
            const type: MediaType = mode === "quote"
                ? optimizedFile.type === "application/pdf" ? "quote_pdf" : "quote_image"
                : optimizedFile.type.startsWith("video/") ? "video" : "photo";
            const response = await fetch("/api/uploads/presign", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify({
                    mediaType: type,
                    fileName: optimizedFile.name,
                    contentType: optimizedFile.type,
                    sizeBytes: optimizedFile.size,
                }),
            });
            const payload = await response.json();
            if (!response.ok) throw new Error(payload.error || "Could not prepare upload");
            const { uploadUrl, storageKey } = payload as { uploadUrl: string; storageKey: string };
            if (!uploadUrl.includes("/mock")) await uploadWithRetry(uploadUrl, optimizedFile);
            onUploadComplete(storageKey, type, category);
        } catch (error) {
            console.error("Upload failed", error);
            setUploadError(error instanceof Error ? error.message : "Upload failed. Please try again.");
        } finally {
            setPendingUploads((count) => Math.max(0, count - 1));
        }
    };

    const handleSelect = (event: React.ChangeEvent<HTMLInputElement>, category?: EvidenceCategory) => {
        const file = event.target.files?.[0];
        if (file) void handleFile(file, category);
        event.target.value = "";
    };

    const renderEvidenceSlot = (slot: EvidenceSlot) => {
        const upload = existingUploads.find((item) => item.category === slot.category);
        const inputId = `evidence-${slot.category}`;
        const accept = slot.mediaType === "video"
            ? "video/mp4,video/quicktime,video/webm"
            : "image/jpeg,image/png,image/webp";
        return (
            <div key={slot.category} className={`rounded-2xl border-2 p-4 ${upload ? "border-teal-500 bg-teal-50" : "border-slate-300 bg-white"}`}>
                <div className="flex items-start gap-3">
                    <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${upload ? "bg-teal-700 text-white" : "bg-slate-100 text-slate-700"}`}>
                        {upload ? <CheckCircle2 className="h-5 w-5" /> : slot.mediaType === "video" ? <Video className="h-5 w-5" /> : <Camera className="h-5 w-5" />}
                    </div>
                    <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                            <h3 className="text-sm font-bold text-slate-950">{slot.title}</h3>
                            <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${slot.recommended ? "bg-teal-100 text-teal-900" : "bg-slate-100 text-slate-700"}`}>
                                {slot.recommended ? "Recommended" : "Optional"}
                            </span>
                        </div>
                        <p className="mt-1 text-xs leading-5 text-slate-700">{slot.instruction}</p>
                    </div>
                </div>
                <input
                    id={inputId}
                    type="file"
                    accept={accept}
                    data-max-size={75 * 1024 * 1024}
                    onChange={(event) => handleSelect(event, slot.category)}
                    className="peer sr-only"
                    aria-label={`${upload ? "Replace" : "Add"} ${slot.title.toLowerCase()} ${slot.mediaType}`}
                />
                <div className="mt-3 flex items-center gap-2">
                    <label htmlFor={inputId} className="inline-flex min-h-12 cursor-pointer items-center justify-center gap-2 rounded-xl bg-teal-700 px-4 py-3 text-sm font-semibold text-white shadow-sm hover:bg-teal-800 peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-teal-700">
                        {slot.mediaType === "video" ? <Video className="h-5 w-5" /> : <Camera className="h-5 w-5" />}
                        {upload ? "Replace" : slot.mediaType === "video" ? "Add video" : "Add photo"}
                    </label>
                    {upload ? (
                        <button type="button" onClick={() => onRemove(upload.key)} className="inline-flex min-h-12 items-center gap-1 rounded-xl border border-slate-400 bg-white px-3 text-sm font-semibold text-slate-800 hover:bg-slate-100" aria-label={`Remove ${slot.title.toLowerCase()} upload`}>
                            <X className="h-4 w-4" /> Remove
                        </button>
                    ) : null}
                </div>
                {upload ? <p className="mt-2 truncate text-xs font-medium text-teal-900">Uploaded: {upload.key.split("/").pop()}</p> : null}
            </div>
        );
    };

    if (mode === "evidence") {
        const evidencePlan = getEvidencePlan(problems);
        return (
            <div>
                <div className="rounded-2xl border border-amber-300 bg-amber-50 p-4 text-amber-950">
                    <div className="flex gap-3">
                        <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0" />
                        <div>
                            <p className="text-sm font-bold">Photograph safely and protect your privacy</p>
                            <p className="mt-1 text-xs leading-5">Never climb or move closer to photograph springs, cables, drums or brackets. Do not stand beneath or operate a crooked, off-track or unsupported door. Avoid people, license plates and personal belongings in the frame.</p>
                        </div>
                    </div>
                </div>
                <div className="mt-4 space-y-3">{evidencePlan.slots.map(renderEvidenceSlot)}</div>
                {pendingUploads > 0 ? <p aria-live="polite" className="mt-3 text-sm font-medium text-teal-800">Uploading {pendingUploads} file{pendingUploads === 1 ? "" : "s"}…</p> : null}
                {uploadError ? (
                    <div className="mt-3 rounded-lg border border-red-300 bg-red-50 p-3 text-xs text-red-800">
                        <strong>Upload failed:</strong> {uploadError}
                        <button type="button" onClick={() => setUploadError(null)} className="ml-2 font-semibold underline">Dismiss</button>
                    </div>
                ) : null}
            </div>
        );
    }

    const quoteKey = existingKeys[0];
    return (
        <div>
            <input id="contractor-quote-upload" type="file" accept="image/jpeg,image/png,image/webp,.pdf" data-max-size={75 * 1024 * 1024} onChange={(event) => handleSelect(event)} className="peer sr-only" aria-label="Choose a contractor quote" />
            <div className="flex min-h-40 flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-400 bg-slate-100 p-5 text-center">
                {quoteKey ? <FileImage className="mb-2 h-8 w-8 text-teal-700" /> : <Upload className="mb-2 h-8 w-8 text-slate-600" />}
                <p className="text-sm font-semibold text-slate-900">{quoteKey ? "Contractor quote uploaded" : "Add contractor quote"}</p>
                <p className="mt-1 text-xs text-slate-600">PDF or clear photo of the contractor quote.</p>
                <div className="mt-4 flex gap-2">
                    <label htmlFor="contractor-quote-upload" className="inline-flex min-h-12 cursor-pointer items-center justify-center gap-2 rounded-xl border-2 border-slate-600 bg-white px-5 py-3 text-sm font-semibold text-slate-950 hover:border-teal-700 hover:bg-teal-50 peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-teal-700">
                        <FileText className="h-5 w-5" /> {quoteKey ? "Replace quote" : "Add quote"}
                    </label>
                    {quoteKey ? <button type="button" onClick={() => onRemove(quoteKey)} className="min-h-12 rounded-xl border border-slate-400 bg-white px-3 text-sm font-semibold text-slate-800">Remove</button> : null}
                </div>
            </div>
            {pendingUploads > 0 ? <p aria-live="polite" className="mt-2 text-xs font-medium text-teal-800">Uploading…</p> : null}
            {uploadError ? <p className="mt-2 text-xs font-medium text-red-800">Upload failed: {uploadError}</p> : null}
        </div>
    );
}
