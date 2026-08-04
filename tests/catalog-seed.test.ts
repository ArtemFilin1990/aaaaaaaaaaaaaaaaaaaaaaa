import { describe, expect, it } from "vitest";

interface DemoSeedProduct {
  slug: string;
  internalSku: string;
  manufacturerDesignation: string;
  gost: string;
  iso: string;
}

interface SeedModule {
  normalizeDesignation(value: string): string;
  buildDemoCatalogSeed(): { products: DemoSeedProduct[] };
}

async function loadSeed(): Promise<SeedModule> {
  return (await import("../prisma/seed-data.mjs")) as unknown as SeedModule;
}

describe("catalog seed data", () => {
  it("contains at least 30 uniquely identified demo products", async () => {
    const { buildDemoCatalogSeed } = await loadSeed();
    const seed = buildDemoCatalogSeed();
    expect(seed.products).toHaveLength(30);
    expect(new Set(seed.products.map((item) => item.slug)).size).toBe(seed.products.length);
    expect(new Set(seed.products.map((item) => item.internalSku)).size).toBe(seed.products.length);
    expect(new Set(seed.products.map((item) => item.iso)).size).toBe(seed.products.length);
  });

  it("is deterministic for repeatable idempotent upserts", async () => {
    const { buildDemoCatalogSeed } = await loadSeed();
    expect(buildDemoCatalogSeed()).toStrictEqual(buildDemoCatalogSeed());
  });

  it("keeps GOST, ISO, internal SKU, and manufacturer designations separate", async () => {
    const { buildDemoCatalogSeed, normalizeDesignation } = await loadSeed();
    for (const product of buildDemoCatalogSeed().products) {
      const normalized = [product.internalSku, product.manufacturerDesignation, product.gost, product.iso].map(normalizeDesignation);
      expect(new Set(normalized).size).toBe(4);
    }
  });
});
