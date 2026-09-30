/**
 * Assessment Template
 * 
 * Defines the structure and sections for a complete garage door diagnostic report.
 * This template ensures consistent, professional formatting across all assessments.
 */

import { Assessment, Diagnosis, DiagnosisFinding, ProblemCode, PROBLEM_OPTIONS } from "@/types";

export interface AssessmentReportData {
  assessment: Assessment;
  diagnosis: Diagnosis;
  reportUrl?: string;
}

/**
 * Assessment Report Template Sections
 */
export const ASSESSMENT_TEMPLATE = {
  sections: {
    header: "Executive Summary",
    findings: "Diagnostic Findings",
    pricing: "Fair Market Pricing",
    parts: "Parts & Materials Needed",
    questions: "Questions to Ask Your Technician",
    balance: "Balance Test Instructions",
    safety: "Safety Notes",
    quote_analysis: "Your Contractor's Quote — Analysis",
    next_steps: "Next Steps",
  },

  sectionDescriptions: {
    header: "Quick overview of what we found and what it means for you",
    findings: "Detailed breakdown of each issue, severity, and what's causing it",
    pricing: "Fair market price range based on industry standards and your specific door",
    parts: "Exact parts and materials needed to fix the problems",
    questions:
      "Key questions to ask any contractor to verify they understand the job",
    balance:
      "How to safely test your door's balance (no tools needed, no risk)",
    safety:
      "Critical safety warnings and things to avoid while waiting for repair",
    quote_analysis:
      "Line-by-line analysis of your contractor's quote (if provided)",
    next_steps: "Your recommended action plan from today forward",
  },
};

/**
 * Generate Executive Summary
 */
export function generateExecutiveSummary(diagnosis: Diagnosis): string {
  const confidenceEmoji = {
    high: "✓",
    medium: "~",
    low: "?",
  };

  const summaryLines = [
    `${confidenceEmoji[diagnosis.confidence]} **Confidence Level:** ${diagnosis.confidence.charAt(0).toUpperCase() + diagnosis.confidence.slice(1)}`,
    "",
    `**Bottom Line:** ${diagnosis.summary}`,
  ];

  if (diagnosis.safety_notes) {
    summaryLines.push("");
    summaryLines.push(`🚨 **⚠️ Safety Alert:** ${diagnosis.safety_notes}`);
  }

  return summaryLines.join("\n");
}

/**
 * Format Findings Section
 */
export function formatFindings(findings: DiagnosisFinding[]): string {
  if (!findings || findings.length === 0) {
    return "No critical issues detected. Your door appears to be in working order.";
  }

  const severityEmoji = {
    low: "🟡",
    medium: "🟠",
    high: "🔴",
    critical: "🆘",
  };

  const lines = findings.map((finding) => {
    const emoji = severityEmoji[finding.severity] || "•";
    let section = `${emoji} **${finding.issue}** (${finding.severity})`;

    if (finding.explanation) {
      section += `\n   ${finding.explanation}`;
    }

    if (
      finding.estimated_cost_low_cents &&
      finding.estimated_cost_high_cents
    ) {
      const low = (finding.estimated_cost_low_cents / 100).toFixed(0);
      const high = (finding.estimated_cost_high_cents / 100).toFixed(0);
      section += `\n   **Typical repair cost:** $${low} – $${high}`;
    }

    return section;
  });

  return lines.join("\n\n");
}

/**
 * Format Pricing Section
 */
export function formatPricing(diagnosis: Diagnosis): string {
  const low = (diagnosis.fair_price_low_cents / 100).toFixed(2);
  const high = (diagnosis.fair_price_high_cents / 100).toFixed(2);

  return `
**Fair Market Price Range:** $${low} – $${high}

This estimate includes:
- Parts & materials
- Labor (2–3 hours typical)
- Basic warranty (usually 1 year parts + labor)

**Why this range?**
- Lower end: Parts-only repair with DIY-adjacent technician
- Upper end: Full warranty, premium parts, established company

**Red flags** — Question quotes that are:
- More than 50% above the upper range (typically overpriced)
- Less than 30% below the lower range (may indicate quality concerns)
`.trim();
}

/**
 * Format Parts Needed Section
 */
export function formatPartsNeeded(parts: string[]): string {
  if (!parts || parts.length === 0) {
    return "No specific parts identified. Diagnosis may be software/sensor-related.";
  }

  const lines = parts.map((part) => `• ${part}`);
  return lines.join("\n");
}

/**
 * Format Technician Questions Section
 */
export function formatTechnicianQuestions(questions: string[]): string {
  if (!questions || questions.length === 0) {
    return "No specific questions — this appears straightforward.";
  }

  const lines = questions.map((q, i) => `${i + 1}. ${q}`);
  return lines.join("\n");
}

/**
 * Format Quote Analysis Section
 */
export function formatQuoteAnalysis(
  quoteAnalysis: Array<{
    item: string;
    quoted_cents?: number | null;
    assessment: "supported" | "question" | "unsupported";
    note: string;
  }>
): string {
  if (!quoteAnalysis || quoteAnalysis.length === 0) {
    return "No contractor quote was provided for analysis.";
  }

  const assessmentEmoji = {
    supported: "✓",
    question: "?",
    unsupported: "✗",
  };

  const lines = quoteAnalysis.map((line) => {
    const emoji = assessmentEmoji[line.assessment] || "•";
    const amount = line.quoted_cents ? `$${(line.quoted_cents / 100).toFixed(2)}` : "—";
    return `${emoji} **${line.item}** (${amount})\n   _${line.note}_`;
  });

  return lines.join("\n\n");
}

/**
 * Format Next Steps Section
 */
export function formatNextSteps(recommendation: string): string {
  const steps: Record<string, string> = {
    approve: `
**✓ This repair is recommended.**

1. Get 2–3 quotes from licensed technicians
2. Compare their estimates against your fair market range: $[LOW] – $[HIGH]
3. Verify they plan to replace springs as a PAIR (not just one)
4. Confirm 1-year parts + labor warranty
5. Schedule the repair
    `.trim(),

    approve_with_questions: `
**~ This repair is likely needed, but verify with a technician.**

1. Contact 2–3 licensed technicians
2. Describe exactly what you see — reference this report
3. Ask them to confirm the diagnosis
4. Get quotes and compare against fair market range: $[LOW] – $[HIGH]
5. If they agree with this assessment, proceed with repair
    `.trim(),

    request_revision: `
**? We need more information to give you a clear answer.**

This can happen if:
- Photos don't clearly show the problem area
- The door behavior is inconsistent
- Multiple issues are present (hard to diagnose from photos alone)

**What to do:**
1. Take additional photos of:
   - The springs (zoomed in, from side angle)
   - The rollers and tracks (full length of door)
   - Any visible damage or wear
   - The door from the side (shows if it's level)

2. Resubmit with clearer photos — we'll re-analyze
3. Or call a technician for in-person diagnosis (recommended if you're unsure)
    `.trim(),

    insufficient_evidence: `
**? We don't have enough information to diagnose the issue.**

This can happen if:
- Only 1–2 photos were provided
- Angles don't show the problem area
- Photos are blurry or too dark

**What to do:**
1. Take a fresh set of photos:
   - Full door (closed and level)
   - Close-up of springs
   - Close-up of rollers/tracks
   - Any visible damage
   - Photo of the garage door opener unit (if safe to access)

2. Resubmit with 5+ clear, well-lit photos
3. Or skip the photos and call a local technician for immediate help
    `.trim(),

    safety_escalation: `
**⚠️ SAFETY CONCERN — Do not operate the door without professional help.**

This assessment identified a safety issue that requires professional repair:
- Broken springs (high tension — risk of injury)
- Door off track (risk of collapse)
- Opener malfunction affecting safety sensors

**What to do:**
1. **Do NOT use the garage door** — risk of injury or property damage
2. **Call a licensed technician TODAY** — this is not DIY-safe
3. If you need emergency access, use the pedestrian side door
4. Once repaired, this report will help the technician understand what they're fixing

**Budget:** Emergency/same-day repairs may cost 20–30% more than standard pricing.
    `.trim(),
  };

  return steps[recommendation] || steps.approve;
}

/**
 * Build Complete Assessment Report
 */
export function buildAssessmentReport(
  assessment: Assessment,
  diagnosis: Diagnosis
): {
  title: string;
  sections: Array<{
    heading: string;
    content: string;
  }>;
  metadata: {
    reportId: string;
    createdAt: string;
    reviewerName?: string;
    confidence: string;
  };
} {
  return {
    title: "Your Garage Door Assessment Report",
    sections: [
      {
        heading: ASSESSMENT_TEMPLATE.sections.header,
        content: generateExecutiveSummary(diagnosis),
      },
      {
        heading: ASSESSMENT_TEMPLATE.sections.findings,
        content: formatFindings(diagnosis.findings),
      },
      {
        heading: ASSESSMENT_TEMPLATE.sections.pricing,
        content: formatPricing(diagnosis),
      },
      {
        heading: ASSESSMENT_TEMPLATE.sections.parts,
        content: formatPartsNeeded(diagnosis.parts_needed),
      },
      {
        heading: ASSESSMENT_TEMPLATE.sections.questions,
        content: formatTechnicianQuestions(diagnosis.questions_for_tech),
      },
      ...(diagnosis.balance_test_instructions
        ? [
            {
              heading: ASSESSMENT_TEMPLATE.sections.balance,
              content: diagnosis.balance_test_instructions,
            },
          ]
        : []),
      ...(diagnosis.safety_notes
        ? [
            {
              heading: ASSESSMENT_TEMPLATE.sections.safety,
              content: diagnosis.safety_notes,
            },
          ]
        : []),
      ...(diagnosis.quote_analysis && diagnosis.quote_analysis.length > 0
        ? [
            {
              heading: ASSESSMENT_TEMPLATE.sections.quote_analysis,
              content: formatQuoteAnalysis(diagnosis.quote_analysis),
            },
          ]
        : []),
      {
        heading: ASSESSMENT_TEMPLATE.sections.next_steps,
        content: formatNextSteps(diagnosis.recommendation),
      },
    ],
    metadata: {
      reportId: assessment.id.slice(0, 8).toUpperCase(),
      createdAt: new Date(diagnosis.finalized_at || diagnosis.created_at).toLocaleDateString(),
      reviewerName: diagnosis.expert_name || undefined,
      confidence: diagnosis.confidence,
    },
  };
}
