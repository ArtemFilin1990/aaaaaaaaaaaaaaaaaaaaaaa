import { normalizeDesignation, normalizeDimensionNumber } from "./normalization";
import { generateSearchVariants } from "./variants";
import type { ParsedIntent, SearchRequest } from "./types";
import { MAX_QUERY_LENGTH } from "./types";

export function parseSearchQuery(rawQuery: string): SearchRequest {
  const raw = typeof rawQuery === "string" ? rawQuery : "";
  const isTooLong = raw.length > MAX_QUERY_LENGTH;
  const normalizedQuery = normalizeDesignation(raw);
  const warnings = isTooLong ? [`Запрос ограничен ${MAX_QUERY_LENGTH} символами`] : [];
  const parsedIntent = parseIntent(normalizedQuery);
  return { rawQuery: raw, normalizedQuery, parsedIntent, generatedVariants: generateSearchVariants(normalizedQuery), warnings, isTooLong };
}

function parseIntent(normalized: string): ParsedIntent {
  if (!normalized) return { type: "EMPTY" };
  const dimension = normalized.match(/^(\d+(?:[.,]\d+)?)X(\d+(?:[.,]\d+)?)X(\d+(?:[.,]\d+)?)$/);
  if (dimension) return { type: "DIMENSIONS", boreDiameter: normalizeDimensionNumber(dimension[1]), outerDiameter: normalizeDimensionNumber(dimension[2]), widthOrHeight: normalizeDimensionNumber(dimension[3]), unit: "mm" };
  const standard = normalized.match(/^(?:(GOST|ISO)-?)?(.+?)(?:-?(GOST|ISO))?$/);
  const explicit = standard?.[1] ?? standard?.[3];
  const value = standard?.[2] ?? normalized;
  if (explicit === "GOST" || explicit === "ISO") return { type: "DESIGNATION", standard: explicit, value: normalizeDesignation(value) };
  if (normalized.startsWith("АРТИКУЛ-")) return { type: "DESIGNATION", sku: true, value: normalizeDesignation(normalized.replace(/^АРТИКУЛ-/, "")) };
  if (normalized.includes("ОБОЗНАЧЕНИЕ-ПРОИЗВОДИТЕЛЯ")) return { type: "DESIGNATION", manufacturer: true, value: normalized.replace(/-?ОБОЗНАЧЕНИЕ-ПРОИЗВОДИТЕЛЯ-?/, "") };
  return { type: "DESIGNATION", value: normalized };
}
