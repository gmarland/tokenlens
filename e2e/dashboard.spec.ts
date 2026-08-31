import { expect, test } from "@playwright/test";

test("shows analytics across all providers and models by default", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Repository context, made visible." })).toBeVisible();
  await expect(page.getByRole("combobox", { name: "Provider" })).toContainText("All providers");
  await expect(page.getByRole("combobox", { name: "Analysis model" })).toContainText("All models");
});
