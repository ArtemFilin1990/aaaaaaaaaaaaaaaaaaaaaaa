export function generateSearchVariants(normalized: string): string[] {
  if (!normalized) return [];
  const variants = new Set<string>([normalized]);
  const separators = ["-", " ", "/"];
  for (const sep of separators) variants.add(normalized.replace(/-/g, sep));
  for (const value of Array.from(variants)) {
    if (value.includes("2Z")) variants.add(value.replace(/2Z/g, "ZZ"));
    if (value.includes("ZZ")) variants.add(value.replace(/ZZ/g, "2Z"));
    if (value.includes("2RS")) variants.add(value.replace(/2RS/g, "2RSH"));
    if (value.includes("2RSH")) variants.add(value.replace(/2RSH/g, "2RS"));
  }
  return Array.from(variants);
}
