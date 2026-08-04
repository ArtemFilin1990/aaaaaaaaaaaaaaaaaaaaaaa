import type { Bearing } from "@/lib/types";
import type { BearingSearchResult } from "@/lib/search/types";

export type CatalogListOptions = {
  limit?: number;
  offset?: number;
};

export type CatalogAnalog = {
  product: Bearing;
  status: "DIRECT" | "ONE_WAY" | "PARTIAL" | "SIZE_ONLY" | "NO_DIRECT" | "CONFLICT";
  evidenceLevel: "A" | "B" | "C" | "R";
  matchingAttributes: string[];
  differingAttributes: string[];
  warning?: string;
};

export interface CatalogRepository {
  findBySlug(slug: string): Promise<Bearing | undefined>;
  search(query: string): Promise<BearingSearchResult[]>;
  list(options?: CatalogListOptions): Promise<Bearing[]>;
  listBrands(): Promise<string[]>;
  listCategories(): Promise<string[]>;
  getAnalogs(slug: string): Promise<CatalogAnalog[]>;
}
