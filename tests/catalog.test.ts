import { describe, expect, it } from "vitest";
import { normalizeDesignation } from "../src/lib/search/normalization";
import { parseSearchQuery } from "../src/lib/search/query-parser";
import { sortSearchResults } from "../src/lib/search/ranking";
import type { SearchResult } from "../src/lib/search/types";

const product = (slug: string) => ({ id: slug, slug, name: slug, brand: null, category: null, bearingType: "test", internalSku: null, manufacturerDesignation: null, gost: null, iso: null, boreDiameter: "25", outerDiameter: "52", widthOrHeight: "15", dimensionUnit: "mm", seal: null, clearance: null, precision: null, supplyStatus: "TEST", isDemo: true });

describe("designation normalization", () => {
  it.each([
    [" 6205 2rs c3 ", "6205-2RS-C3"], ["6205/2Z", "6205-2Z"], ["6205_2z", "6205-2Z"], ["6205---2Z", "6205-2Z"], ["25 × 52 × 15", "25X52X15"], ["25 х 52 х 15", "25X52X15"], ["", ""],
  ])("normalizes %s", (input, expected) => expect(normalizeDesignation(input)).toBe(expected));
  it("limits overlong strings and preserves raw query separately", () => { const raw = ` ${"a".repeat(140)} `; const parsed = parseSearchQuery(raw); expect(parsed.rawQuery).toBe(raw); expect(parsed.normalizedQuery.length).toBeLessThanOrEqual(128); expect(parsed.isTooLong).toBe(true); });
  it("parses GOST and ISO intents", () => { expect(parseSearchQuery(" ГОСТ 7205 ").parsedIntent).toMatchObject({ type: "DESIGNATION", standard: "GOST", value: "7205" }); expect(parseSearchQuery("7205 ISO").parsedIntent).toMatchObject({ type: "DESIGNATION", standard: "ISO", value: "7205" }); });
  it("parses dimensions and decimal comma", () => { expect(parseSearchQuery("25,5 × 52 × 15").parsedIntent).toMatchObject({ type: "DIMENSIONS", boreDiameter: "25.5", outerDiameter: "52", widthOrHeight: "15" }); });
  it("generates safe suffix variants", () => { expect(parseSearchQuery("6205-2Z").generatedVariants).toContain("6205-ZZ"); expect(parseSearchQuery("6205-2RS").generatedVariants).toContain("6205-2RSH"); });
});

describe("search ranking", () => {
  it("is stable and uses slug tie-breaker", () => {
    const mk = (slug: string): SearchResult => ({ product: product(slug), score: 100, matchKind: "PARTIAL", matchedRawValue: "x", matchedNormalizedValue: "X", humanReadableReason: "Частичное совпадение", warnings: [], isPrimary: false });
    expect(sortSearchResults([mk("b"), mk("a")]).map((r) => r.product.slug)).toEqual(["a", "b"]);
  });
  it("does not assign analog status", () => { const keys = Object.keys(sortSearchResults([])); expect(keys).not.toContain("analogStatus"); });
});
