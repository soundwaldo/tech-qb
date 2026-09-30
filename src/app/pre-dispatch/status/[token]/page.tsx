import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getDb } from "@/lib/db";
import { verifyCustomerAccessToken } from "@/features/pre-dispatch/security";
import styles from "@/features/pre-dispatch/pre-dispatch.module.css";
export const metadata:Metadata={title:"Request status",robots:{index:false,follow:false}};export const dynamic="force-dynamic";
type StatusRow={public_reference:string;status:string;technician_verified_at:string|null};
async function loadStatus(token:string):Promise<StatusRow|null>{try{const claims=verifyCustomerAccessToken(token);const rows=await getDb()`SELECT r.public_reference,r.status,r.technician_verified_at FROM pre_dispatch_customer_access_tokens t JOIN pre_dispatch_requests r ON r.id=t.request_id AND r.company_id=t.company_id WHERE t.id=${claims.jti} AND t.company_id=${claims.cid} AND t.request_id=${claims.rid} AND t.revoked_at IS NULL AND t.expires_at>now() LIMIT 1`;return rows[0] as StatusRow|undefined||null}catch{return null}}
export default async function Page({params}:{params:Promise<{token:string}>}){const{token}=await params;const status=await loadStatus(token);if(!status)notFound();return <main className={styles.shell}><section className={styles.panel}><div className={styles.eyebrow}>Private customer status</div><h1>{status.public_reference}</h1><p>Current status: <strong>{status.status}</strong></p><p>{status.technician_verified_at?"A technician has verified the equipment observations.":"Any AI description remains preliminary until a technician inspects the equipment."}</p><p>This link does not provide access to private media.</p></section></main>}
