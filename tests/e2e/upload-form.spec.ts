import { test, expect, type Page } from "@playwright/test";

async function completeStepOne(page: Page) {
  await page.getByLabel("Email").fill("test@example.com");
  await page.getByLabel("Street Address").fill("123 Main Street");
  await page.getByLabel("ZIP Code").fill("90210");
  await page.getByRole("button", { name: /Won't Open/i }).click();
  await expect(page.getByLabel("Email")).toHaveValue("test@example.com");
  await expect(page.getByLabel("ZIP Code")).toHaveValue("90210");
  await expect(page.getByRole("button", { name: /Won't Open/i })).toHaveAttribute("aria-pressed", "true");
}

test.describe("Upload Form Flow", () => {
  test.beforeEach(async ({ page }) => {
    const sessionReady = page.waitForResponse((response) => response.url().endsWith("/api/session/init"));
    await page.goto("/upload");
    await expect(page.getByText("Step 1: Your Property & Issues")).toBeVisible();
    await sessionReady;
  });

  test("fills property information and selects problems", async ({ page }) => {
    await completeStepOne(page);
    await page.getByRole("button", { name: /Loud Grinding/i }).click();
    await expect(page.getByRole("button", { name: /Continue/ })).toBeEnabled();
  });

  test("keeps continue disabled when required fields are absent", async ({ page }) => {
    await expect(page.getByRole("button", { name: /Continue/ })).toBeDisabled();
  });

  test("rejects invalid ZIP codes", async ({ page }) => {
    await page.getByLabel("Email").fill("test@example.com");
    await page.getByLabel("ZIP Code").fill("ABCDE");
    await page.getByRole("button", { name: /Won't Open/i }).click();
    await expect(page.getByText("Invalid ZIP")).toBeVisible();
    await expect(page.getByRole("button", { name: /Continue/ })).toBeDisabled();
  });

  test("requires at least one problem", async ({ page }) => {
    await page.getByLabel("Email").fill("test@example.com");
    await page.getByLabel("ZIP Code").fill("90210");
    await expect(page.getByRole("button", { name: /Continue/ })).toBeDisabled();
  });

  test("advances to the evidence step", async ({ page }) => {
    await completeStepOne(page);
    await page.getByRole("button", { name: "Continue to Photos & Video" }).click();
    await expect(page.getByText("Step 2: Upload Photos & Video")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Garage-door opener" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Spring area — skip if unsafe" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Full door and tracks" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Close-up of the issue" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Short operation video" })).toBeVisible();
    await expect(page.locator('input[type="file"]')).toHaveCount(6);
    await expect(page.getByRole("button", { name: "Continue to Review" })).toBeDisabled();
  });

  test("uses readable details and door-card contrast", async ({ page }) => {
    const details = page.getByLabel("Additional details");
    await expect(details).toHaveClass(/text-slate-950/);
    await expect(page.getByRole("button", { name: "Single Door" })).toHaveClass(/text-slate-950/);
    await expect(page.getByRole("button", { name: "Double Door" })).toHaveClass(/text-slate-900/);
  });

  test("enables review after any one safe photo", async ({ page }) => {
    let uploadNumber = 0;
    await page.route("**/api/uploads/presign", async (route) => {
      uploadNumber += 1;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          uploadUrl: "/api/upload/mock?guided=1",
          storageKey: `uploads/test-session/photo/${uploadNumber}-evidence.jpg`,
        }),
      });
    });
    await completeStepOne(page);
    await page.getByRole("button", { name: "Continue to Photos & Video" }).click();
    const onePixelPng = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=", "base64");
    await page.getByLabel("Add full door and tracks photo").setInputFiles({ name: "evidence.png", mimeType: "image/png", buffer: onePixelPng });
    await expect(page.getByText(/Uploaded:/).last()).toBeVisible();
    await expect(page.getByRole("button", { name: "Continue to Review" })).toBeEnabled();
  });

  test("recommends the hung door and opener without blocking payment", async ({ page }) => {
    await page.getByLabel("Email").fill("test@example.com");
    await page.getByLabel("Street Address").fill("123 Main Street");
    await page.getByLabel("ZIP Code").fill("90210");
    await page.getByRole("button", { name: /Uneven Door/i }).click();
    await page.getByRole("button", { name: "Continue to Photos & Video" }).click();

    await expect(page.getByRole("heading", { name: "Hung or uneven door" })).toBeVisible();
    await expect(page.getByText(/we may email you to request a photo of a specific area/i)).toBeVisible();
    await expect(page.getByText("Recommended", { exact: true })).toHaveCount(2);
    await expect(page.getByRole("heading", { name: "Spring area — skip if unsafe" })).toBeVisible();
    await expect(page.getByText("Spring photos are never required.")).toBeVisible();
    await expect(page.getByLabel("Add short operation video video")).toHaveCount(0);

    const onePixelPng = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=", "base64");
    await page.route("**/api/uploads/presign", (route) => route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ uploadUrl: "/api/upload/mock?guided=1", storageKey: "uploads/test-session/photo/hung-door.jpg" }),
    }));
    await page.getByLabel("Add hung or uneven door photo").setInputFiles({ name: "door.png", mimeType: "image/png", buffer: onePixelPng });
    await expect(page.getByRole("button", { name: "Continue to Review" })).toBeEnabled();
  });

  test("shows photo and video actions on mobile", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await completeStepOne(page);
    await page.getByRole("button", { name: "Continue to Photos & Video" }).click();
    await expect(page.getByLabel("Add garage-door opener photo")).toBeAttached();
    await expect(page.getByLabel("Add spring area — skip if unsafe photo")).toBeAttached();
    await expect(page.getByLabel("Add full door and tracks photo")).toBeAttached();
    await expect(page.getByLabel("Add short operation video video")).toBeAttached();
    await expect(page.getByText("Photograph safely and protect your privacy")).toBeVisible();
  });
});
