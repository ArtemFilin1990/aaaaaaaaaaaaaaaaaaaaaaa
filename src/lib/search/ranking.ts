import type { Bearing } from "@/lib/types";
import { analyzeSearchQuery, normalizeDesignation } from "@/lib/search/normalization";
import type { BearingSearchResult, SearchMatchKind } from "@/lib/search/types";

const VERIFIED_STANDARD_MAPPINGS: Record<string, string> = {
  "205": "6205",
  "80205": "6205-2Z",
  "180205": "6205-2RS",
  "70-205": "6205-C3",
  "7205": "30205"
};

const SCORE: Record<SearchMatchKind, number> = {
  EXACT_ORIGINAL: 1000,
  EXACT_NORMALIZED: 950,
  EXACT_ALIAS: 900,
  STANDARD_MAPPING: 850,
  BASE_AND_SUFFIX: 700,
  PREFIX: 500,
  DIMENSIONS: 400,
  NAME: 200
};

const equalNumber = (left: number, right: number) => Math.abs(left - right) < 0.001;
const rawUpper = (value: string | undefined) => value?.trim().toUpperCase() ?? "";

function result(
  product: Bearing,
  matchKind: SearchMatchKind,
  matchedValue: string,
  explanation: string,
  options: { exact?: boolean; usedStandardMapping?: boolean; technicalWarning?: string } = {}
): BearingSearchResult {
  return {
    product,
    score: SCORE[matchKind],
    matchKind,
    matchedValue,
    explanation,
    exact: options.exact ?? false,
    usedStandardMapping: options.usedStandardMapping ?? false,
    technicalWarning: options.technicalWarning
  };
}

export function rankBearing(product: Bearing, queryValue: string): BearingSearchResult | undefined {
  const query = analyzeSearchQuery(queryValue);
  if (!query.raw) return undefined;

  const originalDesignations = [product.sku, product.gost, product.iso].filter(Boolean) as string[];
  const exactOriginal = originalDesignations.find((value) => rawUpper(value) === rawUpper(query.raw));
  if (exactOriginal) {
    const system = exactOriginal === product.gost ? "ГОСТ" : exactOriginal === product.iso ? "ISO" : "артикул";
    return result(product, "EXACT_ORIGINAL", exactOriginal, `Точное совпадение исходного обозначения (${system}).`, { exact: true });
  }

  const normalizedOriginal = originalDesignations.find((value) => normalizeDesignation(value) === query.normalized);
  if (normalizedOriginal) {
    return result(product, "EXACT_NORMALIZED", normalizedOriginal, "Точное совпадение после нормализации разделителей и регистра.", { exact: true });
  }

  const exactAlias = product.aliases.find((value) => normalizeDesignation(value) === query.normalized);
  if (exactAlias) {
    return result(product, "EXACT_ALIAS", exactAlias, "Совпадение с проверенным поисковым алиасом.", { exact: true });
  }

  const mappedTarget = VERIFIED_STANDARD_MAPPINGS[query.normalized];
  if (mappedTarget && product.iso && normalizeDesignation(product.iso) === mappedTarget) {
    return result(product, "STANDARD_MAPPING", product.iso, `Найдено по соответствию ${query.raw} → ${product.iso}.`, {
      usedStandardMapping: true,
      technicalWarning: query.normalized === "7205"
        ? "Обозначение 7205 неоднозначно: ГОСТ 7205 соответствует ISO 30205, а ISO 7205 — другой тип подшипника. Проверяйте систему обозначения."
        : "Соответствие обозначений не заменяет проверку исполнения, зазора, точности, уплотнений и сепаратора."
    });
  }

  const productQueries = [product.iso, product.gost, ...product.aliases]
    .filter(Boolean)
    .map((value) => analyzeSearchQuery(String(value)));

  const baseAndSuffix = productQueries.find((candidate) => {
    if (!query.base || candidate.base !== query.base) return false;
    if (!query.suffixes.length) return false;
    return query.suffixes.some((suffix) => candidate.suffixes.includes(suffix));
  });
  if (baseAndSuffix) {
    return result(product, "BASE_AND_SUFFIX", baseAndSuffix.normalized, "Совпали базовый номер и часть модификации.", {
      technicalWarning: "Частичное совпадение суффиксов не подтверждает полную взаимозаменяемость."
    });
  }

  const prefix = productQueries.find((candidate) => candidate.compact.startsWith(query.compact) || query.compact.startsWith(candidate.compact));
  if (query.compact.length >= 3 && prefix) {
    return result(product, "PREFIX", prefix.normalized, "Совпадение по префиксу обозначения.", {
      technicalWarning: "Результат приблизительный; проверьте полное обозначение и технические параметры."
    });
  }

  if (
    query.dimensions &&
    equalNumber(product.d, query.dimensions.d) &&
    equalNumber(product.D, query.dimensions.D) &&
    equalNumber(product.B, query.dimensions.B)
  ) {
    return result(product, "DIMENSIONS", `${product.d}×${product.D}×${product.B}`, "Совпадение по размерам d × D × B.", {
      technicalWarning: "Совпадение размеров не означает прямую взаимозаменяемость подшипников."
    });
  }

  if (product.name.toUpperCase().includes(query.raw.toUpperCase())) {
    return result(product, "NAME", product.name, "Совпадение по наименованию товара.", {
      technicalWarning: "Результат приблизительный."
    });
  }

  return undefined;
}

export function rankBearings(products: Bearing[], query: string): BearingSearchResult[] {
  if (!query.trim()) return [];
  return products
    .map((product) => rankBearing(product, query))
    .filter((item): item is BearingSearchResult => Boolean(item))
    .sort((left, right) => right.score - left.score || (left.product.iso ?? left.product.sku).localeCompare(right.product.iso ?? right.product.sku));
}
