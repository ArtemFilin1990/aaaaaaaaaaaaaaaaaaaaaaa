import type { CatalogProductView } from "@/lib/types";

export const MAX_QUERY_LENGTH = 128;
export const DEFAULT_SEARCH_LIMIT = 24;
export const MAX_PUBLIC_RESULTS = 50;
export const MAX_CANDIDATE_POOL = 100;
export const DIMENSION_WARNING = "Совпадение по размерам не подтверждает взаимозаменяемость. Необходимо проверить конструкцию, зазор, точность, уплотнения, сепаратор, нагрузки, обороты и условия эксплуатации";
export const AMBIGUOUS_STANDARD_WARNING = "Обозначение встречается в разных системах. Проверьте ГОСТ, ISO, тип подшипника и размеры";

export type ParsedIntent =
  | { type: "EMPTY" }
  | { type: "DESIGNATION"; value: string; standard?: "GOST" | "ISO"; sku?: boolean; manufacturer?: boolean }
  | { type: "DIMENSIONS"; boreDiameter: string; outerDiameter: string; widthOrHeight: string; unit: "mm" };

export type MatchKind =
  | "EXPLICIT_STANDARD"
  | "INTERNAL_SKU"
  | "MANUFACTURER"
  | "PRIMARY_STANDARD"
  | "SEARCH_ALIAS"
  | "STANDARD_MAPPING"
  | "SUFFIX_VARIANT"
  | "DIMENSIONS"
  | "PREFIX"
  | "PARTIAL"
  | "NAME";

export type SearchRequest = {
  rawQuery: string;
  normalizedQuery: string;
  parsedIntent: ParsedIntent;
  generatedVariants: string[];
  warnings: string[];
  isTooLong: boolean;
};

export type SearchResult = {
  product: CatalogProductView;
  score: number;
  matchKind: MatchKind;
  matchedRawValue: string;
  matchedNormalizedValue: string;
  humanReadableReason: string;
  warnings: string[];
  isPrimary: boolean;
};
