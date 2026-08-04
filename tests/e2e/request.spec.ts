import { expect, test } from "@playwright/test";

const apiPayload = (idempotencyKey: string) => ({
  idempotencyKey,
  companyName: "ООО Тест",
  inn: "3525000000",
  contactName: "Иван Иванов",
  phone: "+7 900 000-00-00",
  email: "test@example.com",
  city: "Вологда",
  requiredDate: "",
  contactMethod: "email",
  paymentTerms: "Безналичная оплата",
  comment: "",
  consent: true,
  sourcePath: "/request",
  items: [{
    productSlug: "6205",
    designation: "6205",
    quantity: 10,
    unit: "шт",
    requiredDate: "",
    analogAllowed: false,
    comment: ""
  }]
});

test("request cart restores a selected product and submits in mock mode", async ({ page }) => {
  await page.goto("/request?product=6205");
  await expect(page.getByLabel("Обозначение").first()).toHaveValue("6205");
  await page.getByLabel("Компания").fill("ООО Тест");
  await page.getByLabel("ИНН").fill("3525000000");
  await page.getByLabel("Контактное лицо").fill("Иван Иванов");
  await page.getByLabel("Город поставки").fill("Вологда");
  await page.getByLabel("Телефон").fill("+7 900 000-00-00");
  await page.getByLabel("E-mail").fill("test@example.com");
  await page.getByText(/Согласен на обработку данных/i).click();
  await page.getByRole("button", { name: "Отправить заявку" }).click();

  await expect(page.getByRole("status")).toContainText("mock-режиме");
  await expect(page.getByRole("status")).toContainText(/MOCK-/);
  await expect(page.getByText("Позиций: 0.")).toBeVisible();
});

test("request API treats the same idempotency key as a duplicate", async ({ request }) => {
  const key = "550e8400-e29b-41d4-a716-446655440001";
  const first = await request.post("/api/request", { data: apiPayload(key) });
  expect(first.status()).toBe(202);
  expect((await first.json()).duplicate).toBe(false);

  const second = await request.post("/api/request", { data: apiPayload(key) });
  expect(second.status()).toBe(200);
  expect((await second.json()).duplicate).toBe(true);
});

test("request API rejects invalid INN", async ({ request }) => {
  const response = await request.post("/api/request", {
    data: { ...apiPayload("550e8400-e29b-41d4-a716-446655440002"), inn: "123" }
  });
  expect(response.status()).toBe(400);
  expect((await response.json()).fields.inn).toBeTruthy();
});
