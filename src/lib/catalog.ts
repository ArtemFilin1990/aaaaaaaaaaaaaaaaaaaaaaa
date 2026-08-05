import type { CatalogFilters } from "@/lib/catalog-filters";
import { catalogRepository } from "@/lib/repositories/prisma-catalog-repository";
import { normalizeDesignation } from "@/lib/search/normalization";
import { parseSearchQuery } from "@/lib/search/query-parser";
import type { SearchResult } from "@/lib/search/types";

export { normalizeDesignation, parseSearchQuery };

export async function searchCatalog(query: string, limit?: number): Promise<SearchResult[]> {
  return catalogRepository.search(parseSearchQuery(query), limit);
}

export async function getBearing(slug: string) {
  return catalogRepository.findBySlug(slug);
}

export async function getBearingDetail(slug: string) {
  return catalogRepository.findDetailBySlug(slug);
}

export async function listDemoBearings(limit?: number) {
  return catalogRepository.listDemo(limit);
}

export async function listCatalog(filters: CatalogFilters) {
  return catalogRepository.listCatalog(filters);
}
