import { parseProductPage, mapToTeaRecord } from "./parse.js";
import { cleanTeaName } from "../shared/cleanName.js";

const VENDOR_NAME = "Yoshi en";
const VENDOR_WEBSITE = "https://www.yoshien.com";
const SCRAPER_VERSION = "yoshien@v3";

let supabase: any = null;
let upsertUnique: any = null;

async function initDb() {
  const db = await import("../shared/db.js");
  supabase = db.supabase;
  upsertUnique = db.upsertUnique;
}

const CATEGORIES = [
  { url: "https://www.yoshien.com/matcha/", type: "Green" },
  { url: "https://www.yoshien.com/gruener-tee/", type: "Green" },
  { url: "https://www.yoshien.com/weisser-tee/", type: "White" },
  { url: "https://www.yoshien.com/oolong-tee/", type: "Oolong" },
  { url: "https://www.yoshien.com/schwarzer-tee/", type: "Black" },
  { url: "https://www.yoshien.com/pu-erh-tee/", type: "Dark" },
];

// Extract product URLs from category page HTML
function extractProductUrls(html: string): string[] {
  const urls: string[] = [];
  const regex = /href="(https:\/\/www\.yoshien\.com\/[^"]+\.html)"/g;
  let match;

  while ((match = regex.exec(html)) !== null) {
    urls.push(match[1]);
  }

  return [...new Set(urls)];
}


async function fetchPage(url: string): Promise<string> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Failed to fetch ${url}: ${response.statusText}`);
  return response.text();
}

async function scrape() {
  const isDryRun = process.argv.includes("--dry");
  const isUpdate = process.argv.includes("--update");

  if (!isDryRun) {
    await initDb();
  }

  console.log(`🌿 Starting Yoshien scraper${isDryRun ? " (DRY RUN)" : ""}${isUpdate ? " (UPDATE)" : ""}`);

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

    console.log(
      `✓ Reference data: ${typeMap.size} tea types`
    );
  }

  let totalProducts = 0;
  let newProducts = 0;
  let skippedProducts = 0;
  let updatedProducts = 0;

  for (const category of CATEGORIES) {
    console.log(`\n📂 Fetching category: ${category.url}`);

    try {
      const categoryHtml = await fetchPage(category.url);
      const productUrls = extractProductUrls(categoryHtml);

      console.log(`   Found ${productUrls.length} products`);

      for (const url of productUrls) {
        totalProducts++;

        if (!isDryRun && !isUpdate) {
          const { data: existing } = await supabase
            .from("tea")
            .select("id")
            .eq("url", url)
            .single();

          if (existing) {
            skippedProducts++;
            continue;
          }
        }

        try {
          const html = await fetchPage(url);
          const detail = parseProductPage(html);

          if (!detail) {
            console.log(`   ⚠️  Failed to parse: ${url}`);
            continue;
          }

          const mapped = mapToTeaRecord(detail, category.type);

          if (!isDryRun && isUpdate) {
            const { data: existing } = await supabase
              .from("tea")
              .select("id")
              .eq("url", url)
              .single();

            if (existing) {
              const { error: updateError } = await supabase
                .from("tea")
                .update({
                  name: cleanTeaName(detail.name),
                  cultivar_raw: detail.cultivar,
                  season: mapped.season,
                  scraper_version: SCRAPER_VERSION,
                })
                .eq("id", existing.id);

              if (updateError) {
                console.log(`      ❌ Update error: ${updateError.message}`);
              } else {
                updatedProducts++;
                console.log(`      ↻ ${detail.name} (id: ${existing.id})`);
              }
              await new Promise((r) => setTimeout(r, 300));
              continue;
            }
          }

          const hasTeaMetadata = detail.cultivar || detail.ernte || detail.beschattung ||
                                detail.charakter || detail.terroir || detail.anbau;
          if (!hasTeaMetadata) {
            console.log(`   ⚠️  Skipping (no tea metadata): ${detail.name}`);
            continue;
          }

          const NON_TEA_STYLE = ["schokolade", "teezubehör", "glas", "löffel", "teekanne", "teetasse", "flasche", "becher"];
          if (NON_TEA_STYLE.some(p => mapped.styleRaw.toLowerCase().includes(p))) {
            console.log(`   ⚠️  Skipping (not tea): ${detail.name} [${mapped.styleRaw}]`);
            continue;
          }

          if (isDryRun) {
            console.log(`\n   📄 ${detail.name}`);
            console.log(`      URL: ${url}`);
            console.log(`      Category: ${detail.category}`);
            console.log(`      Category: ${mapped.typeKey}`);
            console.log(`      Style: ${mapped.styleKey}`);
            console.log(`      Origin: ${mapped.origin}`);
            console.log(`      Country: ${mapped.originCountry}`);
            console.log(`      Elevation: ${mapped.elevationMeters}m`);
            console.log(`      Producer: ${mapped.producerRaw}`);
            console.log(`      Shading: ${mapped.shadingRaw}`);
            console.log(`      Cultivar: ${detail.cultivar}`);
            console.log(`      Season: ${mapped.harvestRaw}`);
            console.log(`      Year: ${mapped.harvestYear}`);
            console.log(`      Offers: ${detail.offers.length}`);

            newProducts++;
            await new Promise((r) => setTimeout(r, 300));
            continue;
          }

          // Resolve IDs
          let typeId: number | null = null;
          if (mapped.typeKey) {
            typeId = typeMap.get(mapped.typeKey.toLowerCase()) || null;
          }

          const teaRecord = {
            name: cleanTeaName(detail.name),
            url,
            vendor: vendorId,
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
            cultivar_raw: detail.cultivar,
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
            available: detail.availability.includes("InStock"),
          });

          // Insert all offers as price snapshots
          for (const offer of detail.offers) {
            if (offer.price > 0) {
              await supabase.from("price_snapshot").insert({
                tea_id: teaData.id,
                weight_grams: offer.weightGrams || detail.weightGrams,
                price: offer.price,
                currency: "EUR",
              });
            }
          }

          newProducts++;
          console.log(`      ✓ ${detail.name} (id: ${teaData.id})`);

          await new Promise((r) => setTimeout(r, 500));
        } catch (error) {
          console.log(`      ❌ Error: ${error instanceof Error ? error.message : error}`);
        }
      }
    } catch (error) {
      console.log(`   ❌ Category error: ${error instanceof Error ? error.message : error}`);
    }
  }

  console.log(`\n📊 Summary:`);
  console.log(`   Total products found: ${totalProducts}`);
  console.log(`   New products saved: ${newProducts}`);
  console.log(`   Updated: ${updatedProducts}`);
  console.log(`   Skipped (existing): ${skippedProducts}`);
}

scrape().catch(console.error);
