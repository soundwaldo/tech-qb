"use client";

import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { Suspense, useState, useEffect } from "react";
import { OnboardingFlow } from "@/components/portal/OnboardingFlow";
import { HOADashboard } from "@/components/portal/HOADashboard";

export default function HOAPortalPage() {
  const [hasOrganization, setHasOrganization] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check if user has an HOA organization
    const checkOrganization = async () => {
      try {
        const res = await fetch("/api/portal/hoa/organization");
        if (res.status === 401) { window.location.href = "/auth/sign-in?next=/portal/hoa"; return; }
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
                  HOA Garage Door Assessment Portal
                </h1>
                <p className="text-center text-slate-400">
                  Manage diagnostics for your entire community in one place
                </p>
              </div>
              <Suspense fallback={<div className="text-center text-slate-400">Loading plans...</div>}>
                <OnboardingFlow type="hoa" onComplete={() => setHasOrganization(true)} />
              </Suspense>
            </>
          ) : (
            <>
              <div className="mb-8">
                <h1 className="text-2xl font-bold text-white">HOA Dashboard</h1>
                <p className="text-slate-400 mt-1">View assessments and community compliance</p>
              </div>
              <HOADashboard />
            </>
          )}
        </div>
      </main>
      <Footer />
    </>
  );
}
