import type { Bearing } from "@/lib/types";

export type SearchMatchKind =
  | "EXACT_ORIGINAL"
  | "EXACT_NORMALIZED"
  | "EXACT_ALIAS"
  | "STANDARD_MAPPING"
  | "BASE_AND_SUFFIX"
  | "PREFIX"
  | "DIMENSIONS"
  | "NAME";

export type ParsedDimensions = {
  d: number;
  D: number;
  B: number;
};

export type NormalizedSearchQuery = {
  raw: string;
  normalized: string;
  compact: string;
  tokens: string[];
  base?: string;
  suffixes: string[];
  dimensions?: ParsedDimensions;
};

export type BearingSearchResult = {
  product: Bearing;
  score: number;
  matchKind: SearchMatchKind;
  matchedValue: string;
  explanation: string;
  exact: boolean;
  usedStandardMapping: boolean;
  technicalWarning?: string;
};
