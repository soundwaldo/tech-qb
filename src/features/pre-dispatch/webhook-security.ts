import "server-only";
import { resolve4, resolve6 } from "node:dns/promises";
import { isIP } from "node:net";
import { request as httpsRequest } from "node:https";

function isBlockedAddress(address: string) {
  const normalized = address.toLowerCase();
  if (normalized === "::1" || normalized === "::" || normalized.startsWith("fe80:") || normalized.startsWith("fc") || normalized.startsWith("fd")) return true;
  const parts = normalized.split(".").map(Number);
  if (parts.length !== 4 || parts.some(Number.isNaN)) return false;
  const [first, second] = parts;
  return first === 0 || first === 10 || first === 127 || (first === 169 && second === 254) || (first === 172 && second >= 16 && second <= 31) || (first === 192 && second === 168) || first >= 224;
}

async function resolveTarget(value:string){
  const url = new URL(value);
  if (url.protocol !== "https:" || url.username || url.password) throw new Error("Webhook URL must be a credential-free HTTPS URL");
  if (url.port && url.port !== "443") throw new Error("Webhook URL must use the standard HTTPS port");
  const hostname = url.hostname.replace(/^\[|\]$/g, "").toLowerCase();
  if (hostname === "localhost" || hostname.endsWith(".localhost") || hostname.endsWith(".local") || hostname.endsWith(".internal")) throw new Error("Webhook hostname is not allowed");
  const addresses = isIP(hostname) ? [hostname] : [...await resolve4(hostname).catch(() => []), ...await resolve6(hostname).catch(() => [])];
  if (!addresses.length || addresses.some(isBlockedAddress)) throw new Error("Webhook hostname does not resolve to an allowed public address");
  const address=addresses[0];return{url,address,family:isIP(address)};
}

export async function assertSafeWebhookUrl(value:string){return(await resolveTarget(value)).url}

export async function postSafeWebhook(value:string,headers:Record<string,string>,body:string,timeoutMs=10_000):Promise<{status:number;ok:boolean;text:string}>{
  const{url,address,family}=await resolveTarget(value);
  return new Promise((resolve,reject)=>{const request=httpsRequest({protocol:"https:",hostname:url.hostname,port:443,path:`${url.pathname}${url.search}`,method:"POST",headers:{...headers,host:url.host,"content-length":Buffer.byteLength(body)},servername:url.hostname,lookup:((_hostname:string,_options:unknown,callback:(error:Error|null,address:string,family:number)=>void)=>callback(null,address,family)) as never},response=>{let text="";response.setEncoding("utf8");response.on("data",chunk=>{if(text.length<4096)text+=String(chunk)});response.on("end",()=>{const status=response.statusCode||0;resolve({status,ok:status>=200&&status<300,text:text.slice(0,300)})})});request.setTimeout(timeoutMs,()=>request.destroy(new Error("Webhook request timed out")));request.on("error",reject);request.end(body)})
}
