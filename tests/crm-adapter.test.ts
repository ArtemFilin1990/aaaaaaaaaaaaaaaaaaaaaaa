import { afterEach, describe, expect, it, vi } from "vitest";
import { DisabledCrmAdapter, getCrmAdapter } from "@/lib/integrations/crm/crm-adapter";

const payload = {
  idempotencyKey: "00000000-0000-4000-8000-000000000001",
  companyName: "ООО ДЕМО",
  inn: "1234567890",
  contactName: "Иван Иванов",
  phone: "+70000000000",
  email: "demo@example.com",
  city: "Вологда",
  contactMethod: "email" as const,
  paymentTerms: "",
  comment: "",
  consent: true,
  items: [{
    productSlug: "6205",
    designation: "6205",
    quantity: 1,
    unit: "шт",
    requiredDate: "",
    analogAllowed: false,
    comment: ""
  }]
};

afterEach(() => {
  delete process.env.CRM_MODE;
  vi.unstubAllGlobals();
});

describe("DisabledCrmAdapter", () => {
  it("does not enable CRM and does not call fetch", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const adapter = new DisabledCrmAdapter();

    expect(adapter.isEnabled()).toBe(false);
    await expect(adapter.submitRequest(payload)).resolves.toEqual({ status: "DISABLED", submitted: false });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("uses disabled mode by default", () => {
    expect(getCrmAdapter()).toBeInstanceOf(DisabledCrmAdapter);
  });

  it("rejects unknown CRM modes", () => {
    process.env.CRM_MODE = "bitrix24";
    expect(() => getCrmAdapter()).toThrow(/Unsupported CRM_MODE/);
  });
});
