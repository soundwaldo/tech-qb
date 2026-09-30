"use client";

import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { Suspense, useState, useEffect } from "react";
import { OnboardingFlow } from "@/components/portal/OnboardingFlow";
import { PMDashboard } from "@/components/portal/PMDashboard";

export default function PMPortalPage() {
  const [hasOrganization, setHasOrganization] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check if user has a PM organization
    const checkOrganization = async () => {
      try {
        const res = await fetch("/api/portal/pm/organization");
        if (res.status === 401) { window.location.href = "/auth/sign-in?next=/portal/pm"; return; }
        const body = await res.json();
        if (res.ok) setHasOrganization(Boolean(body.hasOrganization));
      } catch (error) {
        console.error("Failed to check organization:", error);
      } finally {
        setLoading(false);
      }
    };

    checkOrganization();
  }, []);

  if (loading) {
    return (
      <>
        <Header />
        <main className="flex-1 bg-slate-900 py-20">
          <div className="text-center text-slate-400">Loading...</div>
        </main>
        <Footer />
      </>
    );
  }

  return (
    <>
      <Header />
      <main className="flex-1 bg-slate-900 py-12">
        <div className="mx-auto max-w-6xl px-4">
          {!hasOrganization ? (
            <>
              <div className="mb-12">
                <h1 className="text-center text-3xl font-bold text-white mb-2">
                  Property Manager Portal
                </h1>
                <p className="text-center text-slate-400">
                  Track tenant submissions and validate contractor quotes
                </p>
              </div>
              <Suspense fallback={<div className="text-center text-slate-400">Loading plans...</div>}>
                <OnboardingFlow type="pm" onComplete={() => setHasOrganization(true)} />
              </Suspense>
            </>
          ) : (
            <>
              <div className="mb-8">
                <h1 className="text-2xl font-bold text-white">PM Dashboard</h1>
                <p className="text-slate-400 mt-1">Submissions, quotes, and cost analysis</p>
              </div>
              <PMDashboard />
            </>
          )}
        </div>
      </main>
      <Footer />
    </>
  );
}
