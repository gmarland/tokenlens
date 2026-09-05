import { expect, test } from "@playwright/test";

test("explains the product and its privacy model on the public homepage", async ({ page }) => {
  await page.context().clearCookies();
  const pageErrors: Error[] = [];
  page.on("pageerror", (error) => pageErrors.push(error));
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "See what your coding agents spend their context on." })).toBeVisible();
  await expect(page.getByText("Claude Code + Codex · Local repository analysis")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Understand the system without reading the work." })).toBeVisible();
  await expect(page.getByText("TokenLens does collect prompt text", { exact: false })).toBeVisible();
  await expect(page.getByRole("link", { name: "Sign in" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Open account menu" })).toHaveCount(0);
  expect(pageErrors).toEqual([]);
});

test("keeps anonymous users out of application pages and APIs", async ({ page }) => {
  await page.context().clearCookies();
  await page.goto("/dashboard?provider=codex");
  await expect(page).toHaveURL(/\/login\?callbackUrl=%2Fdashboard%3Fprovider%3Dcodex$/);
  await expect(page.getByRole("heading", { name: "Sign in to TokenLens" })).toBeVisible();

  const response = await page.request.get("/api/repositories");
  expect(response.status()).toBe(401);
  await expect(response.json()).resolves.toEqual({ error: "unauthorized" });
});

test("shows analytics across all providers and models by default", async ({ page }) => {
  await page.goto("/dashboard");
  await expect(page.getByRole("button", { name: "Open account menu" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Start measuring" })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Repository context, made visible." })).toBeVisible();
  await expect(page.getByRole("combobox", { name: "Provider" })).toContainText("All providers");
  await expect(page.getByRole("combobox", { name: "Analysis model" })).toContainText("All models");
  await expect(page.getByRole("heading", { name: "Action centre" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Developers" })).toBeVisible();
  await expect(page.getByRole("grid", { name: "Developers" })).toBeVisible();
  await expect(page.getByRole("alert").first().getByText("Source repository")).toBeVisible();
});

test("surfaces repository actions and diagnostic navigation", async ({ page }) => {
  await page.goto("/dashboard");
  const repository = page.getByRole("grid", { name: "Repositories" }).getByRole("link", { name: "tokenlens", exact: true });
  await repository.click();
  await expect(page.getByRole("grid", { name: "Developers" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Recommended actions" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Prompt benchmarks" })).toBeHidden();
  await expect(page.getByRole("tab", { name: "Overview" })).toHaveAttribute("aria-selected", "true");
  await expect(page.getByRole("tab", { name: "Insights" })).toHaveCount(0);
  await expect(page.getByRole("tab", { name: "Hotspots" })).toBeVisible();
  await expect(page.getByRole("tab", { name: "Model comparisons" })).toBeVisible();

  const repositoryUrl = new URL(page.url());
  await page.getByRole("tab", { name: "Benchmarks" }).click();
  await expect(page).toHaveURL(new URL(`${repositoryUrl.pathname}/benchmarks`, repositoryUrl).toString());
  await expect(page.getByRole("tab", { name: "Benchmarks" })).toHaveAttribute("aria-selected", "true");
  await expect(page.getByText("Repeatable observations", { exact: true })).toBeVisible();

  await page.getByRole("tab", { name: "Agent behaviour" }).click();
  await expect(page).toHaveURL(new URL(`${repositoryUrl.pathname}/behaviour`, repositoryUrl).toString());
  await expect(page.getByRole("heading", { name: "Observed relationships" })).toBeVisible();

  await page.getByRole("tab", { name: "Structure" }).click();
  await expect(page).toHaveURL(new URL(`${repositoryUrl.pathname}/structure`, repositoryUrl).toString());
  await expect(page.getByRole("heading", { name: "Current structure" })).toBeVisible();
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
