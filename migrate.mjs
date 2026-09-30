import { spawnSync } from "node:child_process";

console.warn("migrate.mjs is a compatibility wrapper. Prefer: npm run db:migrate");
const result = spawnSync(
  process.execPath,
  ["--env-file=.env.local", "scripts/migrate-neon.mjs"],
  { stdio: "inherit" }
);

if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
