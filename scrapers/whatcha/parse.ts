import type { ShopifyProduct, ParsedBodyHtml, TeaRecord } from "./types.ts";
import { cleanTeaName } from "../shared/cleanName.js";
import { matchStyle } from "../shared/matching.js";
import { extractSeason } from "../shared/harvest.js";

const LABEL_PATTERNS: Array<{ key: keyof ParsedBodyHtml; labels: string[] }> = [
  { key: "tastingNotes", labels: ["Tasting Notes"] },
  { key: "harvest", labels: ["Harvest", "Harvest/Produced", "Harvested"] },
  { key: "steamed", labels: ["Steamed"] },
  { key: "altitude", labels: ["Altitude"] },
  { key: "cultivar", labels: ["Cultivar"] },
  { key: "origin", labels: ["Origin"] },
  { key: "farmer", labels: ["Farmer", "Producer"] },
  { key: "sourced", labels: ["Sourced"] },
  { key: "roast", labels: ["Roast"] },
  { key: "oxidation", labels: ["Oxidation", "Oxidisation"] },
  { key: "picking", labels: ["Picking"] },
  { key: "packaging", labels: ["Packaging"] },
  { key: "teaBase", labels: ["Tea Base"] },
  { key: "flavouring", labels: ["Flavouring"] },
  { key: "puerhType", labels: ["Pu-erh Type", "Puerh Type"] },
  { key: "factory", labels: ["Factory"] },
  { key: "storage", labels: ["Storage"] },
];

function stripGoldSpans(html: string): string {
  return html.replace(/<span style="color: #c1a347;">/gi, "").replace(/<\/span>/gi, "");
}

function extractTextBetweenLabels(html: string, startLabel: string, endIndex: number): string {
  const startPattern = new RegExp(`<strong>${escapeRegExp(startLabel)}:</strong>`, "i");
  const match = html.slice(endIndex).match(startPattern);
  if (!match) return "";

  const contentStart = endIndex + match.index! + match[0].length;
  const nextStrong = html.slice(contentStart).search(/<strong>/i);
  const contentEnd = nextStrong >= 0 ? contentStart + nextStrong : html.length;

  let content = html.slice(contentStart, contentEnd);
  content = content.replace(/<br\s*\/?>/gi, "\n");
  content = content.replace(/<[^>]+>/g, "");
  content = content.replace(/&nbsp;/g, " ");
  content = content.replace(/\s+/g, " ").trim();

  return content;
}

function escapeRegExp(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function parseBodyHtml(html: string): ParsedBodyHtml {
  const cleaned = stripGoldSpans(html);
  const result: ParsedBodyHtml = {
    tastingNotes: null,
    harvest: null,
    steamed: null,
    altitude: null,
    cultivar: null,
    origin: null,
    farmer: null,
    sourced: null,
    roast: null,
    oxidation: null,
    picking: null,
    packaging: null,
    teaBase: null,
    flavouring: null,
    puerhType: null,
    factory: null,
    storage: null,
  };

  // Search entire HTML for each label (labels can appear in any order)
  for (const { key, labels } of LABEL_PATTERNS) {
    for (const label of labels) {
      const pattern = new RegExp(`<strong>${escapeRegExp(label)}:</strong>`, "i");
      const match = cleaned.match(pattern);
      if (match) {
        const contentStart = match.index! + match[0].length;
        const nextStrong = cleaned.slice(contentStart).search(/<strong>/i);
        const contentEnd = nextStrong >= 0 ? contentStart + nextStrong : cleaned.length;

        let content = cleaned.slice(contentStart, contentEnd);
        content = content.replace(/<br\s*\/?>/gi, "\n");
        content = content.replace(/<[^>]+>/g, "");
        content = content.replace(/&nbsp;/g, " ");
        content = content.replace(/\s+/g, " ").trim();

        if (content) {
          result[key] = content;
        }
        break;
      }
    }
  }

  return result;
}

export function parseWeightFromTitle(title: string): number | null {
  const match = title.match(/(\d+(?:\.\d+)?)\s*g/i);
  if (match) {
    return parseFloat(match[1]);
  }
  return null;
}

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

export function inferCountry(vendor: string): string | null {
  const normalized = vendor.toLowerCase().trim();
  return COUNTRY_MAP[normalized] || null;
}

export function parseElevation(altitudeStr: string): number | null {
  const match = altitudeStr.match(/(\d[\d,]*)\s*m/i);
  if (match) {
    return parseInt(match[1].replace(/,/g, ""), 10);
  }
  return null;
}

export function parseHarvestYear(harvestRaw: string): number | null {
  const match = harvestRaw.match(/(20\d{2})/);
  if (match) {
    return parseInt(match[1], 10);
  }
  return null;
}

export const TYPE_MAP: Record<string, string> = {
  "Black Tea": "black",
  "Green Tea": "green",
  "Oolong Tea": "oolong",
  "Puerh Tea": "dark",
  "White Tea": "white",
  "Yellow Tea": "yellow",
  Matcha: "green",
  "Scented Tea": "scented",
  "Dark Tea": "dark",
};

async function inferStyleFromTitle(title: string): Promise<string | null> {
  const result = await matchStyle(title);
  return result?.key || null;
}

export async function mapToTeaRecord(product: ShopifyProduct): Promise<TeaRecord> {
  const parsed = parseBodyHtml(product.body_html);

  const typeKey = TYPE_MAP[product.product_type] || "green";

  const originCountry = inferCountry(product.vendor);

  const elevationMeters = parsed.altitude ? parseElevation(parsed.altitude) : null;

  const harvestYear = parsed.harvest ? parseHarvestYear(parsed.harvest) : null;

  const season = extractSeason(parsed.harvest);

  const styleRaw = await inferStyleFromTitle(product.title);

  const notesParts: string[] = [];
  if (parsed.steamed) notesParts.push(`Steamed: ${parsed.steamed}`);
  if (parsed.roast) notesParts.push(`Roast: ${parsed.roast}`);
  if (parsed.oxidation) notesParts.push(`Oxidation: ${parsed.oxidation}`);
  if (parsed.picking) notesParts.push(`Picking: ${parsed.picking}`);
  if (parsed.tastingNotes) notesParts.push(`Tasting Notes: ${parsed.tastingNotes}`);
  if (parsed.sourced) notesParts.push(`Sourced: ${parsed.sourced}`);
  if (parsed.packaging) notesParts.push(`Packaging: ${parsed.packaging}`);
  if (parsed.teaBase) notesParts.push(`Tea Base: ${parsed.teaBase}`);
  if (parsed.flavouring) notesParts.push(`Flavouring: ${parsed.flavouring}`);
  if (parsed.puerhType) notesParts.push(`Pu-erh Type: ${parsed.puerhType}`);
  if (parsed.factory) notesParts.push(`Factory: ${parsed.factory}`);
  if (parsed.storage) notesParts.push(`Storage: ${parsed.storage}`);

  const notesRaw = notesParts.join("\n");

  const available = product.variants.some((v) => v.available);

  const offers = product.variants
    .filter((v) => v.available)
    .map((v) => {
      const weightGrams = parseWeightFromTitle(v.title);
      const price = parseFloat(v.price);
      return {
        price,
        weightGrams,
        available: v.available,
      };
    });

  return {
    name: cleanTeaName(product.title),
    url: `https://what-cha.com/products/${product.handle}`,
    typeKey,
    styleRaw,
    origin: parsed.origin,
    originCountry,
    elevationMeters,
    harvestRaw: parsed.harvest,
    harvestYear,
    season,
    producerRaw: parsed.farmer,
    shadingRaw: null,
    cultivarRaw: parsed.cultivar,
    notesRaw,
    available,
    offers,
  };
}