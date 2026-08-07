import type { SquarespaceItem, ParsedExcerpt, TeaRecord } from "./types.js";
import { cleanTeaName } from "../shared/cleanName.js";
import { extractSeason } from "../shared/harvest.js";

const HTML_ENTITIES: Record<string, string> = {
  "&uuml;": "ü",
  "&ouml;": "ö",
  "&auml;": "ä",
  "&szlig;": "ß",
  "&Uuml;": "Ü",
  "&Ouml;": "Ö",
  "&Auml;": "Ä",
  "&quot;": '"',
  "&nbsp;": " ",
  "&#39;": "'",
  "&ndash;": "–",
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
};

function decodeHtmlEntities(text: string): string {
  return text.replace(/&[a-z]+;|&#\d+;/gi, (match) => HTML_ENTITIES[match] || match);
}

function stripTags(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function extractLabelValue(html: string, label: string): string | null {
  const patterns = [
    new RegExp(`<strong>${escapeRegExp(label)}:\\s*<\\/strong>\\s*<span>([^<]+)</span>`, "i"),
    new RegExp(`<strong>${escapeRegExp(label)}:\\s*<\\/strong>\\s*([^<]+)`, "i"),
  ];

  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match && match[1]) {
      return decodeHtmlEntities(match[1].trim());
    }
  }
  return null;
}

function escapeRegExp(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function extractProse(html: string): string | null {
  const firstPTag = html.match(/<p[^>]*>([\s\S]*?)<\/p>/i);
  if (firstPTag && firstPTag[1]) {
    const content = stripTags(firstPTag[1]);
    if (content && !content.includes("Teeart:") && !content.includes("Region:") && !content.includes("Erntedatum:")) {
      return decodeHtmlEntities(content);
    }
  }
  return null;
}

function extractUlFacts(html: string): string[] {
  const facts: string[] = [];
  const ulMatch = html.match(/<ul[^>]*>([\s\S]*?)<\/ul>/i);
  if (ulMatch && ulMatch[1]) {
    const liMatches = ulMatch[1].matchAll(/<li[^>]*>([\s\S]*?)<\/li>/gi);
    for (const liMatch of liMatches) {
      if (liMatch[1]) {
        const fact = stripTags(liMatch[1]);
        if (fact) facts.push(decodeHtmlEntities(fact));
      }
    }
  }
  return facts;
}

function extractGeschmacksnoten(html: string): string | null {
  const pattern = /<strong>Geschmacksnoten:\s*<\/strong>\s*(?:<span>)?([^<]+)/i;
  const match = html.match(pattern);
  if (match && match[1]) {
    return decodeHtmlEntities(match[1].trim());
  }
  return null;
}

export function parseExcerpt(html: string): ParsedExcerpt {
  // Decode entities before label matching so entity-encoded labels like
  // "Anbauh&ouml;he" match "Anbauhöhe". Keep &lt;/&gt; intact so the tag
  // structure survives; values are decoded again by the extractors.
  const decoded = html.replace(/&(?:[a-z]+|#\d+);/gi, (match) => {
    if (match === "&lt;" || match === "&gt;") return match;
    return HTML_ENTITIES[match] || match;
  });
  const teeart = extractLabelValue(decoded, "Teeart");
  const region = extractLabelValue(decoded, "Region");
  const erntedatum = extractLabelValue(decoded, "Erntedatum");
  const kultivar = extractLabelValue(decoded, "Kultivar");
  const anbauhoehe = extractLabelValue(decoded, "Anbauhöhe");
  const beschattung = extractLabelValue(decoded, "Beschattung");
  const geschmacksnoten = extractGeschmacksnoten(decoded);
  const prose = extractProse(decoded);
  const ulFacts = extractUlFacts(decoded);

  return {
    teeart,
    region,
    erntedatum,
    kultivar,
    anbauhoehe,
    beschattung,
    geschmacksnoten,
    prose,
    ulFacts,
  };
}

const TYPE_MAP: Record<string, string> = {
  "Grüner Tee": "green",
  "Weißer Tee": "white",
  "Schwarzer Tee": "black",
  "Oolong": "oolong",
  "Matcha": "green",
  "Gelber Tee": "yellow",
};

const COUNTRY_MAP: Record<string, string> = {
  südkorea: "KR",
  korea: "KR",
  japan: "JP",
  china: "CN",
  taiwan: "TW",
  indien: "IN",
  india: "IN",
  nepal: "NP",
  "sri lanka": "LK",
  ceylon: "LK",
  vietnam: "VN",
};

function inferTypeKey(teeart: string | null, title: string, tags: string[] | null): string | null {
  if (teeart) {
    for (const [german, key] of Object.entries(TYPE_MAP)) {
      if (teeart.includes(german)) {
        return key;
      }
    }
  }

  const lowerTitle = title.toLowerCase();
  const lowerTags = (tags ?? []).map((t) => t.toLowerCase());

  if (lowerTitle.includes("matcha") || lowerTags.some((t) => t.includes("matcha"))) {
    return "green";
  }
  if (lowerTitle.includes("wakoucha") || lowerTags.some((t) => t.includes("schwarz"))) {
    return "black";
  }
  if (lowerTitle.includes("baekcha") || lowerTags.some((t) => t.includes("weiß"))) {
    return "white";
  }
  if (lowerTitle.includes("oolong") || lowerTags.some((t) => t.includes("oolong"))) {
    return "oolong";
  }

  return "green";
}

function extractStyleRaw(teeart: string | null): string | null {
  if (!teeart) return null;

  const parts = teeart.split(",").map((p) => p.trim());
  if (parts.length >= 2) {
    return parts.slice(1).join(", ");
  }
  return null;
}

function inferCountry(origin: string | null, region: string | null): string | null {
  const text = (origin || region || "").toLowerCase();
  for (const [keyword, code] of Object.entries(COUNTRY_MAP)) {
    if (text.includes(keyword)) {
      return code;
    }
  }
  return null;
}

function parseOrigin(origin: string): { origin: string | null; country: string | null } {
  const parts = origin.split(",").map((s) => s.trim());
  const lastPart = parts[parts.length - 1];
  const normalized = lastPart.toLowerCase().replace(/[.\s]+$/, "");
  const country = COUNTRY_MAP[normalized] || null;
  if (!country) return { origin, country: null };
  const region = parts.slice(0, -1).join(", ");
  return { origin: region || null, country };
}

function parseElevation(anbauhoehe: string | null): number | null {
  if (!anbauhoehe) return null;
  const match = anbauhoehe.match(/(\d[\d,]*)/);
  if (match) {
    return parseInt(match[1].replace(/,/g, ""), 10);
  }
  return null;
}

function parseHarvestYear(harvestRaw: string | null): number | null {
  if (!harvestRaw) return null;
  const match = harvestRaw.match(/(20\d{2})/);
  if (match) {
    return parseInt(match[1], 10);
  }
  return null;
}

function parseWeightFromTitle(title: string): number | null {
  const match = title.match(/(\d+(?:\.\d+)?)\s*g/i);
  if (match) {
    return parseFloat(match[1]);
  }
  return null;
}

const WEIGHT_SUFFIX_RE = /\s*(?:-\s*)?(?:\(\s*)?\d+(?:\.\d+)?\s*g(?:rams?)?\s*\)?\s*$/i;

function stripWeightSuffix(name: string): string {
  return name.replace(WEIGHT_SUFFIX_RE, "").trim();
}

function parseWeightFromOptionValue(value: string): number | null {
  const match = value.match(/(\d+(?:\.\d+)?)\s*g/i);
  if (match) {
    return parseFloat(match[1]);
  }
  return null;
}

function buildHarvestRaw(erntedatum: string | null, ulFacts: string[]): string | null {
  if (erntedatum) return erntedatum;

  for (const fact of ulFacts) {
    if (/\d{4}/.test(fact) || /ernte/i.test(fact) || /frühling|sommer|herbst|winter|spring|summer|autumn|fall|winter/i.test(fact)) {
      return fact;
    }
  }
  return null;
}

function buildCultivarRaw(kultivar: string | null, ulFacts: string[]): string | null {
  if (kultivar) return kultivar;

  for (const fact of ulFacts) {
    if (/cultivar|native|yabukita|samidori|asahi|okumidori|kirari|tsuyuhikari|hakusei|blend|oya-ko|bancha/i.test(fact)) {
      return fact;
    }
  }
  return null;
}

function buildNotesRaw(prose: string | null, geschmacksnoten: string | null): string {
  const parts: string[] = [];
  if (prose) parts.push(prose);
  if (geschmacksnoten) parts.push(`Geschmacksnoten: ${geschmacksnoten}`);
  return parts.join("\n");
}

export async function mapToTeaRecord(item: SquarespaceItem): Promise<TeaRecord> {
  const parsed = parseExcerpt(item.excerpt);

  const typeKey = inferTypeKey(parsed.teeart, item.title, item.tags);
  const styleRaw = extractStyleRaw(parsed.teeart);
  const styleSearchText =
    styleRaw ?? ([item.title, ...(item.tags ?? [])].join(" ").trim() || null);
  const { origin, country } = parsed.region ? parseOrigin(parsed.region) : { origin: null, country: null };
  const originCountry = country ?? inferCountry(parsed.prose, parsed.region);
  const elevationMeters = parseElevation(parsed.anbauhoehe);
  const harvestRaw = buildHarvestRaw(parsed.erntedatum, parsed.ulFacts);
  const harvestYear = parseHarvestYear(harvestRaw);
  const season = extractSeason(harvestRaw);
  const producerRaw: string | null = null;
  const shadingRaw = parsed.beschattung === "-" ? null : parsed.beschattung;
  const cultivarRaw = buildCultivarRaw(parsed.kultivar, parsed.ulFacts);
  const notesRaw = buildNotesRaw(parsed.prose, parsed.geschmacksnoten);

  const available = item.variants.some((v) => v.unlimited || v.qtyInStock > 0);

  const offers = item.variants
    .filter((v) => v.price > 0)
    .map((v) => {
      let weightGrams: number | null = null;
      if (v.optionValues.length > 0) {
        weightGrams = parseWeightFromOptionValue(v.optionValues[0].value);
      }
      if (weightGrams === null) {
        weightGrams = parseWeightFromTitle(item.title);
      }
      const price = v.price / 100;
      return {
        price,
        weightGrams,
        available: v.unlimited || v.qtyInStock > 0,
      };
    });

  return {
    name: stripWeightSuffix(cleanTeaName(item.title)),
    url: `https://www.infinitealeaves.com${item.fullUrl}`,
    typeKey: typeKey || "green",
    styleRaw,
    styleSearchText,
    origin,
    originCountry,
    elevationMeters,
    harvestRaw,
    harvestYear,
    season,
    producerRaw,
    shadingRaw,
    cultivarRaw,
    notesRaw,
    available,
    offers,
  };
}