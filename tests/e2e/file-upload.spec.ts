import { test, expect } from "@playwright/test";

test.describe("File Upload Security", () => {
  test("rejects direct Blob upload without a session", async ({ page }) => {
    const response = await page.request.put("/api/upload/blob?key=uploads/attacker/photo/test.jpg&type=image/jpeg", { data: Buffer.from([0xff, 0xd8, 0xff, 0x00]) });
    expect(response.status()).toBe(401);
  });

  test("exposes constrained evidence inputs on step two", async ({ page }) => {
    await page.goto("/upload");
    await page.getByLabel("Email").fill("test@example.com");
    await page.getByLabel("Street Address").fill("123 Main Street");
    await page.getByLabel("ZIP Code").fill("90210");
    await page.getByRole("button", { name: /Won't Open/i }).click();
    await page.getByRole("button", { name: "Continue to Photos & Video" }).click();
    const inputs = page.locator('input[type="file"]');
    await expect(inputs).toHaveCount(6);
    await expect(inputs.first()).toHaveAttribute("accept", /image\/jpeg/);
    await expect(inputs.first()).toHaveAttribute("data-max-size", String(75 * 1024 * 1024));
    await expect(inputs.nth(4)).toHaveAttribute("accept", /video\/mp4/);
    await expect(inputs.nth(5)).toHaveAttribute("accept", /\.pdf/);
  });
});
