import { describe, expect, it } from "vitest";
import { InMemoryCatalogRepository } from "../src/lib/repositories/in-memory-catalog-repository";

const repository = new InMemoryCatalogRepository();

describe("analog safety", () => {
  it("keeps direct and partial relations separate", async () => {
    const analogs = await repository.getAnalogs("6205");
    expect(analogs.some((analog) => analog.status === "DIRECT" && analog.evidenceLevel === "B")).toBe(true);
    expect(analogs.some((analog) => analog.status === "PARTIAL" && Boolean(analog.warning))).toBe(true);
  });

  it("represents 7205 ambiguity as conflict rather than replacement", async () => {
    const analogs = await repository.getAnalogs("30205");
    expect(analogs).toHaveLength(1);
    expect(analogs[0]).toMatchObject({ status: "CONFLICT", evidenceLevel: "A" });
    expect(analogs[0]?.warning).toMatch(/разные подшипники/i);
  });

  it("returns no invented analogs for products without relations", async () => {
    expect(await repository.getAnalogs("6205-2z")).toEqual([]);
  });
});
