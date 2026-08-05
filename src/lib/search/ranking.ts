import type { MatchKind, SearchResult } from "./types";

export const rankWeight: Record<MatchKind, number> = {
  EXPLICIT_STANDARD: 1100, INTERNAL_SKU: 1000, MANUFACTURER: 900, PRIMARY_STANDARD: 800, SEARCH_ALIAS: 700, STANDARD_MAPPING: 600, SUFFIX_VARIANT: 500, DIMENSIONS: 400, PREFIX: 300, PARTIAL: 200, NAME: 100,
};

export function sortSearchResults(results: SearchResult[]): SearchResult[] {
  return [...results].sort((a, b) => b.score - a.score || rankWeight[b.matchKind] - rankWeight[a.matchKind] || Number(b.isPrimary) - Number(a.isPrimary) || a.product.slug.localeCompare(b.product.slug));
}
