export interface ShopifyVariant {
  id: number;
  title: string;
  price: string;
  grams: number;
  available: boolean;
}

export interface ShopifyProduct {
  id: number;
  title: string;
  handle: string;
  body_html: string;
  product_type: string;
  vendor: string;
  tags: string[];
  variants: ShopifyVariant[];
  images: { src: string }[];
}

export interface ParsedBodyHtml {
  tastingNotes: string | null;
  harvest: string | null;
  steamed: string | null;
  altitude: string | null;
  cultivar: string | null;
  origin: string | null;
  farmer: string | null;
  sourced: string | null;
  roast: string | null;
  oxidation: string | null;
  picking: string | null;
  packaging: string | null;
  teaBase: string | null;
  flavouring: string | null;
  puerhType: string | null;
  factory: string | null;
  storage: string | null;
}

export interface TeaRecord {
  name: string;
  url: string;
  teaCategoryKey: string;
  styleRaw: string | null;
  origin: string | null;
  originCountry: string | null;
  elevationMeters: number | null;
  harvestRaw: string | null;
  harvestYear: number | null;
  producerRaw: string | null;
  shadingRaw: null;
  cultivarRaw: string | null;
  notesRaw: string;
  available: boolean;
  offers: {
    price: number;
    weightGrams: number | null;
    available: boolean;
  }[];
}