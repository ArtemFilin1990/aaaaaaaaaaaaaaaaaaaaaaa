import { demoProducts } from "@/data/demo-products";
import { InMemoryCatalogRepository } from "@/lib/repositories/in-memory-catalog-repository";
import { normalizeDesignation } from "@/lib/search/normalization";
import { rankBearings } from "@/lib/search/ranking";
import type { BearingSearchResult } from "@/lib/search/types";
import type { Bearing } from "@/lib/types";

export { normalizeDesignation };

export const catalogRepository = new InMemoryCatalogRepository();

export function searchBearingResults(query: string): BearingSearchResult[] {
  return rankBearings(demoProducts, query);
}

export function searchBearings(query: string): Bearing[] {
  if (!query.trim()) return demoProducts;
  return searchBearingResults(query).map((result) => result.product);
}

export function getBearing(slug: string): Bearing | undefined {
  return demoProducts.find((product) => product.slug === slug);
}
