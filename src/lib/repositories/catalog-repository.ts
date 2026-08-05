import type { CatalogProductView } from "@/lib/types";
import type { SearchRequest, SearchResult } from "@/lib/search/types";

export interface CatalogRepository {
  search(request: SearchRequest, limit?: number): Promise<SearchResult[]>;
  findBySlug(slug: string): Promise<CatalogProductView | null>;
  listDemo(limit?: number): Promise<CatalogProductView[]>;
}
