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
  await expect(page.getByRole("heading", { name: "Prompt benchmarks" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Benchmarks", exact: true })).toHaveAttribute("href", /#prompt-benchmarks$/);
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
  const example = card.getByRole("group", { name: `Action example for ${insight.title}` });
  for (const step of insight.recommendation.example.steps) {
    await expect(example.getByText(step)).toBeHidden();
  }
  const snippet = insight.recommendation.example.snippet;
  if (snippet) {
    await expect(example.getByLabel(`${snippet.language} example`)).toBeHidden();
  }

  await card.getByText(insight.recommendation.example.title).click();
  for (const step of insight.recommendation.example.steps) {
    await expect(example.getByText(step)).toBeVisible();
  }
  if (snippet) {
    await expect(example.getByLabel(`${snippet.language} example`)).toBeVisible();
  }

  await card.getByText(insight.recommendation.example.title).click();
  for (const step of insight.recommendation.example.steps) {
    await expect(example.getByText(step)).toBeHidden();
  }
  if (snippet) {
    await expect(example.getByLabel(`${snippet.language} example`)).toBeHidden();
  }

  await card.getByRole("link", { name: "Investigate" }).click();
  await expect(page).toHaveURL(new RegExp(insight.recommendation.href.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
});
