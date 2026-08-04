import { expect, test } from "@playwright/test";

test("home page and search are available", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /Подшипники и комплектующие/ })).toBeVisible();
  await page.getByLabel("Обозначение или размеры").fill("205");
  await page.getByRole("button", { name: "Найти подшипник" }).click();
  await expect(page).toHaveURL(/search\?q=205/);
  await expect(page.getByText("6205", { exact: true }).first()).toBeVisible();
});
