export type CatalogProductView = {
  id: string;
  slug: string;
  name: string;
  brand: string | null;
  category: string | null;
  bearingType: string;
  internalSku: string | null;
  manufacturerDesignation: string | null;
  gost: string | null;
  iso: string | null;
  boreDiameter: string;
  outerDiameter: string;
  widthOrHeight: string;
  dimensionUnit: string;
  seal: string | null;
  clearance: string | null;
  precision: string | null;
  supplyStatus: string;
  isDemo: boolean;
};

export type ProductAnalogView = {
  id: string;
  status: string;
  statusLabel: string;
  evidenceLevel: string;
  evidenceLabel: string;
  note: string | null;
  target: CatalogProductView;
  warnings: string[];
};

export type ProductDetailView = CatalogProductView & {
  massKg: string | null;
  cage: string | null;
  dynamicLoadRating: string | null;
  staticLoadRating: string | null;
  loadRatingUnit: string | null;
  limitingSpeedRpm: number | null;
  referenceSpeedRpm: number | null;
  temperatureMinC: number | null;
  temperatureMaxC: number | null;
  analogs: ProductAnalogView[];
};

export type Bearing = CatalogProductView;
