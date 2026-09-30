"use client";

import { Suspense, useEffect, useState } from "react";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { OnboardingFlow } from "@/components/portal/OnboardingFlow";

export default function ContractorPortalPage() {
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function checkOrganization() {
      try {
        const response = await fetch("/api/portal/contractor/organization");
        if (response.status === 401) {
          window.location.assign("/auth/sign-in?next=/portal/contractor");
          return;
        }
        const body = await response.json();
        if (response.ok && body.hasOrganization) {
          window.location.assign("/portal/dashboard");
          return;
        }
      } finally {
        setLoading(false);
      }
    }
    checkOrganization();
  }, []);

  return <>
    <Header />
    <main className="min-h-[75vh] bg-slate-900 py-12">
      <div className="mx-auto max-w-6xl px-4">
        <div className="mb-10 text-center">
          <h1 className="text-3xl font-bold text-white">Garage Company Assessment Plans</h1>
          <p className="mt-2 text-slate-400">Give your team assessment credits and manage every customer report in one workspace.</p>
        </div>
        {loading ? <div className="text-center text-slate-400">Checking your subscription...</div> : (
          <Suspense fallback={<div className="text-center text-slate-400">Loading plans...</div>}>
            <OnboardingFlow type="contractor" />
          </Suspense>
        )}
      </div>
    </main>
    <Footer />
  </>;
}
