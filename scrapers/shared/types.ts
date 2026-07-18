// Product from category page HTML
export interface CategoryProduct {
  url: string;
  name: string;
}

// Parsed product detail from HTML
export interface YoshienProductDetail {
  // From JSON-LD
  name: string;
  sku: string;
  category: string;
  description: string;
  gtin13: string;
  price: number;
  currency: string;
  availability: string;
  offers: { price: number; weightGrams: number | null; url: string }[];
  weightGrams: number | null;

  // From HTML table
  charakter: string | null;
  teefarm: string | null;
  terroir: string | null;
  ernte: string | null;
  cultivar: string | null;
  vermahhlung: string | null;
  hoehenlage: string | null;
  beschattung: string | null;
  anbau: string | null;
  qualitaet: string | null;

  // From meta
  imageUrl: string;
}

// Mapped to our database schema
export interface TeaRecord {
  name: string;
  url: string;
  categoryKey: string;
  styleRaw: string | null;
  origin: string | null;
  originCountry: string | null;
  elevationMeters: number | null;
  harvestRaw: string | null;
  harvestYear: number | null;
  producerRaw: string | null;
  shadingRaw: string | null;
  cultivarRaw: string | null;
  notesRaw: string;
  available: boolean;
  offers: { price: number; weightGrams: number | null; available: boolean }[];
}
