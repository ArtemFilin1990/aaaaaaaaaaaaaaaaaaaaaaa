-- The previous migration contains only demo scaffold data. No production data exists.
DROP TABLE IF EXISTS "Product" CASCADE;
DROP TYPE IF EXISTS "AnalogStatus" CASCADE;
DROP TYPE IF EXISTS "EvidenceLevel" CASCADE;

CREATE TYPE "AnalogStatus" AS ENUM ('DIRECT', 'ONE_WAY', 'PARTIAL', 'SIZE_ONLY', 'NO_DIRECT', 'CONFLICT');
CREATE TYPE "EvidenceLevel" AS ENUM ('A', 'B', 'C', 'R');
CREATE TYPE "DesignationSystem" AS ENUM ('GOST', 'ISO', 'BRAND', 'INTERNAL', 'OTHER');
CREATE TYPE "VerificationStatus" AS ENUM ('VERIFIED', 'UNVERIFIED', 'REQUIRES_REVIEW', 'REJECTED');
CREATE TYPE "SupplyStatus" AS ENUM ('ON_REQUEST', 'CHECK_AVAILABILITY', 'EXPECTED', 'DISCONTINUED', 'UNKNOWN');
CREATE TYPE "SourceStatus" AS ENUM ('DEMO', 'IMPORTED', 'VERIFIED', 'REQUIRES_REVIEW', 'ARCHIVED');
CREATE TYPE "BearingType" AS ENUM ('RADIAL_BALL', 'ANGULAR_CONTACT', 'TAPERED_ROLLER', 'CYLINDRICAL_ROLLER', 'SPHERICAL_ROLLER', 'NEEDLE', 'THRUST', 'HOUSING_UNIT', 'OTHER');
CREATE TYPE "DocumentType" AS ENUM ('DATASHEET', 'DRAWING', 'CERTIFICATE', 'STANDARD', 'MANUAL', 'OTHER');
CREATE TYPE "ImportBatchStatus" AS ENUM ('UPLOADED', 'VALIDATING', 'READY', 'APPLIED', 'PARTIALLY_APPLIED', 'REJECTED', 'ROLLED_BACK');
CREATE TYPE "ImportRowStatus" AS ENUM ('PENDING', 'VALID', 'WARNING', 'ERROR', 'APPLIED', 'SKIPPED');

CREATE TABLE "Brand" (
  "id" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "country" TEXT,
  "website" TEXT,
  "isDemo" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Brand_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Category" (
  "id" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "parentId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Category_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Product" (
  "id" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "sku" TEXT NOT NULL,
  "categoryId" TEXT NOT NULL,
  "brandId" TEXT,
  "country" TEXT,
  "bearingType" "BearingType" NOT NULL,
  "innerDiameterMm" DOUBLE PRECISION,
  "outerDiameterMm" DOUBLE PRECISION,
  "widthMm" DOUBLE PRECISION,
  "heightMm" DOUBLE PRECISION,
  "massKg" DOUBLE PRECISION,
  "clearance" TEXT,
  "precisionClass" TEXT,
  "seals" TEXT,
  "cage" TEXT,
  "ringMaterial" TEXT,
  "rollingElementMaterial" TEXT,
  "temperatureMinC" DOUBLE PRECISION,
  "temperatureMaxC" DOUBLE PRECISION,
  "dynamicLoadKn" DOUBLE PRECISION,
  "staticLoadKn" DOUBLE PRECISION,
  "limitingSpeedRpm" INTEGER,
  "supplyStatus" "SupplyStatus" NOT NULL DEFAULT 'UNKNOWN',
  "leadTimeText" TEXT,
  "sourceStatus" "SourceStatus" NOT NULL DEFAULT 'REQUIRES_REVIEW',
  "isPublished" BOOLEAN NOT NULL DEFAULT false,
  "isDemo" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ProductDesignation" (
  "id" TEXT NOT NULL,
  "productId" TEXT NOT NULL,
  "value" TEXT NOT NULL,
  "normalizedValue" TEXT NOT NULL,
  "system" "DesignationSystem" NOT NULL,
  "isPrimary" BOOLEAN NOT NULL DEFAULT false,
  "isSearchAlias" BOOLEAN NOT NULL DEFAULT true,
  "source" TEXT,
  "verificationStatus" "VerificationStatus" NOT NULL DEFAULT 'UNVERIFIED',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ProductDesignation_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SearchAlias" (
  "id" TEXT NOT NULL,
  "productId" TEXT NOT NULL,
  "value" TEXT NOT NULL,
  "normalizedValue" TEXT NOT NULL,
  "source" TEXT,
  "verificationStatus" "VerificationStatus" NOT NULL DEFAULT 'UNVERIFIED',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SearchAlias_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "StandardMapping" (
  "id" TEXT NOT NULL,
  "sourceDesignationId" TEXT NOT NULL,
  "targetDesignationId" TEXT NOT NULL,
  "status" "AnalogStatus" NOT NULL,
  "evidenceLevel" "EvidenceLevel" NOT NULL,
  "source" TEXT,
  "comment" TEXT,
  "verifiedAt" TIMESTAMP(3),
  "manuallyVerified" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "StandardMapping_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ProductAttribute" (
  "id" TEXT NOT NULL,
  "productId" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "value" TEXT,
  "numericValue" DOUBLE PRECISION,
  "unit" TEXT,
  "source" TEXT,
  "verificationStatus" "VerificationStatus" NOT NULL DEFAULT 'UNVERIFIED',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ProductAttribute_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AnalogRelation" (
  "id" TEXT NOT NULL,
  "sourceProductId" TEXT NOT NULL,
  "targetProductId" TEXT NOT NULL,
  "status" "AnalogStatus" NOT NULL,
  "evidenceLevel" "EvidenceLevel" NOT NULL,
  "source" TEXT,
  "comment" TEXT,
  "matchingAttributes" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "differingAttributes" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "reviewedAt" TIMESTAMP(3),
  "manuallyVerified" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AnalogRelation_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AnalogEvidence" (
  "id" TEXT NOT NULL,
  "analogRelationId" TEXT NOT NULL,
  "level" "EvidenceLevel" NOT NULL,
  "sourceName" TEXT NOT NULL,
  "sourceUrl" TEXT,
  "note" TEXT,
  "verifiedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AnalogEvidence_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TechnicalDocument" (
  "id" TEXT NOT NULL,
  "productId" TEXT NOT NULL,
  "type" "DocumentType" NOT NULL,
  "title" TEXT NOT NULL,
  "url" TEXT,
  "filePath" TEXT,
  "standardNumber" TEXT,
  "source" TEXT,
  "verificationStatus" "VerificationStatus" NOT NULL DEFAULT 'UNVERIFIED',
  "isPublic" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "TechnicalDocument_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ImportBatch" (
  "id" TEXT NOT NULL,
  "fileName" TEXT NOT NULL,
  "source" TEXT NOT NULL,
  "status" "ImportBatchStatus" NOT NULL DEFAULT 'UPLOADED',
  "totalRows" INTEGER NOT NULL DEFAULT 0,
  "validRows" INTEGER NOT NULL DEFAULT 0,
  "errorRows" INTEGER NOT NULL DEFAULT 0,
  "appliedRows" INTEGER NOT NULL DEFAULT 0,
  "startedAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ImportBatch_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ImportRow" (
  "id" TEXT NOT NULL,
  "batchId" TEXT NOT NULL,
  "rowNumber" INTEGER NOT NULL,
  "status" "ImportRowStatus" NOT NULL DEFAULT 'PENDING',
  "rawData" JSONB NOT NULL,
  "normalizedData" JSONB,
  "errorMessages" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "productId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ImportRow_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Brand_slug_key" ON "Brand"("slug");
CREATE UNIQUE INDEX "Brand_name_key" ON "Brand"("name");
CREATE UNIQUE INDEX "Category_slug_key" ON "Category"("slug");
CREATE INDEX "Category_parentId_idx" ON "Category"("parentId");
CREATE UNIQUE INDEX "Product_slug_key" ON "Product"("slug");
CREATE UNIQUE INDEX "Product_sku_key" ON "Product"("sku");
CREATE INDEX "Product_categoryId_idx" ON "Product"("categoryId");
CREATE INDEX "Product_brandId_idx" ON "Product"("brandId");
CREATE INDEX "Product_bearingType_idx" ON "Product"("bearingType");
CREATE INDEX "Product_dimensions_idx" ON "Product"("innerDiameterMm", "outerDiameterMm", "widthMm");
CREATE INDEX "Product_supply_publish_idx" ON "Product"("supplyStatus", "isPublished");
CREATE INDEX "Product_source_demo_idx" ON "Product"("sourceStatus", "isDemo");
CREATE UNIQUE INDEX "ProductDesignation_product_normalized_system_key" ON "ProductDesignation"("productId", "normalizedValue", "system");
CREATE INDEX "ProductDesignation_normalized_system_idx" ON "ProductDesignation"("normalizedValue", "system");
CREATE INDEX "ProductDesignation_product_primary_idx" ON "ProductDesignation"("productId", "isPrimary");
CREATE UNIQUE INDEX "SearchAlias_product_normalized_key" ON "SearchAlias"("productId", "normalizedValue");
CREATE INDEX "SearchAlias_normalized_idx" ON "SearchAlias"("normalizedValue");
CREATE UNIQUE INDEX "StandardMapping_source_target_key" ON "StandardMapping"("sourceDesignationId", "targetDesignationId");
CREATE INDEX "StandardMapping_status_evidence_idx" ON "StandardMapping"("status", "evidenceLevel");
CREATE UNIQUE INDEX "ProductAttribute_product_key_key" ON "ProductAttribute"("productId", "key");
CREATE INDEX "ProductAttribute_key_value_idx" ON "ProductAttribute"("key", "value");
CREATE UNIQUE INDEX "AnalogRelation_source_target_key" ON "AnalogRelation"("sourceProductId", "targetProductId");
CREATE INDEX "AnalogRelation_status_evidence_idx" ON "AnalogRelation"("status", "evidenceLevel");
CREATE INDEX "AnalogRelation_target_idx" ON "AnalogRelation"("targetProductId");
CREATE INDEX "AnalogEvidence_relation_level_idx" ON "AnalogEvidence"("analogRelationId", "level");
CREATE INDEX "TechnicalDocument_product_type_idx" ON "TechnicalDocument"("productId", "type");
CREATE INDEX "ImportBatch_status_created_idx" ON "ImportBatch"("status", "createdAt");
CREATE UNIQUE INDEX "ImportRow_batch_row_key" ON "ImportRow"("batchId", "rowNumber");
CREATE INDEX "ImportRow_status_idx" ON "ImportRow"("status");
CREATE INDEX "ImportRow_product_idx" ON "ImportRow"("productId");

ALTER TABLE "Category" ADD CONSTRAINT "Category_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Product" ADD CONSTRAINT "Product_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Product" ADD CONSTRAINT "Product_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ProductDesignation" ADD CONSTRAINT "ProductDesignation_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SearchAlias" ADD CONSTRAINT "SearchAlias_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StandardMapping" ADD CONSTRAINT "StandardMapping_sourceDesignationId_fkey" FOREIGN KEY ("sourceDesignationId") REFERENCES "ProductDesignation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StandardMapping" ADD CONSTRAINT "StandardMapping_targetDesignationId_fkey" FOREIGN KEY ("targetDesignationId") REFERENCES "ProductDesignation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProductAttribute" ADD CONSTRAINT "ProductAttribute_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AnalogRelation" ADD CONSTRAINT "AnalogRelation_sourceProductId_fkey" FOREIGN KEY ("sourceProductId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AnalogRelation" ADD CONSTRAINT "AnalogRelation_targetProductId_fkey" FOREIGN KEY ("targetProductId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AnalogEvidence" ADD CONSTRAINT "AnalogEvidence_analogRelationId_fkey" FOREIGN KEY ("analogRelationId") REFERENCES "AnalogRelation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TechnicalDocument" ADD CONSTRAINT "TechnicalDocument_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ImportRow" ADD CONSTRAINT "ImportRow_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "ImportBatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ImportRow" ADD CONSTRAINT "ImportRow_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;
