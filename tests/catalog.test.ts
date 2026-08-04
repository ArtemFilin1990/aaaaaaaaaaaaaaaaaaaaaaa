import { describe, expect, it } from "vitest";
import { normalizeDesignation, searchBearings } from "../src/lib/catalog";

describe("catalog search", () => {
  it("normalizes separators and case", () => {
    expect(normalizeDesignation(" 6205 2rs c3 ")).toBe("6205-2RS-C3");
  });

  it.each([
    ["205", "6205"],
    ["80205", "6205-2Z"],
    ["180205", "6205-2RS"],
    ["70-205", "6205/C3"],
    ["7205", "30205"]
  ])("finds %s as %s", (query, expected) => {
    expect(searchBearings(query)[0]?.iso).toBe(expected);
  });
});
