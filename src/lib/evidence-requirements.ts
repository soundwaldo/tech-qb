import type { EvidenceCategory, ProblemCode } from "@/types";

export interface EvidenceSlot {
    category: EvidenceCategory;
    title: string;
    instruction: string;
    recommended: boolean;
    mediaType: "photo" | "video";
}

export interface EvidencePlan {
    slots: EvidenceSlot[];
    recommendedCategories: EvidenceCategory[];
    summary: string;
}

const REQUIRED_BY_PROBLEM: Record<ProblemCode, EvidenceCategory[]> = {
    wont_open: ["full_door", "opener"],
    wont_close: ["full_door", "opener"],
    loud_grinding: ["full_door", "opener"],
    broken_spring: ["full_door"],
    sensor_blinking: ["issue_closeup", "opener"],
    door_off_track: ["full_door", "opener"],
    opener_not_working: ["opener"],
    remote_not_working: ["opener"],
    uneven_door: ["full_door", "opener"],
    cable_issues: ["full_door"],
    panel_damage: ["full_door", "issue_closeup"],
    other: ["full_door"],
};

const HIGH_RISK_PROBLEMS = new Set<ProblemCode>(["broken_spring", "door_off_track", "uneven_door", "cable_issues"]);
const SPRING_RELATED_PROBLEMS = new Set<ProblemCode>(["wont_open", "broken_spring", "uneven_door", "cable_issues"]);

export function getEvidencePlan(problems: ProblemCode[]): EvidencePlan {
    const recommended = new Set<EvidenceCategory>();
    for (const problem of problems) {
        for (const category of REQUIRED_BY_PROBLEM[problem]) recommended.add(category);
    }

    const has = (problem: ProblemCode) => problems.includes(problem);
    const isHighRisk = problems.some((problem) => HIGH_RISK_PROBLEMS.has(problem));
    const showSpringOption = problems.some((problem) => SPRING_RELATED_PROBLEMS.has(problem));

    const fullDoorTitle = has("uneven_door")
        ? "Hung or uneven door"
        : has("door_off_track")
            ? "Door and tracks from a safe distance"
            : has("panel_damage")
                ? "Entire door"
                : "Full door and tracks";
    const fullDoorInstruction = has("uneven_door")
        ? "Stand well back and show the entire crooked or hanging door, including both sides. Do not stand beneath it or try to straighten it."
        : has("door_off_track")
            ? "From well back, show the entire door and both tracks. Do not approach, support or operate an off-track door."
            : "Stand back and include the entire inside of the door and both tracks.";
    const issueTitle = has("sensor_blinking")
        ? "Safety sensor lights"
        : has("panel_damage")
            ? "Panel damage close-up"
            : "Close-up of the issue";
    const issueInstruction = has("sensor_blinking")
        ? "From floor level, show both sensor lights and their brackets near the bottom of the tracks."
        : has("panel_damage")
            ? "Show the damaged panel from a comfortable standing distance so an expert can compare repair with replacement."
            : "Show the damaged or concerning area only when it is safe to approach.";

    const slots: EvidenceSlot[] = [
        {
            category: "full_door",
            title: fullDoorTitle,
            instruction: fullDoorInstruction,
            recommended: recommended.has("full_door"),
            mediaType: "photo",
        },
        {
            category: "opener",
            title: "Garage-door opener",
            instruction: "From the floor, show the ceiling-mounted motor and rail. Do not climb to photograph the model label.",
            recommended: recommended.has("opener"),
            mediaType: "photo",
        },
        {
            category: "issue_closeup",
            title: issueTitle,
            instruction: issueInstruction,
            recommended: recommended.has("issue_closeup"),
            mediaType: "photo",
        },
    ];

    if (showSpringOption) {
        slots.push({
            category: "spring_system",
            title: "Spring area — skip if unsafe",
            instruction: "Optional. Only include the area above the door if it is clearly visible from your normal standing position. Do not climb, reach, touch or move closer.",
            recommended: false,
            mediaType: "photo",
        });
    }

    if (!isHighRisk) {
        slots.push({
            category: "operation_video",
            title: "Short operation video",
            instruction: "Optional: record the sound or movement for up to 45 seconds. Stop immediately if the door binds or looks unstable.",
            recommended: false,
            mediaType: "video",
        });
    }

    const recommendedCategories = slots.filter((slot) => slot.recommended).map((slot) => slot.category);
    const recommendedTitles = slots.filter((slot) => slot.recommended).map((slot) => slot.title.toLowerCase());
    const summary = recommendedTitles.length > 0
        ? `Upload any one safe photo to continue. For the best report, we recommend ${joinReadable(recommendedTitles)}. Spring photos are never required.`
        : "Upload any one safe photo to continue. Spring photos are never required.";

    return { slots, recommendedCategories, summary };
}

function joinReadable(items: string[]): string {
    if (items.length <= 1) return items[0] || "safe evidence";
    if (items.length === 2) return `${items[0]} and ${items[1]}`;
    return `${items.slice(0, -1).join(", ")}, and ${items.at(-1)}`;
}
