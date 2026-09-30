"use client";

import { FormEvent, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Building2, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { formatCurrency } from "@/lib/utils";
import {
  SUBSCRIPTION_PLAN_IDS,
  defaultPlanForPortal,
  isPlanForOrganization,
  organizationTypeForPortal,
  planCatalogForPortal,
  type AnySubscriptionPlan,
  type PortalType,
} from "@/lib/subscription-plans";

interface OnboardingFlowProps {
  type: PortalType;
  onComplete?: () => void;
}

type DisplayPlan = {
  label: string;
  price_cents: number;
  description: string;
};

export function OnboardingFlow({ type, onComplete }: OnboardingFlowProps) {
  const searchParams = useSearchParams();
  const organizationType = organizationTypeForPortal(type);
  const plans = useMemo(
    () => Object.entries(planCatalogForPortal(type)) as Array<[AnySubscriptionPlan, DisplayPlan]>,
    [type],
  );
  const requestedPlan = searchParams.get("plan") as AnySubscriptionPlan | null;
  const initialPlan = requestedPlan
    && SUBSCRIPTION_PLAN_IDS.includes(requestedPlan)
    && isPlanForOrganization(requestedPlan, organizationType)
    ? requestedPlan
    : defaultPlanForPortal(type);

  const [organizationName, setOrganizationName] = useState("");
  const [email, setEmail] = useState("");
  const [plan, setPlan] = useState<AnySubscriptionPlan>(initialPlan);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function startCheckout(event: FormEvent) {
    event.preventDefault();
    setError("");
    setLoading(true);
    try {
      const response = await fetch("/api/portal/onboard", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, organizationName, email, plan }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Subscription Checkout could not be started");
      if (!body.checkoutUrl) throw new Error("Stripe returned no Checkout URL");
      onComplete?.();
      window.location.assign(body.checkoutUrl);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Subscription Checkout could not be started");
      setLoading(false);
    }
  }

  const title = type === "contractor" ? "Garage Company Plan" : type === "hoa" ? "HOA Plan" : "Property Manager Plan";
  const organizationLabel = type === "hoa" ? "HOA name" : "Company name";
  const interval = type === "hoa" ? "year" : "month";

  return (
    <form onSubmit={startCheckout} className="mx-auto max-w-3xl space-y-7 rounded-3xl border border-slate-700 bg-slate-800/50 p-6 sm:p-8">
      <div>
        <div className="flex items-center gap-3">
          <Building2 className="h-7 w-7 text-cyan-400" />
          <h2 className="text-2xl font-bold text-white">Choose your {title}</h2>
        </div>
        <p className="mt-2 text-sm text-slate-300">Your organization activates only after Stripe confirms payment. You can manage billing or cancel from the dashboard.</p>
      </div>

      {searchParams.get("billing") === "cancelled" ? (
        <p role="status" className="rounded-xl border border-amber-400/30 bg-amber-950/40 p-3 text-sm text-amber-200">Checkout was canceled. No credits were activated; you can safely try again.</p>
      ) : null}
      {error ? <p role="alert" className="rounded-xl border border-red-400/30 bg-red-950/40 p-3 text-sm text-red-200">{error}</p> : null}

      <div className="grid gap-3 md:grid-cols-3">
        {plans.map(([id, pricing]) => {
          const selected = plan === id;
          return (
            <button
              key={id}
              type="button"
              aria-pressed={selected}
              onClick={() => setPlan(id)}
              className={`rounded-2xl border p-4 text-left transition ${selected ? "border-cyan-400 bg-cyan-400/10" : "border-slate-600 bg-slate-900/50 hover:border-slate-400"}`}
            >
              <div className="flex items-start justify-between gap-2">
                <span className="font-semibold text-white">{pricing.label}</span>
                {selected ? <CheckCircle2 className="h-5 w-5 shrink-0 text-cyan-400" /> : null}
              </div>
              <p className="mt-2 text-xl font-bold text-cyan-300">{formatCurrency(pricing.price_cents)}<span className="text-xs font-normal text-slate-400">/{interval}</span></p>
              <p className="mt-2 text-xs leading-5 text-slate-400">{pricing.description}</p>
            </button>
          );
        })}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Input label={organizationLabel} required minLength={2} value={organizationName} onChange={(event) => setOrganizationName(event.target.value)} />
        <Input label="Billing email" type="email" required autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} />
      </div>

      <Button type="submit" loading={loading} className="w-full bg-cyan-500 text-slate-950 hover:bg-cyan-400">
        Continue to secure payment
      </Button>
      <p className="text-center text-xs text-slate-400">Payments and subscriptions are processed securely by Stripe.</p>
    </form>
  );
}
