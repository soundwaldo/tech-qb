import { neon } from "@neondatabase/serverless";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is required");
}

const sql = neon(process.env.DATABASE_URL);

const tables = await sql`
  SELECT table_name
  FROM information_schema.tables
  WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
  ORDER BY table_name
`;

console.log("TABLES");
for (const table of tables) {
  console.log(`- ${table.table_name}`);
}

const columns = await sql`
  SELECT table_name, column_name
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name IN ('assessments', 'profiles', 'organizations', 'contractors', 'property_ledger')
  ORDER BY table_name, ordinal_position
`;

console.log("\nCOLUMNS");
for (const column of columns) {
  console.log(`${column.table_name}.${column.column_name}`);
}
