import { Prisma, type Product, type ProductDesignation, type SearchAlias, type StandardMapping } from "@prisma/client";
import type { CatalogFilters } from "@/lib/catalog-filters";
import { db } from "@/lib/db";
import { analogStatusLabels, analogWarnings, evidenceLabels, type AnalogStatus, type EvidenceLevel } from "@/lib/analogs";
import type { CatalogProductView, ProductDetailView } from "@/lib/types";
import { rankWeight, sortSearchResults } from "@/lib/search/ranking";
import { AMBIGUOUS_STANDARD_WARNING, DEFAULT_SEARCH_LIMIT, DIMENSION_WARNING, MAX_CANDIDATE_POOL, MAX_PUBLIC_RESULTS, type MatchKind, type SearchRequest, type SearchResult } from "@/lib/search/types";
import type { CatalogRepository } from "./catalog-repository";

type ProductWithRelations = Product & { brand: { name: string } | null; category: { name: string; slug: string } | null; designations: ProductDesignation[]; searchAliases: SearchAlias[]; standardMappings: StandardMapping[] };
type ProductAnalogRecord = { id: string; status: AnalogStatus; evidenceLevel: EvidenceLevel; note: string | null; targetProduct: ProductWithRelations };
type ProductDetailRecord = ProductWithRelations & { analogsFrom: ProductAnalogRecord[] };

function decimal(value: Prisma.Decimal | null | undefined): string { return value == null ? "" : value.toString().replace(/\.000$/, "").replace(/(\.\d*?)0+$/, "$1"); }
function nullableDecimal(value: Prisma.Decimal | null | undefined): string | null { const formatted = decimal(value); return formatted || null; }
function primary(product: ProductWithRelations, kind: ProductDesignation["kind"]): string | null { return [...product.designations].filter((d) => d.kind === kind).sort((a,b) => Number(b.isPrimary)-Number(a.isPrimary) || a.rawValue.localeCompare(b.rawValue))[0]?.rawValue ?? null; }
export function toProductView(product: ProductWithRelations): CatalogProductView { return { id: product.id, slug: product.slug, name: product.name, brand: product.brand?.name ?? null, category: product.category?.name ?? null, bearingType: product.bearingType, internalSku: primary(product,"INTERNAL_SKU"), manufacturerDesignation: primary(product,"MANUFACTURER"), gost: primary(product,"GOST"), iso: primary(product,"ISO"), boreDiameter: decimal(product.boreDiameter), outerDiameter: decimal(product.outerDiameter), widthOrHeight: decimal(product.widthOrHeight), dimensionUnit: product.dimensionUnit, seal: product.seal, clearance: product.clearance, precision: product.precision, supplyStatus: product.supplyStatus, isDemo: product.isDemo }; }

const include = { brand: { select: { name: true } }, category: { select: { name: true, slug: true } }, designations: true, searchAliases: true, standardMappings: true } satisfies Prisma.ProductInclude;
const detailInclude = { ...include, analogsFrom: { include: { targetProduct: { include } }, orderBy: { status: "asc" } } } satisfies Prisma.ProductInclude;

function toProductDetailView(product: ProductDetailRecord): ProductDetailView {
  return {
    ...toProductView(product),
    massKg: nullableDecimal(product.massKg),
    cage: product.cage,
    dynamicLoadRating: nullableDecimal(product.dynamicLoadRating),
    staticLoadRating: nullableDecimal(product.staticLoadRating),
    loadRatingUnit: product.loadRatingUnit,
    limitingSpeedRpm: product.limitingSpeedRpm,
    referenceSpeedRpm: product.referenceSpeedRpm,
    temperatureMinC: product.temperatureMinC,
    temperatureMaxC: product.temperatureMaxC,
    analogs: product.analogsFrom.map((analog: ProductAnalogRecord) => ({
      id: analog.id,
      status: analog.status,
      statusLabel: analogStatusLabels[analog.status],
      evidenceLevel: analog.evidenceLevel,
      evidenceLabel: evidenceLabels[analog.evidenceLevel],
      note: analog.note,
      target: toProductView(analog.targetProduct),
      warnings: analogWarnings(analog.status),
    })),
  };
}


function designationFilter(kind: ProductDesignation["kind"], value: string): Prisma.ProductWhereInput {
  return { designations: { some: { kind, normalizedValue: value.trim().toUpperCase().replace(/[\s/_]+/g, "-") } } };
}

function catalogWhere(filters: CatalogFilters): Prisma.ProductWhereInput {
  const AND: Prisma.ProductWhereInput[] = [];
  if (filters.q) {
    const normalized = filters.q.trim().toUpperCase().replace(/[\s/_]+/g, "-");
    AND.push({ OR: [
      { name: { contains: filters.q.trim(), mode: "insensitive" } },
      { designations: { some: { normalizedValue: { contains: normalized } } } },
      { searchAliases: { some: { normalizedAlias: { contains: normalized } } } },
      { standardMappings: { some: { normalizedCode: { contains: normalized } } } },
    ] });
  }
  if (filters.category) AND.push({ category: { slug: filters.category } });
  if (filters.brand) AND.push({ brand: { normalizedName: filters.brand.trim().toUpperCase().replace(/[\s/_]+/g, "-") } });
  if (filters.type) AND.push({ bearingType: { contains: filters.type, mode: "insensitive" } });
  if (filters.gost) AND.push(designationFilter("GOST", filters.gost));
  if (filters.iso) AND.push(designationFilter("ISO", filters.iso));
  if (filters.d) AND.push({ boreDiameter: new Prisma.Decimal(filters.d) });
  if (filters.D) AND.push({ outerDiameter: new Prisma.Decimal(filters.D) });
  if (filters.B) AND.push({ widthOrHeight: new Prisma.Decimal(filters.B) });
  if (filters.seal) AND.push({ seal: { equals: filters.seal, mode: "insensitive" } });
  if (filters.clearance) AND.push({ clearance: { equals: filters.clearance, mode: "insensitive" } });
  if (filters.precision) AND.push({ precision: { equals: filters.precision, mode: "insensitive" } });
  if (filters.cage) AND.push({ cage: { contains: filters.cage, mode: "insensitive" } });
  if (filters.materials) AND.push({ attributes: { some: { code: "materials", value: { contains: filters.materials, mode: "insensitive" } } } });
  if (filters.unit) AND.push({ dimensionUnit: filters.unit });
  if (filters.demo !== undefined) AND.push({ isDemo: filters.demo });
  return AND.length ? { AND } : {};
}

function catalogOrderBy(filters: CatalogFilters): Prisma.ProductOrderByWithRelationInput[] {
  if (filters.sort === "name") return [{ name: "asc" }, { slug: "asc" }];
  if (filters.sort === "d") return [{ boreDiameter: "asc" }, { slug: "asc" }];
  if (filters.sort === "D") return [{ outerDiameter: "asc" }, { slug: "asc" }];
  if (filters.sort === "B") return [{ widthOrHeight: "asc" }, { slug: "asc" }];
  return [{ slug: "asc" }];
}

export class PrismaCatalogRepository implements CatalogRepository {
  async findBySlug(slug: string) { const product = await db.product.findUnique({ where: { slug }, include }); return product ? toProductView(product) : null; }
  async findDetailBySlug(slug: string) { const product = await db.product.findUnique({ where: { slug }, include: detailInclude }); return product ? toProductDetailView(product as ProductDetailRecord) : null; }
  async listDemo(limit = DEFAULT_SEARCH_LIMIT) { const products = await db.product.findMany({ where: { isDemo: true }, include, orderBy: { slug: "asc" }, take: Math.min(limit, MAX_PUBLIC_RESULTS) }); return products.map(toProductView); }
  async listCatalog(filters: CatalogFilters) {
    const where = catalogWhere(filters);
    const pageSize = Math.min(filters.pageSize, MAX_PUBLIC_RESULTS);
    const totalCount = await db.product.count({ where });
    const pageCount = Math.max(1, Math.ceil(totalCount / pageSize));
    const page = Math.min(filters.page, pageCount);
    const products = await db.product.findMany({ where, include, orderBy: catalogOrderBy(filters), skip: (page - 1) * pageSize, take: pageSize });
    return { products: products.map(toProductView), totalCount, page, pageSize, pageCount };
  }
  async search(request: SearchRequest, limit = DEFAULT_SEARCH_LIMIT): Promise<SearchResult[]> {
    if (request.parsedIntent.type === "EMPTY") return [];
    const publicLimit = Math.min(limit, MAX_PUBLIC_RESULTS);
    const values = request.parsedIntent.type === "DESIGNATION" ? Array.from(new Set([request.parsedIntent.value, ...request.generatedVariants])) : request.generatedVariants;
    const where: Prisma.ProductWhereInput[] = [];
    if (request.parsedIntent.type === "DIMENSIONS") where.push({ boreDiameter: new Prisma.Decimal(request.parsedIntent.boreDiameter), outerDiameter: new Prisma.Decimal(request.parsedIntent.outerDiameter), widthOrHeight: new Prisma.Decimal(request.parsedIntent.widthOrHeight), dimensionUnit: request.parsedIntent.unit });
    if (request.parsedIntent.type === "DESIGNATION") {
      where.push({ designations: { some: { normalizedValue: { in: values }, ...(request.parsedIntent.standard ? { kind: request.parsedIntent.standard } : {}) } } });
      where.push({ searchAliases: { some: { normalizedAlias: { in: values } } } });
      where.push({ standardMappings: { some: { normalizedCode: { in: values }, ...(request.parsedIntent.standard ? { standardKind: request.parsedIntent.standard } : {}) } } });
      if (request.normalizedQuery.length >= 3) { where.push({ designations: { some: { normalizedValue: { startsWith: request.normalizedQuery } } } }); where.push({ name: { contains: request.rawQuery.trim(), mode: "insensitive" } }); }
    }
    const products = await db.product.findMany({ where: { OR: where }, include, orderBy: { slug: "asc" }, take: MAX_CANDIDATE_POOL });
    const results = products.map((p) => this.rankProduct(p, request)).filter((r): r is SearchResult => Boolean(r));
    const sorted = sortSearchResults(results);
    const standardKinds = new Set(sorted.filter((r) => r.matchedNormalizedValue === request.normalizedQuery && (r.humanReadableReason.includes("ГОСТ") || r.humanReadableReason.includes("ISO"))).map((r) => r.humanReadableReason.includes("ГОСТ") ? "GOST" : "ISO"));
    const ambiguous = request.parsedIntent.type === "DESIGNATION" && !request.parsedIntent.standard && standardKinds.size > 1;
    return sorted.slice(0, publicLimit).map((r) => ambiguous ? { ...r, warnings: Array.from(new Set([...r.warnings, AMBIGUOUS_STANDARD_WARNING])) } : r);
  }
  private rankProduct(product: ProductWithRelations, request: SearchRequest): SearchResult | null {
    const view = toProductView(product); const baseWarnings = [...request.warnings];
    if (request.parsedIntent.type === "DIMENSIONS") return { product: view, score: rankWeight.DIMENSIONS, matchKind: "DIMENSIONS", matchedRawValue: `${view.boreDiameter}×${view.outerDiameter}×${view.widthOrHeight}`, matchedNormalizedValue: request.normalizedQuery, humanReadableReason: "Совпадение по размерам", warnings: [DIMENSION_WARNING, ...baseWarnings], isPrimary: false };
    if (request.parsedIntent.type !== "DESIGNATION") return null;
    const values = new Set([request.parsedIntent.value, ...request.generatedVariants]);
    let best: SearchResult | null = null;
    const add = (kind: MatchKind, raw: string, norm: string, reason: string, isPrimary=false) => { const score = rankWeight[kind] + (isPrimary ? 10 : 0); const r = { product: view, score, matchKind: kind, matchedRawValue: raw, matchedNormalizedValue: norm, humanReadableReason: reason, warnings: baseWarnings, isPrimary }; if (!best || sortSearchResults([best, r])[0] === r) best = r; };
    for (const d of product.designations) if (values.has(d.normalizedValue)) { const explicit = request.parsedIntent.standard && d.kind === request.parsedIntent.standard; add(explicit ? "EXPLICIT_STANDARD" : d.kind === "INTERNAL_SKU" ? "INTERNAL_SKU" : d.kind === "MANUFACTURER" ? "MANUFACTURER" : "PRIMARY_STANDARD", d.rawValue, d.normalizedValue, explicit ? `Точное совпадение ${d.kind}` : d.kind === "INTERNAL_SKU" ? "Совпадение с внутренним артикулом" : d.kind === "MANUFACTURER" ? "Совпадение с обозначением производителя" : `Точное совпадение ${d.kind}`, d.isPrimary); }
    for (const a of product.searchAliases) if (values.has(a.normalizedAlias)) add(a.normalizedAlias === request.normalizedQuery ? "SEARCH_ALIAS" : "SUFFIX_VARIANT", a.rawAlias, a.normalizedAlias, a.normalizedAlias === request.normalizedQuery ? "Совпадение с поисковым синонимом" : "Совпадение с эквивалентным поисковым вариантом");
    for (const m of product.standardMappings) if (values.has(m.normalizedCode)) add(request.parsedIntent.standard && m.standardKind === request.parsedIntent.standard ? "EXPLICIT_STANDARD" : "STANDARD_MAPPING", m.rawCode, m.normalizedCode, request.parsedIntent.standard ? `Точное совпадение ${m.standardKind}` : "Совпадение со стандартным обозначением");
    if (!best && request.normalizedQuery.length >= 3) for (const d of product.designations) { if (d.normalizedValue.startsWith(request.normalizedQuery)) add("PREFIX", d.rawValue, d.normalizedValue, "Совпадение по префиксу", d.isPrimary); else if (d.normalizedValue.includes(request.normalizedQuery)) add("PARTIAL", d.rawValue, d.normalizedValue, "Частичное совпадение", d.isPrimary); }
    if (!best && request.rawQuery.trim().length >= 3 && product.name.toUpperCase().includes(request.rawQuery.trim().toUpperCase())) add("NAME", product.name, product.name, "Совпадение по наименованию");
    return best;
  }
}
export const catalogRepository = new PrismaCatalogRepository();
