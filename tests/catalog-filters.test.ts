import { describe, expect, it } from "vitest";
import { activeCatalogFilterLabels, buildCatalogHref, parseCatalogFilters } from "../src/lib/catalog-filters";

describe("catalog URL filters", () => {
  it("normalizes invalid pagination and keeps safe values", () => {
    const filters = parseCatalogFilters({ q: " 6205 ", page: "-5", pageSize: "999", sort: "unknown" });
    expect(filters).toMatchObject({ q: "6205", page: 1, pageSize: 50, sort: "relevance" });
  });

  it("parses dimensions and active labels", () => {
    const filters = parseCatalogFilters({ d: "25,5", D: "52", B: "15", brand: "DEMO EVEREST", demo: "true" });
    expect(filters).toMatchObject({ d: "25.5", D: "52", B: "15", demo: true });
    expect(activeCatalogFilterLabels(filters)).toContain("Только демонстрационные данные");
  });

  it("builds stable href without default noise", () => {
    const filters = parseCatalogFilters({ q: "6205", page: "2", sort: "name" });
    expect(buildCatalogHref(filters)).toBe("/catalog?q=6205&sort=name&page=2");
    expect(buildCatalogHref(filters, { page: 1, sort: "relevance" })).toBe("/catalog?q=6205");
  });
});
