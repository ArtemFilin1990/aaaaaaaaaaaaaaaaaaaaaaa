import { demoProducts } from "@/data/demo-products";
import type { Bearing } from "@/lib/types";

export function normalizeDesignation(value: string): string {
  return value
    .trim()
    .toUpperCase()
    .replace(/[×ХX]/g, "X")
    .replace(/[\s/_]+/g, "-")
    .replace(/-+/g, "-");
}

export function searchBearings(query: string): Bearing[] {
  const normalized = normalizeDesignation(query);
  if (!normalized) return demoProducts;

  return demoProducts
    .map((product) => {
      const designations = [product.sku, product.gost, product.iso, ...product.aliases]
        .filter(Boolean)
        .map((value) => normalizeDesignation(String(value)));
      const exact = designations.includes(normalized);
      const partial = designations.some((value) => value.includes(normalized));
      const dimensions = normalizeDesignation(`${product.d}X${product.D}X${product.B}`) === normalized;
      return { product, score: exact ? 3 : dimensions ? 2 : partial ? 1 : 0 };
    })
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score)
    .map(({ product }) => product);
}

export function getBearing(slug: string): Bearing | undefined {
  return demoProducts.find((product) => product.slug === slug);
}
