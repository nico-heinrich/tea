import type {
  MeiLeafProduct,
  MeiLeafTastingNote,
  TeaRecord,
} from "./types.ts";
import { matchStyle } from "../shared/matching.js";

export const COUNTRY_MAP: Record<string, string> = {
  china: "CN",
  taiwan: "TW",
  japan: "JP",
  india: "IN",
  nepal: "NP",
  "sri lanka": "LK",
  ceylon: "LK",
  kenya: "KE",
  tanzania: "TZ",
  korea: "KR",
  "south korea": "KR",
  vietnam: "VN",
  thailand: "TH",
  malawi: "MW",
  colombia: "CO",
  australia: "AU",
  burma: "MM",
  myanmar: "MM",
  bangladesh: "BD",
  bhutan: "BT",
  rwanda: "RW",
  uganda: "UG",
  turkey: "TR",
  argentina: "AR",
  georgia: "GE",
  usa: "US",
  "united states": "US",
  "south africa": "ZA",
  indonesia: "ID",
};

/** Extract country from origin string (last part after last comma) */
export function extractCountryFromOrigin(origin: string): string | null {
  const parts = origin.split(",").map((s) => s.trim());
  const lastPart = parts[parts.length - 1]?.toLowerCase() || "";
  return COUNTRY_MAP[lastPart] || null;
}

/** Parse elevation string like "700m", "800m approx" → number */
export function parseElevation(elevationStr: string): number | null {
  const match = elevationStr.match(/(\d[\d,]*)\s*m/i);
  if (match) {
    return parseInt(match[1].replace(/,/g, ""), 10);
  }
  return null;
}

/** Parse harvest year from season string (date, month+year, or bare year) */
export function parseHarvestYear(seasonStr: string): number | null {
  const match = seasonStr.match(/(20\d{2})/);
  if (match) {
    return parseInt(match[1], 10);
  }
  return null;
}

/** Parse weight from variant text like "Packet 35g", "Taster 5g" */
export function parseWeightFromText(text: string): number | null {
  const match = text.match(/(\d+)\s*g/i);
  if (match) {
    return parseInt(match[1], 10);
  }
  return null;
}

/** Map product type from category page to internal tea category key */
const TYPE_MAP: Record<string, string> = {
  White: "white",
  Green: "green",
  Matcha: "green",
  Yellow: "yellow",
  Oolong: "oolong",
  Black: "black",
  "Raw Puerh": "dark",
  Ripened: "dark",
};

/** Infer tea type from CSS classes when data-product-type is empty */
function inferTypeFromClasses(classes: string): string | null {
  const classPatterns: Array<[RegExp, string]> = [
    [/tea_type_white/, "white"],
    [/tea_type_green/, "green"],
    [/tea_type_matcha/, "green"],
    [/tea_type_yellow/, "yellow"],
    [/tea_type_oolong/, "oolong"],
    [/tea_type_black/, "black"],
    [/tea_type_raw-puerh/, "dark"],
    [/tea_type_ripened/, "dark"],
  ];

  for (const [pattern, key] of classPatterns) {
    if (pattern.test(classes)) return key;
  }
  return null;
}

/** Resolve tea category key from product type or CSS classes */
export function resolveType(
  productType: string,
  cssClasses: string
): string | null {
  if (productType && TYPE_MAP[productType]) {
    return TYPE_MAP[productType];
  }
  return inferTypeFromClasses(cssClasses);
}

/** Build tasting notes string from MeiLeafTastingNote array */
function buildNotesRaw(tastingNotes: MeiLeafTastingNote[]): string {
  if (tastingNotes.length === 0) return "";
  return tastingNotes
    .map((n) => `${n.label}: ${n.value}`)
    .join("\n");
}

async function inferStyleFromSubtitle(
  subtitle: string | null
): Promise<string | null> {
  if (!subtitle) return null;

  const result = await matchStyle(subtitle);
  if (result) return result.key;

  return subtitle;
}

export async function mapToTeaRecord(product: MeiLeafProduct): Promise<TeaRecord> {
  const typeKey = resolveType(product.teaType, product.cssClasses) || "green";

  const origin = product.detail.origin;
  const originCountry = origin ? extractCountryFromOrigin(origin) : null;

  const elevationMeters = product.detail.elevation
    ? parseElevation(product.detail.elevation)
    : null;

  const harvestRaw = product.detail.season;
  const harvestYear = harvestRaw ? parseHarvestYear(harvestRaw) : null;

  const styleRaw = await inferStyleFromSubtitle(product.subtitle);

  const cultivarRaw = product.detail.cultivar;

  const notesParts: string[] = [];
  if (product.detail.pickingProcessing) {
    notesParts.push(`Picking & Processing: ${product.detail.pickingProcessing}`);
  }
  const tastingNotes = buildNotesRaw(product.tastingNotes);
  if (tastingNotes) notesParts.push(tastingNotes);
  const notesRaw = notesParts.join("\n");

  const available = product.variants.some((v) => v.inStock);

  const offers = product.variants
    .filter((v) => v.inStock)
    .map((v) => ({
      price: v.price,
      weightGrams: v.weightGrams,
      available: v.inStock,
    }));

  return {
    name: product.name,
    url: product.url,
    typeKey,
    styleRaw,
    origin,
    originCountry,
    elevationMeters,
    harvestRaw,
    harvestYear,
    producerRaw: null,
    shadingRaw: null,
    cultivarRaw,
    notesRaw,
    available,
    offers,
  };
}
