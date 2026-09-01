import { expect, test } from "@playwright/test";

test("shows analytics across all providers and models by default", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Repository context, made visible." })).toBeVisible();
  await expect(page.getByRole("combobox", { name: "Provider" })).toContainText("All providers");
  await expect(page.getByRole("combobox", { name: "Analysis model" })).toContainText("All models");
  await expect(page.getByRole("heading", { name: "Action centre" })).toBeVisible();
});

test("surfaces repository actions and diagnostic navigation", async ({ page }) => {
  await page.goto("/");
  const repository = page.getByRole("grid", { name: "Repositories" }).getByRole("link", { name: "tokenlens", exact: true });
  await repository.click();
  await expect(page.getByRole("heading", { name: "Recommended actions" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Insights" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Hotspots" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Model comparisons" })).toBeVisible();
});

test("shows a complete actionable example and links to its evidence", async ({ page, request }) => {
  const response = await request.get("/api/insights");
  expect(response.ok()).toBeTruthy();
  const payload = await response.json();
  const insight = payload.insights[0];
  expect(insight?.recommendation?.example?.steps.length).toBeGreaterThanOrEqual(3);
  expect(insight?.recommendation?.href).toBeTruthy();

  await page.goto(`/repos/${insight.scope.repositoryId}/insights`);
  const card = page.getByRole("alert").filter({ hasText: insight.title });
  await expect(card.getByText("Illustrative example")).toBeVisible();
  await expect(card.getByText(insight.recommendation.example.steps[0])).toBeVisible();
  await card.getByText("Show complete example").click();
  await expect(card.getByText(insight.recommendation.example.steps[1])).toBeVisible();

  await card.getByRole("link", { name: "Investigate" }).click();
  await expect(page).toHaveURL(new RegExp(insight.recommendation.href.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
});
