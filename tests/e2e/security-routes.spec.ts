import { expect, test } from "@playwright/test";

test.describe("public recovery and security routes", () => {
  test("customer authentication renders and preserves the return path", async ({ page }) => {
    await page.goto("/auth/sign-in?next=/portal/dashboard");

    await expect(page).toHaveURL(/\/auth\/sign-in\?next=%2Fportal%2Fdashboard|\/auth\/sign-in\?next=\/portal\/dashboard/);
    await expect(page.getByRole("heading", { name: /sign in to your portal/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /create one/i })).toHaveAttribute(
      "href",
      /next=%2Fportal%2Fdashboard/
    );
    await expect(page.getByRole("link", { name: /forgot password/i })).toHaveAttribute(
      "href",
      /\/auth\/forgot-password\?next=%2Fportal%2Fdashboard/
    );
  });

  test("password recovery renders and preserves the return path", async ({ page }) => {
    await page.goto("/auth/forgot-password?next=/portal/dashboard");

    await expect(page.getByRole("heading", { name: /reset your password/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /send reset link/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /back to sign in/i })).toHaveAttribute(
      "href",
      /next=%2Fportal%2Fdashboard/
    );
  });

  for (const route of ["/verify", "/records", "/properties", "/privacy", "/terms"]) {
    test(`${route} renders`, async ({ page }) => {
      const response = await page.goto(route);
      expect(response?.status()).toBe(200);
      await expect(page.locator("body")).not.toBeEmpty();
    });
  }

  test("unknown customer email receives a private generic response", async ({ request }) => {
    const response = await request.post("/api/records/email-access", {
      data: { email: `no-record-${Date.now()}@example.com` },
    });

    expect(response.status()).toBe(202);
    await expect(response.json()).resolves.toMatchObject({
      message: "If completed records match that email, private links will arrive shortly.",
    });
  });

  test("repair submissions require an attributable account", async ({ request }) => {
    const response = await request.post("/api/ledger/repair", { data: {} });
    expect(response.status()).toBe(401);
  });

  test("property lookup validates input without creating a public record", async ({ request }) => {
    const invalid = await request.post("/api/properties/lookup", {
      data: { address: "1", zipCode: "x" },
    });
    expect(invalid.status()).toBe(400);

    const unknown = await request.post("/api/properties/lookup", {
      data: { address: `999999 Never Created ${Date.now()} Street`, zipCode: "85001" },
    });
    expect(unknown.status()).toBe(404);
    const body = await unknown.json();
    expect(body).not.toHaveProperty("propertyId");
    expect(body).not.toHaveProperty("address");
  });

  test("legacy public repair lookup no longer returns ledger contents", async ({ request }) => {
    const response = await request.get("/api/ledger/repair?address=123%20Example%20St&zip=85001");
    expect(response.status()).toBe(410);
    const body = await response.json();
    expect(body).not.toHaveProperty("records");
    expect(JSON.stringify(body)).not.toContain("canonical_text");
  });

  test("unknown property UUID is not disclosed", async ({ request }) => {
    const response = await request.get("/properties/00000000-0000-4000-8000-000000000000");
    expect(response.status()).toBe(404);
  });
});
