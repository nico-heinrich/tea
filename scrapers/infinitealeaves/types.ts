export interface SquarespaceVariant {
  id: string;
  sku: string;
  price: number;
  salePrice: number;
  priceMoney: { currency: string; value: string };
  salePriceMoney: { currency: string; value: string };
  onSale: boolean;
  unlimited: boolean;
  qtyInStock: number;
  optionValues: { optionName: string; value: string }[];
}

export interface SquarespaceItem {
  id: string;
  urlId: string;
  title: string;
  fullUrl: string;
  excerpt: string;
  categoryIds: string[];
  productType: number;
  variants: SquarespaceVariant[];
  body: string | null;
  tags: string[] | null;
}

export interface SquarespaceCollectionResponse {
  collection: {
    id: string;
    itemCount: number;
    fullUrl: string;
    pageSize: number;
  };
  items: SquarespaceItem[];
  nestedCategories: {
    all: Record<string, unknown>;
    categories: unknown[];
  };
}

export interface ParsedExcerpt {
  teeart: string | null;
  region: string | null;
  erntedatum: string | null;
  kultivar: string | null;
  anbauhoehe: string | null;
  beschattung: string | null;
  geschmacksnoten: string | null;
  prose: string | null;
  ulFacts: string[];
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
  offers: { price: number; weightGrams: number | null; available: boolean }[];
}