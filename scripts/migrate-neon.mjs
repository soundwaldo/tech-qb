import { readFile } from "node:fs/promises";
import crypto from "node:crypto";
import { neon } from "@neondatabase/serverless";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL is required. Pull it with: vercel env pull .env.local --yes");

const sql = neon(databaseUrl);
const source = await readFile(new URL("../neon/schema.sql", import.meta.url), "utf8");
function splitSqlStatements(value){const statements=[];let current="";let quote=null;let dollarTag=null;let lineComment=false;let blockComment=false;for(let index=0;index<value.length;index++){const character=value[index],next=value[index+1];if(lineComment){if(character==="\n"){lineComment=false;current+=character}continue}if(blockComment){if(character==="*"&&next==="/"){blockComment=false;index++}continue}if(!quote&&!dollarTag&&character==="-"&&next==="-"){lineComment=true;index++;continue}if(!quote&&!dollarTag&&character==="/"&&next==="*"){blockComment=true;index++;continue}if(dollarTag){if(value.startsWith(dollarTag,index)){current+=dollarTag;index+=dollarTag.length-1;dollarTag=null}else current+=character;continue}if(quote){current+=character;if(character===quote){if(next===quote){current+=next;index++}else quote=null}continue}if(character==="'"||character==='"'){quote=character;current+=character;continue}if(character==="$" ){const match=value.slice(index).match(/^\$[A-Za-z0-9_]*\$/);if(match){dollarTag=match[0];current+=dollarTag;index+=dollarTag.length-1;continue}}if(character===";"){const statement=current.trim();if(statement)statements.push(statement);current=""}else current+=character}const remaining=current.trim();if(remaining)statements.push(remaining);if(quote||dollarTag||blockComment)throw new Error("Schema contains an unterminated SQL quote or comment");return statements}
const statements=splitSqlStatements(source);

for (const statement of statements) {
  await sql.query(statement);
}

let backfilledEmailLookups = 0;
let backfilledProperties = 0;
let linkedLedgerRecords = 0;
const piiSecret = process.env.PII_ENCRYPTION_KEY;
if (piiSecret && piiSecret.length >= 32) {
  const key = crypto.createHash("sha256").update(piiSecret, "utf8").digest();
  const decrypt = (value) => {
    const combined = Buffer.from(value, "base64");
    if (combined.length < 33) throw new Error("Invalid encrypted value");
    const decipher = crypto.createDecipheriv("aes-256-gcm", key, combined.subarray(0, 16));
    decipher.setAuthTag(combined.subarray(16, 32));
    return Buffer.concat([decipher.update(combined.subarray(32)), decipher.final()]).toString("utf8");
  };
  const encrypt = (value) => {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
    const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
    return Buffer.concat([iv, cipher.getAuthTag(), encrypted]).toString("base64");
  };
  const aliases = {
    street: "st", st: "st", avenue: "ave", ave: "ave", road: "rd", rd: "rd",
    boulevard: "blvd", blvd: "blvd", drive: "dr", dr: "dr", lane: "ln", ln: "ln",
    court: "ct", ct: "ct", circle: "cir", cir: "cir", parkway: "pkwy", pkwy: "pkwy",
    place: "pl", pl: "pl", terrace: "ter", ter: "ter", highway: "hwy", hwy: "hwy",
    north: "n", south: "s", east: "e", west: "w", apartment: "unit", apt: "unit", suite: "unit",
  };
  const normalizeAddress = (address, zipCode) => {
    const street = address
      .normalize("NFKC")
      .toLowerCase()
      .replace(/#/g, " unit ")
      .replace(/[^a-z0-9\s-]/g, " ")
      .split(/\s+/)
      .filter(Boolean)
      .map((token) => aliases[token] || token)
      .join(" ");
    return `${street}|${zipCode.trim().slice(0, 5)}`;
  };
  const upsertProperty = async (address, zipCode, encryptedAddress) => {
    const postalCode = zipCode.trim().slice(0, 5);
    if (!address.trim() || !/^\d{5}$/.test(postalCode)) return null;
    const addressKey = crypto.createHmac("sha256", key).update(normalizeAddress(address, postalCode), "utf8").digest("hex");
    const rows = await sql`
      INSERT INTO properties (address_key, street_address, postal_code, public_region)
      VALUES (${addressKey}, ${encryptedAddress}, ${postalCode}, ${`ZIP ${postalCode}`})
      ON CONFLICT (address_key) DO UPDATE SET address_key = EXCLUDED.address_key
      RETURNING id
    `;
    return rows[0]?.id ?? null;
  };
  const pending = await sql`SELECT id, email FROM assessments WHERE email IS NOT NULL AND email_lookup_hash IS NULL`;
  for (const row of pending) {
    try {
      const email = decrypt(row.email).trim().toLowerCase();
      const lookup = crypto.createHmac("sha256", key).update(email, "utf8").digest("hex");
      await sql`UPDATE assessments SET email_lookup_hash = ${lookup} WHERE id = ${row.id}`;
      backfilledEmailLookups++;
    } catch {
      // Leave unreadable legacy ciphertext unchanged; never log PII.
    }
  }

  const pendingAssessments = await sql`
    SELECT id, street_address, zip_code
    FROM assessments
    WHERE property_id IS NULL AND street_address IS NOT NULL AND street_address <> ''
  `;
  for (const row of pendingAssessments) {
    try {
      let address;
      let encryptedAddress = row.street_address;
      try {
        address = decrypt(row.street_address).trim();
      } catch {
        address = String(row.street_address).trim();
        encryptedAddress = encrypt(address);
      }
      const propertyId = await upsertProperty(address, String(row.zip_code), encryptedAddress);
      if (!propertyId) continue;
      await sql`UPDATE assessments SET property_id = ${propertyId} WHERE id = ${row.id}`;
      backfilledProperties++;
    } catch {
      // Skip malformed legacy addresses; never log the address or ciphertext.
    }
  }

  const linked = await sql`
    UPDATE property_ledger AS ledger
    SET property_id = assessment.property_id
    FROM assessments AS assessment
    WHERE ledger.assessment_id::text = assessment.id::text
      AND ledger.property_id IS NULL
      AND assessment.property_id IS NOT NULL
    RETURNING ledger.id
  `;
  linkedLedgerRecords += linked.length;

  const pendingRepairRecords = await sql`
    SELECT id, canonical_text
    FROM property_ledger
    WHERE property_id IS NULL AND record_type = 'repair'
  `;
  for (const row of pendingRepairRecords) {
    const match = String(row.canonical_text).match(/^Property:\s*(.+),\s*(\d{5}(?:-\d{4})?)\s*$/m);
    if (!match) continue;
    try {
      const propertyId = await upsertProperty(match[1].trim(), match[2], encrypt(match[1].trim()));
      if (!propertyId) continue;
      await sql`UPDATE property_ledger SET property_id = ${propertyId} WHERE id = ${row.id}`;
      linkedLedgerRecords++;
    } catch {
      // Skip malformed legacy records; never log canonical text because it contains PII.
    }
  }

  await sql`
    INSERT INTO property_relationships (property_id, user_id, relationship_type)
    SELECT DISTINCT property_id, customer_user_id,
      CASE WHEN customer_type = 'homeowner' THEN 'homeowner' ELSE 'managed_by' END
    FROM assessments
    WHERE property_id IS NOT NULL AND customer_user_id IS NOT NULL
    ON CONFLICT DO NOTHING
  `;
  await sql`
    INSERT INTO property_relationships (property_id, organization_id, relationship_type)
    SELECT DISTINCT property_id, organization_id,
      CASE WHEN customer_type = 'hoa' THEN 'hoa' ELSE 'managed_by' END
    FROM assessments
    WHERE property_id IS NOT NULL AND organization_id IS NOT NULL
    ON CONFLICT DO NOTHING
  `;
}

const tables = await sql`SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name`;
console.log(`Applied ${statements.length} statements. Backfilled ${backfilledEmailLookups} email lookups and ${backfilledProperties} property links; linked ${linkedLedgerRecords} ledger records. Public tables: ${tables.map((row) => row.table_name).join(", ")}`);
