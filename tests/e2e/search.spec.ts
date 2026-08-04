import { expect, test } from "@playwright/test";

test("search explains a GOST result", async ({ page }) => {
  await page.goto("/search?q=205");
  await expect(page.getByRole("heading", { name: "6205", exact: true })).toBeVisible();
  await expect(page.getByText(/точное совпадение исходного обозначения/i)).toBeVisible();
});

test("search exposes ambiguity of 7205", async ({ page }) => {
  await page.goto("/search?q=7205");
  await expect(page.getByRole("heading", { name: "30205", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "7205", exact: true })).toBeVisible();
  await expect(page.getByText(/не путать с ГОСТ 7205/i)).toBeVisible();
});

test("dimension search shows a safety warning", async ({ page }) => {
  await page.goto("/search?q=25%C3%9752%C3%9715");
  await expect(page.getByText(/совпадение размеров не означает прямую взаимозаменяемость/i).first()).toBeVisible();
});
