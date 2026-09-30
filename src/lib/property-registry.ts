import "server-only";

import { getDb } from "@/lib/db";
import { derivePropertyLookupHash, encryptPII } from "@/lib/pii-encryption";

import { normalizePropertyAddress } from "./property-address";
export { normalizePropertyAddress } from "./property-address";

export interface CanonicalProperty {
    id: string;
    postalCode: string;
    publicRegion: string;
    createdAt: string;
}

export interface PublicPropertyRecord {
    id: string;
    recordType: "diagnosis" | "repair";
    category: string;
    summary: string;
    completedAt: string;
    contentHash: string;
    anchorStatus: "pending" | "confirmed" | "failed";
    anchorProvider: string | null;
    anchorTxId: string | null;
    contractorName: string | null;
    contractorLicense: string | null;
}

function rowToProperty(row: Record<string, unknown>): CanonicalProperty {
    return {
        id: String(row.id),
        postalCode: String(row.postal_code),
        publicRegion: String(row.public_region),
        createdAt: String(row.created_at),
    };
}

export async function getOrCreateProperty(address: string, zipCode: string): Promise<CanonicalProperty> {
    const normalized = normalizePropertyAddress(address, zipCode);
    const addressKey = derivePropertyLookupHash(normalized);
    const postalCode = zipCode.trim().slice(0, 5);
    const db = getDb();
    const rows = await db`
      INSERT INTO properties (address_key, street_address, postal_code, public_region)
      VALUES (${addressKey}, ${encryptPII(address.trim())}, ${postalCode}, ${`ZIP ${postalCode}`})
      ON CONFLICT (address_key) DO UPDATE SET address_key = EXCLUDED.address_key
      RETURNING id, postal_code, public_region, created_at
    `;
    return rowToProperty(rows[0] as Record<string, unknown>);
}

export async function findPropertyByAddress(address: string, zipCode: string): Promise<CanonicalProperty | null> {
    const addressKey = derivePropertyLookupHash(normalizePropertyAddress(address, zipCode));
    const rows = await getDb()`
      SELECT id, postal_code, public_region, created_at FROM properties WHERE address_key = ${addressKey} LIMIT 1
    `;
    return rows[0] ? rowToProperty(rows[0] as Record<string, unknown>) : null;
}

export async function getPublicProperty(id: string): Promise<CanonicalProperty | null> {
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) return null;
    const rows = await getDb()`
      SELECT id, postal_code, public_region, created_at FROM properties WHERE id = ${id} LIMIT 1
    `;
    return rows[0] ? rowToProperty(rows[0] as Record<string, unknown>) : null;
}

export async function getPublicPropertyRecords(propertyId: string): Promise<PublicPropertyRecord[]> {
    const rows = await getDb()`
      SELECT pl.id, pl.record_type, pl.public_category, pl.public_summary,
             COALESCE(pl.completed_at, pl.created_at) AS completed_at,
             pl.content_hash, pl.anchor_status, pl.anchor_provider, pl.anchor_tx_id,
             c.name AS contractor_name, c.license AS contractor_license
      FROM property_ledger pl
      LEFT JOIN contractors c ON c.wallet_id = pl.contractor_wallet_id
      WHERE pl.property_id = ${propertyId}
      ORDER BY COALESCE(pl.completed_at, pl.created_at) DESC
    `;
    return (rows as Record<string, unknown>[]).map((row) => ({
        id: String(row.id),
        recordType: row.record_type as "diagnosis" | "repair",
        category: String(row.public_category),
        summary: String(row.public_summary),
        completedAt: String(row.completed_at),
        contentHash: String(row.content_hash),
        anchorStatus: row.anchor_status as "pending" | "confirmed" | "failed",
        anchorProvider: row.anchor_provider ? String(row.anchor_provider) : null,
        anchorTxId: row.anchor_tx_id ? String(row.anchor_tx_id) : null,
        contractorName: row.contractor_name ? String(row.contractor_name) : null,
        contractorLicense: row.contractor_license ? String(row.contractor_license) : null,
    }));
}

export async function linkProperty(params: {
    propertyId: string;
    userId?: string | null;
    organizationId?: string | null;
    relationshipType: "homeowner" | "managed_by" | "hoa" | "contractor";
}): Promise<void> {
    const db = getDb();
    if (params.userId) {
        await db`
          INSERT INTO property_relationships (property_id, user_id, relationship_type)
          VALUES (${params.propertyId}, ${params.userId}, ${params.relationshipType})
          ON CONFLICT DO NOTHING
        `;
    } else if (params.organizationId) {
        await db`
          INSERT INTO property_relationships (property_id, organization_id, relationship_type)
          VALUES (${params.propertyId}, ${params.organizationId}, ${params.relationshipType})
          ON CONFLICT DO NOTHING
        `;
    }
}
