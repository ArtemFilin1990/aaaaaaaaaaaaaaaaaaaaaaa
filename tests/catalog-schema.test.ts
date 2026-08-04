import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const schema = readFileSync(join(root, "prisma/schema.prisma"), "utf8");
const seed = readFileSync(join(root, "prisma/seed.mjs"), "utf8");

const requiredModels = [
  "Product",
  "ProductDesignation",
  "Brand",
  "Category",
  "ProductAttribute",
  "StandardMapping",
  "AnalogRelation",
  "AnalogEvidence",
  "TechnicalDocument",
  "SearchAlias",
  "ImportBatch",
  "ImportRow"
];

describe("canonical catalog schema", () => {
  it.each(requiredModels)("contains model %s", (modelName) => {
    expect(schema).toContain(`model ${modelName} {`);
  });

  it("keeps public prices out of Product", () => {
    const productBlock = schema.match(/model Product \{([\s\S]*?)\n\}/)?.[1] ?? "";
    expect(productBlock).not.toMatch(/\b(price|salePrice|retailPrice)\b/i);
  });

  it("supports only approved analog statuses and evidence levels", () => {
    for (const status of ["DIRECT", "ONE_WAY", "PARTIAL", "SIZE_ONLY", "NO_DIRECT", "CONFLICT"]) {
      expect(schema).toContain(status);
    }
    for (const level of ["A", "B", "C", "R"]) {
      expect(schema).toMatch(new RegExp(`\\n\\s+${level}\\n`));
    }
  });

  it("marks seed records as DEMO and uses idempotent upserts", () => {
    expect(seed).toContain('sourceStatus: "DEMO"');
    expect(seed).toContain("isDemo: true");
    expect(seed.match(/\.upsert\(/g)?.length ?? 0).toBeGreaterThan(5);
  });

  it.each(["6203", "6204", "6205", "6206", "6304", "6305", "6306", "30205", "30206", "30305", "NU205", "NJ205", "NU206", "7205", "7306"])(
    "contains DEMO series %s",
    (series) => {
      expect(seed).toContain(`\"${series}\"`);
    }
  );
});
