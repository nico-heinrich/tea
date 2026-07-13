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

// Parse price from HTML string
function parsePrice(html: string): number | null {
  const match = html.match(/data-price-amount="([\d.]+)"/);
  return match ? parseFloat(match[1]) : null;
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

// Parse harvest string to season
function parseSeason(harvest: string): string | null {
  if (!harvest) return null;

  const lower = harvest.toLowerCase();
  if (lower.includes("ernte")) {
    // "1. Ernte (Ichibancha), Mai 2025"
    const match = lower.match(/(\d+)\.\s*ernte/);
    if (match) {
      const num = parseInt(match[1], 10);
      // Map harvest number to season name
      const seasons: Record<number, string> = {
        1: "Spring",
        2: "Summer",
        3: "Autumn",
      };
      return seasons[num] || null;
    }
  }

  // Try month names
  if (lower.includes("mai") || lower.includes("may")) return "Spring";
  if (lower.includes("juni") || lower.includes("june")) return "Summer";
  if (lower.includes("juli") || lower.includes("july")) return "Summer";
  if (lower.includes("august")) return "Summer";
  if (lower.includes("september")) return "Autumn";
  if (lower.includes("oktober") || lower.includes("october")) return "Autumn";

  return null;
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

  return {
    name: jsonData.name || "",
    sku: jsonData.sku || "",
    category: jsonData.category || "",
    description: jsonData.description || "",
    gtin13: jsonData.gtin13 || "",
    price: parseFloat(jsonData.offers?.price || "0"),
    currency: jsonData.offers?.priceCurrency || "EUR",
    availability: jsonData.offers?.availability || "",

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
  origin: string | null;
  originCountry: string | null;
  elevationMeters: number | null;
  seasonKey: string | null;
  producerName: string | null;
  shading: string | null;
  rawNotes: string;
} {
  // Processing
  const processingKey = inferProcessing(detail.category, detail.name);

  // Parse terroir
  const { origin, country } = detail.terroir
    ? parseTerroir(detail.terroir)
    : { origin: null, country: null };

  // Elevation
  const elevation = detail.hoehenlage ? parseElevation(detail.hoehenlage) : null;

  // Season from harvest
  const seasonKey = detail.ernte ? parseSeason(detail.ernte) : null;

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
    origin,
    originCountry: country,
    elevationMeters: elevation,
    seasonKey,
    producerName,
    shading,
    rawNotes,
  };
}
