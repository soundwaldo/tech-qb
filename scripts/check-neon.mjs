import { neon } from "@neondatabase/serverless";

if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");
const sql = neon(process.env.DATABASE_URL);

const requiredColumns = {
  organizations: ["id", "name", "customer_type", "report_credits"],
  profiles: ["id", "full_name", "phone", "role", "organization_id", "created_at", "updated_at"],
  broker_applications: ["id","auth_user_id","agreement_version","agreement_accepted_at","status"],
  sales_brokers: ["id","auth_user_id","commission_bps","support_commission_bps","commission_months","active"],
  broker_deals: ["id","broker_id","company_id","invite_token_hash","invite_consumed_at","next_action","lost_reason"],
  broker_commission_ledger: ["id","broker_id","deal_id","stripe_invoice_id","commission_cents","eligible_at","status","payout_reference"],
  pre_dispatch_team_invites: ["id","company_id","email","role","token_hash","expires_at","consumed_at"],
  support_tickets: ["id","public_reference","requester_type","subject","priority","status"],
  properties: ["id", "address_key", "street_address", "postal_code", "public_region", "created_at"],
  property_relationships: ["id", "property_id", "user_id", "organization_id", "relationship_type", "valid_from", "valid_to"],
  assessments: ["id", "session_token", "customer_user_id", "property_address_id", "property_id", "street_address", "email", "email_lookup_hash", "phone", "zip_code", "door_type", "tier", "status", "refund_eligible"],
  assessment_media: ["id", "assessment_id", "evidence_category", "storage_key", "sha256_hash"],
  diagnoses: ["id", "assessment_id", "evidence_reviewed"],
  contractors: ["wallet_id", "identity_type", "name", "repair_count"],
  property_ledger: ["id", "property_address_id", "property_id", "public_category", "public_summary", "completed_at", "content_hash", "contractor_wallet_id", "organization_id", "submitted_by_user_id", "submitter_role", "is_disputed", "dispute_reason", "dispute_raised_at", "dispute_notes"],
  report_manifests: ["id", "assessment_id", "content_hash"],
  maintenance_records: ["id", "public_id", "content_hash"],
  stripe_webhook_events: ["id", "stripe_event_id", "processed", "processing_at", "attempts", "last_error"],
};

const catalog = await sql`
  SELECT table_name, column_name
  FROM information_schema.columns
  WHERE table_schema = 'public'
`;
const present = new Set(catalog.map((row) => `${row.table_name}.${row.column_name}`));
const missing = Object.entries(requiredColumns).flatMap(([table, columns]) =>
  columns.filter((column) => !present.has(`${table}.${column}`)).map((column) => `${table}.${column}`)
);

if (missing.length) {
  console.error(`Missing required schema fields:\n- ${missing.join("\n- ")}`);
  process.exitCode = 1;
}

const rows = await sql`
  SELECT table_name,
         (xpath('/row/count/text()', query_to_xml(format('SELECT count(*) AS count FROM %I', table_name), false, true, '')))[1]::text::int AS row_count
  FROM information_schema.tables
  WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
  ORDER BY table_name
`;
for (const row of rows) console.log(`${row.table_name}: ${row.row_count}`);

const [invariants] = await sql`
  SELECT
    (SELECT count(*)::int FROM (SELECT address_key FROM properties GROUP BY address_key HAVING count(*) > 1) duplicates) AS duplicate_address_keys,
    (SELECT count(*)::int FROM properties WHERE address_key !~ '^[a-f0-9]{64}$') AS invalid_address_keys,
    (SELECT count(*)::int FROM assessments WHERE street_address IS NOT NULL AND street_address <> '' AND property_id IS NULL) AS unlinked_assessments,
    (SELECT count(*)::int FROM property_ledger WHERE assessment_id IS NOT NULL AND property_id IS NULL) AS unlinked_assessment_records,
    (SELECT count(*)::int FROM pg_rules WHERE schemaname = 'public' AND tablename = 'properties' AND rulename = 'protect_properties_from_delete') AS delete_protection_rules
`;
console.log(`Registry integrity: ${JSON.stringify(invariants)}`);
const invariantFailure = Number(invariants.duplicate_address_keys) > 0
  || Number(invariants.invalid_address_keys) > 0
  || Number(invariants.unlinked_assessments) > 0
  || Number(invariants.unlinked_assessment_records) > 0
  || Number(invariants.delete_protection_rules) !== 1;
if (invariantFailure) process.exitCode = 1;
if (!missing.length && !invariantFailure) console.log("Schema contract: OK");
