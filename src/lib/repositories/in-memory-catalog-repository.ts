import { demoProducts } from "@/data/demo-products";
import type { CatalogAnalog, CatalogListOptions, CatalogRepository } from "@/lib/repositories/catalog-repository";
import { rankBearings } from "@/lib/search/ranking";

const analogDefinitions: Record<string, Array<Omit<CatalogAnalog, "product"> & { targetSlug: string }>> = {
  "6205": [
    {
      targetSlug: "6205-fag",
      status: "DIRECT",
      evidenceLevel: "B",
      matchingAttributes: ["d", "D", "B", "зазор", "точность", "уплотнение", "сепаратор"],
      differingAttributes: ["бренд"]
    },
    {
      targetSlug: "6205-2rs",
      status: "PARTIAL",
      evidenceLevel: "B",
      matchingAttributes: ["d", "D", "B"],
      differingAttributes: ["уплотнение", "предельные обороты"],
      warning: "Закрытая модификация не является полной заменой открытого исполнения без проверки условий эксплуатации."
    },
    {
      targetSlug: "6205-c3",
      status: "PARTIAL",
      evidenceLevel: "R",
      matchingAttributes: ["d", "D", "B"],
      differingAttributes: ["внутренний зазор"],
      warning: "Зазор C3 требует проверки посадок, температуры и режима работы."
    }
  ],
  "6205-fag": [
    {
      targetSlug: "6205",
      status: "DIRECT",
      evidenceLevel: "B",
      matchingAttributes: ["d", "D", "B", "зазор", "точность", "уплотнение", "сепаратор"],
      differingAttributes: ["бренд"]
    }
  ],
  "30205": [
    {
      targetSlug: "iso-7205",
      status: "CONFLICT",
      evidenceLevel: "A",
      matchingAttributes: [],
      differingAttributes: ["система обозначения", "тип подшипника", "геометрия"],
      warning: "ГОСТ 7205 и ISO 7205 обозначают разные подшипники. Эта запись показывает конфликт, а не замену."
    }
  ]
};

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

  async getAnalogs(slug: string): Promise<CatalogAnalog[]> {
    return (analogDefinitions[slug] ?? []).flatMap((definition) => {
      const product = demoProducts.find((candidate) => candidate.slug === definition.targetSlug);
      if (!product) return [];
      return [{
        product,
        status: definition.status,
        evidenceLevel: definition.evidenceLevel,
        matchingAttributes: definition.matchingAttributes,
        differingAttributes: definition.differingAttributes,
        warning: definition.warning
      }];
    });
  }
}
