import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { Bearing } from "@/lib/types";
import type { CatalogListOptions, CatalogRepository } from "@/lib/repositories/catalog-repository";
import { rankBearings } from "@/lib/search/ranking";

const productInclude = {
  brand: true,
  category: true,
  designations: true,
  searchAliases: true
} satisfies Prisma.ProductInclude;

type ProductRecord = Prisma.ProductGetPayload<{ include: typeof productInclude }>;

function toBearing(record: ProductRecord): Bearing {
  const gost = record.designations.find((designation) => designation.system === "GOST" && designation.isSearchAlias)?.value;
  const iso = record.designations.find((designation) => designation.system === "ISO" && designation.isPrimary)?.value
    ?? record.designations.find((designation) => designation.system === "ISO")?.value;

  return {
    slug: record.slug,
    name: record.name,
    sku: record.sku,
    gost,
    iso,
    aliases: [
      ...record.searchAliases.map((alias) => alias.value),
      ...record.designations.filter((designation) => designation.isSearchAlias).map((designation) => designation.value)
    ],
    brand: record.brand?.name,
    type: record.category.name,
    d: record.innerDiameterMm ?? undefined,
    D: record.outerDiameterMm ?? undefined,
    B: record.widthMm ?? record.heightMm ?? undefined,
    clearance: record.clearance ?? undefined,
    precisionClass: record.precisionClass ?? undefined,
    seals: record.seals ?? undefined,
    cage: record.cage ?? undefined,
    supplyStatus: record.supplyStatus,
    note: record.isDemo ? "Демонстрационные данные" : undefined
  };
}

export class PrismaCatalogRepository implements CatalogRepository {
  async findBySlug(slug: string) {
    const record = await prisma.product.findFirst({
      where: { slug, isPublished: true },
      include: productInclude
    });
    return record ? toBearing(record) : undefined;
  }

  async search(query: string) {
    const records = await prisma.product.findMany({
      where: { isPublished: true },
      include: productInclude,
      orderBy: { name: "asc" }
    });
    return rankBearings(records.map(toBearing), query);
  }

  async list(options: CatalogListOptions = {}) {
    const records = await prisma.product.findMany({
      where: { isPublished: true },
      include: productInclude,
      orderBy: { name: "asc" },
      skip: options.offset ?? 0,
      take: options.limit ?? 100
    });
    return records.map(toBearing);
  }

  async listBrands() {
    const brands = await prisma.brand.findMany({
      where: { products: { some: { isPublished: true } } },
      select: { name: true },
      orderBy: { name: "asc" }
    });
    return brands.map((brand) => brand.name);
  }

  async listCategories() {
    const categories = await prisma.category.findMany({
      where: { products: { some: { isPublished: true } } },
      select: { name: true },
      orderBy: { name: "asc" }
    });
    return categories.map((category) => category.name);
  }

  async getAnalogs(slug: string) {
    const source = await prisma.product.findUnique({ where: { slug }, select: { id: true } });
    if (!source) return [];

    const relations = await prisma.analogRelation.findMany({
      where: { sourceProductId: source.id },
      include: { targetProduct: { include: productInclude } },
      orderBy: [{ status: "asc" }, { evidenceLevel: "asc" }]
    });

    return relations.map((relation) => ({
      product: toBearing(relation.targetProduct),
      status: relation.status,
      evidenceLevel: relation.evidenceLevel,
      matchingAttributes: relation.matchingAttributes,
      differingAttributes: relation.differingAttributes,
      warning: relation.status === "DIRECT"
        ? undefined
        : "Кандидат не является подтверждённой прямой заменой и требует технической проверки."
    }));
  }
}
