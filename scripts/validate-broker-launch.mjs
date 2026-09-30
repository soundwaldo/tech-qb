import { neon } from "@neondatabase/serverless";

const failures=[];const passes=[];
const required=(name)=>{const value=process.env[name];if(!value)failures.push(`${name} is missing`);else passes.push(`${name} is configured`);return value};
const appUrl=required("NEXT_PUBLIC_APP_URL");if(appUrl){try{if(new URL(appUrl).protocol!=="https:")failures.push("NEXT_PUBLIC_APP_URL must use HTTPS")}catch{failures.push("NEXT_PUBLIC_APP_URL must be a valid URL")}}
const signing=process.env.PRE_DISPATCH_SIGNING_SECRET||process.env.ADMIN_SESSION_SECRET;if(!signing||signing.length<32)failures.push("Pre-Dispatch signing secret must be at least 32 characters");else passes.push("Signing secret length is valid");
for(const flag of ["PRE_DISPATCH_ENABLED","PRE_DISPATCH_ONBOARDING_ENABLED","PRE_DISPATCH_SUBMISSIONS_ENABLED","PRE_DISPATCH_WORKER_ENABLED","PRE_DISPATCH_EMAIL_ENABLED","PRE_DISPATCH_WEBHOOKS_ENABLED"])if(process.env[flag]!=="true")failures.push(`${flag} must be true for broker launch`);else passes.push(`${flag} is enabled`);
required("NEON_AUTH_BASE_URL");
for (const name of ["NEON_AUTH_COOKIE_SECRET", "PII_ENCRYPTION_KEY", "CRON_SECRET"]) {
  if (!process.env[name] || process.env[name].length < 32) failures.push(`${name} must be configured with at least 32 characters`);
  else passes.push(`${name} length is valid`);
}
required("STRIPE_SECRET_KEY");required("STRIPE_WEBHOOK_SECRET");required("STRIPE_PRICE_PRE_DISPATCH");required("STRIPE_PRICE_PRE_DISPATCH_ANNUAL");required("DATABASE_URL");
required("PRE_DISPATCH_OPERATIONS_OWNER_EMAIL");required("PRE_DISPATCH_SUPPORT_OWNER_EMAIL");
if(process.env.PRE_DISPATCH_EMAIL_ENABLED==="true"){required("RESEND_API_KEY");required("EMAIL_FROM")}
const directStorage=Boolean(process.env.R2_ENDPOINT&&process.env.R2_ACCESS_KEY_ID&&process.env.R2_SECRET_ACCESS_KEY&&process.env.R2_BUCKET)||Boolean(process.env.AWS_ACCESS_KEY_ID&&process.env.AWS_SECRET_ACCESS_KEY&&process.env.S3_BUCKET&&process.env.AWS_REGION);
if(!directStorage)failures.push("Private direct R2/S3 storage is not fully configured");else passes.push("Private direct object storage is configured");
if(!process.env.PRE_DISPATCH_MALWARE_SCANNER_URL||!process.env.PRE_DISPATCH_MALWARE_SCANNER_SECRET)failures.push("Production malware scanner is not fully configured");else passes.push("Malware scanner is configured");
if(process.env.DATABASE_URL){try{const sql=neon(process.env.DATABASE_URL);const rows=await sql`SELECT to_regclass('public.sales_brokers') broker_table,to_regclass('public.broker_deals') deal_table,to_regclass('public.pre_dispatch_companies') company_table,to_regclass('public.broker_applications') application_table,to_regclass('public.broker_commission_ledger') commission_table,to_regclass('public.pre_dispatch_team_invites') team_table,to_regclass('public.support_tickets') support_table`;if(Object.values(rows[0]||{}).some(value=>!value))failures.push("Broker/Pre-Dispatch workflow migration is not fully applied");else passes.push("Broker, commission, team, and support tables exist")}catch(error){failures.push(`Database readiness check failed: ${error instanceof Error?error.message:"unknown error"}`)}}
console.log(`Broker launch checks passed: ${passes.length}`);for(const item of passes)console.log(`PASS ${item}`);for(const item of failures)console.error(`FAIL ${item}`);if(failures.length)process.exitCode=1;
