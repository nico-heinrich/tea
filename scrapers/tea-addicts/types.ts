// Types for tea-addicts.de (Jimdo shop)

export interface CategoryCard {
  name: string;
  url: string;
  styleRaw: string | null;
  typeLabel: string | null;
  originLabel: string | null;
  harvestLabel: string | null;
  priceText: string | null;
  description: string | null;
}

export interface Variant {
  weightGrams: number | null;
  price: number;
  available: boolean;
}

export interface ProductDetail {
  name: string | null;
  shortDesc: string | null;
  description: string | null;
  styleSynonym: string | null;
  variants: Variant[];
  available: boolean;
}

export interface TeaRecord {
  name: string;
  url: string;
  typeKey: string;
  styleRaw: string | null;
  styleSearchText: string | null;
  origin: string | null;
  originCountry: string | null;
  elevationMeters: number | null;
  harvestRaw: string | null;
  harvestYear: number | null;
  season: string | null;
  producerRaw: string | null;
  shadingRaw: string | null;
  cultivarRaw: string | null;
  notesRaw: string;
  available: boolean;
  offers: Variant[];
}
