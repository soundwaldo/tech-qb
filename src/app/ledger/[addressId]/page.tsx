import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import { getDb } from "@/lib/db";

interface PageProps { params: Promise<{ addressId: string }> }

export const metadata: Metadata = {
    title: "Property Record Moved | GGuard",
    robots: { index: false, follow: false },
};

export default async function LegacyPropertyLedgerPage({ params }: PageProps) {
    const { addressId } = await params;
    if (!/^[a-f0-9]{64}$/.test(addressId)) notFound();
    const rows = await getDb()`
      SELECT property_id FROM property_ledger
      WHERE property_address_id = ${addressId} AND property_id IS NOT NULL
      ORDER BY created_at DESC LIMIT 1
    `;
    const propertyId = rows[0]?.property_id;
    if (!propertyId) notFound();
    permanentRedirect(`/properties/${String(propertyId)}`);
}
