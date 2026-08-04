import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const normalize = (value) => value.toUpperCase().replace(/[\s/_-]+/g, "");
const slugify = (value) => value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

const brandDefinitions = [
  { slug: "demo-everest", name: "DEMO ЭВЕРЕСТ", country: "Россия" },
  { slug: "demo-skf", name: "DEMO SKF", country: "Швеция" },
  { slug: "demo-fag", name: "DEMO FAG", country: "Германия" },
  { slug: "demo-nsk", name: "DEMO NSK", country: "Япония" }
];

const categoryDefinitions = [
  { slug: "radial-ball", name: "Радиальные шариковые" },
  { slug: "tapered-roller", name: "Конические роликовые" },
  { slug: "cylindrical-roller", name: "Цилиндрические роликовые" },
  { slug: "angular-contact", name: "Радиально-упорные шариковые" }
];

const brands = new Map();
const categories = new Map();

for (const definition of brandDefinitions) {
  const brand = await prisma.brand.upsert({
    where: { slug: definition.slug },
    update: { ...definition, isDemo: true },
    create: { ...definition, isDemo: true }
  });
  brands.set(definition.slug, brand);
}

for (const definition of categoryDefinitions) {
  const category = await prisma.category.upsert({
    where: { slug: definition.slug },
    update: definition,
    create: definition
  });
  categories.set(definition.slug, category);
}

const productDefinitions = [];
const brandCycle = ["demo-everest", "demo-skf", "demo-fag", "demo-nsk"];
let brandCursor = 0;

function addRadialSeries(series, gostBase, d, D, B, variants) {
  for (const variant of variants) {
    const brandSlug = variant.brand ?? brandCycle[brandCursor++ % brandCycle.length];
    const iso = `${series}${variant.isoSuffix ?? ""}`;
    let gost = null;
    if (variant.kind === "OPEN") gost = gostBase;
    if (variant.kind === "2Z") gost = `80${gostBase}`;
    if (variant.kind === "2RS") gost = `180${gostBase}`;
    if (variant.kind === "C3") gost = `70-${gostBase}`;

    productDefinitions.push({
      key: `${series}-${variant.key}-${brandSlug}`,
      iso,
      gost,
      series,
      brandSlug,
      categorySlug: "radial-ball",
      bearingType: "RADIAL_BALL",
      d,
      D,
      B,
      seals: variant.seals ?? null,
      clearance: variant.clearance ?? "CN",
      precisionClass: variant.precisionClass ?? "P0",
      cage: variant.cage ?? "Стальной",
      dynamicLoadKn: variant.dynamicLoadKn,
      staticLoadKn: variant.staticLoadKn,
      limitingSpeedRpm: variant.limitingSpeedRpm
    });
  }
}

const commonVariants = [
  { key: "open", kind: "OPEN", isoSuffix: "", limitingSpeedRpm: 14000 },
  { key: "2z", kind: "2Z", isoSuffix: "-2Z", seals: "2Z", limitingSpeedRpm: 11000 },
  { key: "2rs", kind: "2RS", isoSuffix: "-2RS", seals: "2RS", limitingSpeedRpm: 9000 },
  { key: "c3", kind: "C3", isoSuffix: "/C3", clearance: "C3", limitingSpeedRpm: 14000 }
];

addRadialSeries("6203", "203", 17, 40, 12, commonVariants);
addRadialSeries("6204", "204", 20, 47, 14, commonVariants);
addRadialSeries("6205", "205", 25, 52, 15, [
  { key: "open-skf", kind: "OPEN", brand: "demo-skf", limitingSpeedRpm: 13000 },
  { key: "open-fag", kind: "OPEN", brand: "demo-fag", limitingSpeedRpm: 13000 },
  { key: "2z", kind: "2Z", isoSuffix: "-2Z", seals: "2Z", limitingSpeedRpm: 10000 },
  { key: "2rs", kind: "2RS", isoSuffix: "-2RS", seals: "2RS", limitingSpeedRpm: 8500 },
  { key: "c3", kind: "C3", isoSuffix: "/C3", clearance: "C3", limitingSpeedRpm: 13000 },
  { key: "2rs-c3", kind: "CUSTOM", isoSuffix: "-2RS/C3", seals: "2RS", clearance: "C3", limitingSpeedRpm: 8500 },
  { key: "p6", kind: "CUSTOM", isoSuffix: "/P6", precisionClass: "P6", limitingSpeedRpm: 13000 }
]);
addRadialSeries("6206", "206", 30, 62, 16, commonVariants.slice(0, 3));
addRadialSeries("6304", "304", 20, 52, 15, commonVariants.slice(0, 2));
addRadialSeries("6305", "305", 25, 62, 17, [commonVariants[0], commonVariants[2]]);
addRadialSeries("6306", "306", 30, 72, 19, [commonVariants[0], commonVariants[2]]);

function addSpecial({ iso, gost = null, brandSlug, categorySlug, bearingType, d, D, B, cage = "Стальной" }) {
  productDefinitions.push({
    key: `${iso}-${brandSlug}`,
    iso,
    gost,
    series: iso,
    brandSlug,
    categorySlug,
    bearingType,
    d,
    D,
    B,
    seals: null,
    clearance: "CN",
    precisionClass: "P0",
    cage,
    limitingSpeedRpm: null
  });
}

addSpecial({ iso: "30205", gost: "7205", brandSlug: "demo-everest", categorySlug: "tapered-roller", bearingType: "TAPERED_ROLLER", d: 25, D: 52, B: 16.25 });
addSpecial({ iso: "30205", gost: "7205", brandSlug: "demo-nsk", categorySlug: "tapered-roller", bearingType: "TAPERED_ROLLER", d: 25, D: 52, B: 16.25 });
addSpecial({ iso: "30206", gost: "7206", brandSlug: "demo-fag", categorySlug: "tapered-roller", bearingType: "TAPERED_ROLLER", d: 30, D: 62, B: 17.25 });
addSpecial({ iso: "30305", gost: "7305", brandSlug: "demo-skf", categorySlug: "tapered-roller", bearingType: "TAPERED_ROLLER", d: 25, D: 62, B: 18.25 });
addSpecial({ iso: "NU205", brandSlug: "demo-everest", categorySlug: "cylindrical-roller", bearingType: "CYLINDRICAL_ROLLER", d: 25, D: 52, B: 15 });
addSpecial({ iso: "NJ205", brandSlug: "demo-fag", categorySlug: "cylindrical-roller", bearingType: "CYLINDRICAL_ROLLER", d: 25, D: 52, B: 15 });
addSpecial({ iso: "NU206", brandSlug: "demo-nsk", categorySlug: "cylindrical-roller", bearingType: "CYLINDRICAL_ROLLER", d: 30, D: 62, B: 16 });
addSpecial({ iso: "7205", brandSlug: "demo-skf", categorySlug: "angular-contact", bearingType: "ANGULAR_CONTACT", d: 25, D: 52, B: 15, cage: "Полиамидный" });
addSpecial({ iso: "7306", brandSlug: "demo-fag", categorySlug: "angular-contact", bearingType: "ANGULAR_CONTACT", d: 30, D: 72, B: 19, cage: "Латунный" });

const products = new Map();

for (const definition of productDefinitions) {
  const brand = brands.get(definition.brandSlug);
  const category = categories.get(definition.categorySlug);
  const sku = `DEMO-${normalize(definition.iso)}-${definition.brandSlug.toUpperCase()}`;
  const slug = slugify(`${definition.iso}-${definition.brandSlug}`);
  const productData = {
    slug,
    name: `Подшипник ${definition.iso} (${brand.name})`,
    sku,
    categoryId: category.id,
    brandId: brand.id,
    country: brand.country,
    bearingType: definition.bearingType,
    innerDiameterMm: definition.d,
    outerDiameterMm: definition.D,
    widthMm: definition.B,
    heightMm: null,
    massKg: null,
    clearance: definition.clearance,
    precisionClass: definition.precisionClass,
    seals: definition.seals,
    cage: definition.cage,
    ringMaterial: "Подшипниковая сталь",
    rollingElementMaterial: "Подшипниковая сталь",
    temperatureMinC: -30,
    temperatureMaxC: 120,
    dynamicLoadKn: definition.dynamicLoadKn ?? null,
    staticLoadKn: definition.staticLoadKn ?? null,
    limitingSpeedRpm: definition.limitingSpeedRpm,
    supplyStatus: "CHECK_AVAILABILITY",
    leadTimeText: null,
    sourceStatus: "DEMO",
    isPublished: true,
    isDemo: true
  };

  const product = await prisma.product.upsert({ where: { sku }, update: productData, create: productData });
  products.set(definition.key, product);

  const isoNormalized = normalize(definition.iso);
  const isoDesignation = await prisma.productDesignation.upsert({
    where: { productId_normalizedValue_system: { productId: product.id, normalizedValue: isoNormalized, system: "ISO" } },
    update: { value: definition.iso, isPrimary: true, isSearchAlias: true, source: "DEMO seed", verificationStatus: "VERIFIED" },
    create: { productId: product.id, value: definition.iso, normalizedValue: isoNormalized, system: "ISO", isPrimary: true, isSearchAlias: true, source: "DEMO seed", verificationStatus: "VERIFIED" }
  });

  await prisma.searchAlias.upsert({
    where: { productId_normalizedValue: { productId: product.id, normalizedValue: isoNormalized } },
    update: { value: definition.iso, source: "DEMO seed", verificationStatus: "VERIFIED" },
    create: { productId: product.id, value: definition.iso, normalizedValue: isoNormalized, source: "DEMO seed", verificationStatus: "VERIFIED" }
  });

  if (definition.gost) {
    const gostNormalized = normalize(definition.gost);
    const gostDesignation = await prisma.productDesignation.upsert({
      where: { productId_normalizedValue_system: { productId: product.id, normalizedValue: gostNormalized, system: "GOST" } },
      update: { value: definition.gost, isPrimary: false, isSearchAlias: true, source: "DEMO seed", verificationStatus: "VERIFIED" },
      create: { productId: product.id, value: definition.gost, normalizedValue: gostNormalized, system: "GOST", isPrimary: false, isSearchAlias: true, source: "DEMO seed", verificationStatus: "VERIFIED" }
    });

    await prisma.searchAlias.upsert({
      where: { productId_normalizedValue: { productId: product.id, normalizedValue: gostNormalized } },
      update: { value: definition.gost, source: "DEMO seed", verificationStatus: "VERIFIED" },
      create: { productId: product.id, value: definition.gost, normalizedValue: gostNormalized, source: "DEMO seed", verificationStatus: "VERIFIED" }
    });

    await prisma.standardMapping.upsert({
      where: { sourceDesignationId_targetDesignationId: { sourceDesignationId: gostDesignation.id, targetDesignationId: isoDesignation.id } },
      update: { status: "DIRECT", evidenceLevel: "B", source: "DEMO seed", comment: "Учебное соответствие ГОСТ → ISO", manuallyVerified: false },
      create: { sourceDesignationId: gostDesignation.id, targetDesignationId: isoDesignation.id, status: "DIRECT", evidenceLevel: "B", source: "DEMO seed", comment: "Учебное соответствие ГОСТ → ISO", manuallyVerified: false }
    });
  }

  await prisma.productAttribute.upsert({
    where: { productId_key: { productId: product.id, key: "data_origin" } },
    update: { label: "Источник данных", value: "DEMO", source: "DEMO seed", verificationStatus: "VERIFIED" },
    create: { productId: product.id, key: "data_origin", label: "Источник данных", value: "DEMO", source: "DEMO seed", verificationStatus: "VERIFIED" }
  });
}

async function upsertAnalog(sourceKey, targetKey, status, evidenceLevel, matchingAttributes, differingAttributes, comment) {
  const sourceProduct = products.get(sourceKey);
  const targetProduct = products.get(targetKey);
  if (!sourceProduct || !targetProduct) throw new Error(`Missing DEMO analog endpoint: ${sourceKey} -> ${targetKey}`);

  const relation = await prisma.analogRelation.upsert({
    where: { sourceProductId_targetProductId: { sourceProductId: sourceProduct.id, targetProductId: targetProduct.id } },
    update: { status, evidenceLevel, source: "DEMO seed", comment, matchingAttributes, differingAttributes, manuallyVerified: false },
    create: { sourceProductId: sourceProduct.id, targetProductId: targetProduct.id, status, evidenceLevel, source: "DEMO seed", comment, matchingAttributes, differingAttributes, manuallyVerified: false }
  });

  await prisma.analogEvidence.deleteMany({ where: { analogRelationId: relation.id } });
  await prisma.analogEvidence.create({ data: { analogRelationId: relation.id, level: evidenceLevel, sourceName: "DEMO seed", note: "Учебная запись. Требуется проверка по реальному каталогу производителя." } });
}

await upsertAnalog("6205-open-skf-demo-skf", "6205-open-fag-demo-fag", "DIRECT", "B", ["d", "D", "B", "зазор", "точность", "уплотнение"], ["бренд"], "Учебный прямой аналог между DEMO-брендами при совпадении критичных параметров.");
await upsertAnalog("6205-open-skf-demo-skf", "6205-2rs-demo-skf", "PARTIAL", "B", ["d", "D", "B"], ["уплотнение", "предельные обороты"], "Закрытая модификация не должна считаться полной заменой открытого исполнения автоматически.");
await upsertAnalog("6205-open-skf-demo-skf", "6205-p6-demo-everest", "PARTIAL", "R", ["d", "D", "B"], ["класс точности"], "Кандидат требует инженерной проверки класса точности и посадок.");
await upsertAnalog("30205-demo-everest", "7205-demo-skf", "CONFLICT", "A", [], ["система обозначения", "тип подшипника", "геометрия"], "Строка 7205 неоднозначна: ГОСТ 7205 соответствует ISO 30205, а ISO 7205 обозначает радиально-упорный подшипник.");

console.log(`Seed completed: ${productDefinitions.length} DEMO products.`);
await prisma.$disconnect();
