-- Rebuild baseline Product table into the canonical catalog model.
-- The previous stage created a flat demo Product table. This migration keeps
-- existing rows by renaming that table, creating the canonical structure, and
-- converting legacy fields into Product/ProductDesignation/StandardMapping rows.
ALTER TABLE "Product" RENAME TO "_Stage1Product";
ALTER TABLE "_Stage1Product" RENAME CONSTRAINT "Product_pkey" TO "_Stage1Product_pkey";
ALTER INDEX "Product_slug_key" RENAME TO "_Stage1Product_slug_key";
ALTER INDEX "Product_sku_key" RENAME TO "_Stage1Product_sku_key";

-- CreateEnum
CREATE TYPE "DesignationKind" AS ENUM ('INTERNAL_SKU', 'MANUFACTURER', 'GOST', 'ISO');

-- CreateEnum
CREATE TYPE "AttributeValueType" AS ENUM ('STRING', 'NUMBER', 'BOOLEAN', 'JSON');

-- CreateEnum
CREATE TYPE "StandardKind" AS ENUM ('GOST', 'ISO', 'DIN', 'SKF', 'MANUFACTURER', 'INTERNAL');

-- CreateEnum
CREATE TYPE "AnalogStatus" AS ENUM ('DIRECT', 'ONE_WAY', 'PARTIAL', 'SIZE_ONLY', 'NO_DIRECT', 'CONFLICT');

-- CreateEnum
CREATE TYPE "EvidenceLevel" AS ENUM ('A', 'B', 'C', 'R');

-- CreateEnum
CREATE TYPE "DocumentKind" AS ENUM ('CERTIFICATE', 'DATASHEET', 'DRAWING', 'PASSPORT', 'OTHER');

-- CreateEnum
CREATE TYPE "ImportBatchStatus" AS ENUM ('DRAFT', 'VALIDATED', 'APPLIED', 'REJECTED');

-- CreateEnum
CREATE TYPE "ImportRowStatus" AS ENUM ('PENDING', 'VALID', 'INVALID', 'APPLIED', 'SKIPPED');

-- CreateTable
CREATE TABLE "Product" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "brandId" TEXT,
    "categoryId" TEXT,
    "bearingType" TEXT NOT NULL,
    "boreDiameter" DECIMAL(10,3) NOT NULL,
    "outerDiameter" DECIMAL(10,3) NOT NULL,
    "widthOrHeight" DECIMAL(10,3) NOT NULL,
    "dimensionUnit" TEXT NOT NULL DEFAULT 'mm',
    "massKg" DECIMAL(10,3),
    "clearance" TEXT,
    "precision" TEXT,
    "seal" TEXT,
    "cage" TEXT,
    "materials" JSONB,
    "dynamicLoadRating" DECIMAL(12,3),
    "staticLoadRating" DECIMAL(12,3),
    "loadRatingUnit" TEXT DEFAULT 'kN',
    "limitingSpeedRpm" INTEGER,
    "referenceSpeedRpm" INTEGER,
    "temperatureMinC" INTEGER,
    "temperatureMaxC" INTEGER,
    "supplyStatus" TEXT NOT NULL,
    "isDemo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductDesignation" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "kind" "DesignationKind" NOT NULL,
    "source" TEXT,
    "rawValue" TEXT NOT NULL,
    "normalizedValue" TEXT NOT NULL,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProductDesignation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Brand" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "normalizedName" TEXT NOT NULL,
    "countryCode" TEXT,
    "website" TEXT,
    "isDemo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Brand_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Category" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "parentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Category_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductAttribute" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "unit" TEXT,
    "valueType" "AttributeValueType" NOT NULL DEFAULT 'STRING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProductAttribute_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StandardMapping" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "standardKind" "StandardKind" NOT NULL,
    "rawCode" TEXT NOT NULL,
    "normalizedCode" TEXT NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StandardMapping_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AnalogRelation" (
    "id" TEXT NOT NULL,
    "sourceProductId" TEXT NOT NULL,
    "targetProductId" TEXT NOT NULL,
    "status" "AnalogStatus" NOT NULL,
    "evidenceLevel" "EvidenceLevel" NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AnalogRelation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AnalogEvidence" (
    "id" TEXT NOT NULL,
    "analogRelationId" TEXT NOT NULL,
    "level" "EvidenceLevel" NOT NULL,
    "sourceType" TEXT NOT NULL,
    "sourceRef" TEXT NOT NULL,
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AnalogEvidence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TechnicalDocument" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "kind" "DocumentKind" NOT NULL,
    "title" TEXT NOT NULL,
    "url" TEXT,
    "fileKey" TEXT,
    "issuedBy" TEXT,
    "issuedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TechnicalDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SearchAlias" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "rawAlias" TEXT NOT NULL,
    "normalizedAlias" TEXT NOT NULL,
    "source" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SearchAlias_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ImportBatch" (
    "id" TEXT NOT NULL,
    "sourceName" TEXT NOT NULL,
    "sourceType" TEXT NOT NULL,
    "status" "ImportBatchStatus" NOT NULL DEFAULT 'DRAFT',
    "rowCount" INTEGER NOT NULL DEFAULT 0,
    "checksum" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ImportBatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ImportRow" (
    "id" TEXT NOT NULL,
    "importBatchId" TEXT NOT NULL,
    "rowNumber" INTEGER NOT NULL,
    "rawData" JSONB NOT NULL,
    "normalizedData" JSONB,
    "status" "ImportRowStatus" NOT NULL DEFAULT 'PENDING',
    "errorMessage" TEXT,
    "productId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ImportRow_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Product_slug_key" ON "Product"("slug");

-- CreateIndex
CREATE INDEX "Product_brandId_idx" ON "Product"("brandId");

-- CreateIndex
CREATE INDEX "Product_categoryId_idx" ON "Product"("categoryId");

-- CreateIndex
CREATE INDEX "Product_bearingType_idx" ON "Product"("bearingType");

-- CreateIndex
CREATE INDEX "Product_boreDiameter_outerDiameter_widthOrHeight_idx" ON "Product"("boreDiameter", "outerDiameter", "widthOrHeight");

-- CreateIndex
CREATE INDEX "ProductDesignation_productId_idx" ON "ProductDesignation"("productId");

-- CreateIndex
CREATE INDEX "ProductDesignation_normalizedValue_idx" ON "ProductDesignation"("normalizedValue");

-- CreateIndex
CREATE UNIQUE INDEX "ProductDesignation_kind_normalizedValue_source_key" ON "ProductDesignation"("kind", "normalizedValue", "source");

-- CreateIndex
CREATE UNIQUE INDEX "ProductDesignation_productId_kind_normalizedValue_key" ON "ProductDesignation"("productId", "kind", "normalizedValue");

-- CreateIndex
CREATE UNIQUE INDEX "Brand_name_key" ON "Brand"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Brand_normalizedName_key" ON "Brand"("normalizedName");

-- CreateIndex
CREATE UNIQUE INDEX "Category_slug_key" ON "Category"("slug");

-- CreateIndex
CREATE INDEX "Category_parentId_idx" ON "Category"("parentId");

-- CreateIndex
CREATE INDEX "ProductAttribute_code_idx" ON "ProductAttribute"("code");

-- CreateIndex
CREATE UNIQUE INDEX "ProductAttribute_productId_code_key" ON "ProductAttribute"("productId", "code");

-- CreateIndex
CREATE INDEX "StandardMapping_normalizedCode_idx" ON "StandardMapping"("normalizedCode");

-- CreateIndex
CREATE UNIQUE INDEX "StandardMapping_standardKind_normalizedCode_productId_key" ON "StandardMapping"("standardKind", "normalizedCode", "productId");

-- CreateIndex
CREATE INDEX "AnalogRelation_targetProductId_idx" ON "AnalogRelation"("targetProductId");

-- CreateIndex
CREATE INDEX "AnalogRelation_status_idx" ON "AnalogRelation"("status");

-- CreateIndex
CREATE UNIQUE INDEX "AnalogRelation_sourceProductId_targetProductId_key" ON "AnalogRelation"("sourceProductId", "targetProductId");

-- CreateIndex
CREATE INDEX "AnalogEvidence_analogRelationId_idx" ON "AnalogEvidence"("analogRelationId");

-- CreateIndex
CREATE INDEX "AnalogEvidence_level_idx" ON "AnalogEvidence"("level");

-- CreateIndex
CREATE INDEX "TechnicalDocument_productId_idx" ON "TechnicalDocument"("productId");

-- CreateIndex
CREATE UNIQUE INDEX "TechnicalDocument_productId_kind_title_key" ON "TechnicalDocument"("productId", "kind", "title");

-- CreateIndex
CREATE INDEX "SearchAlias_normalizedAlias_idx" ON "SearchAlias"("normalizedAlias");

-- CreateIndex
CREATE UNIQUE INDEX "SearchAlias_normalizedAlias_productId_key" ON "SearchAlias"("normalizedAlias", "productId");

-- CreateIndex
CREATE UNIQUE INDEX "ImportBatch_checksum_key" ON "ImportBatch"("checksum");

-- CreateIndex
CREATE INDEX "ImportRow_productId_idx" ON "ImportRow"("productId");

-- CreateIndex
CREATE UNIQUE INDEX "ImportRow_importBatchId_rowNumber_key" ON "ImportRow"("importBatchId", "rowNumber");


-- MigrateData
INSERT INTO "Brand" ("id", "name", "normalizedName", "isDemo", "createdAt", "updatedAt")
SELECT
    'migrated-brand-' || md5("legacyBrand"),
    "legacyBrand",
    upper(regexp_replace("legacyBrand", '[\s/_]+', '-', 'g')),
    "isDemo",
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM (
    SELECT COALESCE(NULLIF(trim("brand"), ''), 'DEMO UNSPECIFIED') AS "legacyBrand", bool_and("isDemo") AS "isDemo"
    FROM "_Stage1Product"
    WHERE "brand" IS NOT NULL AND trim("brand") <> ''
    GROUP BY COALESCE(NULLIF(trim("brand"), ''), 'DEMO UNSPECIFIED')
) brands
ON CONFLICT ("normalizedName") DO NOTHING;

INSERT INTO "Product" (
    "id", "slug", "name", "brandId", "bearingType", "boreDiameter", "outerDiameter", "widthOrHeight",
    "dimensionUnit", "supplyStatus", "isDemo", "createdAt", "updatedAt"
)
SELECT
    "id",
    "slug",
    "name",
    CASE WHEN "brand" IS NULL OR trim("brand") = '' THEN NULL ELSE 'migrated-brand-' || md5(COALESCE(NULLIF(trim("brand"), ''), 'UNSPECIFIED')) END,
    "type",
    "bore"::numeric(10,3),
    "outside"::numeric(10,3),
    "width"::numeric(10,3),
    'mm',
    'MIGRATED_UNCONFIRMED',
    "isDemo",
    "createdAt",
    "updatedAt"
FROM "_Stage1Product";

INSERT INTO "ProductDesignation" ("id", "productId", "kind", "source", "rawValue", "normalizedValue", "isPrimary", "createdAt")
SELECT 'migrated-sku-' || md5("id" || "sku"), "id", 'INTERNAL_SKU'::"DesignationKind", 'legacy-product', "sku", upper(regexp_replace("sku", '[\s/_]+', '-', 'g')), true, CURRENT_TIMESTAMP
FROM "_Stage1Product";

INSERT INTO "ProductDesignation" ("id", "productId", "kind", "source", "rawValue", "normalizedValue", "isPrimary", "createdAt")
SELECT 'migrated-gost-' || md5("id" || "gost"), "id", 'GOST'::"DesignationKind", 'legacy-product', "gost", upper(regexp_replace("gost", '[\s/_]+', '-', 'g')), true, CURRENT_TIMESTAMP
FROM "_Stage1Product" WHERE "gost" IS NOT NULL AND trim("gost") <> '';

INSERT INTO "ProductDesignation" ("id", "productId", "kind", "source", "rawValue", "normalizedValue", "isPrimary", "createdAt")
SELECT 'migrated-iso-' || md5("id" || "iso"), "id", 'ISO'::"DesignationKind", 'legacy-product', "iso", upper(regexp_replace("iso", '[\s/_]+', '-', 'g')), true, CURRENT_TIMESTAMP
FROM "_Stage1Product" WHERE "iso" IS NOT NULL AND trim("iso") <> '';

INSERT INTO "StandardMapping" ("id", "productId", "standardKind", "rawCode", "normalizedCode", "note", "createdAt")
SELECT 'migrated-std-gost-' || md5("id" || "gost"), "id", 'GOST'::"StandardKind", "gost", upper(regexp_replace("gost", '[\s/_]+', '-', 'g')), 'Migrated from stage-1 Product.gost', CURRENT_TIMESTAMP
FROM "_Stage1Product" WHERE "gost" IS NOT NULL AND trim("gost") <> '';

INSERT INTO "StandardMapping" ("id", "productId", "standardKind", "rawCode", "normalizedCode", "note", "createdAt")
SELECT 'migrated-std-iso-' || md5("id" || "iso"), "id", 'ISO'::"StandardKind", "iso", upper(regexp_replace("iso", '[\s/_]+', '-', 'g')), 'Migrated from stage-1 Product.iso', CURRENT_TIMESTAMP
FROM "_Stage1Product" WHERE "iso" IS NOT NULL AND trim("iso") <> '';

DROP TABLE "_Stage1Product";

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductDesignation" ADD CONSTRAINT "ProductDesignation_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Category" ADD CONSTRAINT "Category_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductAttribute" ADD CONSTRAINT "ProductAttribute_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StandardMapping" ADD CONSTRAINT "StandardMapping_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnalogRelation" ADD CONSTRAINT "AnalogRelation_sourceProductId_fkey" FOREIGN KEY ("sourceProductId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnalogRelation" ADD CONSTRAINT "AnalogRelation_targetProductId_fkey" FOREIGN KEY ("targetProductId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnalogEvidence" ADD CONSTRAINT "AnalogEvidence_analogRelationId_fkey" FOREIGN KEY ("analogRelationId") REFERENCES "AnalogRelation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TechnicalDocument" ADD CONSTRAINT "TechnicalDocument_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SearchAlias" ADD CONSTRAINT "SearchAlias_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImportRow" ADD CONSTRAINT "ImportRow_importBatchId_fkey" FOREIGN KEY ("importBatchId") REFERENCES "ImportBatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImportRow" ADD CONSTRAINT "ImportRow_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;

