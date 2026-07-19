import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import { chromium, type Page } from "playwright";
import type { MeiLeafProductCard, MeiLeafProductDetail, MeiLeafTastingNote, MeiLeafVariant, MeiLeafProduct } from "./types.ts";
import { mapToTeaRecord } from "./parse.ts";
import { resolveStyle } from "../shared/matching.js";

const VENDOR_NAME = "Mei Leaf";
const VENDOR_WEBSITE = "https://meileaf.com";
const SCRAPER_VERSION = "meileaf@v3";
const BASE_URL = "https://meileaf.com";

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

// --- Product discovery from /teas/ page ---

async function discoverProducts(page: Page): Promise<MeiLeafProductCard[]> {
  console.log("📂 Navigating to /teas/ for product discovery...");
  await page.goto(`${BASE_URL}/teas/`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector("[data-product-name]", { timeout: 30000 });

  const cards = await page.evaluate(() => {
    const elements = [...document.querySelectorAll("[data-product-name]")];
    return elements.map((el) => {
      const link = el.querySelector("a");
      return {
        name: el.getAttribute("data-product-name") || "",
        price: el.getAttribute("data-product-price") || "",
        type: el.getAttribute("data-product-type") || "",
        rating: el.getAttribute("data-community-rating") || "",
        href: link ? link.getAttribute("href") || "" : "",
        cssClasses: el.className || "",
      };
    });
  });

  // Deduplicate by href
  const unique = [...new Map(cards.map((c) => [c.href, c])).values()];

  // Filter out tisanes, herbs, blends
  const filtered = unique.filter((c) => {
    if (c.type === "Tisanes" || c.type === "Herbs" || c.type === "Blend") return false;
    return true;
  });

  console.log(`   Found ${unique.length} total, ${filtered.length} after filtering`);
  return filtered;
}

// --- Product detail extraction ---

async function extractProductDetail(page: Page): Promise<{
  detail: MeiLeafProductDetail;
  tastingNotes: MeiLeafTastingNote[];
  subtitle: string | null;
  h1Name: string | null;
}> {
  // Wait for product detail section to load
  await page.waitForSelector("dt.product-detail__title", { timeout: 15000 }).catch(() => {});

  // Extract structured details (dt.product-detail__title / dd pairs)
  const detailResult = await page.evaluate(() => {
    const detail: Record<string, string | null> = {
      season: null,
      cultivar: null,
      origin: null,
      pickingProcessing: null,
      elevation: null,
    };

    const dts = document.querySelectorAll("dt.product-detail__title");
    dts.forEach((dt) => {
      const dd = dt.nextElementSibling;
      if (!dd) return;
      const label = dt.textContent.trim();
      const value = dd.textContent.trim();

      switch (label) {
        case "SEASON":
          detail.season = value || null;
          break;
        case "CULTIVAR":
          detail.cultivar = value || null;
          break;
        case "ORIGIN":
          detail.origin = value || null;
          break;
        case "PICKING & PROCESSING":
          detail.pickingProcessing = value || null;
          break;
        case "ELEVATION":
          detail.elevation = value || null;
          break;
      }
    });

    const h1 = document.querySelector("h1");
    let h1Name: string | null = null;
    let subtitle: string | null = null;
    if (h1) {
      h1Name = h1.textContent.trim();
      if (h1.nextElementSibling) {
        const next = h1.nextElementSibling;
        const text = next.textContent.trim();
        // Only use if it's short (likely a Chinese name, not tasting notes)
        if (text.length > 0 && text.length < 100) {
          subtitle = text;
        }
      }
    }

    // Extract tasting notes (dt elements starting with EYES, NOSE, MOUTH, BODY)
    const tastingNotes: Array<{ label: string; value: string }> = [];
    const allDts = document.querySelectorAll("dt");
    allDts.forEach((dt) => {
      const label = dt.textContent.trim();
      if (/^(EYES|NOSE|MOUTH|BODY)/.test(label)) {
        const dd = dt.nextElementSibling;
        if (dd) {
          tastingNotes.push({
            label,
            value: dd.textContent.trim(),
          });
        }
      }
    });

    return { detail, subtitle, tastingNotes, h1Name };
  });

  return {
    detail: detailResult.detail as unknown as MeiLeafProductDetail,
    tastingNotes: detailResult.tastingNotes,
    subtitle: detailResult.subtitle,
    h1Name: detailResult.h1Name,
  };
}

async function extractVariants(page: Page): Promise<MeiLeafVariant[]> {
  const rawVariants = await page.evaluate(() => {
    const options = document.querySelectorAll(".product-options__option");
    return [...options].map((opt) => {
      const ds = (opt as HTMLElement).dataset;
      return {
        value: ds.value || "",
        price: ds.price || "",
        saleprice: ds.saleprice || "",
        productid: ds.productid || "",
        instock: ds.instock || "0",
        text: opt.textContent.trim(),
      };
    });
  });

  return rawVariants.map((v) => ({
    value: v.value,
    price: parseFloat(v.price) || 0,
    salePrice: parseFloat(v.saleprice) || 0,
    productId: v.productid,
    inStock: v.instock === "1",
    weightGrams: parseWeight(v.text),
  }));
}

function parseWeight(text: string): number | null {
  const match = text.match(/(\d+)\s*g/i);
  return match ? parseInt(match[1], 10) : null;
}

// --- Main scraper ---

async function scrape() {
  const isDryRun = process.argv.includes("--dry");
  const isTest = process.argv.includes("--test");
  const isUpdate = process.argv.includes("--update");

  if (!isDryRun) {
    console.log("🔌 Connecting to Supabase...");
  }

  console.log(`🌿 Starting ${VENDOR_NAME} scraper${isDryRun ? " (DRY RUN)" : ""}${isTest ? " (TEST)" : ""}${isUpdate ? " (UPDATE)" : ""}`);

  // Resolve reference data
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

  // Launch browser
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent:
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  });
  const page = await context.newPage();

  let totalProducts = 0;
  let newProducts = 0;
  let updatedCount = 0;
  let skippedProducts = 0;
  let skippedNonTea = 0;
  let errorCount = 0;

  try {
    // Step 1: Discover all products
    const productCards = await discoverProducts(page);
    const cardsToProcess = isTest ? productCards.slice(0, 3) : productCards;

    console.log(`\n🍵 Processing ${cardsToProcess.length} products...\n`);

    // Step 2: Visit each product page
    for (let i = 0; i < cardsToProcess.length; i++) {
      const card = cardsToProcess[i];
      totalProducts++;

      const productUrl = card.href.startsWith("http")
        ? card.href
        : `${BASE_URL}${card.href}`;

      process.stdout.write(
        `   [${i + 1}/${cardsToProcess.length}] ${card.name}... `
      );

      try {
        await page.goto(productUrl, {
          waitUntil: "domcontentloaded",
          timeout: 30000,
        });

        const canonicalUrl = page.url();

        // Extract detail, tasting notes, and variants in parallel
        const [detailResult, variants] = await Promise.all([
          extractProductDetail(page),
          extractVariants(page),
        ]);

        const product: MeiLeafProduct = {
          name: detailResult.h1Name || card.name,
          url: canonicalUrl,
          subtitle: detailResult.subtitle,
          teaType: card.type,
          cssClasses: card.cssClasses,
          detail: detailResult.detail,
          tastingNotes: detailResult.tastingNotes,
          variants,
        };

        const mapped = await mapToTeaRecord(product);

        // Check for tea metadata
        const hasTeaMetadata =
          mapped.cultivarRaw ||
          mapped.harvestRaw ||
          mapped.notesRaw ||
          mapped.origin ||
          mapped.styleRaw;

        if (!hasTeaMetadata) {
          console.log("⏭️  (no metadata)");
          skippedNonTea++;
          continue;
        }

        if (isDryRun) {
          console.log();
          console.log(`      URL: ${mapped.url}`);
          console.log(`      Category: ${mapped.typeKey}`);
          console.log(`      Style: ${mapped.styleRaw}`);
          console.log(`      Origin: ${mapped.origin} (${mapped.originCountry})`);
          console.log(`      Cultivar: ${mapped.cultivarRaw}`);
          console.log(`      Elevation: ${mapped.elevationMeters}m`);
          console.log(`      Season: ${mapped.harvestRaw}`);
          console.log(`      Year: ${mapped.harvestYear}`);
          console.log(`      Offers: ${mapped.offers.length}`);
          if (mapped.notesRaw) {
            console.log(`      Notes: ${mapped.notesRaw.substring(0, 100)}...`);
          }
          newProducts++;
          continue;
        }

        // Check if tea already exists
        const { data: existing } = await supabase
          .from("tea")
          .select("id")
          .eq("url", mapped.url)
          .single();

        if (existing) {
          if (isUpdate) {
            let typeId: number | null = null;
            if (mapped.typeKey) {
              typeId =
                typeMap.get(mapped.typeKey.toLowerCase()) || null;
            }

            const styleId = await resolveStyle(mapped.styleRaw, mapped.typeKey);

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
              console.log(`❌ Update error: ${updateError.message}`);
              errorCount++;
            } else {
              updatedCount++;
              console.log(`↻ Updated (id: ${existing.id})`);
            }
          } else {
            skippedProducts++;
            console.log("⏭️  (exists)");
          }
          continue;
        }

        // Insert new tea
        let typeId: number | null = null;
        if (mapped.typeKey) {
          typeId =
            typeMap.get(mapped.typeKey.toLowerCase()) || null;
        }

        const styleId = await resolveStyle(mapped.styleRaw, mapped.typeKey);

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
          console.log(`❌ DB error: ${teaError.message}`);
          errorCount++;
          continue;
        }

        // Insert availability
        await supabase.from("availability_snapshot").insert({
          tea_id: teaData.id,
          available: mapped.available,
        });

        // Insert price snapshots
        for (const offer of mapped.offers) {
          if (offer.price > 0) {
            await supabase.from("price_snapshot").insert({
              tea_id: teaData.id,
              weight_grams: offer.weightGrams,
              price: offer.price,
              currency: "EUR",
            });
          }
        }

        newProducts++;
        console.log(`✓ (id: ${teaData.id})`);
        await new Promise((r) => setTimeout(r, 200));
      } catch (err) {
        errorCount++;
        console.log(
          `❌ Error: ${err instanceof Error ? err.message : String(err)}`
        );
      }

      // Polite delay between requests
      await new Promise((r) => setTimeout(r, 300));
    }
  } finally {
    await browser.close();
  }

  console.log(`\n📊 Summary:`);
  console.log(`   Total products found: ${totalProducts}`);
  console.log(`   New products saved: ${newProducts}`);
  console.log(`   Updated: ${updatedCount}`);
  console.log(`   Skipped (existing): ${skippedProducts}`);
  console.log(`   Skipped (no metadata): ${skippedNonTea}`);
  console.log(`   Errors: ${errorCount}`);
}

scrape().catch(console.error);
