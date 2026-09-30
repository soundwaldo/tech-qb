import Link from "next/link";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createServiceClient } from "@/lib/neon";
import { isAdminAuthenticated } from "@/lib/admin-auth";
import { Header } from "@/components/layout/Header";
import { Badge } from "@/components/ui/Badge";
import { createRepairInviteToken } from "@/lib/invite-token";
import { getDb } from "@/lib/db";

type OrganizationRow = {
    id: string;
    name: string;
    customer_type: "hoa" | "property_manager";
    subscription_plan: string | null;
    subscription_status: string | null;
    report_credits: number;
    unit_count: number | null;
    created_at: string;
};

type ProfileRow = {
    id: string;
    full_name: string | null;
    role: string;
    organization_id: string | null;
    created_at: string;
};

type ContractorPilotRow={id:string;name:string;slug:string;display_name:string;product_status:string;trial_ends_at:string;active:boolean;widget_enabled:boolean;allowed_origins:string[];session_count:number;request_count:number;owner_name:string|null};

async function createContractorPilot(formData:FormData){
    "use server";
    if(!await isAdminAuthenticated())redirect("/login");
    const name=String(formData.get("name")||"").trim();const slug=String(formData.get("slug")||"").trim().toLowerCase();const email=String(formData.get("email")||"").trim().toLowerCase();const phone=String(formData.get("phone")||"").replace(/\D/g,"");const website=String(formData.get("website")||"").trim();const profileId=String(formData.get("profileId")||"").trim();const trialDays=Math.min(90,Math.max(1,Number(formData.get("trialDays"))||30));
    if(name.length<2||!(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).test(slug)||!/^\S+@\S+\.\S+$/.test(email)||phone.length<7)return;
    let origin:string|null=null;try{if(website){const url=new URL(website);if(url.protocol!=="https:")return;origin=url.origin}}catch{return}
    const sql=getDb();
    await sql.transaction((tx)=>[
      tx`WITH org AS (INSERT INTO organizations(id,name,customer_type,subscription_plan,subscription_status,report_credits) VALUES(gen_random_uuid(),${name},'contractor','starter','trialing',0) RETURNING id), company AS (INSERT INTO pre_dispatch_companies(id,organization_id,name,slug,display_name,notification_email,phone,website_url,allowed_origins,product_status,trial_ends_at,subscription_plan) SELECT gen_random_uuid(),id,${name},${slug},${name},${email},${`+${phone}`},${website||null},${origin?[origin]:[]},'trial',now()+(${trialDays}*interval '1 day'),'pre_dispatch_pilot' FROM org RETURNING id,organization_id), profile_update AS (UPDATE profiles SET organization_id=(SELECT organization_id FROM company),role='contractor',updated_at=now() WHERE id=${profileId} AND ${profileId}<>'' RETURNING id) INSERT INTO pre_dispatch_company_users(id,company_id,auth_user_id,role) SELECT gen_random_uuid(),company.id,profile_update.id,'owner' FROM company JOIN profile_update ON true`,
      tx`INSERT INTO pre_dispatch_audit_events(id,company_id,event_type,actor_type,sanitized_metadata) SELECT gen_random_uuid(),id,'pilot.created','admin',${JSON.stringify({trialDays,originConfigured:Boolean(origin),ownerAssigned:Boolean(profileId)})}::jsonb FROM pre_dispatch_companies WHERE slug=${slug}`,
    ]);
    revalidatePath("/admin");
}

async function updateContractorPilot(formData:FormData){
    "use server";
    if(!await isAdminAuthenticated())redirect("/login");
    const companyId=String(formData.get("companyId")||"");const action=String(formData.get("pilotAction")||"");if(!companyId)return;const sql=getDb();
    if(action==="extend")await sql`UPDATE pre_dispatch_companies SET product_status='trial',active=true,widget_enabled=true,trial_ends_at=GREATEST(trial_ends_at,now())+interval '30 days',updated_at=now() WHERE id=${companyId}`;
    else if(action==="activate")await sql`UPDATE pre_dispatch_companies SET product_status='active',active=true,widget_enabled=true,updated_at=now() WHERE id=${companyId}`;
    else if(action==="suspend")await sql`UPDATE pre_dispatch_companies SET product_status='suspended',widget_enabled=false,updated_at=now() WHERE id=${companyId}`;
    else if(action==="rotate-key")await sql`UPDATE pre_dispatch_companies SET public_widget_key=gen_random_uuid(),updated_at=now() WHERE id=${companyId}`;
    else if(action==="set-origin"){const raw=String(formData.get("origin")||"").trim();let origin:string;try{const url=new URL(raw);if(url.protocol!=="https:")return;origin=url.origin}catch{return}await sql`UPDATE pre_dispatch_companies SET website_url=${raw},allowed_origins=ARRAY[${origin}],updated_at=now() WHERE id=${companyId}`}
    else if(action==="assign-owner"){const profileId=String(formData.get("profileId")||"").trim();if(!profileId)return;await sql.transaction((tx)=>[tx`UPDATE profiles SET organization_id=(SELECT organization_id FROM pre_dispatch_companies WHERE id=${companyId}),role='contractor',updated_at=now() WHERE id=${profileId}`,tx`INSERT INTO pre_dispatch_company_users(id,company_id,auth_user_id,role) VALUES(gen_random_uuid(),${companyId},${profileId},'owner') ON CONFLICT(company_id,auth_user_id) DO UPDATE SET role='owner'`])}
    else return;
    await sql`INSERT INTO pre_dispatch_audit_events(id,company_id,event_type,actor_type,sanitized_metadata) VALUES(gen_random_uuid(),${companyId},${`pilot.${action}`},'admin','{}'::jsonb)`;revalidatePath("/admin");
}

type QueueRow = {
    id: string;
    property_label: string | null;
    zip_code: string;
    customer_type: string;
    contractor_name: string | null;
    due_at: string | null;
    status: string;
};

async function createPilotOrganization(formData: FormData) {
    "use server";

    if (!await isAdminAuthenticated()) redirect("/login");

    const name = String(formData.get("name") || "").trim();
    const customerType = String(formData.get("customerType") || "pm");
    const unitCountRaw = String(formData.get("unitCount") || "").trim();
    const reportCreditsRaw = String(formData.get("reportCredits") || "").trim();
    const profileId = String(formData.get("profileId") || "").trim();

    if (!name) return;

    const unitCount = unitCountRaw ? Number(unitCountRaw) : null;
    const reportCredits = reportCreditsRaw ? Number(reportCreditsRaw) : customerType === "hoa" ? 100 : 50;

    const service = createServiceClient();
    const { data: org, error } = await service
        .from("organizations")
        .insert({
            name,
            customer_type: customerType === "hoa" ? "hoa" : "property_manager",
            subscription_plan: customerType === "hoa" ? "hoa_basic" : "pm_starter",
            subscription_status: "active",
            report_credits: Number.isFinite(reportCredits) ? reportCredits : (customerType === "hoa" ? 100 : 50),
            unit_count: Number.isFinite(unitCount ?? NaN) ? unitCount : null,
        })
        .select("id")
        .single();

    if (error || !org) {
        return;
    }

    if (profileId) {
        await service
            .from("profiles")
            .update({ organization_id: org.id })
            .eq("id", profileId);
    }

    revalidatePath("/admin");
}

export default async function AdminPage() {
    if (!await isAdminAuthenticated()) redirect("/login");

    const service = createServiceClient();
    const [{ data: assessments }, { data: organizations }, { data: profiles }] = await Promise.all([
        service.from("assessments").select("*").in("status", ["paid", "ai_processing", "awaiting_expert_review", "needs_more_evidence", "in_review"]).order("due_at", { ascending: true }),
        service.from("organizations").select("id, name, customer_type, subscription_plan, subscription_status, report_credits, unit_count, created_at").order("created_at", { ascending: false }),
        service.from("profiles").select("id, full_name, role, organization_id, created_at").order("created_at", { ascending: false }),
    ]);

    const queue = (Array.isArray(assessments) ? assessments : []) as QueueRow[];
    const orgRows = (Array.isArray(organizations) ? organizations : []) as OrganizationRow[];
    const profileRows = (Array.isArray(profiles) ? profiles : []) as ProfileRow[];
    const contractorPilots=(await getDb()`SELECT c.id,c.name,c.slug,c.display_name,c.product_status,c.trial_ends_at,c.active,c.widget_enabled,c.allowed_origins,(SELECT count(*)::int FROM pre_dispatch_upload_sessions s WHERE s.company_id=c.id) session_count,(SELECT count(*)::int FROM pre_dispatch_requests r WHERE r.company_id=c.id) request_count,(SELECT p.full_name FROM pre_dispatch_company_users cu JOIN profiles p ON p.id=cu.auth_user_id WHERE cu.company_id=c.id AND cu.role='owner' LIMIT 1) owner_name FROM pre_dispatch_companies c ORDER BY c.created_at DESC`) as unknown as ContractorPilotRow[];

    const onboardedProfiles = profileRows.filter((profile) => Boolean(profile.organization_id));
    const unassignedProfiles = profileRows.filter((profile) => !profile.organization_id);
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://ggaurdai.com";

    return (
        <>
            <Header />
            <main className="min-h-screen bg-slate-950 py-10 text-white">
                <div className="mx-auto max-w-6xl px-4 sm:px-6 space-y-8">
                    <div>
                        <p className="text-sm font-semibold text-cyan-400">Expert workspace</p>
                        <h1 className="mt-1 text-3xl font-bold">Admin dashboard</h1>
                        <p className="mt-2 text-slate-400">Review assessments, monitor onboarding, create pilots, <Link className="text-cyan-300" href="/admin/brokers">manage sales brokers</Link>, and <Link className="text-cyan-300" href="/admin/support">resolve support tickets</Link>.</p>
                    </div>

                    <section className="grid gap-4 md:grid-cols-4">
                        <StatCard label="Organizations" value={orgRows.length} />
                        <StatCard label="Profiles onboarded" value={onboardedProfiles.length} />
                        <StatCard label="Profiles not onboarded" value={unassignedProfiles.length} />
                        <StatCard label="Review queue" value={queue.length} />
                    </section>

                    <section className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
                        <div><h2 className="text-xl font-bold">Create contractor widget pilot</h2><p className="mt-1 text-sm text-slate-400">Creates the contractor organization and Pre-Dispatch trial together. Add an existing unassigned profile ID to make that user the owner.</p></div>
                        <form action={createContractorPilot} className="mt-6 grid gap-4 md:grid-cols-2">
                            <div><label className="mb-2 block text-sm font-medium text-slate-300">Company name</label><input name="name" required minLength={2} className="field"/></div>
                            <div><label className="mb-2 block text-sm font-medium text-slate-300">Slug</label><input name="slug" required pattern="[a-z0-9]+(?:-[a-z0-9]+)*" className="field" placeholder="acme-garage-doors"/></div>
                            <div><label className="mb-2 block text-sm font-medium text-slate-300">Notification email</label><input name="email" required type="email" className="field"/></div>
                            <div><label className="mb-2 block text-sm font-medium text-slate-300">Phone</label><input name="phone" required type="tel" className="field"/></div>
                            <div><label className="mb-2 block text-sm font-medium text-slate-300">Website HTTPS URL</label><input name="website" type="url" className="field" placeholder="https://www.example.com"/></div>
                            <div><label className="mb-2 block text-sm font-medium text-slate-300">Owner profile ID (optional)</label><input name="profileId" className="field"/></div>
                            <div><label className="mb-2 block text-sm font-medium text-slate-300">Trial days</label><input name="trialDays" type="number" min="1" max="90" defaultValue="30" className="field"/></div>
                            <div className="flex items-end"><button className="w-full rounded-xl bg-cyan-500 px-5 py-3 text-sm font-semibold text-slate-900 hover:bg-cyan-400">Create contractor pilot</button></div>
                        </form>
                        <div className="mt-8 space-y-3">{contractorPilots.length?contractorPilots.map(pilot=><div key={pilot.id} className="rounded-xl border border-slate-800 bg-slate-950 p-4 text-sm"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-semibold text-white">{pilot.display_name}</p><p className="text-slate-400">/{pilot.slug} · {pilot.owner_name||"Owner not assigned"} · {pilot.allowed_origins.length?pilot.allowed_origins.join(", "):"No embed origin"}</p><p className="mt-1 text-xs text-slate-500">{pilot.session_count} widget sessions · {pilot.request_count} completed requests · trial ends {new Date(pilot.trial_ends_at).toLocaleDateString()}</p></div><Badge className={pilot.product_status==="active"?"bg-emerald-950 text-emerald-300":pilot.product_status==="trial"?"bg-cyan-950 text-cyan-300":"bg-amber-950 text-amber-300"}>{pilot.product_status}</Badge></div><form action={updateContractorPilot} className="mt-3 flex flex-wrap gap-2"><input type="hidden" name="companyId" value={pilot.id}/><button name="pilotAction" value="extend" className="rounded-lg border border-slate-700 px-3 py-2 hover:border-cyan-600">Extend 30 days</button><button name="pilotAction" value="activate" className="rounded-lg border border-slate-700 px-3 py-2 hover:border-emerald-600">Activate</button><button name="pilotAction" value="suspend" className="rounded-lg border border-slate-700 px-3 py-2 hover:border-amber-600">Suspend</button><button name="pilotAction" value="rotate-key" className="rounded-lg border border-slate-700 px-3 py-2 hover:border-cyan-600">Rotate key</button></form><form action={updateContractorPilot} className="mt-3 grid gap-2 sm:grid-cols-[1fr_auto]"><input type="hidden" name="companyId" value={pilot.id}/><input name="origin" type="url" required className="field" placeholder="https://www.contractor-site.com" defaultValue={pilot.allowed_origins[0]||""}/><button name="pilotAction" value="set-origin" className="rounded-lg border border-slate-700 px-3 py-2 hover:border-cyan-600">Set origin</button></form><form action={updateContractorPilot} className="mt-2 grid gap-2 sm:grid-cols-[1fr_auto]"><input type="hidden" name="companyId" value={pilot.id}/><input name="profileId" required className="field" placeholder="Existing auth profile ID"/><button name="pilotAction" value="assign-owner" className="rounded-lg border border-slate-700 px-3 py-2 hover:border-cyan-600">Assign owner</button></form></div>):<p className="text-sm text-slate-400">No contractor pilots yet.</p>}</div>
                    </section>

                    <section className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                            <div>
                                <h2 className="text-xl font-bold">Create pilot organization</h2>
                                <p className="mt-1 text-sm text-slate-400">Use this for PM or HOA pilots. It creates an active org with credits and no checkout flow.</p>
                            </div>
                            <Badge className="bg-cyan-950 text-cyan-300">No payment required</Badge>
                        </div>

                        <form action={createPilotOrganization} className="mt-6 grid gap-4 md:grid-cols-2">
                            <div>
                                <label className="mb-2 block text-sm font-medium text-slate-300">Organization name</label>
                                <input name="name" required className="field" placeholder="Acme Property Management" />
                            </div>
                            <div>
                                <label className="mb-2 block text-sm font-medium text-slate-300">Type</label>
                                <select name="customerType" defaultValue="pm" className="field">
                                    <option value="pm">Property manager</option>
                                    <option value="hoa">HOA</option>
                                </select>
                            </div>
                            <div>
                                <label className="mb-2 block text-sm font-medium text-slate-300">Unit/property count</label>
                                <input name="unitCount" type="number" min="0" className="field" placeholder="25" />
                            </div>
                            <div>
                                <label className="mb-2 block text-sm font-medium text-slate-300">Starter credits</label>
                                <input name="reportCredits" type="number" min="0" className="field" placeholder="50" />
                            </div>
                            <div>
                                <label className="mb-2 block text-sm font-medium text-slate-300">Link to profile ID (optional)</label>
                                <input name="profileId" className="field" placeholder="auth user/profile UUID" />
                            </div>
                            <div className="flex items-end">
                                <button type="submit" className="w-full rounded-xl bg-cyan-500 px-5 py-3 text-sm font-semibold text-slate-900 hover:bg-cyan-400">
                                    Create pilot org
                                </button>
                            </div>
                        </form>
                    </section>

                    <section className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                            <div>
                                <h2 className="text-xl font-bold">Pilot invite links</h2>
                                <p className="mt-1 text-sm text-slate-400">Repair submissions require a signed invite link. Share one of these with pilot contractors only.</p>
                            </div>
                            <Badge className="bg-slate-800 text-slate-300">30-day signed links</Badge>
                        </div>

                        <div className="mt-6 space-y-3">
                            {orgRows.length === 0 ? (
                                <div className="rounded-xl border border-slate-800 p-4 text-sm text-slate-400">No organizations yet.</div>
                            ) : orgRows.map((org) => {
                                const inviteToken = createRepairInviteToken({
                                    organizationId: org.id,
                                    customerType: org.customer_type,
                                });
                                const inviteUrl = `${appUrl}/submit-repair?invite=${encodeURIComponent(inviteToken)}`;

                                return (
                                    <div key={org.id} className="rounded-xl border border-slate-800 bg-slate-950 p-4 text-sm">
                                        <div className="flex items-center justify-between gap-3">
                                            <div>
                                                <p className="font-semibold text-white">{org.name}</p>
                                                <p className="text-slate-400">{org.customer_type.replaceAll("_", " ")} · {org.subscription_plan || "unplanned"}</p>
                                            </div>
                                            <Badge className="bg-cyan-950 text-cyan-300">{org.subscription_status || "unknown"}</Badge>
                                        </div>
                                        <p className="mt-3 break-all rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 font-mono text-xs text-cyan-300">{inviteUrl}</p>
                                        <p className="mt-2 text-xs text-slate-500">Share this URL to allow a contractor to submit a repair record for this pilot org.</p>
                                    </div>
                                );
                            })}
                        </div>
                    </section>

                    <section className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
                        <h2 className="text-xl font-bold">Onboarding status</h2>
                        <p className="mt-1 text-sm text-slate-400">Profiles with an organization assigned are onboarded. Unassigned profiles are not yet onboarded.</p>

                        <div className="mt-6 grid gap-6 lg:grid-cols-2">
                            <div>
                                <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-400">Onboarded profiles</h3>
                                <div className="mt-3 space-y-3">
                                    {onboardedProfiles.length === 0 ? (
                                        <div className="rounded-xl border border-slate-800 p-4 text-sm text-slate-400">No onboarded profiles yet.</div>
                                    ) : onboardedProfiles.map((profile) => (
                                        <div key={profile.id} className="rounded-xl border border-slate-800 bg-slate-950 p-4 text-sm">
                                            <div className="flex items-center justify-between gap-3">
                                                <div>
                                                    <p className="font-semibold text-white">{profile.full_name || profile.id}</p>
                                                    <p className="text-slate-400">{profile.role.replaceAll("_", " ")}</p>
                                                </div>
                                                <Badge className="bg-emerald-950 text-emerald-300">Onboarded</Badge>
                                            </div>
                                            <p className="mt-2 text-xs text-slate-500">Org ID: {profile.organization_id}</p>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div>
                                <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-400">Not onboarded</h3>
                                <div className="mt-3 space-y-3">
                                    {unassignedProfiles.length === 0 ? (
                                        <div className="rounded-xl border border-slate-800 p-4 text-sm text-slate-400">No unassigned profiles.</div>
                                    ) : unassignedProfiles.map((profile) => (
                                        <div key={profile.id} className="rounded-xl border border-slate-800 bg-slate-950 p-4 text-sm">
                                            <div className="flex items-center justify-between gap-3">
                                                <div>
                                                    <p className="font-semibold text-white">{profile.full_name || profile.id}</p>
                                                    <p className="text-slate-400">{profile.role.replaceAll("_", " ")}</p>
                                                </div>
                                                <Badge className="bg-amber-950 text-amber-300">Not onboarded</Badge>
                                            </div>
                                            <p className="mt-2 text-xs text-slate-500">Profile ID: {profile.id}</p>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </section>

                    <section>
                        <div className="mb-4 flex items-end justify-between gap-4">
                            <div>
                                <h2 className="text-xl font-bold">Assessment queue</h2>
                                <p className="mt-1 text-sm text-slate-400">Review evidence, edit the structured draft, and release a decision-ready report.</p>
                            </div>
                        </div>

                        <div className="space-y-3">
                            {queue.length === 0 ? (
                                <div className="rounded-2xl border border-slate-800 p-10 text-center text-slate-400">The review queue is empty.</div>
                            ) : queue.map((item) => (
                                <Link key={item.id} href={`/admin/${item.id}`} className="flex flex-col justify-between gap-3 rounded-2xl border border-slate-800 bg-slate-900 p-5 transition hover:border-cyan-700 sm:flex-row sm:items-center">
                                    <div>
                                        <p className="font-semibold">{item.property_label || `Property in ${item.zip_code}`}</p>
                                        <p className="mt-1 text-sm text-slate-400">
                                            {item.customer_type.replaceAll("_", " ")} · {item.contractor_name || "No contractor"} · Due {item.due_at ? new Date(item.due_at).toLocaleString() : "not set"}
                                        </p>
                                    </div>
                                    <Badge className="bg-cyan-950 text-cyan-300">{item.status.replaceAll("_", " ")}</Badge>
                                </Link>
                            ))}
                        </div>
                    </section>
                </div>
            </main>
        </>
    );
}

function StatCard({ label, value }: { label: string; value: number }) {
    return (
        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
            <p className="text-sm text-slate-400">{label}</p>
            <p className="mt-2 text-3xl font-bold text-white">{value}</p>
        </div>
    );
}
