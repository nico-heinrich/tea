import type { ShopifyProduct, ParsedTags } from "./types.js";
import { cleanTeaName } from "../shared/cleanName.js";

function parseTags(tags: string[]): ParsedTags {
  let teaType: string | null = null;
  let producer: string | null = null;
  let region: string | null = null;
  let subRegion: string | null = null;
  let yearOfProduction: number | null = null;
  let harvestSeason: string | null = null;
  let storageType: string | null = null;
  let shape: string | null = null;
  let cultivar: string | null = null;

  for (const tag of tags) {
    if (tag.startsWith("Tea Type_")) teaType = tag.slice(9);
    else if (tag.startsWith("Producer_")) producer = tag.slice(9);
    else if (tag.startsWith("Region_")) region = tag.slice(7);
    else if (tag.startsWith("Sub-Region_")) subRegion = tag.slice(11);
    else if (tag.startsWith("Year of Production_")) {
      const year = parseInt(tag.slice(19), 10);
      if (year > 1900 && year < 2100) yearOfProduction = year;
    }
    else if (tag.includes("Harvest Season")) harvestSeason = tag.replace(/_/g, " ");
    else if (tag.startsWith("Storage Type_")) storageType = tag.slice(13);
    else if (tag.startsWith("Shape_")) shape = tag.slice(6);
    else if (tag.startsWith("Cultivar_")) cultivar = tag.slice(9);
  }

  return { teaType, producer, region, subRegion, yearOfProduction, harvestSeason, storageType, shape, cultivar };
}

const WEIGHT_PATTERNS = [
  /(\d+(?:\.\d+)?)\s*(?:Grams?|g)\b/i,
  /(\d+(?:\.\d+)?)\s*(?:Kilograms?|kg)\b/i,
];

function parseWeightFromTitle(title: string): number | null {
  for (const pattern of WEIGHT_PATTERNS) {
    const match = title.match(pattern);
    if (match) {
      const value = parseFloat(match[1]);
      if (pattern.source.includes("kg")) return value * 1000;
      return value;
    }
  }
  return null;
}

const COUNTRY_MAP: Record<string, string> = {
  yunnan: "CN", fujian: "CN", guangdong: "CN", sichuan: "CN",
  hunan: "CN", hubei: "CN", jiangxi: "CN", jiangsu: "CN",
  shandong: "CN", zhejiang: "CN", anhui: "CN", henan: "CN",
  shaanxi: "CN", guizhou: "CN", guangxi: "CN", hainan: "CN",
  taiwan: "TW", japan: "JP", india: "IN", nepal: "NP",
  sri: "LK", kenya: "KE", vietnam: "VN", thailand: "TH",
  indonesia: "ID", korea: "KR", turkey: "TR", tanzania: "TZ",
};

function inferCountry(region: string | null, subRegion: string | null): string | null {
  const text = `${region || ""} ${subRegion || ""}`.toLowerCase();
  for (const [key, code] of Object.entries(COUNTRY_MAP)) {
    if (text.includes(key)) return code;
  }
  return null;
}

function parseElevation(html: string): number | null {
  const text = html.replace(/<[^>]+>/g, " ");
  const patterns = [
    /altitude[:\s]+(\d{1,5})\s*meters/i,
    /elevation[:\s]+(\d{1,5})\s*meters/i,
    /grown at[:\s]+(\d{1,5})\s*(?:meters|m\b)/i,
    /(\d{1,5})\s*meters?\s*(?:altitude|elevation)/i,
    /(\d{1,5})\s*m\b\s*(?:altitude|elevation)/i,
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) return parseInt(match[1], 10);
  }
  return null;
}

function parseCultivar(html: string): string | null {
  const text = html.replace(/<\/?p[^>]*>/gi, "\n").replace(/<[^>]+>/g, " ").replace(/[ \t]+/g, " ").replace(/\n\s*/g, "\n");
  const match = text.match(/(?:Cultivar|Varietal):\s*([\p{Lu}\u4e00-\u9fff][\p{L}\p{N}\s\-#().,\u4e00-\u9fff]{1,80}?)(?:\s*\n|\s+(?:Altitude|Elevation|Harvest|Style|Craft|Pluck|Pick|Area|Origin|Region|We |In |The |Some |It |This |Our |That |Also |From |Farm|Bush|Tree|Wild|Old|Fresh|Dry|Full|Light|Dark|Heavy|Smooth|Clean|Process|Roast|Season|Grade|Type|Flush|Note|Wrapper|Year|Vintage|Pressed|Cake|Sample|Gram|Kilo|among)|\.)/u);
  if (match) {
    let value = match[1].trim();
    const cutoff = value.search(/\s(?:\d|Pure|Pluck|Late|Sweet|Growing|Bud|to|and|or)\b/);
    if (cutoff > 0) value = value.slice(0, cutoff);
    if (value.length < 3) return null;
    return cleanCultivar(value);
  }
  return null;
}

function cleanCultivar(raw: string): string | null {
  const value = raw.trim().replace(/<[^>]+>/g, "").trim();
  if (GENERIC_LEAF.test(value)) return null;
  if (/\b(this|that|the|and|but|with|which|is|are|have|has|gives|grows|growing|called|referred|fermented|from|region|tea|harvested|produced|large|small|sturdy|naturally|low|level|smooth|aromatic)\b/i.test(value)) return null;
  return value || null;
}

const GENERIC_LEAF = /large.?leaf|small.?leaf|mixed.?(?:leaf|large|small)|pure assamica|ancient arbor|old arbor|wild.?arbor|sun.?dried/i;

const TEA_TYPE_TO_CATEGORY: Record<string, string> = {
  "Raw Pu-erh Tea": "Pu-erh",
  "Ripe Pu-erh Tea": "Pu-erh",
  "Pu-erh Tea": "Pu-erh",
  "Hei Cha": "Pu-erh",
  "Black Tea": "Black",
  "Green Tea": "Green",
  "Oolong Tea": "Oolong",
  "White Tea": "White",
  "Yellow Tea": "Yellow",
};

function inferTeaCategory(productType: string, teaType: string | null): string {
  if (teaType && TEA_TYPE_TO_CATEGORY[teaType]) return TEA_TYPE_TO_CATEGORY[teaType];
  if (TEA_TYPE_TO_CATEGORY[productType]) return TEA_TYPE_TO_CATEGORY[productType];
  const lower = (productType + " " + (teaType || "")).toLowerCase();
  if (lower.includes("pu-erh") || lower.includes("pu erh") || lower.includes("hei cha")) return "Pu-erh";
  if (lower.includes("black")) return "Black";
  if (lower.includes("green")) return "Green";
  if (lower.includes("oolong")) return "Oolong";
  if (lower.includes("white")) return "White";
  if (lower.includes("yellow")) return "Yellow";
  return "Green";
}

function buildNotesRaw(product: ShopifyProduct, tags: ParsedTags): string {
  const parts = [tags.storageType, tags.shape].filter(Boolean);
  const desc = product.body_html
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 500);
  if (desc) parts.push(desc);
  return parts.join("\n");
}

export function mapToTeaRecord(product: ShopifyProduct): {
  name: string;
  url: string;
  teaCategoryKey: string;
  processingRaw: string;
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
} {
  const tags = parseTags(product.tags);
  const url = `https://yunnansourcing.com/products/${product.handle}`;
  const name = cleanTeaName(product.title);
  const teaCategoryKey = inferTeaCategory(product.product_type, tags.teaType);
  const processingRaw = tags.teaType || product.product_type;
  const origin = tags.subRegion || tags.region || null;
  const originCountry = inferCountry(tags.region, tags.subRegion);
  const harvestRaw = tags.harvestSeason || null;
  const harvestYear = tags.yearOfProduction;
  const producerRaw = tags.producer || product.vendor || null;
  const cultivarRaw = tags.cultivar || parseCultivar(product.body_html);
  const notesRaw = buildNotesRaw(product, tags);
  const available = product.variants.some(v => v.available);
  const elevationMeters = parseElevation(product.body_html);

  const offers = product.variants.map(v => ({
    price: parseFloat(v.price),
    weightGrams: parseWeightFromTitle(v.title),
    available: v.available,
  }));

  return {
    name,
    url,
    teaCategoryKey,
    processingRaw,
    origin,
    originCountry,
    elevationMeters,
    harvestRaw,
    harvestYear,
    producerRaw,
    shadingRaw: null,
    cultivarRaw,
    notesRaw,
    available,
    offers,
  };
}
