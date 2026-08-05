import { MAX_QUERY_LENGTH } from "./types";

const CYRILLIC_TECHNICAL_LOOKALIKES: Record<string, string> = {
  А: "A", В: "B", Г: "G", Е: "E", К: "K", М: "M", Н: "H", О: "O", Р: "P", С: "C", Т: "T", У: "Y",
};

export function normalizeDesignation(value: string): string {
  const trimmed = value.trim().slice(0, MAX_QUERY_LENGTH);
  if (!trimmed) return "";
  let next = trimmed.toUpperCase().replace(/ГОСТ/g, "GOST").replace(/[АВГЕКМНОРСТУ]/g, (char) => CYRILLIC_TECHNICAL_LOOKALIKES[char] ?? char);
  next = next.replace(/(?<=\d)\s*[XХ×]\s*(?=\d)/g, "X");
  next = next.replace(/[\s/_]+/g, "-").replace(/-+/g, "-");
  next = next.replace(/^[.,;:|()[\]{}]+|[.,;:|()[\]{}]+$/g, "");
  return next.replace(/^-+|-+$/g, "");
}

export function normalizeDimensionNumber(value: string): string {
  const n = Number(value.replace(",", "."));
  if (!Number.isFinite(n)) return value;
  return String(n).replace(/\.0+$/, "").replace(/(\.\d*?)0+$/, "$1");
}
