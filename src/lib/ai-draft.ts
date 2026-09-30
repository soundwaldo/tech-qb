import {
    AI_DIAGNOSIS_TEMPLATES,
    DiagnosisFinding,
    ProblemCode,
    PROBLEM_OPTIONS,
} from "@/types";

export interface AiDraftResult {
    summary: string;
    findings: DiagnosisFinding[];
    parts_needed: string[];
    questions_for_tech: string[];
    fair_price_low_cents: number;
    fair_price_high_cents: number;
    balance_test_instructions: string;
    safety_notes: string;
    ai_draft: string;
}

const BALANCE_TEST = `How to perform a garage door balance test (safe DIY check):
1. Close the door fully.
2. Pull the emergency release cord (red handle) so the door disconnects from the opener.
3. Manually lift the door halfway and let go.
4. A balanced door stays in place. If it falls, springs are weak/broken. If it rises, springs are too tight.
5. Reconnect the trolley before using the opener again.
⚠️ Never attempt to wind or adjust torsion springs yourself — they are under extreme tension.`;

const SAFETY_DEFAULT = `Do not force a stuck or off-track door. Broken springs and cables can cause sudden door collapse. Keep children and pets clear of the garage until a professional secures the door.`;

/**
 * Rule-based AI draft from selected problem codes.
 * Human experts edit and finalize — this only pre-fills.
 */
export function generateAiDraft(
    problems: ProblemCode[],
    description?: string | null
): AiDraftResult {
    const matched = problems
        .map((p) => AI_DIAGNOSIS_TEMPLATES[p])
        .filter(Boolean) as NonNullable<
            (typeof AI_DIAGNOSIS_TEMPLATES)[ProblemCode]
        >[];

    if (matched.length === 0) {
        const labels = problems
            .map((c) => PROBLEM_OPTIONS.find((o) => o.code === c)?.label || c)
            .join(", ");
        return {
            summary: `Customer reported: ${labels || "unspecified issue"}. ${description ? `Notes: ${description}` : "Awaiting media review for diagnosis."
                }`,
            findings: [
                {
                    issue: "Pending expert review",
                    severity: "medium",
                    explanation:
                        "No high-confidence template matched. Expert should review media and contractor quote carefully.",
                },
            ],
            parts_needed: [],
            questions_for_tech: [
                "What specific parts are being replaced and why?",
                "Can you show the failed component?",
                "Is this quote itemized (parts vs labor vs trip fee)?",
            ],
            fair_price_low_cents: 10000,
            fair_price_high_cents: 50000,
            balance_test_instructions: BALANCE_TEST,
            safety_notes: SAFETY_DEFAULT,
            ai_draft: buildDraftText(labels, description),
        };
    }

    // Merge templates: take highest severity findings, union parts/questions, max price range
    const findings: DiagnosisFinding[] = [];
    const parts = new Set<string>();
    const questions = new Set<string>();
    let priceLow = Infinity;
    let priceHigh = 0;
    const summaries: string[] = [];

    for (const t of matched) {
        summaries.push(t.summary);
        for (const f of t.findings) findings.push(f);
        t.parts.forEach((p) => parts.add(p));
        t.questions.forEach((q) => questions.add(q));
        priceLow = Math.min(priceLow, t.price_low);
        priceHigh = Math.max(priceHigh, t.price_high);
    }

    if (priceLow === Infinity) priceLow = 0;

    const summary =
        summaries.join(" ") +
        (description ? ` Customer notes: ${description}` : "");

    const labels = problems
        .map((c) => PROBLEM_OPTIONS.find((o) => o.code === c)?.label || c)
        .join(", ");

    return {
        summary,
        findings,
        parts_needed: Array.from(parts),
        questions_for_tech: Array.from(questions),
        fair_price_low_cents: priceLow,
        fair_price_high_cents: priceHigh,
        balance_test_instructions: BALANCE_TEST,
        safety_notes: SAFETY_DEFAULT,
        ai_draft: buildDraftText(labels, description, summary),
    };
}

function buildDraftText(
    labels: string,
    description?: string | null,
    summary?: string
): string {
    return [
        "=== AI-ASSISTED DRAFT (edit before sending) ===",
        `Problems selected: ${labels}`,
        description ? `Customer description: ${description}` : null,
        summary ? `Suggested summary: ${summary}` : null,
        "",
        "Review media carefully. Adjust fair price for local market.",
        "Confirm parts list against photos. Remove any speculative items.",
        "===============================================",
    ]
        .filter(Boolean)
        .join("\n");
}
