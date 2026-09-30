/**
 * Property Ledger — Immutable on-chain record system
 *
 * Architecture: Web2→Web3 bridge pattern
 *   Step 1: Build canonical text record (Web2)
 *   Step 2: Hash it with SHA-256 (crypto.ts)
 *   Step 3: Anchor hash to blockchain via pluggable AnchorProvider
 *   Step 4: Store tx proof in DB — survives photo deletion forever
 *
 * Record types:
 *   "diagnosis"  — GGuard's assessment report (problem identified)
 *   "repair"     — Contractor's submission (problem resolved)
 */

import { createHash } from "crypto";
import { getDb } from "./db";
import { getOrCreateProperty, linkProperty } from "./property-registry";

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

export type LedgerRecordType = "diagnosis" | "repair";

export interface DiagnosisPayload {
  assessmentId: string;
  propertyAddress: string;
  zipCode: string;
  problems: string[];
  summary: string;
  findings: unknown;
  fairPriceLowCents: number;
  fairPriceHighCents: number;
  partsNeeded: string[];
  mediaHashes: string[]; // SHA-256 of each uploaded file
  organizationId?: string | null;
}

export interface RepairPayload {
  propertyAddress: string;
  zipCode: string;
  trade: string; // "HVAC" | "Plumbing" | "Electrical" | "Roofing" | etc.
  summary: string; // plain text: what was done
  costCents: number;
  contractorName: string;
  contractorLicense?: string;
  contractorEmail?: string;
  repairedAt: string; // ISO date
  mediaHashes?: string[]; // optional before/after photo hashes
  relatedAssessmentId?: string; // link back to GGuard diagnosis if known
  organizationId?: string | null;
  submittedByUserId?: string | null;
  submitterRole?: string | null;
}

export interface AnchorResult {
  txId: string; // blockchain transaction ID (or mock ID)
  blockHeight: number;
  anchoredAt: string; // ISO timestamp
  provider: string; // "supra" | "mock"
}

export type ContractorIdentityType = "license" | "email";

export interface ContractorProfile {
  walletId: string;
  identityType: ContractorIdentityType;
  name: string;
  license: string | null;
  email: string | null;
  trade: string | null;
  repairCount: number;
  firstSeenAt: string;
  lastSeenAt: string;
}

export interface LedgerRecord {
  id: string;
  propertyId: string | null;
  propertyAddressId: string; // normalized address hash (the "wallet" identifier)
  recordType: LedgerRecordType;
  canonicalText: string; // human-readable text that persists forever
  contentHash: string; // SHA-256 of canonicalText + mediaHashes
  anchorTxId: string | null;
  anchorBlockHeight: number | null;
  anchorProvider: string | null;
  anchorStatus: "pending" | "confirmed" | "failed";
  anchoredAt: string | null;
  assessmentId: string | null;
  contractorWalletId: string | null;
  publicCategory: string;
  publicSummary: string;
  completedAt: string;
  organizationId?: string | null;
  submittedByUserId?: string | null;
  submitterRole?: string | null;
  createdAt: string;
  // Dispute tracking (14-day window, non-destructive)
  isDisputed: boolean;
  disputeReason: string | null;
  disputeRaisedAt: string | null;
  disputeNotes: string | null;
}

// ─────────────────────────────────────────────
// Pluggable Anchor Interface
// ─────────────────────────────────────────────

export interface AnchorProvider {
  name: string;
  anchorHash(contentHash: string, metadata: Record<string, string>): Promise<AnchorResult>;
  verifyAnchor(txId: string): Promise<{ confirmed: boolean; blockHeight: number | null }>;
}

// ─────────────────────────────────────────────
// Mock Anchor Provider (works today, no API key needed)
// Swap for SupraAnchorProvider when Supra API key available
// ─────────────────────────────────────────────

export class MockAnchorProvider implements AnchorProvider {
  name = "mock";

  async anchorHash(contentHash: string): Promise<AnchorResult> {
    // Simulate deterministic mock TX based on hash
    const mockTxId = "0x" + createHash("sha256")
      .update("mock_anchor_" + contentHash + Date.now())
      .digest("hex")
      .substring(0, 64);

    return {
      txId: mockTxId,
      blockHeight: Math.floor(Math.random() * 1_000_000) + 5_000_000,
      anchoredAt: new Date().toISOString(),
      provider: "mock",
    };
  }

  async verifyAnchor(txId: string): Promise<{ confirmed: boolean; blockHeight: number | null }> {
    // Mock: always confirmed if txId starts with 0x
    return { confirmed: txId.startsWith("0x"), blockHeight: null };
  }
}

// ─────────────────────────────────────────────
// Supra L1 Anchor Provider (stub — wire in when API key available)
// ─────────────────────────────────────────────

export class SupraAnchorProvider implements AnchorProvider {
  name = "supra";
  private apiKey: string;
  private rpcUrl: string;

  constructor() {
    this.apiKey = process.env.SUPRA_API_KEY ?? "";
    this.rpcUrl = process.env.SUPRA_RPC_URL ?? "https://rpc-mainnet.supra.com";
  }

  async anchorHash(contentHash: string, metadata: Record<string, string>): Promise<AnchorResult> {
    if (!this.apiKey) {
      throw new Error("SUPRA_API_KEY not configured — use MockAnchorProvider for development");
    }

    // POST hash to Supra L1 via REST API
    // Replace with actual Supra SDK call when available
    const response = await fetch(`${this.rpcUrl}/v1/anchor`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        data: contentHash,
        metadata,
        type: "gguard_property_record",
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Supra anchor failed: ${response.status} ${body}`);
    }

    const result = await response.json() as {
      tx_hash: string;
      block_height: number;
      timestamp: string;
    };

    return {
      txId: result.tx_hash,
      blockHeight: result.block_height,
      anchoredAt: result.timestamp,
      provider: "supra",
    };
  }

  async verifyAnchor(txId: string): Promise<{ confirmed: boolean; blockHeight: number | null }> {
    if (!this.apiKey) {
      return { confirmed: false, blockHeight: null };
    }

    const response = await fetch(`${this.rpcUrl}/v1/transactions/${txId}`, {
      headers: { "Authorization": `Bearer ${this.apiKey}` },
    });

    if (!response.ok) return { confirmed: false, blockHeight: null };

    const tx = await response.json() as { status: string; block_height: number };
    return {
      confirmed: tx.status === "confirmed",
      blockHeight: tx.block_height ?? null,
    };
  }
}

// ─────────────────────────────────────────────
// Get active anchor provider based on environment
// ─────────────────────────────────────────────

function getAnchorProvider(): AnchorProvider {
  if (process.env.SUPRA_API_KEY) {
    return new SupraAnchorProvider();
  }
  return new MockAnchorProvider();
}

// ─────────────────────────────────────────────
// Normalize property address to a stable identifier
// SHA-256 of normalized address string — this is the "wallet address"
// ─────────────────────────────────────────────

export function derivePropertyAddressId(address: string, zipCode: string): string {
  const normalized = `${address.toLowerCase().trim()}_${zipCode.trim()}`;
  return createHash("sha256").update(normalized).digest("hex");
}

// ─────────────────────────────────────────────
// Contractor Wallet — deterministic identity
//
// License-based:  SHA-256("contractor_lic:" + name + ":" + license)
//   → strong identity, tied to verifiable public license record
// Email-based:    SHA-256("contractor_email:" + email)
//   → softer identity, requires email ownership
// ─────────────────────────────────────────────

export function deriveContractorWalletId(
  name: string,
  license: string | null | undefined,
  email: string | null | undefined,
): { walletId: string; identityType: ContractorIdentityType } {
  const n = name.toLowerCase().trim();
  if (license && license.trim().length > 0) {
    const l = license.toLowerCase().trim();
    return {
      walletId: createHash("sha256").update(`contractor_lic:${n}:${l}`).digest("hex"),
      identityType: "license",
    };
  }
  if (email && email.trim().length > 0) {
    const e = email.toLowerCase().trim();
    return {
      walletId: createHash("sha256").update(`contractor_email:${e}`).digest("hex"),
      identityType: "email",
    };
  }
  // Fallback: name-only (weakest identity — no unique claim)
  return {
    walletId: createHash("sha256").update(`contractor_name:${n}`).digest("hex"),
    identityType: "email",
  };
}

/**
 * Upsert a contractor profile. Returns their wallet ID.
 * Creates on first submission, updates repair_count + last_seen_at on subsequent ones.
 */
export async function upsertContractor(params: {
  name: string;
  license?: string | null;
  email?: string | null;
  trade?: string | null;
}): Promise<string> {
  const { walletId, identityType } = deriveContractorWalletId(
    params.name,
    params.license,
    params.email,
  );
  const db = getDb();

  await db`
    INSERT INTO contractors (wallet_id, identity_type, name, license, email, trade, repair_count, first_seen_at, last_seen_at)
    VALUES (
      ${walletId}, ${identityType}, ${params.name.trim()},
      ${params.license?.trim() || null}, ${params.email?.trim() || null},
      ${params.trade?.trim() || null}, 1, now(), now()
    )
    ON CONFLICT (wallet_id) DO UPDATE SET
      repair_count  = contractors.repair_count + 1,
      last_seen_at  = now(),
      email         = COALESCE(EXCLUDED.email, contractors.email),
      trade         = COALESCE(EXCLUDED.trade, contractors.trade)
  `;

  return walletId;
}

/**
 * Fetch a contractor's profile by wallet ID.
 */
export async function getContractorProfile(walletId: string): Promise<ContractorProfile | null> {
  if (!/^[a-f0-9]{64}$/.test(walletId)) return null;
  const db = getDb();
  const rows = await db`
    SELECT * FROM contractors WHERE wallet_id = ${walletId} LIMIT 1
  `;
  const row = (rows as Record<string, unknown>[])[0];
  if (!row) return null;
  return {
    walletId: row.wallet_id as string,
    identityType: row.identity_type as ContractorIdentityType,
    name: row.name as string,
    license: row.license as string | null,
    email: row.email as string | null,
    trade: row.trade as string | null,
    repairCount: row.repair_count as number,
    firstSeenAt: row.first_seen_at as string,
    lastSeenAt: row.last_seen_at as string,
  };
}

/**
 * Fetch all repair ledger records for a contractor wallet.
 */
export async function getContractorLedger(walletId: string): Promise<LedgerRecord[]> {
  if (!/^[a-f0-9]{64}$/.test(walletId)) return [];
  const db = getDb();
  const rows = await db`
    SELECT * FROM property_ledger
    WHERE contractor_wallet_id = ${walletId}
    ORDER BY created_at DESC
  `;
  return (rows as Record<string, unknown>[]).map(rowToLedgerRecord);
}

// ─────────────────────────────────────────────
// Build canonical text document for a diagnosis
// This text is stored permanently — human readable after photos are gone
// ─────────────────────────────────────────────

export function buildDiagnosisText(payload: DiagnosisPayload): string {
  const lines = [
    `GGuard Property Diagnosis Report`,
    `Assessment ID: ${payload.assessmentId}`,
    `Property: ${payload.propertyAddress}, ${payload.zipCode}`,
    `Date: ${new Date().toISOString()}`,
    ``,
    `Problems Identified: ${payload.problems.join(", ")}`,
    ``,
    `Summary:`,
    payload.summary,
    ``,
    `Fair Price Estimate: $${(payload.fairPriceLowCents / 100).toFixed(2)} – $${(payload.fairPriceHighCents / 100).toFixed(2)}`,
    `Parts Needed: ${payload.partsNeeded.length > 0 ? payload.partsNeeded.join(", ") : "None listed"}`,
    ``,
    `Photo Evidence Hashes (SHA-256):`,
    ...payload.mediaHashes.map((h, i) => `  Photo ${i + 1}: ${h}`),
    ``,
    `Note: Photo files may be deleted after 90 days. The hashes above`,
    `prove specific photos existed at the time of this report.`,
  ];
  return lines.join("\n");
}

// ─────────────────────────────────────────────
// Build canonical text document for a contractor repair
// ─────────────────────────────────────────────

export function buildRepairText(payload: RepairPayload): string {
  const lines = [
    `Contractor Repair Record`,
    `Property: ${payload.propertyAddress}, ${payload.zipCode}`,
    `Date of Repair: ${payload.repairedAt}`,
    `Submitted: ${new Date().toISOString()}`,
    ``,
    `Trade: ${payload.trade}`,
    `Contractor: ${payload.contractorName}`,
    ...(payload.contractorLicense ? [`License: ${payload.contractorLicense}`] : []),
    ...(payload.contractorEmail ? [`Contact: ${payload.contractorEmail}`] : []),
    ``,
    `Work Performed:`,
    payload.summary,
    ``,
    `Cost: $${(payload.costCents / 100).toFixed(2)}`,
    ...(payload.relatedAssessmentId ? [`Related GGuard Assessment: ${payload.relatedAssessmentId}`] : []),
    ...(payload.mediaHashes && payload.mediaHashes.length > 0 ? [
      ``,
      `Photo Evidence Hashes (SHA-256):`,
      ...payload.mediaHashes.map((h, i) => `  Photo ${i + 1}: ${h}`),
    ] : []),
  ];
  return lines.join("\n");
}

// ─────────────────────────────────────────────
// Build content hash from canonical text + media hashes
// ─────────────────────────────────────────────

function buildContentHash(canonicalText: string, mediaHashes: string[]): string {
  const payload = JSON.stringify({
    text: canonicalText,
    media: [...mediaHashes].sort(),
  });
  return createHash("sha256").update(payload).digest("hex");
}

// ─────────────────────────────────────────────
// Core service functions
// ─────────────────────────────────────────────

/**
 * Anchor a GGuard diagnosis report to the property ledger.
 * Called automatically when a report is finalized.
 */
export async function anchorDiagnosisRecord(payload: DiagnosisPayload): Promise<LedgerRecord> {
  const canonicalText = buildDiagnosisText(payload);
  const contentHash = buildContentHash(canonicalText, payload.mediaHashes);
  const propertyAddressId = derivePropertyAddressId(payload.propertyAddress, payload.zipCode);
  const property = await getOrCreateProperty(payload.propertyAddress, payload.zipCode);

  const provider = getAnchorProvider();
  let anchor: AnchorResult | null = null;
  let anchorStatus: "confirmed" | "failed" = "failed";

  try {
    anchor = await provider.anchorHash(contentHash, {
      record_type: "diagnosis",
      property_id: property.id,
      assessment_id: payload.assessmentId,
    });
    anchorStatus = "confirmed";
  } catch (err) {
    console.error("[PropertyLedger] Anchor failed, storing pending record:", err);
  }

  const record = await insertLedgerRecord({
    propertyAddressId,
    propertyId: property.id,
    recordType: "diagnosis",
    publicCategory: "garage_door_assessment",
    publicSummary: "Garage door assessment completed",
    completedAt: new Date().toISOString(),
    canonicalText,
    contentHash,
    anchor,
    anchorStatus,
    assessmentId: payload.assessmentId,
    organizationId: payload.organizationId ?? null,
  });
  return record;
}

/**
 * Anchor a contractor repair submission to the property ledger.
 * Called from the contractor submission API endpoint.
 * Automatically upserts the contractor profile and links their wallet ID.
 */
export async function anchorRepairRecord(payload: RepairPayload): Promise<LedgerRecord> {
  const mediaHashes = payload.mediaHashes ?? [];
  const canonicalText = buildRepairText(payload);
  const contentHash = buildContentHash(canonicalText, mediaHashes);
  const propertyAddressId = derivePropertyAddressId(payload.propertyAddress, payload.zipCode);
  const property = await getOrCreateProperty(payload.propertyAddress, payload.zipCode);

  // Upsert contractor identity — creates wallet on first submission
  const contractorWalletId = await upsertContractor({
    name: payload.contractorName,
    license: payload.contractorLicense,
    email: payload.contractorEmail,
    trade: payload.trade,
  });

  const provider = getAnchorProvider();
  let anchor: AnchorResult | null = null;
  let anchorStatus: "confirmed" | "failed" = "failed";

  try {
    anchor = await provider.anchorHash(contentHash, {
      record_type: "repair",
      property_id: property.id,
      contractor_wallet: contractorWalletId,
      trade: payload.trade,
    });
    anchorStatus = "confirmed";
  } catch (err) {
    console.error("[PropertyLedger] Anchor failed, storing pending record:", err);
  }

  const record = await insertLedgerRecord({
    propertyAddressId,
    propertyId: property.id,
    recordType: "repair",
    publicCategory: payload.trade.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").slice(0, 80) || "garage_door_repair",
    publicSummary: `${payload.trade.trim()} repair completed`,
    completedAt: payload.repairedAt,
    canonicalText,
    contentHash,
    anchor,
    anchorStatus,
    assessmentId: payload.relatedAssessmentId ?? null,
    contractorWalletId,
    organizationId: payload.organizationId ?? null,
    submittedByUserId: payload.submittedByUserId ?? null,
    submitterRole: payload.submitterRole ?? null,
  });

  await Promise.all([
    payload.organizationId ? linkProperty({ propertyId: property.id, organizationId: payload.organizationId, relationshipType: "managed_by" }) : Promise.resolve(),
    payload.submittedByUserId && payload.submitterRole === "contractor"
      ? linkProperty({ propertyId: property.id, userId: payload.submittedByUserId, relationshipType: "contractor" })
      : Promise.resolve(),
  ]);

  return record;
}

/**
 * Retrieve all ledger records for a property address.
 * Public — anyone can look up a property's history.
 */
export async function getPropertyLedger(address: string, zipCode: string): Promise<LedgerRecord[]> {
  const propertyAddressId = derivePropertyAddressId(address, zipCode);
  const db = getDb();

  const rows = await db`
    SELECT * FROM property_ledger
    WHERE property_address_id = ${propertyAddressId}
    ORDER BY created_at ASC
  `;

  return (rows as Record<string, unknown>[]).map(rowToLedgerRecord);
}

/**
 * Verify a specific record's content hash matches its canonical text.
 * Proves the record hasn't been tampered with.
 */
export function verifyRecordIntegrity(record: LedgerRecord, mediaHashes: string[] = []): boolean {
  const recomputed = buildContentHash(record.canonicalText, mediaHashes);
  return recomputed === record.contentHash;
}

// ─────────────────────────────────────────────
// DB helpers
// ─────────────────────────────────────────────

async function insertLedgerRecord(params: {
  propertyAddressId: string;
  propertyId: string;
  recordType: LedgerRecordType;
  publicCategory: string;
  publicSummary: string;
  completedAt: string;
  canonicalText: string;
  contentHash: string;
  anchor: AnchorResult | null;
  anchorStatus: "confirmed" | "failed";
  assessmentId: string | null;
  contractorWalletId?: string | null;
  organizationId?: string | null;
  submittedByUserId?: string | null;
  submitterRole?: string | null;
}): Promise<LedgerRecord> {
  const db = getDb();

  const txId = params.anchor?.txId ?? null;
  const blockHeight = params.anchor?.blockHeight ?? null;
  const provider = params.anchor?.provider ?? null;
  const anchoredAt = params.anchor?.anchoredAt ?? null;
  const contractorWalletId = params.contractorWalletId ?? null;
  const organizationId = params.organizationId ?? null;
  const submittedByUserId = params.submittedByUserId ?? null;
  const submitterRole = params.submitterRole ?? null;

  const rows = await db`
    INSERT INTO property_ledger (
      property_address_id, property_id, record_type, public_category, public_summary, completed_at, canonical_text, content_hash,
      anchor_tx_id, anchor_block_height, anchor_provider, anchor_status, anchored_at,
      assessment_id, contractor_wallet_id, organization_id, submitted_by_user_id, submitter_role
    ) VALUES (
      ${params.propertyAddressId}, ${params.propertyId}, ${params.recordType}, ${params.publicCategory}, ${params.publicSummary}, ${params.completedAt}, ${params.canonicalText}, ${params.contentHash},
      ${txId}, ${blockHeight}, ${provider}, ${params.anchorStatus}, ${anchoredAt},
      ${params.assessmentId}, ${contractorWalletId}, ${organizationId}, ${submittedByUserId}, ${submitterRole}
    )
    RETURNING *
  `;

  return rowToLedgerRecord((rows as Record<string, unknown>[])[0]);
}

function rowToLedgerRecord(row: Record<string, unknown>): LedgerRecord {
  return {
    id: row.id as string,
    propertyId: row.property_id as string | null,
    propertyAddressId: row.property_address_id as string,
    recordType: row.record_type as LedgerRecordType,
    canonicalText: row.canonical_text as string,
    contentHash: row.content_hash as string,
    anchorTxId: row.anchor_tx_id as string | null,
    anchorBlockHeight: row.anchor_block_height as number | null,
    anchorProvider: row.anchor_provider as string | null,
    anchorStatus: row.anchor_status as "pending" | "confirmed" | "failed",
    anchoredAt: row.anchored_at as string | null,
    assessmentId: row.assessment_id as string | null,
    contractorWalletId: row.contractor_wallet_id as string | null,
    publicCategory: (row.public_category as string | null) ?? "property_record",
    publicSummary: (row.public_summary as string | null) ?? "Verified property record",
    completedAt: (row.completed_at as string | null) ?? (row.created_at as string),
    organizationId: row.organization_id as string | null,
    submittedByUserId: row.submitted_by_user_id as string | null,
    submitterRole: row.submitter_role as string | null,
    createdAt: row.created_at as string,
    isDisputed: (row.is_disputed as boolean) ?? false,
    disputeReason: (row.dispute_reason as string | null) ?? null,
    disputeRaisedAt: (row.dispute_raised_at as string | null) ?? null,
    disputeNotes: (row.dispute_notes as string | null) ?? null,
  };
}
