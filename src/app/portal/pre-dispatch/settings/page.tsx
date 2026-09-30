import type { Metadata } from "next";
import { notFound } from "next/navigation";
import styles from "@/features/pre-dispatch/pre-dispatch.module.css";
import { getTenantWidgetHealth, requireTenantManager } from "@/features/pre-dispatch/repository";
import { PreDispatchSettings } from "@/features/pre-dispatch/ui/PreDispatchSettings";
import { PreDispatchBilling } from "@/features/pre-dispatch/ui/PreDispatchBilling";
import Link from "next/link";

export const metadata:Metadata={title:"Pre-Dispatch Settings",robots:{index:false,follow:false}};
export const dynamic="force-dynamic";
export default async function Page(){let company;try{company=await requireTenantManager({ allowExpiredBilling: true })}catch{notFound()}const health=await getTenantWidgetHealth(company.id);return <main className={styles.shell}><section className={styles.panel}><div className={styles.eyebrow}>{company.display_name}</div><h1>Branding, widget and CRM delivery</h1><p><Link href="/portal/pre-dispatch">Inbox</Link> · <Link href="/portal/pre-dispatch/team">Team access</Link> · <Link href="/support">Support</Link></p><PreDispatchBilling status={company.product_status} trialEndsAt={company.trial_ends_at}/><PreDispatchSettings company={company} initialHealth={health as {session_count:number;request_count:number;last_session_at:string|null;last_request_at:string|null}}/></section></main>}
