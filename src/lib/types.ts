export type Bearing = {
  slug: string;
  name: string;
  sku: string;
  gost?: string;
  iso?: string;
  aliases: string[];
  brand?: string;
  type: string;
  d?: number;
  D?: number;
  B?: number;
  clearance?: string;
  precisionClass?: string;
  seals?: string;
  cage?: string;
  supplyStatus?: "ON_REQUEST" | "CHECK_AVAILABILITY" | "EXPECTED" | "DISCONTINUED" | "UNKNOWN";
  note?: string;
};
