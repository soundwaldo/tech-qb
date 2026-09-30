import { defineConfig } from "@playwright/test";

// Database-free domain/static checks. These do not replace browser acceptance.
export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: ["pre-dispatch.spec.ts", "broker.spec.ts"],
  grepInvert: /Pre-Dispatch public experience/,
  reporter: "list",
  workers: 1,
});
