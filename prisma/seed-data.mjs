export function normalizeDesignation(value) {
  return value.trim().toUpperCase().replace(/[×ХX]/g, "X").replace(/[\s/_]+/g, "-").replace(/-+/g, "-");
}

const baseProducts = Array.from({ length: 30 }, (_, index) => {
  const n = index + 1;
  const series = n <= 15 ? "62" : "63";
  const suffix = String(n).padStart(2, "0");
  const iso = `${series}${suffix}`;
  const gost = `${n <= 15 ? "2" : "3"}${suffix}`;
  const d = 10 + n * 5;
  return {
    slug: `demo-${iso.toLowerCase()}`,
    name: `DEMO подшипник шариковый радиальный ${iso}`,
    internalSku: `DEMO-${iso}`,
    manufacturerDesignation: `${iso}-EVEREST-DEMO`,
    gost,
    iso,
    aliases: [gost, `${iso} C3`, `${iso}-ZZ`],
    brandName: n % 3 === 0 ? "DEMO URAL" : n % 3 === 1 ? "DEMO EVEREST" : "DEMO EAC",
    categorySlug: "radial-ball-bearings",
    categoryName: "Радиальные шариковые подшипники",
    bearingType: "Радиальный шариковый",
    boreDiameter: d,
    outerDiameter: d + 25 + (n % 5) * 2,
    widthOrHeight: 8 + (n % 7) * 2,
    massKg: Number((0.08 + n * 0.015).toFixed(3)),
    clearance: n % 2 === 0 ? "C3" : "CN",
    precision: n % 5 === 0 ? "P6" : "P0",
    seal: n % 4 === 0 ? "2RS" : n % 4 === 1 ? "2Z" : null,
    cage: "Стальной штампованный",
    materials: { rings: "bearing steel", rollingElements: "bearing steel" },
    dynamicLoadRating: Number((6 + n * 0.75).toFixed(3)),
    staticLoadRating: Number((3 + n * 0.45).toFixed(3)),
    limitingSpeedRpm: 14000 - n * 180,
    referenceSpeedRpm: 11000 - n * 120,
    temperatureMinC: -40,
    temperatureMaxC: 120,
    supplyStatus: "DEMO_NO_CONFIRMED_STOCK",
  };
});

export function buildDemoCatalogSeed() {
  return {
    products: baseProducts,
    analogRelations: [
      { sourceSku: "DEMO-6201", targetSku: "DEMO-6202", status: "SIZE_ONLY", evidenceLevel: "R", note: "DEMO: размерная близость не подтверждает прямой аналог" },
      { sourceSku: "DEMO-6203", targetSku: "DEMO-6204", status: "PARTIAL", evidenceLevel: "C", note: "DEMO: требуется инженерная проверка условий применения" },
      { sourceSku: "DEMO-6301", targetSku: "DEMO-6302", status: "NO_DIRECT", evidenceLevel: "B", note: "DEMO: прямой замены нет" },
    ],
  };
}
