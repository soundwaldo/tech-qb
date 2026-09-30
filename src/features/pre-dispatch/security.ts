import "server-only";
import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { acceptedMediaTypes, uploadLimits } from "./config";
export { newInternalId, newPublicReference } from "./domain";

type UploadClaims = { sid: string; cid: string; exp: number; iat: number; v: 1; scope: "predispatch:upload";mediaTypes:readonly string[];maxPhotoBytes:number;maxVideoBytes:number };
export type CustomerAccessClaims={rid:string;cid:string;jti:string;exp:number;iat:number;v:1;scope:"predispatch:customer-status"};
export type EmbedClaims={sid:string;cid:string;slug:string;origin:string;exp:number;iat:number;v:1;scope:"predispatch:embed"};
function secret() { const value = process.env.PRE_DISPATCH_SIGNING_SECRET || process.env.ADMIN_SESSION_SECRET; if (!value || value.length < 32) throw new Error("PRE_DISPATCH_SIGNING_SECRET must be at least 32 characters"); return value; }
function encode(value: string) { return Buffer.from(value).toString("base64url"); }
export function createUploadToken(companyId: string, sessionId: string, expiresAt: Date) {
  const claims: UploadClaims = { sid: sessionId, cid: companyId, exp: Math.floor(expiresAt.getTime()/1000), iat: Math.floor(Date.now()/1000), v: 1, scope: "predispatch:upload",mediaTypes:acceptedMediaTypes,maxPhotoBytes:uploadLimits.maxPhotoBytes,maxVideoBytes:uploadLimits.maxVideoBytes };
  const body = encode(JSON.stringify(claims)); const signature = createHmac("sha256", secret()).update(body).digest("base64url"); return `${body}.${signature}`;
}
export function verifyUploadToken(token: string): UploadClaims {
  const [body, supplied] = token.split("."); if (!body || !supplied) throw new Error("Malformed upload token");
  const expected = createHmac("sha256", secret()).update(body).digest(); const actual = Buffer.from(supplied, "base64url");
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) throw new Error("Invalid upload token");
  const claims = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as UploadClaims;
  if (claims.scope !== "predispatch:upload" || claims.v !== 1 || claims.exp <= Math.floor(Date.now()/1000) || !Array.isArray(claims.mediaTypes) || !claims.maxPhotoBytes || !claims.maxVideoBytes) throw new Error("Expired or invalid upload token");
  return claims;
}
export function createEmbedToken(companyId:string,sessionId:string,slug:string,origin:string,expiresAt:Date){const claims:EmbedClaims={sid:sessionId,cid:companyId,slug,origin,exp:Math.floor(expiresAt.getTime()/1000),iat:Math.floor(Date.now()/1000),v:1,scope:"predispatch:embed"};const body=encode(JSON.stringify(claims));const signature=createHmac("sha256",secret()).update(body).digest("base64url");return`${body}.${signature}`}
export function verifyEmbedToken(token:string):EmbedClaims{const[body,supplied]=token.split(".");if(!body||!supplied)throw new Error("Malformed embed token");const expected=createHmac("sha256",secret()).update(body).digest();const actual=Buffer.from(supplied,"base64url");if(actual.length!==expected.length||!timingSafeEqual(actual,expected))throw new Error("Invalid embed token");const claims=JSON.parse(Buffer.from(body,"base64url").toString("utf8")) as EmbedClaims;if(claims.scope!=="predispatch:embed"||claims.v!==1||claims.exp<=Math.floor(Date.now()/1000)||!claims.sid||!claims.cid||!claims.slug||new URL(claims.origin).origin!==claims.origin)throw new Error("Expired or invalid embed token");return claims}
export function createCustomerAccessToken(companyId:string,requestId:string,expiresAt=new Date(Date.now()+7*24*60*60_000)){const claims:CustomerAccessClaims={rid:requestId,cid:companyId,jti:randomUUID(),exp:Math.floor(expiresAt.getTime()/1000),iat:Math.floor(Date.now()/1000),v:1,scope:"predispatch:customer-status"};const body=encode(JSON.stringify(claims));const signature=createHmac("sha256",secret()).update(body).digest("base64url");return{token:`${body}.${signature}`,claims,expiresAt}}
export function verifyCustomerAccessToken(token:string):CustomerAccessClaims{const[body,supplied]=token.split(".");if(!body||!supplied)throw new Error("Malformed customer access token");const expected=createHmac("sha256",secret()).update(body).digest();const actual=Buffer.from(supplied,"base64url");if(actual.length!==expected.length||!timingSafeEqual(actual,expected))throw new Error("Invalid customer access token");const claims=JSON.parse(Buffer.from(body,"base64url").toString("utf8")) as CustomerAccessClaims;if(claims.scope!=="predispatch:customer-status"||claims.v!==1||claims.exp<=Math.floor(Date.now()/1000)||!claims.jti)throw new Error("Expired or invalid customer access token");return claims}
export function safeFilename(name: string) { const extension = name.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") || "bin"; return `${randomUUID()}.${extension}`; }
