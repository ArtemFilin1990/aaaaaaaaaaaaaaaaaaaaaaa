import type { CatalogFilters } from "@/lib/catalog-filters";
import type { CatalogProductView, ProductDetailView } from "@/lib/types";
import type { SearchRequest, SearchResult } from "@/lib/search/types";

export type CatalogListResult = {
  products: CatalogProductView[];
  totalCount: number;
  page: number;
  pageSize: number;
  pageCount: number;
};

export interface CatalogRepository {
  search(request: SearchRequest, limit?: number): Promise<SearchResult[]>;
  findBySlug(slug: string): Promise<CatalogProductView | null>;
  findDetailBySlug(slug: string): Promise<ProductDetailView | null>;
  listDemo(limit?: number): Promise<CatalogProductView[]>;
  listCatalog(filters: CatalogFilters): Promise<CatalogListResult>;
}
