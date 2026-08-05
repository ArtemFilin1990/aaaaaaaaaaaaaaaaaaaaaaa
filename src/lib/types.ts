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

export type Bearing = CatalogProductView;
