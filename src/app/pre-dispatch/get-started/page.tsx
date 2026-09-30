import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import styles from "@/features/pre-dispatch/pre-dispatch.module.css";
import { preDispatchFlags } from "@/features/pre-dispatch/config";
import { OnboardingForm } from "@/features/pre-dispatch/ui/OnboardingForm";
import { getCurrentUser } from "@/lib/auth/server";
import { getDb } from "@/lib/db";

export const metadata:Metadata={title:"Get Started | GGuard Pre-Dispatch",robots:{index:false,follow:false}};
export const dynamic="force-dynamic";
export default async function Page(){
  if(!preDispatchFlags.enabled||!preDispatchFlags.onboarding)notFound();
  const user=await getCurrentUser();
  if(!user)return <main className={styles.shell}><section className={styles.panel}><h1>Sign in to onboard your company</h1><p>Pre-Dispatch must be connected to a verified contractor organization.</p><Link className={styles.button} href="/auth/sign-in?next=/pre-dispatch/get-started">Sign in</Link></section></main>;
  const rows=await getDb()`SELECT o.customer_type FROM profiles p LEFT JOIN organizations o ON o.id=p.organization_id WHERE p.id=${user.id} LIMIT 1`;
  if(rows[0]?.customer_type!=="contractor")return <main className={styles.shell}><section className={styles.panel}><h1>Create your contractor organization first</h1><p>Your signed-in profile is not attached to a contractor organization. Start a contractor plan, or ask the GGuard pilot administrator to assign your profile to a pilot.</p><Link className={styles.button} href="/portal/contractor">Set up contractor organization</Link></section></main>;
  return <main className={styles.shell}><section className={styles.panel}><div className={styles.eyebrow}>Company onboarding</div><h1>Your upload link in three short steps</h1><p>Your website origin will be authorized automatically when you provide its HTTPS URL.</p><OnboardingForm/></section></main>;
}
