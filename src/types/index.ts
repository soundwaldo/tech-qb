// ============================================================
// GGuard Diagnostics — Core Type Definitions
// ============================================================

export type UserRole = "homeowner" | "property_manager" | "admin";

export type DoorType = "single" | "double";

export type AssessmentTier = "standard" | "express" | "comprehensive";

export type AssessmentStatus =
    | "draft"
    | "pending_payment"
    | "paid"
    | "ai_processing"
    | "awaiting_expert_review"
    | "needs_more_evidence"
    | "in_review"
    | "completed"
    | "delivered"
    | "refunded"
    | "cancelled";

export type CustomerType = "homeowner" | "hoa" | "property_manager" | "contractor";
export type ReportRecommendation =
    | "approve"
    | "approve_with_questions"
    | "request_revision"
    | "insufficient_evidence"
    | "safety_escalation";

export type MediaType = "photo" | "video" | "quote_pdf" | "quote_image";

export type EvidenceCategory =
    | "opener"
    | "spring_system"
    | "full_door"
    | "issue_closeup"
    | "operation_video";

export interface EvidenceUpload {
    key: string;
    category: EvidenceCategory;
    media_type: "photo" | "video";
}

export type ProblemCode =
    | "wont_open"
    | "wont_close"
    | "loud_grinding"
    | "broken_spring"
    | "sensor_blinking"
    | "door_off_track"
    | "opener_not_working"
    | "remote_not_working"
    | "uneven_door"
    | "cable_issues"
    | "panel_damage"
    | "other";

export type SubscriptionPlan = "starter" | "growth" | "enterprise";
export type HOAPlan = "hoa_basic" | "hoa_premium" | "hoa_enterprise";
export type PMPlan = "pm_starter" | "pm_professional" | "pm_enterprise";

export type SubscriptionStatus =
    | "active"
    | "past_due"
    | "cancelled"
    | "trialing"
    | "incomplete"
    | "unpaid"
    | "paused";

// ---------- Database row types ----------

export interface Profile {
    id: string;
    full_name: string | null;
    phone: string | null;
    role: UserRole;
    organization_id: string | null;
    created_at: string;
    updated_at: string;
}

export interface Organization {
    id: string;
    customer_type: "hoa" | "property_manager" | "contractor";
    name: string;
    stripe_customer_id: string | null;
    stripe_subscription_id: string | null;
    subscription_plan: SubscriptionPlan | HOAPlan | PMPlan | null;
    subscription_status: SubscriptionStatus | null;
    report_credits: number;
    unit_count: number | null;
    created_at: string;
    updated_at: string;
}

export interface AddressWallet {
    id: string;
    // Normalized address components (PII-sensitive)
    city: string;
    state: string;
    zip_code: string;
    // Public-safe display
    public_label: string; // e.g. "Phoenix, AZ 85001"
    // Ownership
    organization_id: string | null;
    owner_user_id: string | null;
    created_at: string;
    updated_at: string;
}

export interface Assessment {
    id: string;
    // Session / guest support (no-login D2C)
    session_token: string;
    customer_user_id: string | null;
    customer_type: CustomerType;
    property_label: string | null;
    contractor_name: string | null;
    contractor_quote_cents: number | null;
    ai_processing_consent: boolean;
    // Property
    address_wallet_id: string | null;
    zip_code: string;
    door_type: DoorType;
    // Problems
    problems: ProblemCode[];
    description: string | null;
    // Pricing
    tier: AssessmentTier;
    amount_cents: number;
    // Status
    status: AssessmentStatus;
    // Stripe
    stripe_checkout_session_id: string | null;
    stripe_payment_intent_id: string | null;
    paid_at: string | null;
    // Org (B2B)
    organization_id: string | null;
    // Timestamps
    created_at: string;
    updated_at: string;
    // SLA
    due_at: string | null;
}

export interface AssessmentMedia {
    id: string;
    assessment_id: string;
    media_type: MediaType;
    evidence_category: EvidenceCategory | null;
    storage_key: string;
    file_name: string;
    content_type: string;
    size_bytes: number;
    sha256_hash: string | null;
    created_at: string;
}

export interface Diagnosis {
    id: string;
    assessment_id: string;
    // Expert content
    summary: string;
    findings: DiagnosisFinding[];
    fair_price_low_cents: number;
    fair_price_high_cents: number;
    parts_needed: string[];
    questions_for_tech: string[];
    balance_test_instructions: string | null;
    safety_notes: string | null;
    recommendation: ReportRecommendation;
    confidence: "low" | "medium" | "high";
    quote_analysis: QuoteAnalysisLine[];
    limitations: string[];
    report_version: number;
    // AI draft
    ai_draft: string | null;
    ai_draft_used: boolean;
    ai_model: string | null;
    ai_generated_at: string | null;
    ai_error: string | null;
    // Expert
    expert_id: string | null;
    expert_name: string | null;
    finalized_at: string | null;
    created_at: string;
    updated_at: string;
}

export interface QuoteAnalysisLine {
    item: string;
    quoted_cents: number | null;
    assessment: "supported" | "question" | "unsupported";
    note: string;
}

export interface DiagnosisFinding {
    issue: string;
    severity: "low" | "medium" | "high" | "critical";
    explanation: string;
    estimated_cost_low_cents?: number;
    estimated_cost_high_cents?: number;
}

export interface MaintenanceRecord {
    id: string;
    address_wallet_id: string;
    assessment_id: string;
    diagnosis_id: string;
    // Public verification fields (no PII)
    public_id: string; // short public-facing ID
    repair_type: string;
    city: string;
    zip_code: string;
    completed_date: string;
    // Cryptographic proof
    content_hash: string; // SHA-256 of media hashes + diagnosis content
    media_hashes: string[];
    // Timestamps
    created_at: string;
}

export interface StripeWebhookEvent {
    id: string;
    stripe_event_id: string;
    event_type: string;
    processed: boolean;
    payload: Record<string, unknown>;
    created_at: string;
}

// ---------- API / form types ----------

export interface IntakeFormData {
    zip_code: string;
    door_type: DoorType;
    problems: ProblemCode[];
    description?: string;
    email: string;
    phone?: string;
    tier: AssessmentTier;
    evidence: EvidenceUpload[];
    quote_key?: string;
}

export interface CheckoutRequest {
    assessment_id: string;
    tier: AssessmentTier;
    email: string;
    success_url: string;
    cancel_url: string;
}

export interface PresignUploadRequest {
    file_name: string;
    content_type: string;
    size_bytes: number;
    media_type: MediaType;
    assessment_id?: string;
    session_token: string;
}

export interface PresignUploadResponse {
    upload_url: string;
    storage_key: string;
    expires_in: number;
}

export interface DiagnosisDraftRequest {
    assessment_id: string;
    summary: string;
    findings: DiagnosisFinding[];
    fair_price_low_cents: number;
    fair_price_high_cents: number;
    parts_needed: string[];
    questions_for_tech: string[];
    balance_test_instructions?: string;
    safety_notes?: string;
}

export interface PublicVerification {
    public_id: string;
    city: string;
    zip_code: string;
    repair_type: string;
    completed_date: string;
    content_hash: string;
    verified: boolean;
    // No names, exact addresses, or media
}

// ---------- Pricing ----------

export const TIER_PRICING: Record<
    AssessmentTier,
    { amount_cents: number; label: string; sla_hours: number; description: string }
> = {
    standard: {
        amount_cents: 3900,
        label: "Standard",
        sla_hours: 24,
        description: "Expert review within 24 hours",
    },
    express: {
        amount_cents: 7900,
        label: "Express",
        sla_hours: 2,
        description: "Priority review within 2 hours",
    },
    comprehensive: {
        amount_cents: 9900,
        label: "Comprehensive",
        sla_hours: 24,
        description: "Full system analysis + detailed report",
    },
};

export const B2B_PLANS: Record<
    SubscriptionPlan,
    {
        label: string;
        price_cents: number;
        credits_per_month: number;
        per_report_cents: number;
        description: string;
    }
> = {
    starter: {
        label: "Starter",
        price_cents: 9900,
        credits_per_month: 5,
        per_report_cents: 1800,
        description: "5 report credits/month · $18/extra report",
    },
    growth: {
        label: "Growth",
        price_cents: 24900,
        credits_per_month: 20,
        per_report_cents: 1500,
        description: "20 report credits/month · $15/extra report",
    },
    enterprise: {
        label: "Enterprise",
        price_cents: 49900,
        credits_per_month: 50,
        per_report_cents: 1200,
        description: "50 report credits/month · $12/extra report",
    },
};

// HOA-specific plans (per-unit pricing)
export const HOA_PLANS: Record<
    HOAPlan,
    {
        label: string;
        price_cents: number;
        units: number;
        per_report_cents: number;
        description: string;
    }
> = {
    hoa_basic: {
        label: "HOA Basic",
        price_cents: 19900,
        units: 25,
        per_report_cents: 1800,
        description: "Up to 25 units · $18/report · Annual billing",
    },
    hoa_premium: {
        label: "HOA Premium",
        price_cents: 39900,
        units: 75,
        per_report_cents: 1500,
        description: "Up to 75 units · $15/report · Annual billing",
    },
    hoa_enterprise: {
        label: "HOA Enterprise",
        price_cents: 79900,
        units: 200,
        per_report_cents: 1200,
        description: "Up to 200 units · $12/report · Annual billing",
    },
};

// Property Manager-specific plans (per-unit pricing)
export const PM_PLANS: Record<
    PMPlan,
    {
        label: string;
        price_cents: number;
        units: number;
        per_report_cents: number;
        description: string;
    }
> = {
    pm_starter: {
        label: "PM Starter",
        price_cents: 14900,
        units: 10,
        per_report_cents: 1600,
        description: "Up to 10 properties · $16/report · Monthly billing",
    },
    pm_professional: {
        label: "PM Professional",
        price_cents: 29900,
        units: 30,
        per_report_cents: 1400,
        description: "Up to 30 properties · $14/report · Monthly billing",
    },
    pm_enterprise: {
        label: "PM Enterprise",
        price_cents: 59900,
        units: 100,
        per_report_cents: 1200,
        description: "Up to 100 properties · $12/report · Monthly billing",
    },
};

export const PROBLEM_OPTIONS: {
    code: ProblemCode;
    label: string;
    icon: string;
    description: string;
}[] = [
        {
            code: "wont_open",
            label: "Won't Open",
            icon: "🚫",
            description: "Door won't open at all — check springs, cables, and opener unit",
        },
        {
            code: "wont_close",
            label: "Won't Close",
            icon: "⬇️",
            description: "Door won't close fully — inspect sensors, cables, and track alignment",
        },
        {
            code: "loud_grinding",
            label: "Loud Grinding",
            icon: "🔊",
            description: "Grinding, scraping, squealing — look for worn rollers, misaligned track, or binding",
        },
        {
            code: "broken_spring",
            label: "Broken Spring",
            icon: "🌀",
            description: "Torsion spring visibly broken or stretched at top of door — DANGEROUS: do not attempt repair",
        },
        {
            code: "sensor_blinking",
            label: "Sensor Blinking",
            icon: "💡",
            description: "Safety sensors (usually 6-8 inches above ground) blinking, blocked, or misaligned",
        },
        {
            code: "door_off_track",
            label: "Off Track",
            icon: "🛤️",
            description: "Door rollers visibly off the vertical or horizontal track on either side",
        },
        {
            code: "opener_not_working",
            label: "Opener Dead",
            icon: "⚡",
            description: "Garage door opener unit on ceiling not responding — check power and light indicators",
        },
        {
            code: "remote_not_working",
            label: "Remote Issues",
            icon: "📡",
            description: "Wireless remote or wall keypad buttons not activating the opener",
        },
        {
            code: "uneven_door",
            label: "Uneven Door",
            icon: "📐",
            description: "Door sags to one side, hangs unevenly, or sits crooked in the frame",
        },
        {
            code: "cable_issues",
            label: "Cable Problems",
            icon: "🔗",
            description: "Cables visible frayed, snapped, loose, or slipping off pulleys — located on both sides at top",
        },
        {
            code: "panel_damage",
            label: "Panel Damage",
            icon: "🧱",
            description: "Door panels dented, cracked, bent, rusted, or with visible water damage",
        },
        {
            code: "other",
            label: "Other",
            icon: "❓",
            description: "Something else — describe below",
        },
    ];

// AI draft templates keyed by problem codes
export const AI_DIAGNOSIS_TEMPLATES: Partial<
    Record<
        ProblemCode,
        {
            summary: string;
            findings: DiagnosisFinding[];
            parts: string[];
            questions: string[];
            price_low: number;
            price_high: number;
        }
    >
> = {
    broken_spring: {
        summary:
            "Likely torsion spring failure. Springs are wear items that typically last 7–12 years / ~10,000 cycles.",
        findings: [
            {
                issue: "Torsion spring failure",
                severity: "critical",
                explanation:
                    "A broken torsion spring removes counterbalance force. Operating the door without a functional spring risks cable failure, track damage, and personal injury.",
            },
        ],
        parts: ["Torsion spring(s) matched to door weight", "Winding cones (if worn)"],
        questions: [
            "Are both springs being replaced as a pair?",
            "What is the door weight and spring wire size being used?",
            "Is the quote including labor, disposal, and a cycle warranty?",
        ],
        price_low: 25000,
        price_high: 45000,
    },
    uneven_door: {
        summary:
            "The door is hanging unevenly. A standard on-site service commonly covers securing the door, identifying the cause, and correcting alignment when replacement parts or a new door are not required.",
        findings: [
            {
                issue: "Door hanging unevenly",
                severity: "high",
                explanation:
                    "A crooked door may involve track alignment, rollers, or the lift system. It should not be operated until a technician confirms it is supported and safe.",
            },
        ],
        parts: ["Alignment or reset labor", "Rollers or track hardware only if visibly damaged"],
        questions: [
            "Does the base service price include securing and realigning the door?",
            "What visible damage would make parts or full-door replacement necessary?",
            "Are any replacement parts itemized separately from the standard service?",
        ],
        price_low: 15000,
        price_high: 35000,
    },
    sensor_blinking: {
        summary:
            "Safety photo-eye sensors appear misaligned or obstructed. This is often a free DIY fix.",
        findings: [
            {
                issue: "Photo-eye sensor misalignment",
                severity: "low",
                explanation:
                    "Blinking sensors usually mean the beams are not aligned or something is blocking the path. Replacement is rarely needed.",
            },
        ],
        parts: [],
        questions: [
            "Did the tech attempt realignment before quoting a replacement?",
            "Are the sensor brackets bent or damaged?",
            "Is the wiring intact from sensors to the opener?",
        ],
        price_low: 0,
        price_high: 15000,
    },
    loud_grinding: {
        summary:
            "Grinding noises typically indicate worn rollers, dry hinges, or a failing opener gear.",
        findings: [
            {
                issue: "Mechanical wear / lubrication needed",
                severity: "medium",
                explanation:
                    "Metal-on-metal grinding often comes from nylon rollers that have worn through, dry hinges, or a stripped worm gear in the opener.",
            },
        ],
        parts: ["Nylon rollers (set of 10–12)", "Hinge lubrication", "Opener gear kit (if applicable)"],
        questions: [
            "Is the noise coming from the door tracks or the opener unit?",
            "When was the door last lubricated?",
            "Are the rollers steel or nylon?",
        ],
        price_low: 8000,
        price_high: 35000,
    },
    wont_open: {
        summary:
            "Door will not open — could be spring, opener motor, or locked trolley. Needs visual confirmation.",
        findings: [
            {
                issue: "Door non-operational",
                severity: "high",
                explanation:
                    "Multiple root causes possible: broken spring, failed opener capacitor/motor, locked emergency release, or track obstruction.",
            },
        ],
        parts: ["TBD after media review"],
        questions: [
            "Does the opener motor run when activated?",
            "Can the door be lifted manually after pulling the emergency release?",
            "Are there any visible broken springs or cables?",
        ],
        price_low: 10000,
        price_high: 50000,
    },
    door_off_track: {
        summary:
            "Door rollers have left the track. Do not force operation — risk of further damage or injury.",
        findings: [
            {
                issue: "Door off track",
                severity: "critical",
                explanation:
                    "An off-track door can fall or jam. Common causes: impact damage, broken cable, or worn rollers. Professional realignment required.",
            },
        ],
        parts: ["Track realignment", "Rollers (if damaged)", "Cable (if broken)"],
        questions: [
            "Is the door currently supported / secured?",
            "Was there a recent impact (vehicle, wind)?",
            "Are the cables intact on both sides?",
        ],
        price_low: 15000,
        price_high: 40000,
    },
    cable_issues: {
        summary:
            "Lift cables appear damaged. Cables under tension are dangerous — do not attempt DIY repair.",
        findings: [
            {
                issue: "Damaged lift cable(s)",
                severity: "critical",
                explanation:
                    "Frayed or snapped cables can cause the door to drop suddenly. Cables should be replaced in pairs with proper drum winding.",
            },
        ],
        parts: ["Lift cables (pair)", "Cable drums (if worn)"],
        questions: [
            "Are both cables being replaced?",
            "Is the drum and shaft in good condition?",
            "Does the quote include spring rebalancing after cable work?",
        ],
        price_low: 15000,
        price_high: 35000,
    },
};
