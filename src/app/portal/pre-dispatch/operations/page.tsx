import Link from "next/link";
import { notFound } from "next/navigation";
import styles from "@/features/pre-dispatch/pre-dispatch.module.css";
import { requireTenantManager } from "@/features/pre-dispatch/repository";
import { OperationsDashboard } from "@/features/pre-dispatch/ui/OperationsDashboard";
export const dynamic="force-dynamic";
export default async function Page(){let company;try{company=await requireTenantManager()}catch{notFound()}return <main className={styles.shell}><section className={styles.panel}><Link href="/portal/pre-dispatch">← Dashboard</Link><div className={styles.eyebrow}>{company.display_name}</div><h1>Delivery operations</h1><p>Monitor AI, email, and CRM delivery. Dead-letter jobs can be safely queued for another attempt.</p><OperationsDashboard/></section></main>}
