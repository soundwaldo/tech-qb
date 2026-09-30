CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), name TEXT NOT NULL,
  customer_type TEXT NOT NULL CHECK (customer_type IN ('hoa','property_manager','contractor')),
  stripe_customer_id TEXT UNIQUE, subscription_plan TEXT, subscription_status TEXT,
  report_credits INTEGER NOT NULL DEFAULT 0, unit_count INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE organizations DROP CONSTRAINT IF EXISTS organizations_customer_type_check;
ALTER TABLE organizations ADD CONSTRAINT organizations_customer_type_check CHECK (customer_type IN ('hoa','property_manager','contractor'));
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT UNIQUE;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS last_stripe_invoice_id TEXT;

CREATE TABLE IF NOT EXISTS profiles (
  id TEXT PRIMARY KEY,
  full_name TEXT,
  phone TEXT,
  role TEXT NOT NULL DEFAULT 'homeowner' CHECK (role IN ('homeowner','property_manager','contractor','admin')),
  organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE profiles ALTER COLUMN id TYPE TEXT USING id::text;
CREATE INDEX IF NOT EXISTS idx_profiles_org ON profiles(organization_id);
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE profiles ADD CONSTRAINT profiles_role_check CHECK (role IN ('homeowner','property_manager','contractor','admin','sales_broker'));

CREATE TABLE IF NOT EXISTS sales_brokers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), auth_user_id TEXT NOT NULL UNIQUE REFERENCES profiles(id) ON DELETE RESTRICT,
  display_name TEXT NOT NULL, commission_bps INTEGER NOT NULL DEFAULT 2000 CHECK (commission_bps BETWEEN 0 AND 10000),
  support_commission_bps INTEGER NOT NULL DEFAULT 0 CHECK (support_commission_bps BETWEEN 0 AND 10000),
  commission_months INTEGER NOT NULL DEFAULT 12 CHECK (commission_months BETWEEN 1 AND 120),
  support_commission_enabled BOOLEAN NOT NULL DEFAULT false,
  active BOOLEAN NOT NULL DEFAULT true, created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE sales_brokers ADD COLUMN IF NOT EXISTS support_commission_bps INTEGER NOT NULL DEFAULT 0;
ALTER TABLE sales_brokers ADD COLUMN IF NOT EXISTS commission_months INTEGER NOT NULL DEFAULT 12;
ALTER TABLE sales_brokers ADD COLUMN IF NOT EXISTS support_commission_enabled BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS broker_applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), auth_user_id TEXT NOT NULL UNIQUE REFERENCES profiles(id) ON DELETE RESTRICT,
  legal_name TEXT NOT NULL, display_name TEXT NOT NULL, business_name TEXT, email TEXT NOT NULL, phone TEXT NOT NULL,
  website_url TEXT, territory TEXT, sales_experience TEXT NOT NULL, support_capacity TEXT NOT NULL,
  tax_status TEXT NOT NULL CHECK (tax_status IN ('individual','business')),
  agreement_version TEXT NOT NULL, agreement_accepted_at TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'submitted' CHECK (status IN ('submitted','approved','declined','withdrawn')),
  reviewed_at TIMESTAMPTZ, reviewed_by TEXT, decision_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS broker_deals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), broker_id UUID NOT NULL REFERENCES sales_brokers(id) ON DELETE RESTRICT,
  company_id UUID UNIQUE, prospect_company TEXT NOT NULL, contact_name TEXT NOT NULL, contact_email TEXT NOT NULL,
  phone TEXT NOT NULL, website_url TEXT, stage TEXT NOT NULL DEFAULT 'invited' CHECK (stage IN ('invited','claimed','demo','proposal','checkout','won','lost')),
  invite_token_hash TEXT NOT NULL UNIQUE, commission_bps INTEGER NOT NULL CHECK (commission_bps BETWEEN 0 AND 10000),
  commission_cents INTEGER NOT NULL DEFAULT 0, commission_status TEXT NOT NULL DEFAULT 'unearned' CHECK (commission_status IN ('unearned','pending','approved','paid','void')),
  notes TEXT, claimed_at TIMESTAMPTZ, won_at TIMESTAMPTZ, created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE broker_deals ADD COLUMN IF NOT EXISTS invite_consumed_at TIMESTAMPTZ;
ALTER TABLE broker_deals ADD COLUMN IF NOT EXISTS next_action TEXT;
ALTER TABLE broker_deals ADD COLUMN IF NOT EXISTS next_action_at TIMESTAMPTZ;
ALTER TABLE broker_deals ADD COLUMN IF NOT EXISTS lost_reason TEXT;
CREATE INDEX IF NOT EXISTS idx_broker_deals_broker_stage ON broker_deals(broker_id,stage,created_at DESC);

CREATE TABLE IF NOT EXISTS broker_commission_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), broker_id UUID NOT NULL REFERENCES sales_brokers(id) ON DELETE RESTRICT,
  deal_id UUID NOT NULL REFERENCES broker_deals(id) ON DELETE RESTRICT, stripe_invoice_id TEXT,
  stripe_charge_id TEXT, sequence_number INTEGER NOT NULL DEFAULT 1,
  gross_collected_cents INTEGER NOT NULL CHECK (gross_collected_cents >= 0),
  excluded_cents INTEGER NOT NULL DEFAULT 0 CHECK (excluded_cents >= 0),
  commission_bps INTEGER NOT NULL CHECK (commission_bps BETWEEN 0 AND 10000),
  commission_cents INTEGER NOT NULL CHECK (commission_cents >= 0),
  kind TEXT NOT NULL DEFAULT 'sale' CHECK (kind IN ('sale','support','clawback','adjustment')),
  status TEXT NOT NULL DEFAULT 'held' CHECK (status IN ('held','pending','approved','paid','void','clawed_back')),
  eligible_at TIMESTAMPTZ NOT NULL, approved_at TIMESTAMPTZ, approved_by TEXT,
  paid_at TIMESTAMPTZ, payout_reference TEXT, void_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_broker_commission_status ON broker_commission_ledger(broker_id,status,eligible_at);

-- Broker commission accounting: month-based accrual, verified net basis, auditable recovery.
ALTER TABLE broker_commission_ledger ADD COLUMN IF NOT EXISTS months_credited INTEGER NOT NULL DEFAULT 1 CHECK (months_credited BETWEEN 1 AND 120);
ALTER TABLE broker_commission_ledger ADD COLUMN IF NOT EXISTS refunded_cents INTEGER NOT NULL DEFAULT 0 CHECK (refunded_cents >= 0);
ALTER TABLE broker_commission_ledger ADD COLUMN IF NOT EXISTS stripe_refund_id TEXT;
ALTER TABLE broker_commission_ledger ADD COLUMN IF NOT EXISTS clawback_of_id UUID REFERENCES broker_commission_ledger(id) ON DELETE RESTRICT;
ALTER TABLE broker_commission_ledger DROP CONSTRAINT IF EXISTS broker_commission_ledger_stripe_invoice_id_key;
-- One accrual row per invoice per kind, and one recovery row per refund per parent row.
CREATE UNIQUE INDEX IF NOT EXISTS uniq_broker_commission_invoice_kind ON broker_commission_ledger(stripe_invoice_id,kind) WHERE kind <> 'clawback';
CREATE UNIQUE INDEX IF NOT EXISTS uniq_broker_commission_clawback ON broker_commission_ledger(clawback_of_id,stripe_refund_id) WHERE kind = 'clawback' AND clawback_of_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_broker_commission_clawback_parent ON broker_commission_ledger(clawback_of_id) WHERE clawback_of_id IS NOT NULL;

-- GGuard Pre-Dispatch (isolated, additive feature)
CREATE TABLE IF NOT EXISTS pre_dispatch_companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), organization_id UUID UNIQUE REFERENCES organizations(id) ON DELETE RESTRICT,
  name TEXT NOT NULL, slug TEXT NOT NULL UNIQUE, display_name TEXT NOT NULL, notification_email TEXT NOT NULL,
  phone TEXT NOT NULL, website_url TEXT, logo_url TEXT, brand_color TEXT NOT NULL DEFAULT '#0f766e', welcome_message TEXT,
  public_widget_key UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE, allowed_origins TEXT[] NOT NULL DEFAULT '{}',
  active BOOLEAN NOT NULL DEFAULT true, widget_enabled BOOLEAN NOT NULL DEFAULT true, retention_days INTEGER NOT NULL DEFAULT 90,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE broker_deals DROP CONSTRAINT IF EXISTS broker_deals_company_id_fkey;
ALTER TABLE broker_deals ADD CONSTRAINT broker_deals_company_id_fkey FOREIGN KEY(company_id) REFERENCES pre_dispatch_companies(id) ON DELETE RESTRICT;
CREATE TABLE IF NOT EXISTS pre_dispatch_company_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), company_id UUID NOT NULL REFERENCES pre_dispatch_companies(id) ON DELETE RESTRICT,
  auth_user_id TEXT NOT NULL, role TEXT NOT NULL DEFAULT 'owner' CHECK (role IN ('owner','admin','member')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), UNIQUE(company_id, auth_user_id)
);

CREATE TABLE IF NOT EXISTS pre_dispatch_team_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), company_id UUID NOT NULL REFERENCES pre_dispatch_companies(id) ON DELETE RESTRICT,
  email TEXT NOT NULL, role TEXT NOT NULL CHECK (role IN ('admin','member')), token_hash TEXT NOT NULL UNIQUE,
  invited_by TEXT NOT NULL, expires_at TIMESTAMPTZ NOT NULL, consumed_at TIMESTAMPTZ, revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_pd_team_invites_company ON pre_dispatch_team_invites(company_id,created_at DESC);

CREATE TABLE IF NOT EXISTS support_tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), public_reference TEXT NOT NULL UNIQUE,
  requester_auth_user_id TEXT REFERENCES profiles(id) ON DELETE SET NULL,
  requester_type TEXT NOT NULL CHECK (requester_type IN ('customer','contractor','broker','admin')),
  company_id UUID REFERENCES pre_dispatch_companies(id) ON DELETE RESTRICT,
  broker_id UUID REFERENCES sales_brokers(id) ON DELETE RESTRICT,
  subject TEXT NOT NULL, description TEXT NOT NULL,
  priority TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN ('low','normal','high','urgent')),
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','in_progress','waiting','resolved','closed')),
  assigned_to TEXT, resolution TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_support_status ON support_tickets(status,priority,created_at);
CREATE TABLE IF NOT EXISTS pre_dispatch_customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), company_id UUID NOT NULL REFERENCES pre_dispatch_companies(id) ON DELETE RESTRICT,
  first_name TEXT NOT NULL, last_name TEXT NOT NULL, phone TEXT NOT NULL, normalized_phone TEXT NOT NULL,
  email TEXT, normalized_email TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS pre_dispatch_upload_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), company_id UUID NOT NULL REFERENCES pre_dispatch_companies(id) ON DELETE RESTRICT,
  idempotency_key UUID NOT NULL DEFAULT gen_random_uuid(), status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','finalized','expired','revoked')),
  origin TEXT, expires_at TIMESTAMPTZ NOT NULL, finalized_at TIMESTAMPTZ, created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(company_id, id, idempotency_key)
);
CREATE TABLE IF NOT EXISTS pre_dispatch_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), company_id UUID NOT NULL REFERENCES pre_dispatch_companies(id) ON DELETE RESTRICT,
  customer_id UUID NOT NULL REFERENCES pre_dispatch_customers(id) ON DELETE RESTRICT, upload_session_id UUID NOT NULL UNIQUE REFERENCES pre_dispatch_upload_sessions(id) ON DELETE RESTRICT,
  public_reference TEXT NOT NULL UNIQUE, idempotency_key UUID NOT NULL, service_address1 TEXT NOT NULL, service_address2 TEXT,
  city TEXT NOT NULL, state TEXT NOT NULL, postal_code TEXT NOT NULL, preferred_contact_method TEXT, preferred_timing TEXT,
  problem_category TEXT NOT NULL, problem_description TEXT NOT NULL, vehicle_trapped BOOLEAN NOT NULL DEFAULT false,
  door_stuck_open BOOLEAN NOT NULL DEFAULT false, door_stuck_closed BOOLEAN NOT NULL DEFAULT false, loud_bang BOOLEAN NOT NULL DEFAULT false,
  loose_cables BOOLEAN NOT NULL DEFAULT false, off_track BOOLEAN NOT NULL DEFAULT false, opener_brand TEXT, additional_notes TEXT,
  safety_concern BOOLEAN NOT NULL DEFAULT false, consent_accepted_at TIMESTAMPTZ NOT NULL, source TEXT NOT NULL DEFAULT 'hosted',
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new','reviewed','contacted','scheduled','dispatched','completed','archived')),
  intake_summary TEXT NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(company_id, idempotency_key)
);
CREATE TABLE IF NOT EXISTS pre_dispatch_media_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), company_id UUID NOT NULL REFERENCES pre_dispatch_companies(id) ON DELETE RESTRICT,
  upload_session_id UUID NOT NULL REFERENCES pre_dispatch_upload_sessions(id) ON DELETE RESTRICT,
  request_id UUID REFERENCES pre_dispatch_requests(id) ON DELETE RESTRICT, type TEXT NOT NULL CHECK (type IN ('image','video')),
  storage_key TEXT NOT NULL UNIQUE, original_filename TEXT NOT NULL, safe_filename TEXT NOT NULL, mime_type TEXT NOT NULL,
  size_bytes BIGINT NOT NULL, duration_seconds INTEGER, width INTEGER, height INTEGER,
  processing_status TEXT NOT NULL DEFAULT 'pending' CHECK (processing_status IN ('pending','uploaded','verified','rejected','deleted')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS pre_dispatch_notification_deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), company_id UUID NOT NULL REFERENCES pre_dispatch_companies(id) ON DELETE RESTRICT,
  request_id UUID NOT NULL REFERENCES pre_dispatch_requests(id) ON DELETE RESTRICT, channel TEXT NOT NULL DEFAULT 'email', destination TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending', provider_message_id TEXT, attempts INTEGER NOT NULL DEFAULT 0, last_attempt_at TIMESTAMPTZ,
  error_code TEXT, idempotency_key TEXT NOT NULL UNIQUE, created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS pre_dispatch_integration_deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), company_id UUID NOT NULL REFERENCES pre_dispatch_companies(id) ON DELETE RESTRICT,
  request_id UUID NOT NULL REFERENCES pre_dispatch_requests(id) ON DELETE RESTRICT, integration_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending', attempts INTEGER NOT NULL DEFAULT 0, response_code INTEGER, last_attempt_at TIMESTAMPTZ,
  next_attempt_at TIMESTAMPTZ, created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS pre_dispatch_audit_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), company_id UUID NOT NULL REFERENCES pre_dispatch_companies(id) ON DELETE RESTRICT,
  request_id UUID REFERENCES pre_dispatch_requests(id) ON DELETE RESTRICT, event_type TEXT NOT NULL, actor_type TEXT NOT NULL,
  sanitized_metadata JSONB NOT NULL DEFAULT '{}', created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_pd_customers_phone ON pre_dispatch_customers(company_id, normalized_phone);
CREATE INDEX IF NOT EXISTS idx_pd_customers_email ON pre_dispatch_customers(company_id, normalized_email);
CREATE INDEX IF NOT EXISTS idx_pd_requests_company_created ON pre_dispatch_requests(company_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pd_requests_company_status ON pre_dispatch_requests(company_id, status);
CREATE INDEX IF NOT EXISTS idx_pd_upload_sessions_expiry ON pre_dispatch_upload_sessions(expires_at);
CREATE INDEX IF NOT EXISTS idx_pd_upload_sessions_status ON pre_dispatch_upload_sessions(status);
CREATE INDEX IF NOT EXISTS idx_pd_notifications_status ON pre_dispatch_notification_deliveries(company_id, status);
CREATE INDEX IF NOT EXISTS idx_pd_integrations_status ON pre_dispatch_integration_deliveries(company_id, status);
ALTER TABLE pre_dispatch_companies ADD COLUMN IF NOT EXISTS forwarding_email TEXT;
ALTER TABLE pre_dispatch_companies ADD COLUMN IF NOT EXISTS additional_notification_emails TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE pre_dispatch_companies ADD COLUMN IF NOT EXISTS launcher_position TEXT NOT NULL DEFAULT 'inline';
ALTER TABLE pre_dispatch_companies ADD COLUMN IF NOT EXISTS launcher_copy TEXT NOT NULL DEFAULT 'Show us your garage door problem';
ALTER TABLE pre_dispatch_requests ADD COLUMN IF NOT EXISTS ai_processing_consent BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE pre_dispatch_requests ADD COLUMN IF NOT EXISTS analysis_status TEXT NOT NULL DEFAULT 'pending';
ALTER TABLE pre_dispatch_media_assets ADD COLUMN IF NOT EXISTS sha256 TEXT;
ALTER TABLE pre_dispatch_media_assets ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS pre_dispatch_analyses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), company_id UUID NOT NULL REFERENCES pre_dispatch_companies(id) ON DELETE RESTRICT,
  request_id UUID NOT NULL UNIQUE REFERENCES pre_dispatch_requests(id) ON DELETE RESTRICT,
  status TEXT NOT NULL CHECK (status IN ('pending','processing','completed','failed','insufficient_evidence')),
  summary TEXT, possible_issues JSONB NOT NULL DEFAULT '[]', parts_categories TEXT[] NOT NULL DEFAULT '{}',
  urgency TEXT, safety_flags TEXT[] NOT NULL DEFAULT '{}', dispatch_notes TEXT, inventory_categories TEXT[] NOT NULL DEFAULT '{}',
  estimated_minutes_min INTEGER, estimated_minutes_max INTEGER, overall_confidence NUMERIC(4,3),
  evidence_references JSONB NOT NULL DEFAULT '[]', limitations TEXT[] NOT NULL DEFAULT '{}',
  provider TEXT, model_version TEXT, human_review_state TEXT NOT NULL DEFAULT 'pending', error_code TEXT,
  attempts INTEGER NOT NULL DEFAULT 0, next_attempt_at TIMESTAMPTZ, completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_pd_analyses_company_status ON pre_dispatch_analyses(company_id, status);
ALTER TABLE pre_dispatch_analyses ADD COLUMN IF NOT EXISTS equipment_observations JSONB NOT NULL DEFAULT '{}';

CREATE TABLE IF NOT EXISTS pre_dispatch_outbox_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), company_id UUID NOT NULL REFERENCES pre_dispatch_companies(id) ON DELETE RESTRICT,
  request_id UUID REFERENCES pre_dispatch_requests(id) ON DELETE RESTRICT, event_type TEXT NOT NULL, event_version TEXT NOT NULL DEFAULT '1.0',
  payload JSONB NOT NULL DEFAULT '{}', status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','processing','completed','retry','dead_letter')),
  attempts INTEGER NOT NULL DEFAULT 0, available_at TIMESTAMPTZ NOT NULL DEFAULT now(), locked_at TIMESTAMPTZ, locked_by TEXT,
  last_error_code TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT now(), completed_at TIMESTAMPTZ,
  UNIQUE(request_id, event_type)
);
CREATE INDEX IF NOT EXISTS idx_pd_outbox_ready ON pre_dispatch_outbox_events(status, available_at);

CREATE TABLE IF NOT EXISTS pre_dispatch_webhook_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), company_id UUID NOT NULL REFERENCES pre_dispatch_companies(id) ON DELETE RESTRICT,
  endpoint_url TEXT NOT NULL, encrypted_secret TEXT NOT NULL, secret_hint TEXT NOT NULL, active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_pd_webhooks_company ON pre_dispatch_webhook_configs(company_id, active);

CREATE TABLE IF NOT EXISTS pre_dispatch_webhook_deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), company_id UUID NOT NULL REFERENCES pre_dispatch_companies(id) ON DELETE RESTRICT,
  webhook_config_id UUID NOT NULL REFERENCES pre_dispatch_webhook_configs(id) ON DELETE RESTRICT,
  integration_event_id UUID NOT NULL, request_id UUID NOT NULL REFERENCES pre_dispatch_requests(id) ON DELETE RESTRICT,
  status TEXT NOT NULL DEFAULT 'pending', attempts INTEGER NOT NULL DEFAULT 0, response_code INTEGER,
  response_excerpt TEXT, next_attempt_at TIMESTAMPTZ, last_attempt_at TIMESTAMPTZ, error_code TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(webhook_config_id, integration_event_id)
);
CREATE INDEX IF NOT EXISTS idx_pd_webhook_delivery_status ON pre_dispatch_webhook_deliveries(company_id, status, next_attempt_at);
CREATE TABLE IF NOT EXISTS pre_dispatch_customer_access_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),company_id UUID NOT NULL REFERENCES pre_dispatch_companies(id) ON DELETE RESTRICT,
  request_id UUID NOT NULL REFERENCES pre_dispatch_requests(id) ON DELETE RESTRICT,expires_at TIMESTAMPTZ NOT NULL,revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_pd_customer_access ON pre_dispatch_customer_access_tokens(company_id,request_id,expires_at) WHERE revoked_at IS NULL;

-- Shared abuse controls survive serverless cold starts and scale-out.
CREATE TABLE IF NOT EXISTS api_rate_limit_buckets (
  bucket_key TEXT PRIMARY KEY,
  request_count INTEGER NOT NULL,
  reset_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_rate_limit_expiry ON api_rate_limit_buckets(reset_at);

ALTER TABLE pre_dispatch_media_assets ADD COLUMN IF NOT EXISTS malware_scan_status TEXT NOT NULL DEFAULT 'pending';
ALTER TABLE pre_dispatch_media_assets ADD COLUMN IF NOT EXISTS malware_scan_provider TEXT;
ALTER TABLE pre_dispatch_media_assets ADD COLUMN IF NOT EXISTS malware_scanned_at TIMESTAMPTZ;
ALTER TABLE pre_dispatch_media_assets ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE pre_dispatch_requests ADD COLUMN IF NOT EXISTS assigned_auth_user_id TEXT;
ALTER TABLE pre_dispatch_requests ADD COLUMN IF NOT EXISTS scheduled_at TIMESTAMPTZ;
ALTER TABLE pre_dispatch_requests ADD COLUMN IF NOT EXISTS technician_notes TEXT;
ALTER TABLE pre_dispatch_requests ADD COLUMN IF NOT EXISTS technician_verified_at TIMESTAMPTZ;
ALTER TABLE pre_dispatch_requests ADD COLUMN IF NOT EXISTS technician_verified_by TEXT;
ALTER TABLE pre_dispatch_requests ADD COLUMN IF NOT EXISTS verified_equipment JSONB NOT NULL DEFAULT '{}';
ALTER TABLE pre_dispatch_companies ADD COLUMN IF NOT EXISTS product_status TEXT NOT NULL DEFAULT 'trial';
ALTER TABLE pre_dispatch_companies ADD COLUMN IF NOT EXISTS trial_ends_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '14 days');
ALTER TABLE pre_dispatch_companies ADD COLUMN IF NOT EXISTS subscription_plan TEXT NOT NULL DEFAULT 'pre_dispatch_trial';
ALTER TABLE pre_dispatch_companies ADD COLUMN IF NOT EXISTS contact_name TEXT;
ALTER TABLE pre_dispatch_companies ADD COLUMN IF NOT EXISTS work_email TEXT;
ALTER TABLE pre_dispatch_companies ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT;
ALTER TABLE pre_dispatch_companies ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS uq_pd_company_stripe_subscription ON pre_dispatch_companies(stripe_subscription_id) WHERE stripe_subscription_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_pd_requests_assignment ON pre_dispatch_requests(company_id, assigned_auth_user_id, status, created_at DESC);


CREATE TABLE IF NOT EXISTS properties (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  address_key TEXT NOT NULL UNIQUE,
  street_address TEXT NOT NULL,
  postal_code TEXT NOT NULL,
  public_region TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_properties_address_key ON properties(address_key);
ALTER TABLE pre_dispatch_requests ADD COLUMN IF NOT EXISTS property_id UUID REFERENCES properties(id) ON DELETE RESTRICT;
DROP RULE IF EXISTS protect_properties_from_delete ON properties;
CREATE RULE protect_properties_from_delete AS ON DELETE TO properties DO INSTEAD NOTHING;

CREATE TABLE IF NOT EXISTS property_relationships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID NOT NULL REFERENCES properties(id) ON DELETE RESTRICT,
  user_id TEXT REFERENCES profiles(id) ON DELETE SET NULL,
  organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
  relationship_type TEXT NOT NULL CHECK (relationship_type IN ('homeowner','managed_by','hoa','contractor')),
  valid_from TIMESTAMPTZ NOT NULL DEFAULT now(),
  valid_to TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK ((user_id IS NOT NULL AND organization_id IS NULL) OR (user_id IS NULL AND organization_id IS NOT NULL))
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_property_relationship_user_active
  ON property_relationships(property_id, user_id, relationship_type) WHERE valid_to IS NULL AND user_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_property_relationship_org_active
  ON property_relationships(property_id, organization_id, relationship_type) WHERE valid_to IS NULL AND organization_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_property_relationship_property ON property_relationships(property_id);

CREATE TABLE IF NOT EXISTS assessments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), session_token TEXT NOT NULL UNIQUE,
  customer_type TEXT NOT NULL DEFAULT 'homeowner' CHECK (customer_type IN ('homeowner','hoa','property_manager','contractor')),
  property_label TEXT, contractor_name TEXT, contractor_quote_cents INTEGER,
  street_address TEXT, zip_code TEXT NOT NULL, door_type TEXT NOT NULL CHECK (door_type IN ('single','double')),
  problems TEXT[] NOT NULL DEFAULT '{}', description TEXT, tier TEXT NOT NULL,
  amount_cents INTEGER NOT NULL, status TEXT NOT NULL DEFAULT 'draft', ai_processing_consent BOOLEAN NOT NULL DEFAULT false,
  stripe_checkout_session_id TEXT UNIQUE, stripe_payment_intent_id TEXT, paid_at TIMESTAMPTZ,
  organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL, due_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE assessments DROP CONSTRAINT IF EXISTS assessments_customer_type_check;
ALTER TABLE assessments ADD CONSTRAINT assessments_customer_type_check CHECK (customer_type IN ('homeowner','hoa','property_manager','contractor'));
CREATE INDEX IF NOT EXISTS idx_assessments_status ON assessments(status);
CREATE INDEX IF NOT EXISTS idx_assessments_org ON assessments(organization_id);
ALTER TABLE assessments ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE assessments ADD COLUMN IF NOT EXISTS email_lookup_hash TEXT;
ALTER TABLE assessments ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE assessments ADD COLUMN IF NOT EXISTS refund_eligible BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE assessments ADD COLUMN IF NOT EXISTS customer_user_id TEXT REFERENCES profiles(id) ON DELETE SET NULL;
ALTER TABLE assessments ADD COLUMN IF NOT EXISTS property_address_id TEXT;
ALTER TABLE assessments ADD COLUMN IF NOT EXISTS property_id UUID REFERENCES properties(id) ON DELETE RESTRICT;
CREATE INDEX IF NOT EXISTS idx_assessments_customer ON assessments(customer_user_id);
CREATE INDEX IF NOT EXISTS idx_assessments_property_address ON assessments(property_address_id);
CREATE INDEX IF NOT EXISTS idx_assessments_property_id ON assessments(property_id);
CREATE INDEX IF NOT EXISTS idx_assessments_email_lookup ON assessments(email_lookup_hash);

CREATE TABLE IF NOT EXISTS assessment_media (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), assessment_id UUID NOT NULL REFERENCES assessments(id) ON DELETE CASCADE,
  media_type TEXT NOT NULL, evidence_category TEXT, storage_key TEXT NOT NULL UNIQUE, file_name TEXT NOT NULL,
  content_type TEXT NOT NULL, size_bytes BIGINT NOT NULL DEFAULT 0, sha256_hash TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE assessment_media ADD COLUMN IF NOT EXISTS evidence_category TEXT;
ALTER TABLE assessment_media DROP CONSTRAINT IF EXISTS assessment_media_evidence_category_check;
ALTER TABLE assessment_media ADD CONSTRAINT assessment_media_evidence_category_check
  CHECK (evidence_category IS NULL OR evidence_category IN ('opener', 'spring_system', 'full_door', 'issue_closeup', 'operation_video'));
CREATE INDEX IF NOT EXISTS idx_media_assessment ON assessment_media(assessment_id);

CREATE TABLE IF NOT EXISTS diagnoses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), assessment_id UUID NOT NULL UNIQUE REFERENCES assessments(id) ON DELETE CASCADE,
  summary TEXT NOT NULL DEFAULT '', findings JSONB NOT NULL DEFAULT '[]',
  fair_price_low_cents INTEGER NOT NULL DEFAULT 0, fair_price_high_cents INTEGER NOT NULL DEFAULT 0,
  parts_needed TEXT[] NOT NULL DEFAULT '{}', questions_for_tech TEXT[] NOT NULL DEFAULT '{}',
  balance_test_instructions TEXT, safety_notes TEXT, recommendation TEXT NOT NULL DEFAULT 'insufficient_evidence',
  confidence TEXT NOT NULL DEFAULT 'low', quote_analysis JSONB NOT NULL DEFAULT '[]', limitations TEXT[] NOT NULL DEFAULT '{}',
  report_version INTEGER NOT NULL DEFAULT 1, ai_draft TEXT, ai_draft_used BOOLEAN NOT NULL DEFAULT false,
  ai_model TEXT, ai_generated_at TIMESTAMPTZ, ai_error TEXT, expert_name TEXT,
  finalized_at TIMESTAMPTZ, created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE diagnoses ADD COLUMN IF NOT EXISTS evidence_reviewed TEXT[] NOT NULL DEFAULT '{}';

CREATE TABLE IF NOT EXISTS report_manifests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), assessment_id UUID NOT NULL REFERENCES assessments(id) ON DELETE RESTRICT,
  diagnosis_id UUID NOT NULL REFERENCES diagnoses(id) ON DELETE RESTRICT, public_id TEXT NOT NULL UNIQUE,
  version INTEGER NOT NULL, record_type TEXT NOT NULL DEFAULT 'diagnostic_assessment', manifest_version TEXT NOT NULL DEFAULT '1.0',
  manifest JSONB NOT NULL, content_hash TEXT NOT NULL UNIQUE, previous_content_hash TEXT,
  verified_at TIMESTAMPTZ NOT NULL DEFAULT now(), chain_id TEXT, transaction_hash TEXT,
  block_number BIGINT, anchored_at TIMESTAMPTZ, created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (assessment_id, version)
);

CREATE TABLE IF NOT EXISTS maintenance_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), public_id TEXT NOT NULL UNIQUE,
  repair_type TEXT NOT NULL, city TEXT NOT NULL, zip_code TEXT NOT NULL,
  completed_date DATE NOT NULL DEFAULT CURRENT_DATE, content_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE maintenance_records ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES pre_dispatch_companies(id) ON DELETE RESTRICT;
ALTER TABLE maintenance_records ADD COLUMN IF NOT EXISTS property_id UUID REFERENCES properties(id) ON DELETE RESTRICT;
ALTER TABLE maintenance_records ADD COLUMN IF NOT EXISTS customer_id UUID REFERENCES pre_dispatch_customers(id) ON DELETE RESTRICT;
ALTER TABLE maintenance_records ADD COLUMN IF NOT EXISTS pre_dispatch_request_id UUID UNIQUE REFERENCES pre_dispatch_requests(id) ON DELETE RESTRICT;
ALTER TABLE maintenance_records ADD COLUMN IF NOT EXISTS analysis_id UUID UNIQUE REFERENCES pre_dispatch_analyses(id) ON DELETE RESTRICT;
ALTER TABLE maintenance_records ADD COLUMN IF NOT EXISTS source_media_hashes TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE maintenance_records ADD COLUMN IF NOT EXISTS preliminary_findings JSONB NOT NULL DEFAULT '[]';
ALTER TABLE maintenance_records ADD COLUMN IF NOT EXISTS safety_flags TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE maintenance_records ADD COLUMN IF NOT EXISTS verification_state TEXT NOT NULL DEFAULT 'technician_verification_pending';
ALTER TABLE maintenance_records ADD COLUMN IF NOT EXISTS model_version TEXT;
ALTER TABLE maintenance_records ADD COLUMN IF NOT EXISTS human_review_state TEXT NOT NULL DEFAULT 'pending';
ALTER TABLE maintenance_records ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ;
ALTER TABLE maintenance_records ADD COLUMN IF NOT EXISTS reviewed_by TEXT;

-- Defense in depth: tenant identity must agree across every relationship.
CREATE UNIQUE INDEX IF NOT EXISTS uq_pd_customers_company_id ON pre_dispatch_customers(company_id,id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_pd_sessions_company_id ON pre_dispatch_upload_sessions(company_id,id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_pd_requests_company_id ON pre_dispatch_requests(company_id,id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_pd_analyses_company_id ON pre_dispatch_analyses(company_id,id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_pd_webhook_configs_company_id ON pre_dispatch_webhook_configs(company_id,id);
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='fk_pd_request_customer_tenant') THEN ALTER TABLE pre_dispatch_requests ADD CONSTRAINT fk_pd_request_customer_tenant FOREIGN KEY(company_id,customer_id) REFERENCES pre_dispatch_customers(company_id,id) NOT VALID; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='fk_pd_request_session_tenant') THEN ALTER TABLE pre_dispatch_requests ADD CONSTRAINT fk_pd_request_session_tenant FOREIGN KEY(company_id,upload_session_id) REFERENCES pre_dispatch_upload_sessions(company_id,id) NOT VALID; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='fk_pd_media_session_tenant') THEN ALTER TABLE pre_dispatch_media_assets ADD CONSTRAINT fk_pd_media_session_tenant FOREIGN KEY(company_id,upload_session_id) REFERENCES pre_dispatch_upload_sessions(company_id,id) NOT VALID; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='fk_pd_media_request_tenant') THEN ALTER TABLE pre_dispatch_media_assets ADD CONSTRAINT fk_pd_media_request_tenant FOREIGN KEY(company_id,request_id) REFERENCES pre_dispatch_requests(company_id,id) NOT VALID; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='fk_pd_analysis_request_tenant') THEN ALTER TABLE pre_dispatch_analyses ADD CONSTRAINT fk_pd_analysis_request_tenant FOREIGN KEY(company_id,request_id) REFERENCES pre_dispatch_requests(company_id,id) NOT VALID; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='fk_pd_outbox_request_tenant') THEN ALTER TABLE pre_dispatch_outbox_events ADD CONSTRAINT fk_pd_outbox_request_tenant FOREIGN KEY(company_id,request_id) REFERENCES pre_dispatch_requests(company_id,id) NOT VALID; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='fk_pd_webhook_delivery_config_tenant') THEN ALTER TABLE pre_dispatch_webhook_deliveries ADD CONSTRAINT fk_pd_webhook_delivery_config_tenant FOREIGN KEY(company_id,webhook_config_id) REFERENCES pre_dispatch_webhook_configs(company_id,id) NOT VALID; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='fk_pd_maintenance_request_tenant') THEN ALTER TABLE maintenance_records ADD CONSTRAINT fk_pd_maintenance_request_tenant FOREIGN KEY(company_id,pre_dispatch_request_id) REFERENCES pre_dispatch_requests(company_id,id) NOT VALID; END IF;
END $$;

CREATE TABLE IF NOT EXISTS stripe_webhook_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), stripe_event_id TEXT NOT NULL UNIQUE,
  event_type TEXT NOT NULL, processed BOOLEAN NOT NULL DEFAULT false,
  payload JSONB NOT NULL DEFAULT '{}', created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE stripe_webhook_events ADD COLUMN IF NOT EXISTS processing_at TIMESTAMPTZ;
ALTER TABLE stripe_webhook_events ADD COLUMN IF NOT EXISTS attempts INTEGER NOT NULL DEFAULT 0;
ALTER TABLE stripe_webhook_events ADD COLUMN IF NOT EXISTS last_error TEXT;

CREATE OR REPLACE VIEW public_report_verifications AS
SELECT public_id, record_type, manifest_version, content_hash, previous_content_hash,
       verified_at, chain_id, transaction_hash, block_number, anchored_at, true AS verified
FROM report_manifests;

CREATE OR REPLACE VIEW public_verifications AS
SELECT public_id, city, zip_code, repair_type, completed_date, content_hash, true AS verified
FROM maintenance_records;

CREATE TABLE IF NOT EXISTS contractors (
  wallet_id TEXT PRIMARY KEY,
  identity_type TEXT NOT NULL CHECK (identity_type IN ('license','email')),
  name TEXT NOT NULL,
  license TEXT,
  email TEXT,
  trade TEXT,
  repair_count INTEGER NOT NULL DEFAULT 0,
  first_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Property Ledger: immutable on-chain maintenance records per property address
-- Each row is either a GGuard diagnosis or a contractor repair submission.
-- canonical_text persists forever even after media files are deleted.
-- content_hash = SHA-256(canonical_text + sorted media hashes) — tamper-evident.
-- anchor_tx_id links to on-chain proof (mock or real Supra L1 TX).
CREATE TABLE IF NOT EXISTS property_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_address_id TEXT NOT NULL,         -- SHA-256(normalized_address + zip) — the "wallet" ID
  record_type TEXT NOT NULL CHECK (record_type IN ('diagnosis', 'repair')),
  canonical_text TEXT NOT NULL,              -- full human-readable record, permanent
  content_hash TEXT NOT NULL,                -- SHA-256(canonical_text + media_hashes)
  anchor_tx_id TEXT,                         -- blockchain TX hash (null until anchored)
  anchor_block_height BIGINT,
  anchor_provider TEXT,                      -- 'mock' | 'supra'
  anchor_status TEXT NOT NULL DEFAULT 'pending' CHECK (anchor_status IN ('pending', 'confirmed', 'failed')),
  anchored_at TIMESTAMPTZ,
  assessment_id UUID REFERENCES assessments(id) ON DELETE SET NULL,
  submitted_by_user_id TEXT REFERENCES profiles(id) ON DELETE SET NULL,
  submitter_role TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ledger_property ON property_ledger(property_address_id);
CREATE INDEX IF NOT EXISTS idx_ledger_assessment ON property_ledger(assessment_id);
CREATE INDEX IF NOT EXISTS idx_ledger_status ON property_ledger(anchor_status);
CREATE INDEX IF NOT EXISTS idx_ledger_type ON property_ledger(record_type, created_at DESC);
ALTER TABLE property_ledger ADD COLUMN IF NOT EXISTS contractor_wallet_id TEXT REFERENCES contractors(wallet_id) ON DELETE SET NULL;
ALTER TABLE property_ledger ADD COLUMN IF NOT EXISTS is_disputed BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE property_ledger ADD COLUMN IF NOT EXISTS dispute_reason TEXT;
ALTER TABLE property_ledger ADD COLUMN IF NOT EXISTS dispute_raised_at TIMESTAMPTZ;
ALTER TABLE property_ledger ADD COLUMN IF NOT EXISTS dispute_notes TEXT;
ALTER TABLE property_ledger ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL;
ALTER TABLE property_ledger ADD COLUMN IF NOT EXISTS submitted_by_user_id TEXT REFERENCES profiles(id) ON DELETE SET NULL;
ALTER TABLE property_ledger ADD COLUMN IF NOT EXISTS submitter_role TEXT;
ALTER TABLE property_ledger ADD COLUMN IF NOT EXISTS property_id UUID REFERENCES properties(id) ON DELETE RESTRICT;
ALTER TABLE property_ledger ADD COLUMN IF NOT EXISTS public_category TEXT NOT NULL DEFAULT 'property_record';
ALTER TABLE property_ledger ADD COLUMN IF NOT EXISTS public_summary TEXT NOT NULL DEFAULT 'Verified property record';
ALTER TABLE property_ledger ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;
UPDATE property_ledger SET
  public_category = CASE WHEN record_type = 'diagnosis' THEN 'garage_door_assessment' ELSE 'garage_door_repair' END,
  public_summary = CASE WHEN record_type = 'diagnosis' THEN 'Garage door assessment completed' ELSE 'Garage door repair completed' END,
  completed_at = COALESCE(completed_at, created_at)
WHERE public_category = 'property_record' OR completed_at IS NULL;
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE profiles ADD CONSTRAINT profiles_role_check CHECK (role IN ('homeowner','property_manager','contractor','admin','sales_broker'));
CREATE INDEX IF NOT EXISTS idx_ledger_contractor ON property_ledger(contractor_wallet_id);
CREATE INDEX IF NOT EXISTS idx_ledger_organization ON property_ledger(organization_id);
CREATE INDEX IF NOT EXISTS idx_ledger_submitter ON property_ledger(submitted_by_user_id);
CREATE INDEX IF NOT EXISTS idx_ledger_property_uuid ON property_ledger(property_id, completed_at DESC);
