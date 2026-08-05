import { describe, expect, it } from "vitest";
import { analogStatusLabels, analogWarnings, evidenceLabels } from "../src/lib/analogs";

describe("safe analog labels", () => {
  it("does not promote size-only relations to direct replacements", () => {
    expect(analogStatusLabels.SIZE_ONLY).toBe("Совпадение только по размерам");
    expect(analogWarnings("SIZE_ONLY").join(" ")).toContain("не подтверждает взаимозаменяемость");
  });

  it("describes evidence as levels rather than guarantees", () => {
    expect(evidenceLabels.A).toContain("уровень");
    expect(evidenceLabels.R).toContain("справочная");
  });
});
