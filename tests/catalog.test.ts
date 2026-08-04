import { describe, expect, it } from "vitest";
import { normalizeDesignation, searchBearingResults, searchBearings } from "../src/lib/catalog";
import { analyzeSearchQuery } from "../src/lib/search/normalization";

describe("bearing search normalization", () => {
  it.each([
    [" 6205 2rs c3 ", "6205-2RS-C3"],
    ["6205/2RS/C3", "6205-2RS-C3"],
    ["6205-2RSH-C3", "6205-2RS-C3"],
    ["6205 zz", "6205-2Z"],
    ["70-205", "70-205"]
  ])("normalizes %s", (input, expected) => {
    expect(normalizeDesignation(input)).toBe(expected);
  });

  it.each(["25×52×15", "25x52x15", "25 52 15"])("extracts dimensions from %s", (input) => {
    expect(analyzeSearchQuery(input).dimensions).toEqual({ d: 25, D: 52, B: 15 });
  });
});

describe("bearing search ranking", () => {
  it.each([
    ["205", "6205"],
    ["80205", "6205-2Z"],
    ["180205", "6205-2RS"],
    ["70-205", "6205/C3"],
    ["6205 2RS C3", "6205-2RS/C3"]
  ])("finds %s as %s", (query, expected) => {
    expect(searchBearings(query)[0]?.iso).toBe(expected);
  });

  it("returns both meanings of ambiguous 7205", () => {
    const results = searchBearingResults("7205");
    expect(results.map((item) => item.product.iso)).toEqual(expect.arrayContaining(["30205", "7205"]));
    expect(results.some((item) => item.product.iso === "30205" && item.product.gost === "7205")).toBe(true);
  });

  it("explains dimension matches without declaring an analog", () => {
    const result = searchBearingResults("25×52×15")[0];
    expect(result?.matchKind).toBe("DIMENSIONS");
    expect(result?.technicalWarning).toMatch(/не означает прямую взаимозаменяемость/i);
  });

  it("returns an empty list for an unknown designation", () => {
    expect(searchBearingResults("NOT-A-BEARING")).toEqual([]);
  });
});
