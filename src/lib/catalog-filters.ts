import { z } from "zod";
import type { Bearing } from "@/lib/types";

const optionalText = z.string().trim().max(100).optional().catch(undefined);
const optionalNumber = z.coerce.number().finite().nonnegative().optional().catch(undefined);

export const catalogFiltersSchema = z.object({
  brand: optionalText,
  type: optionalText,
  d: optionalNumber,
  D: optionalNumber,
  B: optionalNumber,
  clearance: optionalText,
  precision: optionalText,
  seals: optionalText,
  supply: z.enum(["ON_REQUEST", "CHECK_AVAILABILITY", "EXPECTED", "DISCONTINUED", "UNKNOWN"]).optional().catch(undefined),
  page: z.coerce.number().int().min(1).max(10000).default(1).catch(1)
});

export type CatalogFilters = z.infer<typeof catalogFiltersSchema>;

const firstValue = (value: string | string[] | undefined) => Array.isArray(value) ? value[0] : value;
const equalNumber = (left: number | undefined, right: number | undefined) => left != null && right != null && Math.abs(left - right) < 0.001;

export function parseCatalogFilters(searchParams: Record<string, string | string[] | undefined>): CatalogFilters {
  return catalogFiltersSchema.parse({
    brand: firstValue(searchParams.brand),
    type: firstValue(searchParams.type),
    d: firstValue(searchParams.d),
    D: firstValue(searchParams.D),
    B: firstValue(searchParams.B),
    clearance: firstValue(searchParams.clearance),
    precision: firstValue(searchParams.precision),
    seals: firstValue(searchParams.seals),
    supply: firstValue(searchParams.supply),
    page: firstValue(searchParams.page)
  });
}

export function filterCatalog(products: Bearing[], filters: CatalogFilters): Bearing[] {
  return products.filter((product) => {
    if (filters.brand && product.brand !== filters.brand) return false;
    if (filters.type && product.type !== filters.type) return false;
    if (filters.d != null && !equalNumber(product.d, filters.d)) return false;
    if (filters.D != null && !equalNumber(product.D, filters.D)) return false;
    if (filters.B != null && !equalNumber(product.B, filters.B)) return false;
    if (filters.clearance && product.clearance !== filters.clearance) return false;
    if (filters.precision && product.precisionClass !== filters.precision) return false;
    if (filters.seals && product.seals !== filters.seals) return false;
    if (filters.supply && product.supplyStatus !== filters.supply) return false;
    return true;
  });
}

export function toCatalogQuery(filters: CatalogFilters, overrides: Partial<CatalogFilters> = {}): string {
  const merged = { ...filters, ...overrides };
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(merged)) {
    if (value == null || value === "" || (key === "page" && value === 1)) continue;
    params.set(key, String(value));
  }
  const query = params.toString();
  return query ? `/catalog?${query}` : "/catalog";
}
