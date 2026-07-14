import * as cheerio from "cheerio";
import type { YoshienProductDetail } from "../shared/types.js";

// Map German processing to our processing
function inferProcessing(category: string, name: string): string | null {
  const cat = category.toLowerCase();
  const nameLower = name.toLowerCase();

  if (cat.includes("matcha")) return "Matcha";
  if (nameLower.includes("hojicha") || nameLower.includes("hocha")) return "Hojicha";
  if (nameLower.includes("gyokuro")) return "Gyokuro";
  if (nameLower.includes("genmaicha")) return "Genmaicha";
  if (nameLower.includes("sencha")) return "Sencha";
  if (nameLower.includes("bancha")) return "Bancha";
  if (nameLower.includes("kukicha")) return "Kukicha";

  return null;
}

function getRawProcessing(category: string, name: string): string {
  const cat = category.toLowerCase();
  const nameLower = name.toLowerCase();

  if (cat.includes("matcha")) return "matcha";
  if (nameLower.includes("hojicha") || nameLower.includes("hocha")) return "hojicha";
  if (nameLower.includes("gyokuro")) return "gyokuro";
  if (nameLower.includes("genmaicha")) return "genmaicha";
  if (nameLower.includes("sencha")) return "sencha";
  if (nameLower.includes("bancha")) return "bancha";
  if (nameLower.includes("kukicha")) return "kukicha";
  if (nameLower.includes("fukamushi")) return "fukamushi";
  if (nameLower.includes("kabusecha")) return "kabusecha";
  if (nameLower.includes("tencha")) return "tencha";
  if (nameLower.includes("shincha")) return "shincha";

  return category || name;
}

// Parse weight from URL like "matcha-okinami-bio-40g.html"
function parseWeightFromUrl(url: string): number | null {
  const match = url.match(/(\d+)g/);
  return match ? parseInt(match[1], 10) : null;
}

// Parse weight from unit string like "40g" or "100g"
function parseWeight(unit: string): number | null {
  const match = unit.match(/(\d+)\s*g/);
  return match ? parseInt(match[1], 10) : null;
}

// Parse elevation from string like "200m ü.d.M."
function parseElevation(text: string): number | null {
  const match = text.match(/(\d+)\s*m/);
  return match ? parseInt(match[1], 10) : null;
}

const COUNTRY_CODES: Record<string, string> = {
  china: "CN", chinesisch: "CN", yunnan: "CN", fujian: "CN", anhua: "CN",
  japan: "JP", japanese: "JP", kyoto: "JP", shizuoka: "JP", kagoshima: "JP",
  fukuoka: "JP", mie: "JP", miyazaki: "JP", kōchi: "JP", kochi: "JP",
  india: "IN", indien: "IN",
  nepal: "NP",
  "sri lanka": "LK", ceylon: "LK",
  kenia: "KE", kenya: "KE",
  tansania: "TZ", tanzania: "TZ",
  taiwan: "TW",
  südkorea: "KR", "south korea": "KR", korea: "KR",
  türkei: "TR", turkey: "TR",
  thailand: "TH",
  vietnam: "VN",
  indonesien: "ID", indonesia: "ID",
};

function countryNameToCode(name: string): string | null {
  const lower = name.toLowerCase().trim();
  if (COUNTRY_CODES[lower]) return COUNTRY_CODES[lower];
  for (const [key, code] of Object.entries(COUNTRY_CODES)) {
    if (lower.includes(key)) return code;
  }
  return null;
}

function parseTerroir(terroir: string): {
  origin: string | null;
  country: string | null;
} {
  if (!terroir) return { origin: null, country: null };

  const parts = terroir.split(",").map((p) => p.trim());
  const countryRaw = parts[parts.length - 1] || null;
  const country = countryRaw ? countryNameToCode(countryRaw) : null;
  const origin = parts.slice(0, -1).join(", ") || null;

  return { origin, country };
}

// Parse harvest year from string like "1. Ernte (Ichibancha), Mai 2025"
function parseHarvestYear(harvest: string): number | null {
  if (!harvest) return null;

  // Look for 4-digit year
  const match = harvest.match(/\b(20\d{2})\b/);
  return match ? parseInt(match[1], 10) : null;
}

// Parse product page HTML
export function parseProductPage(html: string): YoshienProductDetail | null {
  const $ = cheerio.load(html);

  // Get JSON-LD data
  const jsonLdScript = $('script[type="application/ld+json"]').filter(function () {
    const data = JSON.parse($(this).html() || "{}");
    return data["@type"] === "Product";
  });

  if (!jsonLdScript.length) return null;

  const jsonData = JSON.parse(jsonLdScript.html() || "{}");

  // Get HTML table data
  const tableData: Record<string, string> = {};
  $("table tr").each(function () {
    const key = $(this).find("th").text().trim();
    const value = $(this).find("td").text().trim();
    if (key && value) {
      tableData[key] = value;
    }
  });

  // Get image
  const ogImage = $('meta[property="og:image"]').attr("content") || "";

  // Parse unit-value for weight (e.g., "40g", "100g", "40/100g")
  const unitValues: string[] = [];
  $(".cs-product-tile__unit-value, .unit-value").each(function () {
    const text = $(this).text().trim();
    if (text) unitValues.push(text);
  });

  // Extract primary weight from unit values
  let weightGrams: number | null = null;
  for (const unit of unitValues) {
    const match = unit.match(/(\d+)\s*g/);
    if (match) {
      weightGrams = parseInt(match[1], 10);
      break;
    }
  }

  // Parse offers (multiple sizes with weights)
  const offers: { price: number; weightGrams: number | null; url: string }[] = [];
  if (jsonData.offers) {
    // Handle nested AggregateOffer structure
    const offerData = jsonData.offers.offers || jsonData.offers;
    const offerList = Array.isArray(offerData) ? offerData : [offerData];
    for (const offer of offerList) {
      if (offer.price) {
        offers.push({
          price: parseFloat(offer.price),
          weightGrams: offer.url ? parseWeightFromUrl(offer.url) : weightGrams,
          url: offer.url || "",
        });
      }
    }
  }

  const availability = (Array.isArray(jsonData.offers?.offers)
    ? jsonData.offers.offers[0]
    : jsonData.offers?.offers
  )?.availability || jsonData.offers?.availability || "";

  return {
    name: jsonData.name || "",
    sku: jsonData.sku || "",
    category: jsonData.category || "",
    description: jsonData.description || "",
    gtin13: jsonData.gtin13 || "",
    price: parseFloat(jsonData.offers?.price || "0"),
    currency: jsonData.offers?.priceCurrency || "EUR",
    availability,
    offers,
    weightGrams,

    charakter: tableData["Charakter"] || null,
    teefarm: tableData["Teefarm"] || null,
    terroir: tableData["Terroir"] || null,
    ernte: tableData["Ernte"] || null,
    cultivar: tableData["Cultivar"] || null,
    vermahhlung: tableData["Vermahlung"] || null,
    hoehenlage: tableData["Höhenlage"] || null,
    beschattung: tableData["Beschattung"] || null,
    anbau: tableData["Anbau"] || null,
    qualitaet: tableData["Qualität"] || null,

    imageUrl: ogImage,
  };
}

// Map parsed data to our database schema
export function mapToTeaRecord(
  detail: YoshienProductDetail,
  oxidationLevel: string
): {
  oxidationLevelKey: string | null;
  processingKey: string | null;
  processingRaw: string;
  origin: string | null;
  originCountry: string | null;
  elevationMeters: number | null;
  harvestRaw: string | null;
  harvestYear: number | null;
  producerRaw: string | null;
  shadingRaw: string | null;
  notesRaw: string;
} {
  const processingKey = inferProcessing(detail.category, detail.name);
  const processingRaw = getRawProcessing(detail.category, detail.name);

  const { origin, country } = detail.terroir
    ? parseTerroir(detail.terroir)
    : { origin: null, country: null };

  const elevation = detail.hoehenlage ? parseElevation(detail.hoehenlage) : null;
  const harvestRaw = detail.ernte || null;
  const harvestYear = detail.ernte ? parseHarvestYear(detail.ernte) : null;
  const producerRaw = detail.teefarm || null;
  const shadingRaw = detail.beschattung || null;

  const notesRaw = [detail.charakter, detail.anbau, detail.vermahhlung, detail.qualitaet]
    .filter(Boolean)
    .join("\n");

  return {
    oxidationLevelKey: oxidationLevel,
    processingKey,
    processingRaw,
    origin,
    originCountry: country,
    elevationMeters: elevation,
    harvestRaw,
    harvestYear,
    producerRaw,
    shadingRaw,
    notesRaw,
  };
}
