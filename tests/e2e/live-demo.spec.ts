import { expect, test, type Page } from "@playwright/test";

// Navigation contract for the sample-only Pre-Dispatch demo. The demo is the only
// hands-on way to see the widget product working, so the header, the homepage hero,
// and the footer must all reach it without hunting.

// Tailwind v4 emits oklch colors, so the computed value is painted onto a 1x1
// canvas to get comparable sRGB bytes instead of parsing the color string.
async function canvasLuminance(page: Page): Promise<number> {
    return page.evaluate(() => {
        const node = document.querySelector("main") ?? document.body;
        const probe = document.createElement("canvas");
        probe.width = 1;
        probe.height = 1;
        const context = probe.getContext("2d");
        if (!context) return 1;
        context.fillStyle = getComputedStyle(node).backgroundColor;
        context.fillRect(0, 0, 1, 1);
        const [r, g, b] = context.getImageData(0, 0, 1, 1).data;
        return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
    });
}

test("header, homepage hero, and footer all route to the live demo", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("header").getByRole("link", { name: "Live demo", exact: true })).toHaveAttribute("href", "/pre-dispatch/demo");
    await expect(page.locator("main").getByRole("link", { name: "Live demo", exact: true })).toBeVisible();
    await expect(page.getByRole("contentinfo").getByRole("link", { name: "Live Demo (sample data)" })).toHaveAttribute("href", "/pre-dispatch/demo");

    await page.locator("header").getByRole("link", { name: "Live demo", exact: true }).click();
    await expect(page).toHaveURL(/\/pre-dispatch\/demo$/);
    await expect(page.getByText("Sample data only")).toBeVisible();
});

test("mobile navigation keeps the live demo reachable", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");
    await page.getByRole("button", { name: "Toggle menu" }).click();
    const navigation = page.locator("#mobile-navigation");
    await expect(navigation.getByRole("link", { name: "Live demo", exact: true })).toHaveAttribute("href", "/pre-dispatch/demo");
});

for (const route of ["/", "/verify", "/records", "/properties", "/privacy", "/terms", "/pre-dispatch", "/pre-dispatch/demo"]) {
    test(`${route} renders on the dark site canvas`, async ({ page }) => {
        const response = await page.goto(route);
        expect(response?.status()).toBe(200);
        expect(await canvasLuminance(page)).toBeLessThan(0.2);
    });
}