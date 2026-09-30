import { spawnSync } from "node:child_process";
import { join } from "node:path";

const stripeKey=process.env.STRIPE_SECRET_KEY;
if(!stripeKey)throw new Error("STRIPE_SECRET_KEY is required");
const authorization={Authorization:`Bearer ${stripeKey}`};
async function stripe(path,init={}){const response=await fetch(`https://api.stripe.com/v1${path}`,{...init,headers:{...authorization,...init.headers}});const body=await response.json();if(!response.ok)throw new Error(body?.error?.message||`Stripe request failed: ${response.status}`);return body}
const form=(data)=>new URLSearchParams(Object.entries(data).filter(([,value])=>value!==undefined).map(([key,value])=>[key,String(value)]));
const vercelCommand=process.platform==="win32"?join(process.env.APPDATA||"","npm","vercel.cmd"):"vercel";
function vercel(args,input){const result=spawnSync(vercelCommand,args,{input:input?`${input}\n`:undefined,encoding:"utf8",stdio:["pipe","pipe","pipe"],shell:process.platform==="win32"});if(result.status!==0)throw new Error(`Vercel ${args.slice(0,3).join(" ")} failed: ${result.error?.message||result.stderr||result.stdout||`status ${result.status}`}`);return result.stdout}
function replaceVercelEnv(name,value){spawnSync(vercelCommand,["env","rm",name,"production","--yes"],{encoding:"utf8",stdio:["ignore","pipe","pipe"],shell:process.platform==="win32"});vercel(["env","add",name,"production","--yes"],value)}

const products=await stripe("/products?active=true&limit=100");
let product=products.data.find(item=>item.name==="GGuard Pre-Dispatch");
if(!product)product=await stripe("/products",{method:"POST",headers:{"content-type":"application/x-www-form-urlencoded"},body:form({name:"GGuard Pre-Dispatch",description:"Branded pre-dispatch photo and video intake for garage-door service companies"})});
const prices=await stripe(`/prices?active=true&type=recurring&product=${encodeURIComponent(product.id)}&limit=100`);
let price=prices.data.find(item=>item.currency==="usd"&&item.unit_amount===14900&&item.recurring?.interval==="month");
if(!price)price=await stripe("/prices",{method:"POST",headers:{"content-type":"application/x-www-form-urlencoded"},body:form({product:product.id,unit_amount:14900,currency:"usd","recurring[interval]":"month",nickname:"GGuard Pre-Dispatch Monthly"})});
let annualPrice=prices.data.find(item=>item.currency==="usd"&&item.unit_amount===149000&&item.recurring?.interval==="year");
if(!annualPrice)annualPrice=await stripe("/prices",{method:"POST",headers:{"content-type":"application/x-www-form-urlencoded"},body:form({product:product.id,unit_amount:149000,currency:"usd","recurring[interval]":"year",nickname:"GGuard Pre-Dispatch Annual"})});
replaceVercelEnv("STRIPE_PRICE_PRE_DISPATCH",price.id);
replaceVercelEnv("STRIPE_PRICE_PRE_DISPATCH_ANNUAL",annualPrice.id);

if(!process.env.STRIPE_WEBHOOK_SECRET){
  const endpoints=await stripe("/webhook_endpoints?limit=100");
  const existing=endpoints.data.filter(item=>item.url==="https://ggaurdai.com/api/webhook/stripe"&&item.status==="enabled");
  const events=["checkout.session.completed","checkout.session.async_payment_succeeded","checkout.session.async_payment_failed","checkout.session.expired","charge.refunded","customer.subscription.created","customer.subscription.updated","customer.subscription.deleted","invoice.paid","invoice.payment_failed"];
  const body=new URLSearchParams({url:"https://ggaurdai.com/api/webhook/stripe",description:"GGuard production webhook - managed rotation"});
  events.forEach((event,index)=>body.set(`enabled_events[${index}]`,event));
  const endpoint=await stripe("/webhook_endpoints",{method:"POST",headers:{"content-type":"application/x-www-form-urlencoded"},body});
  if(!endpoint.secret)throw new Error("Stripe did not return a webhook signing secret");
  replaceVercelEnv("STRIPE_WEBHOOK_SECRET",endpoint.secret);
  for(const old of existing)await stripe(`/webhook_endpoints/${old.id}`,{method:"POST",headers:{"content-type":"application/x-www-form-urlencoded"},body:form({disabled:true})});
}
console.log(`Configured GGuard Pre-Dispatch product ${product.id}, monthly price ${price.id}, annual price ${annualPrice.id}, and production webhook signing.`);
