-- Rebuild baseline demo Product table into the canonical catalog model.
DROP TABLE IF EXISTS "Product" CASCADE;

-- CreateEnum
CREATE TYPE "DesignationKind" AS ENUM ('INTERNAL_SKU', 'MANUFACTURER', 'GOST', 'ISO');

-- CreateEnum
CREATE TYPE "AttributeValueType" AS ENUM ('STRING', 'NUMBER', 'BOOLEAN', 'JSON');

-- CreateEnum
CREATE TYPE "StandardKind" AS ENUM ('GOST', 'ISO', 'DIN', 'SKF', 'MANUFACTURER', 'INTERNAL');

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

