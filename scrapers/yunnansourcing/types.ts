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

export interface ParsedTags {
  teaType: string | null;
  producer: string | null;
  region: string | null;
  subRegion: string | null;
  yearOfProduction: number | null;
  harvestSeason: string | null;
  storageType: string | null;
  shape: string | null;
  cultivar: string | null;
}
