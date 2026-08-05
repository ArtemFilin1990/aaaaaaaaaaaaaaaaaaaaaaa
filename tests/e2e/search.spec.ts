import { expect, test } from "@playwright/test";

test("PostgreSQL search result links to product card", async ({ page }) => {
  const errors: string[] = [];
  page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/search");
  await page.getByRole("textbox").fill("6205");
  await page.getByRole("button", { name: "Найти" }).click();
  await expect(page).toHaveURL(/\/search\?q=6205/);
  await expect(page.getByText(/Совпадение/).first()).toBeVisible();
  await page.getByRole("link", { name: /Открыть карточку/ }).first().click();
  await expect(page).toHaveURL(/\/product\//);
  await expect(page.getByText("Карточка из PostgreSQL")).toBeVisible();
  expect(errors).toEqual([]);
});

test("search empty, no results and dimension warning", async ({ page }) => {
  await page.goto("/search?q=not-existing-stage3-value");
  await expect(page.getByText("Совпадений нет")).toBeVisible();
  await page.goto("/search?q=15x42x10");
  await expect(page.getByText(/Совпадение по размерам/).first()).toBeVisible();
  await expect(page.getByText(/не подтверждает взаимозаменяемость/).first()).toBeVisible();
});
