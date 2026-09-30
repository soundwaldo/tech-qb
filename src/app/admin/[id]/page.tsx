import { notFound, redirect } from "next/navigation";
import { createServiceClient } from "@/lib/neon";
import { isAdminAuthenticated } from "@/lib/admin-auth";
import { generateAiDraft } from "@/lib/ai-draft";
import { Header } from "@/components/layout/Header";
import type { Assessment, Diagnosis, ReportRecommendation } from "@/types";
import { getStripe } from "@/lib/stripe";
import { sendReportReady } from "@/lib/email";
import { hashStoredObject } from "@/lib/storage";
import { createVerifiedManifest } from "@/lib/report-manifest";
import { anchorDiagnosisRecord } from "@/lib/property-ledger";
import { decryptPII } from "@/lib/pii-encryption";
import { VoiceTextArea } from "@/components/admin/VoiceTextArea";

const COMMON_REPAIR_QUESTIONS = [
  "What failed, and can you show me the worn or broken part?",
  "Can this be safely repaired, or does the part need to be replaced?",
  "What brand and part number will you install?",
  "Is the quote itemized by parts, labor, service-call fees, and tax?",
  "Are there any possible additional charges not included in this quote?",
  "What warranties cover the parts and labor, and for how long?",
  "Will you test the door balance, photo eyes, auto-reverse, and manual release after the repair?",
  "Is your company insured, and will I receive a written invoice and receipt?",
  "Is the door safe to use until the repair is completed?",
] as const;

const COMMON_FINDINGS: Diagnosis["findings"] = [
  {
    issue: "Torsion spring failure",
    severity: "critical",
    explanation:
      "The spring is broken or no longer providing proper counterbalance.",
  },
  {
    issue: "Damaged lift cable(s)",
    severity: "critical",
    explanation: "A lift cable is frayed, loose, off the drum, or broken.",
  },
  {
    issue: "Door off track",
    severity: "critical",
    explanation:
      "One or more rollers have left the track and the door should not be operated.",
  },
  {
    issue: "Door out of balance",
    severity: "high",
    explanation:
      "The door does not remain supported when operated manually and needs professional adjustment.",
  },
  {
    issue: "Bent or misaligned track",
    severity: "high",
    explanation:
      "The track is bent, loose, or out of alignment and is affecting door travel.",
  },
  {
    issue: "Worn or damaged rollers",
    severity: "medium",
    explanation:
      "One or more rollers show wear, damage, binding, or excessive noise.",
  },
  {
    issue: "Loose or damaged hinges / brackets",
    severity: "medium",
    explanation: "Door hardware is loose, cracked, bent, or excessively worn.",
  },
  {
    issue: "Photo-eye sensor issue",
    severity: "low",
    explanation:
      "The safety sensors are blocked, misaligned, damaged, or have a wiring problem.",
  },
  {
    issue: "Opener motor / gear / logic issue",
    severity: "medium",
    explanation:
      "The powered opener is not operating or controlling the door correctly.",
  },
  {
    issue: "Damaged weather seal",
    severity: "low",
    explanation:
      "The bottom or perimeter seal is torn, missing, or no longer sealing properly.",
  },
  {
    issue: "Door panel or section damage",
    severity: "medium",
    explanation:
      "A door panel or section is dented, cracked, separated, or structurally damaged.",
  },
  {
    issue: "Maintenance / lubrication needed",
    severity: "low",
    explanation:
      "Moving hardware needs cleaning, tightening, lubrication, or routine maintenance.",
  },
  { issue: "Other finding", severity: "medium", explanation: "" },
];

const COMMON_PARTS = [
  "Torsion spring(s)",
  "Extension spring(s)",
  "Lift cables",
  "Cable drums",
  "Rollers",
  "Hinges or brackets",
  "Track or track hardware",
  "Photo-eye sensors",
  "Opener gear or sprocket",
  "Opener motor or logic board",
  "Weather seal",
  "Door panel or section",
  "Fasteners / miscellaneous hardware",
] as const;

function mergeFindingOptions(
  initial: Diagnosis["findings"],
): Diagnosis["findings"] {
  const options = new Map(
    COMMON_FINDINGS.map((finding) => [finding.issue, finding]),
  );
  initial.forEach((finding) => options.set(finding.issue, finding));
  return Array.from(options.values());
}

async function requireAdmin() {
  if (!(await isAdminAuthenticated())) redirect("/login");
  return { service: createServiceClient() };
}

export default async function ReviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { service } = await requireAdmin();
  const [{ data: assessmentData }, { data: diagnosisData }, { data: media }] =
    await Promise.all([
      service.from("assessments").select("*").eq("id", id).single(),
      service
        .from("diagnoses")
        .select("*")
        .eq("assessment_id", id)
        .maybeSingle(),
      service.from("assessment_media").select("*").eq("assessment_id", id),
    ]);
  if (!assessmentData) notFound();
  const assessment = assessmentData as unknown as Assessment;
  const draft = generateAiDraft(assessment.problems, assessment.description);
  const diagnosis = diagnosisData as unknown as Diagnosis | null;
  const initialFindings = diagnosis?.findings?.length
    ? diagnosis.findings
    : draft.findings;
  const findingOptions = mergeFindingOptions(initialFindings);
  const selectedFindingIssues = new Set(
    initialFindings.map((finding) => finding.issue),
  );
  const initialParts = diagnosis ? diagnosis.parts_needed : draft.parts_needed;
  const partOptions = Array.from(new Set([...COMMON_PARTS, ...initialParts]));
  const selectedParts = new Set(initialParts);
  async function finalize(formData: FormData) {
    "use server";
    const { service: db } = await requireAdmin();
    const recommendation = String(
      formData.get("recommendation"),
    ) as ReportRecommendation;
    const selectedFindingIndexes = formData
      .getAll("finding")
      .map(Number)
      .filter(
        (index) =>
          Number.isInteger(index) &&
          index >= 0 &&
          index < findingOptions.length,
      );
    const findings = selectedFindingIndexes.map((index) => {
      const option = findingOptions[index];
      const enteredDetail = String(
        formData.get(`finding_detail_${index}`) || "",
      ).trim();
      return {
        ...option,
        explanation:
          enteredDetail ||
          option.explanation ||
          "Expert finding confirmed during assessment review.",
      };
    });
    if (!findings.length)
      throw new Error(
        "Select at least one finding before releasing the report",
      );
    const summary = String(formData.get("summary") || "").trim();
    if (!summary) {
      throw new Error("Add your overall assessment before releasing the report");
    }
    const partsNeeded = formData
      .getAll("parts_needed")
      .map(String)
      .map((value) => value.trim())
      .filter(Boolean);
    const verifiedAt = new Date().toISOString();
    const { data: currentDiagnosis } = await db
      .from("diagnoses")
      .select("*")
      .eq("assessment_id", id)
      .single();
    const { data: currentAssessment } = await db
      .from("assessments")
      .select("*")
      .eq("id", id)
      .single();
    if (!currentAssessment) throw new Error("The assessment is missing");
    const diagnosisSource = currentDiagnosis ?? {
      findings: draft.findings,
      parts_needed: draft.parts_needed,
      balance_test_instructions: draft.balance_test_instructions,
      quote_analysis: [],
    };
    const payload = {
      assessment_id: id,
      summary,
      recommendation,
      confidence: String(formData.get("confidence")),
      findings,
      fair_price_low_cents: Math.round(
        Number(formData.get("fair_price_low")) * 100,
      ),
      fair_price_high_cents: Math.round(
        Number(formData.get("fair_price_high")) * 100,
      ),
      parts_needed: partsNeeded,
      questions_for_tech: formData
        .getAll("questions")
        .map(String)
        .map((value) => value.trim())
        .filter(Boolean),
      safety_notes: String(formData.get("safety_notes") || ""),
      balance_test_instructions: String(
        formData.get("balance_test_instructions") ||
          draft.balance_test_instructions,
      ).trim(),
      limitations: String(formData.get("limitations") || "")
        .split("\n")
        .map((value) => value.trim())
        .filter(Boolean),
      quote_analysis: diagnosisSource.quote_analysis || [],
      ai_draft_used: true,
      expert_name: "GGuard Expert",
      finalized_at: verifiedAt,
    };
    const { data: verifiedDiagnosis, error: diagnosisError } = await db
      .from("diagnoses")
      .upsert(payload, { onConflict: "assessment_id" })
      .select()
      .single();
    if (diagnosisError || !verifiedDiagnosis)
      throw new Error("Could not save verified report");
    const { data: evidence } = await db
      .from("assessment_media")
      .select("id, media_type, storage_key, sha256_hash")
      .eq("assessment_id", id);
    const evidenceRows = (Array.isArray(evidence) ? evidence : []) as Array<{
      id: string;
      media_type: string;
      storage_key: string;
      sha256_hash: string | null;
    }>;
    const mediaHashes = await Promise.all(
      evidenceRows.map(async (item) => {
        const sha256 =
          item.sha256_hash || (await hashStoredObject(item.storage_key));
        if (!item.sha256_hash)
          await db
            .from("assessment_media")
            .update({ sha256_hash: sha256 })
            .eq("id", item.id);
        return { media_type: item.media_type, sha256 };
      }),
    );
    const { data: prior } = await db
      .from("report_manifests")
      .select("version, content_hash")
      .eq("assessment_id", id)
      .order("version", { ascending: false })
      .limit(1)
      .maybeSingle();
    const priorRow =
      (prior as {
        version?: number | null;
        content_hash?: string | null;
      } | null) ?? null;
    const version = (priorRow?.version ?? 0) + 1;
    const built = createVerifiedManifest({
      assessment: currentAssessment as unknown as Assessment,
      diagnosis: {
        ...verifiedDiagnosis,
        report_version: version,
      } as unknown as Diagnosis,
      mediaHashes,
      version,
      previousContentHash: priorRow?.content_hash || null,
      verifiedAt,
    });
    const { error: manifestError } = await db
      .from("report_manifests")
      .insert({
        assessment_id: id,
        diagnosis_id: verifiedDiagnosis.id,
        public_id: built.publicId,
        version,
        manifest: built.manifest,
        content_hash: built.contentHash,
        previous_content_hash: priorRow?.content_hash || null,
        verified_at: verifiedAt,
      });
    if (manifestError)
      throw new Error("Could not create immutable report manifest");
    await db
      .from("diagnoses")
      .update({ report_version: version })
      .eq("id", verifiedDiagnosis.id);
    await db.from("assessments").update({ status: "completed" }).eq("id", id);
    const encryptedAddress = (currentAssessment as Record<string, unknown>)[
      "street_address"
    ] as string | null;
    const propertyAddress = encryptedAddress
      ? decryptPII(encryptedAddress)
      : "";
    if (!propertyAddress)
      throw new Error(
        "A property address is required before finalizing the ledger record",
      );
    await anchorDiagnosisRecord({
      assessmentId: id,
      propertyAddress,
      zipCode: (currentAssessment as unknown as Assessment).zip_code ?? "",
      problems: (currentAssessment as unknown as Assessment).problems ?? [],
      summary: payload.summary,
      findings: payload.findings,
      fairPriceLowCents: payload.fair_price_low_cents,
      fairPriceHighCents: payload.fair_price_high_cents,
      partsNeeded: (payload.parts_needed as string[] | null) ?? [],
      mediaHashes: mediaHashes.map((m) => m.sha256),
      organizationId: (currentAssessment as Record<string, unknown>)[
        "organization_id"
      ] as string | null,
    });
    if (assessment.stripe_checkout_session_id) {
      const checkout = await getStripe().checkout.sessions.retrieve(
        assessment.stripe_checkout_session_id,
      );
      const customerEmail = checkout.customer_details?.email;
      if (customerEmail) {
        try {
          await sendReportReady({
            to: customerEmail,
            assessmentId: id,
            accessToken: assessment.session_token,
            summary,
            fairLow: payload.fair_price_low_cents,
            fairHigh: payload.fair_price_high_cents,
            publicId: built.publicId,
          });
          await db
            .from("assessments")
            .update({ status: "delivered" })
            .eq("id", id);
        } catch (error) {
          console.error(
            "[email] Completed report could not be delivered",
            error,
          );
        }
      }
    }
    redirect(`/report/${id}?access=${assessment.session_token}`);
  }
  const selectedQuestions = new Set(
    diagnosis?.questions_for_tech?.length
      ? diagnosis.questions_for_tech
      : COMMON_REPAIR_QUESTIONS,
  );
  const repairQuestions = Array.from(
    new Set([
      ...COMMON_REPAIR_QUESTIONS,
      ...(diagnosis?.questions_for_tech ?? []),
    ]),
  );
  return (
    <>
      <Header />
      <main className="min-h-screen bg-slate-950 py-5 sm:py-10">
        <form
          action={finalize}
          className="mx-auto grid max-w-6xl gap-4 px-3 sm:gap-6 sm:px-4 lg:grid-cols-[0.8fr_1.2fr]"
        >
          <aside className="min-w-0 space-y-4 sm:space-y-5">
            <div className="rounded-2xl border border-slate-800 bg-slate-900 p-4 text-white sm:p-6">
              <p className="text-xs font-semibold uppercase text-cyan-300">
                Evidence brief
              </p>
              <h1 className="mt-2 break-words text-xl font-bold sm:text-2xl">
                {assessment.property_label || assessment.zip_code}
              </h1>
              <p className="mt-3 break-words text-sm leading-6 text-slate-300">
                {assessment.description || "No additional description."}
              </p>
              {diagnosis?.ai_model && (
                <p className="mt-4 break-words text-xs text-slate-500">
                  AI draft: {diagnosis.ai_model} · Human verification required
                </p>
              )}
            </div>
            <div className="rounded-2xl border border-slate-800 bg-slate-900 p-4 text-white sm:p-6">
              <h2 className="font-bold">Submitted evidence</h2>
              <ul className="mt-3 space-y-2 text-sm text-slate-300">
                {(Array.isArray(media) ? media : []).map((item) => {
                  const row = item as {
                    id?: string;
                    media_type?: string;
                    file_name?: string;
                  };
                  return (
                    <li
                      key={row.id ?? "media"}
                      className="flex min-w-0 flex-col items-start gap-2 rounded-lg border border-slate-700 p-3 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <span className="min-w-0 break-words">
                        {row.media_type?.replaceAll("_", " ") || "Evidence"} ·{" "}
                        {row.file_name || "attachment"}
                      </span>
                      {row.id && (
                        <a
                          className="inline-flex min-h-11 shrink-0 items-center rounded-lg px-3 font-semibold text-cyan-400 hover:bg-slate-800 hover:underline"
                          href={`/api/admin/media/${row.id}`}
                          target="_blank"
                          rel="noreferrer"
                        >
                          Open evidence
                        </a>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          </aside>
          <section className="min-w-0 space-y-5 rounded-2xl border border-slate-800 bg-slate-900 p-4 text-white sm:p-6">
            <div className="rounded-xl border border-cyan-900 bg-cyan-950/40 p-4 text-sm leading-6 text-cyan-100">
              Select the findings and parts, add only job-specific details, then
              confirm the price. Standard education is already included below.
            </div>
            <div>
              <label
                htmlFor="recommendation"
                className="mb-1.5 block text-sm font-medium text-slate-300"
              >
                Recommendation
              </label>
              <select
                id="recommendation"
                name="recommendation"
                defaultValue={
                  diagnosis?.recommendation || "approve_with_questions"
                }
                className="field"
              >
                <option value="approve">Approve</option>
                <option value="approve_with_questions">
                  Approve with questions
                </option>
                <option value="request_revision">Request revised quote</option>
                <option value="insufficient_evidence">
                  More evidence needed
                </option>
                <option value="safety_escalation">Safety escalation</option>
              </select>
            </div>
            <div>
              <label
                htmlFor="confidence"
                className="mb-1.5 block text-sm font-medium text-slate-300"
              >
                Confidence
              </label>
              <select
                id="confidence"
                name="confidence"
                defaultValue={diagnosis?.confidence || "medium"}
                className="field"
              >
                <option>low</option>
                <option>medium</option>
                <option>high</option>
              </select>
            </div>
            <fieldset className="rounded-xl border border-slate-700 bg-slate-950/40 p-4">
              <legend className="px-1 text-sm font-semibold text-slate-200">
                Findings
              </legend>
              <p className="mb-3 text-xs leading-5 text-slate-400">
                Check each confirmed issue. A detail box with voice dictation
                appears for every selected finding.
              </p>
              <div className="grid gap-2">
                {findingOptions.map((finding, index) => (
                  <div
                    key={finding.issue}
                    className="grid grid-cols-[auto_1fr] rounded-lg border border-slate-800 px-3 py-2.5 hover:border-cyan-800 hover:bg-cyan-950/20"
                  >
                    <input
                      id={`finding-${index}`}
                      type="checkbox"
                      name="finding"
                      value={index}
                      defaultChecked={selectedFindingIssues.has(finding.issue)}
                      className="peer mt-0.5 h-5 w-5 shrink-0 accent-cyan-500"
                    />
                    <label
                      htmlFor={`finding-${index}`}
                      className="cursor-pointer pl-3 text-sm font-medium leading-5 text-slate-200"
                    >
                      {finding.issue}
                      <span className="ml-2 text-xs font-normal uppercase text-slate-500">
                        {finding.severity}
                      </span>
                    </label>
                    <div className="col-span-2 mt-3 hidden border-t border-slate-800 pt-3 peer-checked:block">
                      <VoiceTextArea
                        name={`finding_detail_${index}`}
                        label={`Details for ${finding.issue}`}
                        defaultValue={finding.explanation}
                        rows={2}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </fieldset>
            <fieldset className="rounded-xl border border-slate-700 bg-slate-950/40 p-4">
              <legend className="px-1 text-sm font-semibold text-slate-200">
                Parts needed
              </legend>
              <p className="mb-3 text-xs leading-5 text-slate-400">
                Select every part that should appear in the customer report.
              </p>
              <div className="grid gap-2 sm:grid-cols-2">
                {partOptions.map((part) => (
                  <label
                    key={part}
                    className="flex cursor-pointer gap-3 rounded-lg border border-slate-800 px-3 py-2.5 text-sm leading-5 text-slate-200 hover:border-cyan-800 hover:bg-cyan-950/20"
                  >
                    <input
                      type="checkbox"
                      name="parts_needed"
                      value={part}
                      defaultChecked={selectedParts.has(part)}
                      className="mt-0.5 h-5 w-5 shrink-0 accent-cyan-500"
                    />
                    <span>{part}</span>
                  </label>
                ))}
              </div>
            </fieldset>
            <VoiceTextArea
              name="summary"
              label="My findings / overall assessment"
              defaultValue={diagnosis?.summary || ""}
              rows={5}
              required
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <Money
                name="fair_price_low"
                label="Fair range low"
                value={
                  (diagnosis?.fair_price_low_cents ??
                    draft.fair_price_low_cents) / 100
                }
              />
              <Money
                name="fair_price_high"
                label="Fair range high"
                value={
                  (diagnosis?.fair_price_high_cents ??
                    draft.fair_price_high_cents) / 100
                }
              />
            </div>
            <fieldset className="rounded-xl border border-slate-700 bg-slate-950/40 p-4">
              <legend className="px-1 text-sm font-semibold text-slate-200">
                Questions the customer should ask
              </legend>
              <p className="mb-3 text-xs leading-5 text-slate-400">
                Useful repair questions are selected automatically. Uncheck any
                that do not apply.
              </p>
              <div className="grid gap-2">
                {repairQuestions.map((question) => (
                  <label
                    key={question}
                    className="flex cursor-pointer gap-3 rounded-lg border border-slate-800 px-3 py-2.5 text-sm leading-5 text-slate-200 hover:border-cyan-800 hover:bg-cyan-950/20"
                  >
                    <input
                      type="checkbox"
                      name="questions"
                      value={question}
                      defaultChecked={selectedQuestions.has(question)}
                      className="mt-0.5 h-5 w-5 shrink-0 accent-cyan-500"
                    />
                    <span>{question}</span>
                  </label>
                ))}
              </div>
            </fieldset>
            <details className="rounded-xl border border-slate-700 bg-slate-950/50">
              <summary className="cursor-pointer list-none px-4 py-3 text-sm font-semibold text-cyan-200">
                Standard customer education{" "}
                <span className="ml-2 text-xs font-normal text-slate-400">
                  Already included — edit only if needed
                </span>
              </summary>
              <div className="space-y-4 border-t border-slate-800 p-4">
                <VoiceTextArea
                  name="balance_test_instructions"
                  label="Balanced-door education"
                  defaultValue={
                    diagnosis?.balance_test_instructions ||
                    draft.balance_test_instructions
                  }
                  rows={7}
                />
                <VoiceTextArea
                  name="safety_notes"
                  label="Safety notice"
                  defaultValue={diagnosis?.safety_notes || draft.safety_notes}
                  rows={4}
                />
                <VoiceTextArea
                  name="limitations"
                  label="Limitations (one per line)"
                  defaultValue={(
                    diagnosis?.limitations || [
                      "Remote review based on customer-submitted evidence.",
                    ]
                  ).join("\n")}
                  rows={3}
                />
              </div>
            </details>
            <button className="sticky bottom-3 z-10 min-h-12 w-full rounded-xl bg-cyan-500 px-5 py-3 font-semibold text-slate-950 shadow-xl shadow-slate-950/40 hover:bg-cyan-400 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300 lg:static">
              Verify, lock manifest, and release report
            </button>
          </section>
        </form>
      </main>
    </>
  );
}

function Money({
  name,
  label,
  value,
}: {
  name: string;
  label: string;
  value: number;
}) {
  return (
    <div>
      <label
        htmlFor={name}
        className="mb-1.5 block text-sm font-medium text-slate-300"
      >
        {label}
      </label>
      <input
        id={name}
        name={name}
        required
        type="number"
        min="0"
        step=".01"
        inputMode="decimal"
        defaultValue={value}
        className="field"
      />
    </div>
  );
}
