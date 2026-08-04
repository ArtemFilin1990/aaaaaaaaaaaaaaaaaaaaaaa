import { expect, test } from "@playwright/test";

test("product page shows technical data without a public price", async ({ page }) => {
  await page.goto("/product/6205");
  await expect(page.getByRole("heading", { name: "6205", exact: true })).toBeVisible();
  await expect(page.getByText("Технические характеристики")).toBeVisible();
  await expect(page.getByText("25 мм", { exact: true }).first()).toBeVisible();
  await expect(page.locator("body")).not.toContainText("₽");
  await expect(page.getByText(/наличие и срок требуют подтверждения/i)).toBeVisible();
});

test("partial analog is not presented as a complete replacement", async ({ page }) => {
  await page.goto("/product/6205");
  await expect(page.getByText(/PARTIAL — частичное соответствие/i).first()).toBeVisible();
  await expect(page.getByText(/не является полной заменой/i).first()).toBeVisible();
  await expect(page.getByText(/доказательность R/i)).toBeVisible();
});

test("designation conflict is displayed as conflict", async ({ page }) => {
  await page.goto("/product/30205");
  await expect(page.getByText(/CONFLICT — конфликт данных или обозначений/i)).toBeVisible();
  await expect(page.getByText(/разные подшипники/i)).toBeVisible();
});

test("product without relations does not invent analogs", async ({ page }) => {
  await page.goto("/product/6205-2z");
  await expect(page.getByText(/Проверенные связи не добавлены/i)).toBeVisible();
});
