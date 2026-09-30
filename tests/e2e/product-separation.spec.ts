import { expect, test } from "@playwright/test";

test("homepage distinguishes products and routes to separate pricing", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "GGuard Diagnostics", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "GGuard Pre-Dispatch", exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "Assessment pricing", exact: true }).first()).toHaveAttribute("href", "/diagnostics#pricing");
  await expect(page.getByRole("link", { name: "Widget subscription pricing", exact: true }).first()).toHaveAttribute("href", "/pre-dispatch#pricing");
  await page.getByRole("link", { name: "Explore Diagnostics", exact: true }).click();
  await expect(page).toHaveURL(/\/diagnostics$/);
  await expect(page.getByRole("heading", { name: "Get Your Diagnostic Report" })).toBeVisible();
  await expect(page.locator("main")).not.toContainText("$149/month");
  await expect(page.locator('a[href="/upload?tier=standard"]')).toBeVisible();
});

test("widget page identifies its purchase as a separate subscription", async ({ page }) => {
  await page.goto("/pre-dispatch");
  await expect(page.getByText("For contractor websites: GGuard Pre-Dispatch.", { exact: true })).toBeVisible();
  await expect(page.locator("#pricing")).toContainText("not a bundle of diagnostic report credits");
  await expect(page.getByRole("link", { name: "Start widget onboarding" })).toHaveAttribute("href", "/pre-dispatch/get-started");
});

test("mobile navigation offers both products without horizontal overflow", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.getByRole("button", { name: "Toggle menu" }).click();
  const navigation = page.locator("#mobile-navigation");
  await expect(navigation.getByRole("link", { name: "Diagnostics", exact: true })).toBeVisible();
  await expect(navigation.getByRole("link", { name: "Contractor Widget", exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});
