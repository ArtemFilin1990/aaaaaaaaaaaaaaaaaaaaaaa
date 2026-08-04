import { expect, test } from "@playwright/test";

test("catalog stores filters in URL", async ({ page }) => {
  await page.goto("/catalog");
  await page.getByLabel("Бренд").selectOption({ label: "DEMO SKF" });
  await page.getByLabel("Внутренний диаметр d").fill("25");
  await page.getByRole("button", { name: "Применить" }).click();
  await expect(page).toHaveURL(/brand=DEMO(\+|%20)SKF/);
  await expect(page).toHaveURL(/d=25/);
  await expect(page.getByText(/Найдено позиций:/)).toBeVisible();
});

test("catalog does not publish prices", async ({ page }) => {
  await page.goto("/catalog");
  await expect(page.locator("body")).not.toContainText("₽");
  await expect(page.locator("body")).not.toContainText(/купить сейчас/i);
});

test("mobile catalog has no page-level horizontal overflow", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/catalog?d=25&D=52");
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
  await expect(page.getByText(/Найдено позиций:/)).toBeVisible();
});
