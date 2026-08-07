// Parsing logic for tea-addicts.de (Jimdo shop)
import type { CategoryCard, ProductDetail, Variant, TeaRecord } from "./types.js";
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

// --- Category card parsing -------------------------------------------------

const H2_NAME_RE = /<h2 class="product-name-1">([\s\S]*?)<\/h2>/g;
// Non-global variant: .match() on a /g regex returns full matches, not groups.
const H2_BLOCK_RE = /<h2 class="product-name-1">([\s\S]*?)<\/h2>/;
const GRADUATION_RE = /<p class="tea-graduation-1">([\s\S]*?)<\/p>/;
const BUTTON_RE = /<a class="button-s-dark" href="([^"]+)"/;
// First <p> without a class attribute inside a card block is the description.
// Graduation and info rows all carry classes; the description <p> is plain.
const PLAIN_P_RE = /<p(?![^>]*class=)[^>]*>([\s\S]*?)<\/p>/;

/**
 * Extract an info row by its icon (teesorte / herkunft / ernte / euro).
 * Each row is `<img alt="icon {name}"/>` followed by a
 * `<p class="tea-information-2 add-top-5">` value.
 */
function extractInfoRow(block: string, icon: string): string | null {
  const pattern = new RegExp(
    `alt="icon ${icon}"[\\s\\S]*?<p class="tea-information-2 add-top-5">([\\s\\S]*?)<\\/p>`,
    "i"
  );
  const match = block.match(pattern);
  return match ? decodeHtmlEntities(stripTags(match[1])) : null;
}

function parseCardBlock(block: string): CategoryCard | null {
  const h2 = block.match(H2_BLOCK_RE);
  if (!h2) return null;
  const name = decodeHtmlEntities(stripTags(h2[1]));
  if (!name) return null;

  const urlMatch = block.match(BUTTON_RE);
  if (!urlMatch) return null;

  const graduationMatch = block.match(GRADUATION_RE);
  const plainP = block.match(PLAIN_P_RE);

  return {
    name,
    url: urlMatch[1],
    styleRaw: graduationMatch ? decodeHtmlEntities(stripTags(graduationMatch[1])) : null,
    typeLabel: extractInfoRow(block, "teesorte"),
    originLabel: extractInfoRow(block, "herkunft"),
    harvestLabel: extractInfoRow(block, "ernte"),
    priceText: extractInfoRow(block, "euro"),
    description: plainP ? decodeHtmlEntities(stripTags(plainP[1])) : null,
  };
}

/** Parse a category page into product cards (one per `product-name-1` block). */
export function parseCategoryPage(html: string): CategoryCard[] {
  const cards: CategoryCard[] = [];
  const matches = [...html.matchAll(H2_NAME_RE)];
  for (let i = 0; i < matches.length; i++) {
    const start = matches[i].index ?? 0;
    const end = i + 1 < matches.length ? (matches[i + 1].index ?? html.length) : html.length;
    const block = html.slice(start, end);
    const card = parseCardBlock(block);
    if (card) cards.push(card);
  }
  return cards;
}

// --- Product detail parsing ------------------------------------------------

const NAME_RE = /<span class="fn" itemprop="name">([\s\S]*?)<\/span>/;
const SHORT_DESC_RE = /class="cc-shop-product-short-desc">([\s\S]*?)<\/div>/;
const DESCRIPTION_RE = /class="description" itemprop="description">([\s\S]*?)<\/div>/;
const OPTION_RE = /<option class="j-product__variants__item"([\s\S]*?)<\/option>/g;
const PARAMS_RE = /data-params="([\s\S]*?)"/;
const NON_VARIANT_PRICE_RE = /itemprop="price" content="([\d.]+)"/;
const BASIC_PRICE_UNIT_RE = /cc-shop-product-basic-price-unit">\s*([\d.,]+)\s*g/;
const AVAILABILITY_META_RE = /<meta itemprop="availability" content="([^"]+)"/;

// Info sections ("Teesorte" / "Herkunft" / "Ernte") on the product page render
// a label, a value (h3.tea-information-1) and a following detail paragraph
// (p.center-align) in a sibling module. The Teesorte detail sometimes names the
// style itself, e.g. "Auch als Ya Bao bezeichnet kommt dieser Tee…".
const TEESORTE_SUBTITLE_RE = new RegExp(
  `<p class="headline-os-s center-align grey-333 add-top-10">\\s*Teesorte\\s*</p>` +
    `[\\s\\S]*?<h3 class="tea-information-1 grey-333">[\\s\\S]*?</h3>` +
    `\\s*(?:</div>\\s*)+` +
    `<div id="[^"]*" class="j-module n j-text ">\\s*<p class="center-align">([\\s\\S]*?)</p>`,
  "i"
);
const STYLE_SYNONYM_RE = /auch\s+als\s+([^,.]+?)\s+bezeichnet/i;

/** "Auch als Ya Bao bezeichnet…" → "Ya Bao" (null when the subtitle names no style). */
function extractStyleSynonym(html: string): string | null {
  const section = html.match(TEESORTE_SUBTITLE_RE);
  if (!section) return null;
  const subtitle = decodeHtmlEntities(stripTags(section[1]));
  const match = subtitle.match(STYLE_SYNONYM_RE);
  return match ? match[1].trim() : null;
}

// Comparison/category clauses must not contribute to style matching, e.g.
// Long Leaf "inspiriert vom chinesischen Dianhong" (not a Dian Hong) and
// Laos Special Pu'er "Kategorie Heicha … Dark Tea" (generic, not Hei Cha Zhuan).
const STYLE_NOISE_RE =
  /inspiriert\s+vom?[^.,;]+|vergleichbar\s+mit[^.,;]+|Kategorie\s+[^.,;]+/gi;

/** Description slice used only as a style-matching fallback. */
function styleHintFromDescription(description: string): string | null {
  const hint = description
    .replace(STYLE_NOISE_RE, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 500);
  return hint || null;
}

/** Weight comes from the option's `content`/`title` attribute (e.g. "100g"). */
function parseVariantWeight(optionHtml: string): number | null {
  const content = optionHtml.match(/content="(\d+(?:\.\d+)?)\s*g/i);
  if (content) return parseFloat(content[1]);
  const title = optionHtml.match(/title="(\d+(?:\.\d+)?)\s*g/i);
  if (title) return parseFloat(title[1]);
  return null;
}

/**
 * Some variants carry no gram weight in their label (e.g. "Mit Bambusrohr"),
 * but data-params always includes the base price per unit (e.g. 49,80 € / 100 g).
 * Derive the weight as price / basicPrice × unitGrams.
 */
function parseBasicPriceWeight(params: {
  price?: number;
  basicPrice?: number;
  basicPriceUnit?: string;
}): number | null {
  if (
    typeof params.price !== "number" ||
    typeof params.basicPrice !== "number" ||
    params.price <= 0 ||
    params.basicPrice <= 0
  ) {
    return null;
  }
  const unitMatch = (params.basicPriceUnit || "").match(/(\d+(?:[.,]\d+)?)\s*g/i);
  if (!unitMatch) return null;
  const unitGrams = parseFloat(unitMatch[1].replace(",", "."));
  if (!unitGrams || unitGrams <= 0) return null;
  const weightGrams = (params.price / params.basicPrice) * unitGrams;
  if (weightGrams <= 0) return null;
  return Math.round(weightGrams * 10) / 10;
}

/** Parse variant offers from `<option class="j-product__variants__item" data-params="...">`. */
function parseVariants(html: string): Variant[] {
  const variants: Variant[] = [];
  for (const match of html.matchAll(OPTION_RE)) {
    const optionHtml = match[1];
    const paramsMatch = optionHtml.match(PARAMS_RE);
    if (!paramsMatch) continue;

    let params: { price?: number; availability?: number; basicPrice?: number; basicPriceUnit?: string };
    try {
      // data-params JSON quotes are HTML-entity encoded (&quot;)
      params = JSON.parse(paramsMatch[1].replace(/&quot;/g, '"'));
    } catch {
      continue;
    }

    if (typeof params.price !== "number" || params.price <= 0) continue;
    // Jimdo availability: 1 = in stock, 2 = limited but available; 0/absent = sold out
    const availability = typeof params.availability === "number" ? params.availability : 0;
    const weightGrams = parseVariantWeight(optionHtml) ?? parseBasicPriceWeight(params);
    variants.push({
      weightGrams,
      price: params.price,
      available: availability >= 1,
    });
  }
  return variants;
}

/**
 * Non-variant products (e.g. Greenday, Moonlight White) expose the price via
 * `itemprop="price" content="..."`. Weight falls back through short-desc
 * ("100 Gr. Cake"), basic-price-unit, then the description ("100g").
 */
function parseNonVariantOffer(
  html: string,
  shortDesc: string | null,
  description: string | null
): Variant | null {
  const priceMatch = html.match(NON_VARIANT_PRICE_RE);
  if (!priceMatch) return null;
  const price = parseFloat(priceMatch[1]);
  if (price <= 0) return null;

  let weightGrams: number | null = null;
  if (shortDesc) {
    const weight = shortDesc.match(/(\d+(?:\.\d+)?)\s*gr/i);
    if (weight) weightGrams = parseFloat(weight[1]);
  }
  if (weightGrams === null) {
    const unit = html.match(BASIC_PRICE_UNIT_RE);
    if (unit) weightGrams = parseFloat(unit[1].replace(",", "."));
  }
  if (weightGrams === null && description) {
    const weight = description.match(/(\d+(?:\.\d+)?)\s*g/i);
    if (weight) weightGrams = parseFloat(weight[1]);
  }

  const availableMatch = html.match(AVAILABILITY_META_RE);
  const available = availableMatch ? !/outofstock/i.test(availableMatch[1]) : true;

  return { weightGrams, price, available };
}

/**
 * Parse a product detail page. Returns null when the page is not a product
 * page (e.g. Lauryn redirects to the category page).
 */
export function parseProductPage(html: string): ProductDetail | null {
  if (!html.includes("cc-shop-product-desc")) return null;

  const nameMatch = html.match(NAME_RE);
  const shortDescMatch = html.match(SHORT_DESC_RE);
  const descriptionMatch = html.match(DESCRIPTION_RE);

  const shortDesc = shortDescMatch ? stripTags(shortDescMatch[1]) : null;
  const description = descriptionMatch
    ? decodeHtmlEntities(stripTags(descriptionMatch[1]))
    : null;

  let variants = parseVariants(html);
  if (variants.length === 0) {
    const single = parseNonVariantOffer(html, shortDesc, description);
    if (single) variants = [single];
  }

  return {
    name: nameMatch ? decodeHtmlEntities(stripTags(nameMatch[1])) : null,
    shortDesc,
    description,
    styleSynonym: extractStyleSynonym(html),
    variants,
    available: variants.length > 0 ? variants.some((v) => v.available) : true,
  };
}

// --- Mapping to TeaRecord ---------------------------------------------------

const TYPE_LABEL_MAP: Record<string, string> = {
  "grüner tee": "green",
  "weißer tee": "white",
  "schwarzer tee": "black",
  "wulong tee": "oolong",
  "ripe pu'er": "dark",
  "raw pu'er": "dark",
  "sheng pu-erh": "dark",
  "shou pu-erh": "dark",
};

const COUNTRY_MAP: Record<string, string> = {
  japan: "JP",
  china: "CN",
  taiwan: "TW",
  nepal: "NP",
  indien: "IN",
  india: "IN",
  "sri lanka": "LK",
  ceylon: "LK",
  vietnam: "VN",
  georgien: "GE",
  laos: "LA",
  malawi: "MW",
  korea: "KR",
  "south korea": "KR",
  thailand: "TH",
  kenya: "KE",
  portugal: "PT",
  azoren: "PT",
};

function inferTypeKey(typeLabel: string | null, categoryHint: string | null): string | null {
  const text = (typeLabel || "").toLowerCase().replace(/\+/g, "").trim();
  if (text) {
    for (const [label, key] of Object.entries(TYPE_LABEL_MAP)) {
      if (text.includes(label)) return key;
    }
    if (/pu[\s-]?er|puer/.test(text)) return "dark";
  }
  return categoryHint;
}

/** "Shizuoka / Japan" → origin "Shizuoka", country "JP". */
function parseOrigin(label: string | null): { origin: string | null; originCountry: string | null } {
  if (!label) return { origin: null, originCountry: null };
  const parts = label.split("/").map((s) => s.trim()).filter(Boolean);
  const countryPart = (parts[parts.length - 1] ?? "").toLowerCase();
  const originCountry = COUNTRY_MAP[countryPart] || null;
  if (originCountry && parts.length > 1) {
    return { origin: parts.slice(0, -1).join("/").trim() || null, originCountry };
  }
  return { origin: label, originCountry };
}

function parseHarvestYear(harvestRaw: string | null): number | null {
  if (!harvestRaw) return null;
  const match = harvestRaw.match(/(20\d{2})/);
  return match ? parseInt(match[1], 10) : null;
}

/** Short-desc that is only a weight ("100 Gr. Cake") is not a style. */
const WEIGHT_ONLY_RE = /^\d+(?:[.,]\d+)?\s*(?:g|gr)\b/i;

/** Card price text ("10,50 / 50g", "3,95/60g") → { price, weightGrams }. */
function parseCardPrice(priceText: string | null): { price: number; weightGrams: number } | null {
  if (!priceText) return null;
  const match = priceText.match(/([\d.,]+)\s*\/\s*([\d.,]+)\s*g/i);
  if (!match) return null;
  const price = parseFloat(match[1].replace(",", "."));
  const weightGrams = parseFloat(match[2].replace(",", "."));
  if (Number.isNaN(price) || Number.isNaN(weightGrams) || price <= 0 || weightGrams <= 0) {
    return null;
  }
  return { price, weightGrams };
}

export function mapToTeaRecord(
  card: CategoryCard,
  product: ProductDetail | null,
  categoryHint: string | null
): TeaRecord {
  const styleFromProduct =
    product?.shortDesc && !WEIGHT_ONLY_RE.test(product.shortDesc) ? product.shortDesc : null;
  const styleFromInfo = product?.styleSynonym || null;
  const styleRaw = styleFromInfo || card.styleRaw || styleFromProduct;
  const styleSearchText =
    [styleFromInfo, card.styleRaw, styleFromProduct, card.name, card.typeLabel]
      .filter(Boolean)
      .join(" ")
      .trim() || card.name;
  const styleFallbackText = product?.description ? styleHintFromDescription(product.description) : null;

  const { origin, originCountry } = parseOrigin(card.originLabel);
  const harvestRaw = card.harvestLabel || null;
  const notesRaw = product?.description || card.description || "";

  let offers = product && product.variants.length > 0 ? product.variants : [];
  if (offers.length === 0) {
    const cardOffer = parseCardPrice(card.priceText);
    if (cardOffer) offers = [{ ...cardOffer, available: true }];
  }

  return {
    name: product?.name || card.name,
    url: card.url,
    typeKey: inferTypeKey(card.typeLabel, categoryHint) || "green",
    styleRaw,
    styleSearchText,
    styleFallbackText,
    origin,
    originCountry,
    elevationMeters: null,
    harvestRaw,
    harvestYear: parseHarvestYear(harvestRaw),
    season: extractSeason(harvestRaw),
    producerRaw: null,
    shadingRaw: null,
    cultivarRaw: null,
    notesRaw,
    available: product ? product.available : true,
    offers,
  };
}
