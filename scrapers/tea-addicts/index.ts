import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import type { CategoryCard, TeaRecord } from "./types.js";
import { parseCategoryPage, parseProductPage, mapToTeaRecord } from "./parse.js";
import { resolveStyle } from "../shared/matching.js";
import { normalizeToUsd100g } from "../shared/fx.js";

const VENDOR_NAME = "Tea Addicts";
const VENDOR_WEBSITE = "https://www.tea-addicts.de";
const SCRAPER_VERSION = "tea-addicts@v4";
const BASE_URL = "https://www.tea-addicts.de";
const BROWSER_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";

const CATEGORIES: { path: string; typeKey: string | null }[] = [
  { path: "/gruener-tee/", typeKey: "green" },
  { path: "/schwarzer-tee/", typeKey: "black" },
  { path: "/weisser-tee/", typeKey: "white" },
  { path: "/wulong-tee/", typeKey: "oolong" },
  { path: "/tee/pu-erh-tee/", typeKey: "dark" },
  // Sale page: only products not already seen (Lauryn) are kept
  { path: "/tee/reduziert/", typeKey: null },
];

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error("Missing SUPABASE_URL or SUPABASE_KEY env vars");
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function upsertUnique<T extends Record<string, unknown>>(
  table: string,
  record: T,
  uniqueField: string
): Promise<number> {
  const value = record[uniqueField];

  const { data: existing } = await supabase
    .from(table)
    .select("id")
    .eq(uniqueField, value)
    .single();

  if (existing) {
    return existing.id;
  }

  const { data, error } = await supabase
    .from(table)
    .insert(record)
    .select("id")
    .single();

  if (error) throw error;
  return data.id;
}

async function fetchHtml(url: string): Promise<string> {
  const response = await fetch(url, {
    headers: {
      "User-Agent": BROWSER_UA,
      "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    },
    redirect: "follow",
  });
  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status} ${response.statusText}`);
  }
  return response.text();
}

async function scrape() {
  const isDryRun = process.argv.includes("--dry");
  const isUpdate = process.argv.includes("--update");

  if (!isDryRun) {
    console.log("🔌 Connecting to Supabase...");
  }

  console.log(`🌿 Starting ${VENDOR_NAME} scraper${isDryRun ? " (DRY RUN)" : ""}`);

  let vendorId = 1;
  let typeMap = new Map<string, number>();

  if (!isDryRun) {
    vendorId = await upsertUnique(
      "vendor",
      { name: VENDOR_NAME, website: VENDOR_WEBSITE },
      "name"
    );
    console.log(`✓ Vendor: ${VENDOR_NAME} (id: ${vendorId})`);

    const { data: teaCategories } = await supabase
      .from("type")
      .select("id, key");

    typeMap = new Map(
      (teaCategories || []).map((r: any) => [r.key, r.id])
    );
    console.log(`✓ Reference data: ${typeMap.size} tea types`);
  }

  let totalProducts = 0;
  let newProducts = 0;
  let updatedCount = 0;
  let skippedProducts = 0;
  let skippedNonTea = 0;

  const seenUrls = new Set<string>();
  const uniqueCards: { card: CategoryCard; typeKey: string | null }[] = [];

  console.log(`\n📂 Fetching category pages...`);

  for (const category of CATEGORIES) {
    const url = `${BASE_URL}${category.path}`;
    try {
      const html = await fetchHtml(url);
      const cards = parseCategoryPage(html);
      console.log(`   ${category.path}: ${cards.length} products`);

      for (const card of cards) {
        const normalizedUrl = card.url.replace(/\/+$/, "");
        if (seenUrls.has(normalizedUrl)) continue;
        seenUrls.add(normalizedUrl);
        uniqueCards.push({ card: { ...card, url: normalizedUrl }, typeKey: category.typeKey });
      }
    } catch (error) {
      console.log(`   ❌ Category error (${category.path}): ${error instanceof Error ? error.message : error}`);
    }
    await new Promise((r) => setTimeout(r, 300));
  }

  console.log(`\n📦 ${uniqueCards.length} unique products found`);

  for (const { card, typeKey } of uniqueCards) {
    totalProducts++;

    const productUrl = `${BASE_URL}${card.url}`;

    let product = null;
    try {
      const html = await fetchHtml(productUrl);
      product = parseProductPage(html);
      if (!product) {
        console.log(`   ⚠️  No product data for ${card.name}, using card data`);
      }
    } catch (error) {
      console.log(`   ⚠️  Product fetch failed for ${card.name}: ${error instanceof Error ? error.message : error}`);
    }

    const mapped = mapToTeaRecord(card, product, typeKey);
    if (!mapped) {
      console.log(`   ⚠️  Skipping (unknown tea type): ${card.name}`);
      skippedNonTea++;
      continue;
    }
    mapped.url = `${BASE_URL}${mapped.url}`;

    const hasTeaMetadata = mapped.cultivarRaw || mapped.harvestRaw ||
      mapped.notesRaw || mapped.origin || mapped.producerRaw;
    if (!hasTeaMetadata) {
      console.log(`   ⚠️  Skipping (no tea metadata): ${mapped.name}`);
      skippedNonTea++;
      continue;
    }

    const nonTeaPatterns = [
      "schokolade", "teezubehör", "glas", "löffel",
      "teekanne", "teetasse", "flasche", "becher"
    ];
    const styleLower = (mapped.styleRaw || "").toLowerCase();
    if (nonTeaPatterns.some((p) => styleLower.includes(p))) {
      console.log(`   ⚠️  Skipping (non-tea style): ${mapped.name}`);
      skippedNonTea++;
      continue;
    }

    if (!isDryRun) {
      const { data: existing } = await supabase
        .from("tea")
        .select("id")
        .eq("url", mapped.url)
        .single();

      if (existing) {
        if (isUpdate) {
          let typeId: number | null = null;
          if (mapped.typeKey) {
            typeId = typeMap.get(mapped.typeKey.toLowerCase()) || null;
          }

          const styleId = await resolveStyle(mapped.styleSearchText, mapped.typeKey);

          const updatePayload: Record<string, unknown> = {
            name: mapped.name,
            type: typeId,
            style_raw: mapped.styleRaw,
            origin: mapped.origin,
            origin_country: mapped.originCountry,
            elevation_meters: mapped.elevationMeters,
            harvest_raw: mapped.harvestRaw,
            harvest_year: mapped.harvestYear,
            season: mapped.season,
            producer_raw: mapped.producerRaw,
            shading_raw: mapped.shadingRaw,
            cultivar_raw: mapped.cultivarRaw,
            notes_raw: mapped.notesRaw,
            scraper_version: SCRAPER_VERSION,
          };
          if (styleId) updatePayload.style = styleId;

          const { error: updateError } = await supabase
            .from("tea")
            .update(updatePayload)
            .eq("id", existing.id);

          if (updateError) {
            console.log(`      ❌ Update error: ${updateError.message}`);
          } else {
            updatedCount++;
            console.log(`      ↻ ${mapped.name} (id: ${existing.id})`);
          }
        } else {
          skippedProducts++;
        }
        continue;
      }
    }

    if (isDryRun) {
      console.log(`\n   📄 ${mapped.name}`);
      console.log(`      URL: ${mapped.url}`);
      console.log(`      Type: ${mapped.typeKey}`);
      console.log(`      Style: ${mapped.styleRaw}`);
      console.log(`      Origin: ${mapped.origin} (${mapped.originCountry})`);
      console.log(`      Harvest: ${mapped.harvestRaw} (${mapped.harvestYear}, ${mapped.season})`);
      console.log(`      Offers: ${mapped.offers.length}`);
      for (const offer of mapped.offers) {
        console.log(`         - ${offer.weightGrams}g @ ${offer.price} EUR (available: ${offer.available})`);
      }
      newProducts++;
      continue;
    }

    let typeId: number | null = null;
    if (mapped.typeKey) {
      typeId = typeMap.get(mapped.typeKey.toLowerCase()) || null;
    }

    const styleId = await resolveStyle(mapped.styleSearchText, mapped.typeKey);

    const teaRecord = {
      name: mapped.name,
      url: mapped.url,
      vendor: vendorId,
      type: typeId,
      style: styleId,
      style_raw: mapped.styleRaw,
      origin: mapped.origin,
      origin_country: mapped.originCountry,
      elevation_meters: mapped.elevationMeters,
      harvest_raw: mapped.harvestRaw,
      harvest_year: mapped.harvestYear,
      season: mapped.season,
      producer_raw: mapped.producerRaw,
      shading_raw: mapped.shadingRaw,
      cultivar_raw: mapped.cultivarRaw,
      notes_raw: mapped.notesRaw,
      scraper_version: SCRAPER_VERSION,
    };

    const { data: teaData, error: teaError } = await supabase
      .from("tea")
      .insert(teaRecord)
      .select("id")
      .single();

    if (teaError) {
      console.log(`      ❌ DB error: ${teaError.message}`);
      continue;
    }

    await supabase.from("availability_snapshot").insert({
      tea_id: teaData.id,
      available: mapped.available,
    });

    for (const offer of mapped.offers) {
      if (offer.price > 0) {
        const fx = await normalizeToUsd100g(offer.price, offer.weightGrams, "EUR");
        await supabase.from("price_snapshot").insert({
          tea_id: teaData.id,
          weight_grams: offer.weightGrams,
          price: offer.price,
          currency: "EUR",
          price_100g_usd: fx.price100gUsd,
          fx_rate_usd: fx.fxRateUsd,
        });
      }
    }

    newProducts++;
    console.log(`      ✓ ${mapped.name} (id: ${teaData.id})`);
    await new Promise((r) => setTimeout(r, 300));
  }

  console.log(`\n📊 Summary:`);
  console.log(`   Total products found: ${totalProducts}`);
  console.log(`   New products saved: ${newProducts}`);
  console.log(`   Updated: ${updatedCount}`);
  console.log(`   Skipped (existing): ${skippedProducts}`);
  console.log(`   Skipped (non-tea/unknown): ${skippedNonTea}`);
}

scrape().catch(console.error);
