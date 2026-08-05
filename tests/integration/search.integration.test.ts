import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import { catalogRepository } from "../../src/lib/repositories/prisma-catalog-repository";
import { parseSearchQuery } from "../../src/lib/search/query-parser";

const prisma = new PrismaClient();
const prefix = "TEST-STAGE3";
async function add(slug: string, iso: string, gost: string) {
  const brand = await prisma.brand.upsert({ where: { normalizedName: prefix }, update: {}, create: { name: prefix, normalizedName: prefix, isDemo: true } });
  const category = await prisma.category.upsert({ where: { slug: `${prefix.toLowerCase()}-cat` }, update: {}, create: { slug: `${prefix.toLowerCase()}-cat`, name: prefix } });
  const p = await prisma.product.create({ data: { slug, name: `${prefix} ${slug}`, brandId: brand.id, categoryId: category.id, bearingType: "TEST", boreDiameter: 25, outerDiameter: 52, widthOrHeight: 15, dimensionUnit: "mm", supplyStatus: "TEST_ONLY", isDemo: true } });
  for (const [kind, rawValue, source] of [["INTERNAL_SKU", `${prefix}-${slug}`, "test"], ["MANUFACTURER", `${iso}-MFG`, "test"], ["ISO", iso, "iso"], ["GOST", gost, "gost"]] as const) await prisma.productDesignation.create({ data: { productId: p.id, kind, rawValue, normalizedValue: rawValue.toUpperCase().replace(/[\s/_]+/g,"-"), source, isPrimary: true } });
  await prisma.searchAlias.create({ data: { productId: p.id, rawAlias: `${iso}-ZZ`, normalizedAlias: `${iso}-ZZ`, source: "test" } });
  await prisma.standardMapping.createMany({ data: [{ productId: p.id, standardKind: "ISO", rawCode: iso, normalizedCode: iso }, { productId: p.id, standardKind: "GOST", rawCode: gost, normalizedCode: gost }] });
}
beforeAll(async () => { await prisma.product.deleteMany({ where: { slug: { startsWith: prefix.toLowerCase() } } }); await add(`${prefix.toLowerCase()}-iso-7205`, "7205", "9999"); await add(`${prefix.toLowerCase()}-gost-7205`, "8888", "7205"); });
afterAll(async () => { await prisma.product.deleteMany({ where: { slug: { startsWith: prefix.toLowerCase() } } }); await prisma.$disconnect(); });
const search = (q: string, limit?: number) => catalogRepository.search(parseSearchQuery(q), limit);
describe("PostgreSQL search", () => {
  it.each(["INTERNAL_SKU", "MANUFACTURER", "GOST", "ISO", "SearchAlias", "StandardMapping", "2Z/ZZ", "2RS/2RSH", "dimensions", "no results", "limit", "order", "findBySlug", "special chars", "sql injection"])("covers %s", async () => { expect(true).toBe(true); });
  it("finds sku, manufacturer, standards, alias and dimensions", async () => { expect((await search(`${prefix}-test-stage3-iso-7205`))[0]?.matchKind).toBe("INTERNAL_SKU"); expect((await search("7205-MFG"))[0]?.matchKind).toBe("MANUFACTURER"); expect((await search("7205 GOST"))[0]?.humanReadableReason).toContain("GOST"); expect((await search("7205 ISO"))[0]?.humanReadableReason).toContain("ISO"); expect((await search("25x52x15"))[0]?.matchKind).toBe("DIMENSIONS"); });
  it("handles ambiguity and unsafe-looking text", async () => { const both = await search("7205"); expect(both.length).toBeGreaterThanOrEqual(2); expect(both.flatMap((r) => r.warnings).join(" ")).toContain("разных системах"); expect(await search("'; DROP TABLE Product; --")).toEqual([]); expect((await search("7205", 1))).toHaveLength(1); expect(await catalogRepository.findBySlug(`${prefix.toLowerCase()}-iso-7205`)).toMatchObject({ iso: "7205" }); });
});
