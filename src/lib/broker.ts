import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { getCurrentUser } from "@/lib/auth/server";
import { getDb } from "@/lib/db";

export type Broker={id:string;auth_user_id:string;display_name:string;commission_bps:number;active:boolean};
export const hashBrokerInvite=(token:string)=>createHash("sha256").update(token).digest("hex");
export const newBrokerInvite=()=>randomBytes(32).toString("base64url");
export async function requireBroker(){const user=await getCurrentUser();if(!user)throw new Error("UNAUTHORIZED");const rows=await getDb()`SELECT b.* FROM sales_brokers b JOIN profiles p ON p.id=b.auth_user_id WHERE b.auth_user_id=${user.id} AND b.active=true AND p.role='sales_broker' LIMIT 1`;if(!rows[0])throw new Error("FORBIDDEN");return{user,broker:rows[0] as Broker}}
