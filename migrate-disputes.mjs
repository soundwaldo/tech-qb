#!/usr/bin/env node

/**
 * Database Migration: Add Dispute Tracking to Property Ledger
 * Allows PMs to flag repairs as disputed within 14 days (immutable record)
 */

import { neon } from '@neondatabase/serverless';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error('❌ DATABASE_URL not set');
  process.exit(1);
}

const sql = neon(connectionString);

async function migrate() {
  try {
    console.log('🔗 Connecting to Neon database');

    // Add dispute columns to property_ledger
    console.log('📝 Adding dispute tracking columns...');
    await sql`
      ALTER TABLE property_ledger
      ADD COLUMN IF NOT EXISTS is_disputed BOOLEAN DEFAULT FALSE,
      ADD COLUMN IF NOT EXISTS dispute_reason TEXT,
      ADD COLUMN IF NOT EXISTS dispute_raised_at TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS dispute_notes TEXT;
    `;
    console.log('✅ Columns added');

    // Create index for efficient dispute queries (simple index on disputed flag)
    console.log('🗂️  Creating dispute index...');
    await sql`
      CREATE INDEX IF NOT EXISTS idx_ledger_disputed 
      ON property_ledger(is_disputed) 
      WHERE is_disputed = TRUE;
    `;
    console.log('✅ Index created');

    // Create index for recent disputes (just on created_at for disputed records, no time-based filter)
    console.log('🗂️  Creating recent disputes index...');
    await sql`
      CREATE INDEX IF NOT EXISTS idx_ledger_recent_disputes
      ON property_ledger(created_at DESC)
      WHERE is_disputed = TRUE;
    `;
    console.log('✅ Recent disputes index created');

    console.log('');
    console.log('✅ Migration complete!');
    console.log('   - Added: is_disputed (BOOLEAN)');
    console.log('   - Added: dispute_reason (TEXT)');
    console.log('   - Added: dispute_raised_at (TIMESTAMPTZ)');
    console.log('   - Added: dispute_notes (TEXT)');
    console.log('');

    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

migrate();
