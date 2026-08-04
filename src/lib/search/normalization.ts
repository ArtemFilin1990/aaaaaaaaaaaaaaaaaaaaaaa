import type { NormalizedSearchQuery, ParsedDimensions } from "@/lib/search/types";

const SUFFIX_ALIASES: Record<string, string> = {
  ZZ: "2Z",
  "2ZR": "2Z",
  "2RSH": "2RS",
  "2RS1": "2RS",
  RS: "RS",
  Z: "Z",
  NORMAL: "CN",
  НОРМАЛЬНЫЙ: "CN"
};

function parseNumber(value: string): number {
  return Number(value.replace(",", "."));
}

function parseDimensions(value: string): ParsedDimensions | undefined {
  const explicit = value
    .trim()
    .toUpperCase()
    .replace(/[Х×*]/g, "X")
    .match(/^(\d+(?:[.,]\d+)?)\s*X\s*(\d+(?:[.,]\d+)?)\s*X\s*(\d+(?:[.,]\d+)?)$/);

  const whitespace = value.trim().match(/^(\d+(?:[.,]\d+)?)\s+(\d+(?:[.,]\d+)?)\s+(\d+(?:[.,]\d+)?)$/);
  const match = explicit ?? whitespace;
  if (!match) return undefined;

  const [d, D, B] = match.slice(1).map(parseNumber);
  if (![d, D, B].every(Number.isFinite)) return undefined;
  return { d, D, B };
}

export function normalizeSuffix(value: string): string {
  const upper = value.toUpperCase();
  return SUFFIX_ALIASES[upper] ?? upper;
}

export function analyzeSearchQuery(value: string): NormalizedSearchQuery {
  const raw = value.trim();
  const dimensions = parseDimensions(raw);
  const prepared = raw
    .toUpperCase()
    .replace(/[Х×]/g, "X")
    .replace(/[\s/_]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

  const rawTokens = prepared ? prepared.split("-").filter(Boolean) : [];
  const tokens = rawTokens.map((token, index) => (index === 0 ? token : normalizeSuffix(token)));
  const normalized = tokens.join("-");
  const compact = normalized.replace(/[^A-ZА-Я0-9]/g, "");
  const base = tokens[0] && /\d/.test(tokens[0]) ? tokens[0] : undefined;
  const suffixes = tokens.slice(1);

  return { raw, normalized, compact, tokens, base, suffixes, dimensions };
}

export function normalizeDesignation(value: string): string {
  return analyzeSearchQuery(value).normalized;
}

export function compactDesignation(value: string): string {
  return analyzeSearchQuery(value).compact;
}
