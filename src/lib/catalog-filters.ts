import { z } from "zod";
import { DEFAULT_SEARCH_LIMIT, MAX_PUBLIC_RESULTS } from "@/lib/search/types";

export const catalogSortValues = ["relevance", "designation", "name", "d", "D", "B"] as const;
export type CatalogSort = (typeof catalogSortValues)[number];

const textValue = z
  .string()
  .trim()
  .max(80)
  .transform((value) => value.replace(/[\u0000-\u001F\u007F]/g, ""))
  .pipe(z.string().max(80));

const optionalText = z.preprocess((value) => {
  const first = Array.isArray(value) ? value[0] : value;
  return typeof first === "string" && first.trim() ? first : undefined;
}, textValue.optional());

const decimalText = z.preprocess((value) => {
  const first = Array.isArray(value) ? value[0] : value;
  if (typeof first !== "string" || !first.trim()) return undefined;
  return first.replace(",", ".").trim();
}, z.string().regex(/^\d+(?:\.\d{1,3})?$/).max(12).optional());

const positiveInt = (fallback: number, max: number) => z.preprocess((value) => {
  const first = Array.isArray(value) ? value[0] : value;
  const parsed = Number.parseInt(String(first ?? ""), 10);
  if (!Number.isFinite(parsed) || parsed < 1) return fallback;
  return Math.min(parsed, max);
}, z.number().int().min(1).max(max));

export const catalogFilterSchema = z.object({
  q: optionalText,
  category: optionalText,
  brand: optionalText,
  type: optionalText,
  gost: optionalText,
  iso: optionalText,
  d: decimalText,
  D: decimalText,
  B: decimalText,
  seal: optionalText,
  clearance: optionalText,
  precision: optionalText,
  cage: optionalText,
  materials: optionalText,
  unit: optionalText.default("mm"),
  demo: z.preprocess((value) => {
    const first = Array.isArray(value) ? value[0] : value;
    if (first === "true") return true;
    if (first === "false") return false;
    return undefined;
  }, z.boolean().optional()),
  sort: z.preprocess((value) => {
    const first = Array.isArray(value) ? value[0] : value;
    return catalogSortValues.includes(first as CatalogSort) ? first : "relevance";
  }, z.enum(catalogSortValues)),
  page: positiveInt(1, 10_000),
  pageSize: positiveInt(DEFAULT_SEARCH_LIMIT, MAX_PUBLIC_RESULTS),
});

export type CatalogFilters = z.infer<typeof catalogFilterSchema>;

export function parseCatalogFilters(searchParams: Record<string, string | string[] | undefined>): CatalogFilters {
  return catalogFilterSchema.parse(searchParams);
}

export function buildCatalogHref(filters: CatalogFilters, overrides: Partial<CatalogFilters> = {}): string {
  const next = { ...filters, ...overrides };
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(next)) {
    if (value === undefined || value === "" || (key === "page" && value === 1) || (key === "pageSize" && value === DEFAULT_SEARCH_LIMIT) || (key === "sort" && value === "relevance") || (key === "unit" && value === "mm")) continue;
    params.set(key, String(value));
  }
  const query = params.toString();
  return query ? `/catalog?${query}` : "/catalog";
}

export function activeCatalogFilterLabels(filters: CatalogFilters): string[] {
  const labels: string[] = [];
  if (filters.q) labels.push(`Поиск: ${filters.q}`);
  if (filters.category) labels.push(`Категория: ${filters.category}`);
  if (filters.brand) labels.push(`Бренд: ${filters.brand}`);
  if (filters.type) labels.push(`Тип: ${filters.type}`);
  if (filters.gost) labels.push(`ГОСТ: ${filters.gost}`);
  if (filters.iso) labels.push(`ISO: ${filters.iso}`);
  if (filters.d) labels.push(`d: ${filters.d}`);
  if (filters.D) labels.push(`D: ${filters.D}`);
  if (filters.B) labels.push(`B/H: ${filters.B}`);
  if (filters.seal) labels.push(`Уплотнение: ${filters.seal}`);
  if (filters.clearance) labels.push(`Зазор: ${filters.clearance}`);
  if (filters.precision) labels.push(`Точность: ${filters.precision}`);
  if (filters.cage) labels.push(`Сепаратор: ${filters.cage}`);
  if (filters.materials) labels.push(`Материалы: ${filters.materials}`);
  if (filters.demo !== undefined) labels.push(filters.demo ? "Только демонстрационные данные" : "Без демонстрационных данных");
  return labels;
}
