import {
    B2B_PLANS,
    HOA_PLANS,
    PM_PLANS,
    type HOAPlan,
    type PMPlan,
    type SubscriptionPlan,
} from "@/types";

export type OrganizationType = "contractor" | "hoa" | "property_manager";
export type PortalType = "contractor" | "hoa" | "pm";
export type AnySubscriptionPlan = SubscriptionPlan | HOAPlan | PMPlan;

export const SUBSCRIPTION_PLAN_IDS = [
    "starter", "growth", "enterprise",
    "hoa_basic", "hoa_premium", "hoa_enterprise",
    "pm_starter", "pm_professional", "pm_enterprise",
] as const satisfies readonly AnySubscriptionPlan[];

export function organizationTypeForPortal(type: PortalType): OrganizationType {
    return type === "pm" ? "property_manager" : type;
}

export function portalTypeForOrganization(type: OrganizationType): PortalType {
    return type === "property_manager" ? "pm" : type;
}

export function isPlanForOrganization(plan: AnySubscriptionPlan, type: OrganizationType): boolean {
    if (type === "contractor") return plan in B2B_PLANS;
    if (type === "hoa") return plan in HOA_PLANS;
    return plan in PM_PLANS;
}

export function creditsForPlan(plan: AnySubscriptionPlan): number {
    if (plan in B2B_PLANS) return B2B_PLANS[plan as SubscriptionPlan].credits_per_month;
    if (plan in HOA_PLANS) return HOA_PLANS[plan as HOAPlan].units;
    return PM_PLANS[plan as PMPlan].units;
}

export function planCatalogForPortal(type: PortalType) {
    if (type === "contractor") return B2B_PLANS;
    if (type === "hoa") return HOA_PLANS;
    return PM_PLANS;
}

export function defaultPlanForPortal(type: PortalType): AnySubscriptionPlan {
    if (type === "contractor") return "starter";
    if (type === "hoa") return "hoa_basic";
    return "pm_starter";
}
