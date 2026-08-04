import { describe, expect, it } from "vitest";
import { demoProducts } from "../src/data/demo-products";
import { filterCatalog, parseCatalogFilters, toCatalogQuery } from "../src/lib/catalog-filters";

describe("catalog filters", () => {
  it("parses valid URL parameters and defaults invalid page", () => {
    expect(parseCatalogFilters({ brand: "DEMO SKF", d: "25", page: "invalid" })).toMatchObject({
      brand: "DEMO SKF",
      d: 25,
      page: 1
    });
  });

  it("filters by brand and dimensions", () => {
    const filters = parseCatalogFilters({ brand: "DEMO SKF", d: "25", D: "52" });
    const results = filterCatalog(demoProducts, filters);
    expect(results.length).toBeGreaterThan(0);
    expect(results.every((product) => product.brand === "DEMO SKF" && product.d === 25 && product.D === 52)).toBe(true);
  });

  it("does not match missing dimensions as zero", () => {
    const filters = parseCatalogFilters({ d: "0" });
    expect(filterCatalog(demoProducts, filters)).toEqual([]);
  });

  it("serializes shareable filter state", () => {
    const filters = parseCatalogFilters({ brand: "DEMO SKF", d: "25", page: "2" });
    expect(toCatalogQuery(filters)).toContain("brand=DEMO+SKF");
    expect(toCatalogQuery(filters)).toContain("d=25");
    expect(toCatalogQuery(filters)).toContain("page=2");
  });
});
