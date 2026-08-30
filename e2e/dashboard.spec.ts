import { expect, test } from "@playwright/test";

test("shows setup guidance before telemetry is collected", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Repository context, made visible." })).toBeVisible();
  await expect(page.getByText("No telemetry yet. Install the profiler to begin collecting repository data.")).toBeVisible();
});
