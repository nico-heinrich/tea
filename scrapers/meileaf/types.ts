// Raw product card data from category page DOM
export interface MeiLeafProductCard {
  name: string;
  price: string;
  type: string;
  rating: string;
  href: string;
  cssClasses: string;
}

// Structured detail from product page (dt.product-detail__title / dd pairs)
export interface MeiLeafProductDetail {
  season: string | null;
  cultivar: string | null;
  origin: string | null;
  pickingProcessing: string | null;
  elevation: string | null;
}

// Tasting note entry
export interface MeiLeafTastingNote {
  label: string;
  value: string;
}

// Variant from product page (.product-options__option)
export interface MeiLeafVariant {
  value: string; // Packet, Taster, Pouch
  price: number;
  salePrice: number;
  productId: string;
  inStock: boolean;
  weightGrams: number | null;
}

// Full parsed product (before DB mapping)
export interface MeiLeafProduct {
  name: string;
  url: string;
  subtitle: string | null;
  teaType: string;
  cssClasses: string;
  detail: MeiLeafProductDetail;
  tastingNotes: MeiLeafTastingNote[];
  variants: MeiLeafVariant[];
}

// Mapped to our database schema
export interface TeaRecord {
  name: string;
  url: string;
  typeKey: string;
  styleRaw: string | null;
  origin: string | null;
  originCountry: string | null;
  elevationMeters: number | null;
  harvestRaw: string | null;
  harvestYear: number | null;
  season: string | null;
  producerRaw: null;
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
