export type Bearing = {
  slug: string;
  name: string;
  sku: string;
  gost?: string;
  iso?: string;
  aliases: string[];
  brand?: string;
  type: string;
  d: number;
  D: number;
  B: number;
  note?: string;
};
