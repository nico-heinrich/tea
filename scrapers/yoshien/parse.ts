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

// Parse terroir into origin and country
function parseTerroir(terroir: string): {
  origin: string | null;
  country: string | null;
} {
  if (!terroir) return { origin: null, country: null };

  // Pattern: "Fuji (Reg.), Shizuoka (Präf.), Japan"
  const parts = terroir.split(",").map((p) => p.trim());
  const country = parts[parts.length - 1] || null;
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

  return {
    name: jsonData.name || "",
    sku: jsonData.sku || "",
    category: jsonData.category || "",
    description: jsonData.description || "",
    gtin13: jsonData.gtin13 || "",
    price: parseFloat(jsonData.offers?.price || "0"),
    currency: jsonData.offers?.priceCurrency || "EUR",
    availability: jsonData.offers?.availability || "",
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
  harvestSeason: string | null;
  harvestYear: number | null;
  producerName: string | null;
  shading: string | null;
  rawNotes: string;
} {
  // Processing
  const processingKey = inferProcessing(detail.category, detail.name);
  const processingRaw = getRawProcessing(detail.category, detail.name);

  // Parse terroir
  const { origin, country } = detail.terroir
    ? parseTerroir(detail.terroir)
    : { origin: null, country: null };

  // Elevation
  const elevation = detail.hoehenlage ? parseElevation(detail.hoehenlage) : null;

  // Harvest info - store raw season, parse year
  const harvestSeason = detail.ernte || null;
  const harvestYear = detail.ernte ? parseHarvestYear(detail.ernte) : null;

  // Producer
  const producerName = detail.teefarm || null;

  // Shading
  const shading = detail.beschattung || null;

  // Raw notes - combine relevant fields
  const rawNotes = [detail.charakter, detail.anbau, detail.vermahhlung, detail.qualitaet]
    .filter(Boolean)
    .join("\n");

  return {
    oxidationLevelKey: oxidationLevel,
    processingKey,
    processingRaw,
    origin,
    originCountry: country,
    elevationMeters: elevation,
    harvestSeason,
    harvestYear,
    producerName,
    shading,
    rawNotes,
  };
}
