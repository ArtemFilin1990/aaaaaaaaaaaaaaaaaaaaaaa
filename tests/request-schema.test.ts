import { describe, expect, it } from "vitest";
import { commercialRequestSchema } from "../src/lib/request/schema";

const validPayload = {
  idempotencyKey: "550e8400-e29b-41d4-a716-446655440000",
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
};

describe("commercial request validation", () => {
  it("accepts a complete B2B request", () => {
    expect(commercialRequestSchema.safeParse(validPayload).success).toBe(true);
  });

  it.each(["123", "12345678901", "1234567890123"])("rejects invalid INN %s", (inn) => {
    expect(commercialRequestSchema.safeParse({ ...validPayload, inn }).success).toBe(false);
  });

  it("requires at least one product item", () => {
    expect(commercialRequestSchema.safeParse({ ...validPayload, items: [] }).success).toBe(false);
  });

  it("requires explicit consent", () => {
    expect(commercialRequestSchema.safeParse({ ...validPayload, consent: false }).success).toBe(false);
  });

  it("rejects zero quantity", () => {
    expect(commercialRequestSchema.safeParse({
      ...validPayload,
      items: [{ ...validPayload.items[0], quantity: 0 }]
    }).success).toBe(false);
  });
});
