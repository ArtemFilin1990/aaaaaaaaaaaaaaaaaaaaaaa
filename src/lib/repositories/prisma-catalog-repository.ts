import { Prisma, type Product, type ProductDesignation, type SearchAlias, type StandardMapping } from "@prisma/client";
import { db } from "@/lib/db";
import type { CatalogProductView } from "@/lib/types";
import { rankWeight, sortSearchResults } from "@/lib/search/ranking";
import { AMBIGUOUS_STANDARD_WARNING, DEFAULT_SEARCH_LIMIT, DIMENSION_WARNING, MAX_CANDIDATE_POOL, MAX_PUBLIC_RESULTS, type MatchKind, type SearchRequest, type SearchResult } from "@/lib/search/types";
import type { CatalogRepository } from "./catalog-repository";

type ProductWithRelations = Product & { brand: { name: string } | null; category: { name: string } | null; designations: ProductDesignation[]; searchAliases: SearchAlias[]; standardMappings: StandardMapping[] };

function decimal(value: Prisma.Decimal | null | undefined): string { return value == null ? "" : value.toString().replace(/\.000$/, "").replace(/(\.\d*?)0+$/, "$1"); }
function primary(product: ProductWithRelations, kind: ProductDesignation["kind"]): string | null { return [...product.designations].filter((d) => d.kind === kind).sort((a,b) => Number(b.isPrimary)-Number(a.isPrimary) || a.rawValue.localeCompare(b.rawValue))[0]?.rawValue ?? null; }
export function toProductView(product: ProductWithRelations): CatalogProductView { return { id: product.id, slug: product.slug, name: product.name, brand: product.brand?.name ?? null, category: product.category?.name ?? null, bearingType: product.bearingType, internalSku: primary(product,"INTERNAL_SKU"), manufacturerDesignation: primary(product,"MANUFACTURER"), gost: primary(product,"GOST"), iso: primary(product,"ISO"), boreDiameter: decimal(product.boreDiameter), outerDiameter: decimal(product.outerDiameter), widthOrHeight: decimal(product.widthOrHeight), dimensionUnit: product.dimensionUnit, seal: product.seal, clearance: product.clearance, precision: product.precision, supplyStatus: product.supplyStatus, isDemo: product.isDemo }; }

const include = { brand: { select: { name: true } }, category: { select: { name: true } }, designations: true, searchAliases: true, standardMappings: true } satisfies Prisma.ProductInclude;

export class PrismaCatalogRepository implements CatalogRepository {
  async findBySlug(slug: string) { const product = await db.product.findUnique({ where: { slug }, include }); return product ? toProductView(product) : null; }
  async listDemo(limit = DEFAULT_SEARCH_LIMIT) { const products = await db.product.findMany({ where: { isDemo: true }, include, orderBy: { slug: "asc" }, take: Math.min(limit, MAX_PUBLIC_RESULTS) }); return products.map(toProductView); }
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
