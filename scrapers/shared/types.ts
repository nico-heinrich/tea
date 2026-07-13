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
  vendor_id: number;
  oxidation_level_id: number | null;
  processing_id: number | null;
  origin: string | null;
  origin_country: string | null;
  elevation_meters: number | null;
  season: string | null;
  producer_id: number | null;
  shading: string | null;
  is_available: boolean;
  raw_notes: string | null;
}
