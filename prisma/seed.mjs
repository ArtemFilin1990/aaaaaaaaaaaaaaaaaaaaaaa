import { PrismaClient } from "@prisma/client";
import { buildDemoCatalogSeed, normalizeDesignation } from "./seed-data.mjs";

const prisma = new PrismaClient();

async function upsertProduct(item) {
  const brand = await prisma.brand.upsert({
    where: { normalizedName: normalizeDesignation(item.brandName) },
    update: { name: item.brandName },
    create: { name: item.brandName, normalizedName: normalizeDesignation(item.brandName), countryCode: "RU" },
  });
  const category = await prisma.category.upsert({
    where: { slug: item.categorySlug },
    update: { name: item.categoryName },
    create: { slug: item.categorySlug, name: item.categoryName },
  });
  const product = await prisma.product.upsert({
    where: { slug: item.slug },
    update: { name: item.name, brandId: brand.id, categoryId: category.id, bearingType: item.bearingType, boreDiameter: item.boreDiameter, outerDiameter: item.outerDiameter, widthOrHeight: item.widthOrHeight, dimensionUnit: "mm", massKg: item.massKg, clearance: item.clearance, precision: item.precision, seal: item.seal, cage: item.cage, materials: item.materials, dynamicLoadRating: item.dynamicLoadRating, staticLoadRating: item.staticLoadRating, limitingSpeedRpm: item.limitingSpeedRpm, referenceSpeedRpm: item.referenceSpeedRpm, temperatureMinC: item.temperatureMinC, temperatureMaxC: item.temperatureMaxC, supplyStatus: item.supplyStatus },
    create: { slug: item.slug, name: item.name, brandId: brand.id, categoryId: category.id, bearingType: item.bearingType, boreDiameter: item.boreDiameter, outerDiameter: item.outerDiameter, widthOrHeight: item.widthOrHeight, dimensionUnit: "mm", massKg: item.massKg, clearance: item.clearance, precision: item.precision, seal: item.seal, cage: item.cage, materials: item.materials, dynamicLoadRating: item.dynamicLoadRating, staticLoadRating: item.staticLoadRating, limitingSpeedRpm: item.limitingSpeedRpm, referenceSpeedRpm: item.referenceSpeedRpm, temperatureMinC: item.temperatureMinC, temperatureMaxC: item.temperatureMaxC, supplyStatus: item.supplyStatus },
  });
  const designations = [
    ["INTERNAL_SKU", item.internalSku, "everest", true],
    ["MANUFACTURER", item.manufacturerDesignation, item.brandName, true],
    ["GOST", item.gost, "gost", true],
    ["ISO", item.iso, "iso", true],
  ];
  for (const [kind, rawValue, source, isPrimary] of designations) {
    await prisma.productDesignation.upsert({ where: { productId_kind_normalizedValue: { productId: product.id, kind, normalizedValue: normalizeDesignation(rawValue) } }, update: { rawValue, source, isPrimary }, create: { productId: product.id, kind, rawValue, normalizedValue: normalizeDesignation(rawValue), source, isPrimary } });
  }
  for (const [standardKind, rawCode] of [["GOST", item.gost], ["ISO", item.iso]]) {
    await prisma.standardMapping.upsert({ where: { standardKind_normalizedCode_productId: { productId: product.id, standardKind, normalizedCode: normalizeDesignation(rawCode) } }, update: { rawCode }, create: { productId: product.id, standardKind, rawCode, normalizedCode: normalizeDesignation(rawCode) } });
  }
  for (const rawAlias of item.aliases) {
    await prisma.searchAlias.upsert({ where: { normalizedAlias_productId: { productId: product.id, normalizedAlias: normalizeDesignation(rawAlias) } }, update: { rawAlias, source: "demo-seed" }, create: { productId: product.id, rawAlias, normalizedAlias: normalizeDesignation(rawAlias), source: "demo-seed" } });
  }
  await prisma.productAttribute.upsert({ where: { productId_code: { productId: product.id, code: "demo_stage" } }, update: { value: "catalog-data-model" }, create: { productId: product.id, code: "demo_stage", name: "Этап данных", value: "catalog-data-model" } });
  await prisma.technicalDocument.upsert({ where: { productId_kind_title: { productId: product.id, kind: "DATASHEET", title: "DEMO datasheet placeholder" } }, update: { issuedBy: "ООО ЭВЕРЕСТ DEMO" }, create: { productId: product.id, kind: "DATASHEET", title: "DEMO datasheet placeholder", issuedBy: "ООО ЭВЕРЕСТ DEMO" } });
  return product;
}

async function main() {
  const seed = buildDemoCatalogSeed();
  const bySku = new Map();
  for (const item of seed.products) bySku.set(item.internalSku, await upsertProduct(item));
  for (const relation of seed.analogRelations) {
    const source = bySku.get(relation.sourceSku);
    const target = bySku.get(relation.targetSku);
    const analog = await prisma.analogRelation.upsert({ where: { sourceProductId_targetProductId: { sourceProductId: source.id, targetProductId: target.id } }, update: { status: relation.status, evidenceLevel: relation.evidenceLevel, note: relation.note }, create: { sourceProductId: source.id, targetProductId: target.id, status: relation.status, evidenceLevel: relation.evidenceLevel, note: relation.note } });
    await prisma.analogEvidence.upsert({ where: { id: `${analog.id}-demo-evidence` }, update: { level: relation.evidenceLevel, sourceType: "DEMO", sourceRef: relation.sourceSku, comment: relation.note }, create: { id: `${analog.id}-demo-evidence`, analogRelationId: analog.id, level: relation.evidenceLevel, sourceType: "DEMO", sourceRef: relation.sourceSku, comment: relation.note } });
  }
  await prisma.importBatch.upsert({ where: { checksum: "demo-catalog-data-model-v1" }, update: { status: "APPLIED", rowCount: seed.products.length }, create: { sourceName: "DEMO catalog data model seed", sourceType: "seed", status: "APPLIED", rowCount: seed.products.length, checksum: "demo-catalog-data-model-v1", rows: { create: seed.products.map((product, index) => ({ rowNumber: index + 1, rawData: product, normalizedData: { slug: product.slug, sku: product.internalSku }, status: "APPLIED" })) } } });
  console.log(`Seeded ${seed.products.length} demo catalog products.`);
}

main().finally(async () => prisma.$disconnect());
