import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function duplicateCount(table, columns) {
  const quoted = columns.map((column) => `"${column}"`).join(", ");
  const rows = await prisma.$queryRawUnsafe(`SELECT COUNT(*)::int AS count FROM (SELECT ${quoted} FROM "${table}" GROUP BY ${quoted} HAVING COUNT(*) > 1) duplicates`);
  return Number(rows[0]?.count ?? 0);
}

async function main() {
  const counts = {
    products: await prisma.product.count(),
    demoProducts: await prisma.product.count({ where: { isDemo: true } }),
    designations: await prisma.productDesignation.count(),
    aliases: await prisma.searchAlias.count(),
    standardMappings: await prisma.standardMapping.count(),
    analogRelations: await prisma.analogRelation.count(),
    analogEvidences: await prisma.analogEvidence.count(),
    importBatches: await prisma.importBatch.count(),
    importRows: await prisma.importRow.count(),
  };

  assert(counts.demoProducts >= 30, `Expected at least 30 demo products, got ${counts.demoProducts}`);
  assert(await duplicateCount("Product", ["slug"]) === 0, "Duplicate Product.slug values found");
  assert(await duplicateCount("ProductDesignation", ["kind", "normalizedValue", "source"]) === 0, "Duplicate ProductDesignation kind/value/source values found");
  assert(await duplicateCount("ProductDesignation", ["productId", "kind", "normalizedValue"]) === 0, "Duplicate ProductDesignation per product found");
  assert(await duplicateCount("SearchAlias", ["normalizedAlias", "productId"]) === 0, "Duplicate SearchAlias values found");
  assert(await duplicateCount("StandardMapping", ["standardKind", "normalizedCode", "productId"]) === 0, "Duplicate StandardMapping values found");
  assert(await duplicateCount("AnalogRelation", ["sourceProductId", "targetProductId"]) === 0, "Duplicate AnalogRelation values found");
  assert(await duplicateCount("ImportBatch", ["checksum"]) === 0, "Duplicate ImportBatch checksums found");
  assert(await duplicateCount("ImportRow", ["importBatchId", "rowNumber"]) === 0, "Duplicate ImportRow rows found");

  const designationKinds = await prisma.productDesignation.groupBy({ by: ["kind"], _count: true });
  for (const kind of ["INTERNAL_SKU", "MANUFACTURER", "GOST", "ISO"]) {
    assert(designationKinds.some((row) => row.kind === kind && row._count > 0), `Missing ${kind} designations`);
  }

  const internalSkuCount = await prisma.productDesignation.count({ where: { kind: "INTERNAL_SKU" } });
  const uniqueInternalSku = await prisma.productDesignation.findMany({ where: { kind: "INTERNAL_SKU" }, distinct: ["normalizedValue"], select: { id: true } });
  assert(internalSkuCount === uniqueInternalSku.length, "Internal SKU normalized values are not unique");

  const analogsWithoutEvidence = await prisma.analogRelation.count({ where: { evidences: { none: {} } } });
  assert(analogsWithoutEvidence === 0, "AnalogRelation rows without evidence found");
  assert(counts.importBatches === 1, `Expected one demo ImportBatch, got ${counts.importBatches}`);
  assert(counts.importRows === counts.demoProducts, `Expected ImportRow count to match demo products (${counts.demoProducts}), got ${counts.importRows}`);

  await prisma.$queryRaw`SET CONSTRAINTS ALL IMMEDIATE`;
  console.log(JSON.stringify(counts, null, 2));
}

main()
  .catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
