import { neon } from "@neondatabase/serverless";
import { readFileSync } from "fs";

// Load .env.local manually
try {
  const envFile = readFileSync(".env.local", "utf8");
  for (const line of envFile.split("\n")) {
    const match = line.match(/^([^#=]+)=(.*)$/);
    if (match) process.env[match[1].trim()] = match[2].trim().replace(/^"|"$/g, "");
  }
} catch {}

const db = neon(process.env.DATABASE_URL);

async function run() {
  console.log("Running contractor wallet migration...");

  // Contractors table — one row per unique contractor identity
  await db`
    CREATE TABLE IF NOT EXISTS contractors (
      wallet_id       TEXT PRIMARY KEY,               -- SHA-256(name+license) or SHA-256(name+email)
      identity_type   TEXT NOT NULL DEFAULT 'email'   -- 'license' | 'email'
                        CHECK (identity_type IN ('license', 'email')),
      name            TEXT NOT NULL,
      license         TEXT,
      email           TEXT,
      trade           TEXT,
      repair_count    INT NOT NULL DEFAULT 0,
      first_seen_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
      last_seen_at    TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `;
  console.log("✅ contractors table");

  await db`CREATE INDEX IF NOT EXISTS idx_contractors_license ON contractors(license) WHERE license IS NOT NULL`;
  await db`CREATE INDEX IF NOT EXISTS idx_contractors_email ON contractors(email) WHERE email IS NOT NULL`;
  console.log("✅ contractors indexes");

  // Add contractor_wallet_id to property_ledger
  await db`
    ALTER TABLE property_ledger
      ADD COLUMN IF NOT EXISTS contractor_wallet_id TEXT REFERENCES contractors(wallet_id)
  `;
  console.log("✅ property_ledger.contractor_wallet_id");

  await db`
    CREATE INDEX IF NOT EXISTS idx_ledger_contractor_wallet
      ON property_ledger(contractor_wallet_id)
      WHERE contractor_wallet_id IS NOT NULL
  `;
  console.log("✅ ledger contractor_wallet index");

  console.log("\nContractor wallet migration complete.");
}

run().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
