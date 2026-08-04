import { demoProducts } from "@/data/demo-products";
import type { CatalogListOptions, CatalogRepository } from "@/lib/repositories/catalog-repository";
import { rankBearings } from "@/lib/search/ranking";

export class InMemoryCatalogRepository implements CatalogRepository {
  async findBySlug(slug: string) {
    return demoProducts.find((product) => product.slug === slug);
  }

  async search(query: string) {
    return rankBearings(demoProducts, query);
  }

  async list(options: CatalogListOptions = {}) {
    const { offset = 0, limit = demoProducts.length } = options;
    return demoProducts.slice(offset, offset + limit);
  }

  async listBrands() {
    return [...new Set(demoProducts.map((product) => product.brand).filter((brand): brand is string => Boolean(brand)))].sort();
  }

  async listCategories() {
    return [...new Set(demoProducts.map((product) => product.type))].sort();
  }

  async getAnalogs() {
    return [];
  }
}
