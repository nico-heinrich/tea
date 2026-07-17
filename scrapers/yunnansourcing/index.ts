import { mapToTeaRecord } from "./parse.js";
import type { ShopifyProduct } from "./types.js";

const VENDOR_NAME = "Yunnan Sourcing";
const VENDOR_WEBSITE = "https://yunnansourcing.com";
const SCRAPER_VERSION = "yunnansourcing@v3";
const BASE_URL = "https://yunnansourcing.com";

const COLLECTIONS = [
  { path: "/collections/raw-pu-erh-tea/products.json", teaCategory: "Pu-erh" },
  { path: "/collections/ripe-pu-erh/products.json", teaCategory: "Pu-erh" },
  { path: "/collections/black-tea/products.json", teaCategory: "Black" },
  { path: "/collections/green-tea/products.json", teaCategory: "Green" },
  { path: "/collections/oolong-tea/products.json", teaCategory: "Oolong" },
  { path: "/collections/white-tea/products.json", teaCategory: "White" },
  { path: "/collections/hei-cha/products.json", teaCategory: "Pu-erh" },
];

const NON_TEA_PRODUCT_TYPES = [
  "Teaware", "Accessories", "Puzzle", "Gift Certificate",
  "Jigsaw Puzzle", "Silver Teapots and Wares",
  "Chaozhou Pottery", "Jian Shui Pottery", "Qin Zhou Pottery", "Yixing Pottery",
];

let supabase: any = null;
let upsertUnique: any = null;

async function initDb() {
  const db = await import("../shared/db.js");
  supabase = db.supabase;
  upsertUnique = db.upsertUnique;
}

async function fetchCollectionPage(path: string, page: number): Promise<ShopifyProduct[]> {
  const url = `${BASE_URL}${path}?limit=250&page=${page}`;
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Failed to fetch ${url}: ${response.statusText}`);
  const data = await response.json();
  return data.products || [];
}

async function scrape() {
  const isDryRun = process.argv.includes("--dry");
  const isTest = process.argv.includes("--test");
  const isUpdate = process.argv.includes("--update");
  const collections = isTest ? COLLECTIONS.slice(0, 1) : COLLECTIONS;

  if (!isDryRun) await initDb();

  console.log(`🌿 Starting Yunnan Sourcing scraper${isDryRun ? " (DRY RUN)" : ""}`);

  let vendorId = 1;
  let categoryMap = new Map<string, number>();

  if (!isDryRun) {
    vendorId = await upsertUnique(
      "vendor",
      { name: VENDOR_NAME, website: VENDOR_WEBSITE },
      "name"
    );
    console.log(`✓ Vendor: ${VENDOR_NAME} (id: ${vendorId})`);

    const { data: teaCategories } = await supabase
      .from("tea_category")
      .select("id, key");

    categoryMap = new Map(
      (teaCategories || []).map((r: any) => [r.key, r.id])
    );
    console.log(`✓ Reference data: ${categoryMap.size} tea categories`);
  }

  let totalProducts = 0;
  let newProducts = 0;
  let updatedCount = 0;
  let skippedProducts = 0;
  let skippedNonTea = 0;

  for (const collection of collections) {
    console.log(`\n📂 Fetching collection: ${collection.path}`);
    let page = 1;

    try {
      while (true) {
        const products = await fetchCollectionPage(collection.path, page);
        if (products.length === 0) break;

        console.log(`   Page ${page}: ${products.length} products`);

        for (const product of products) {
          totalProducts++;

          if (NON_TEA_PRODUCT_TYPES.includes(product.product_type)) {
            skippedNonTea++;
            continue;
          }

          const mapped = mapToTeaRecord(product);

          if (!isDryRun) {
            const { data: existing } = await supabase
              .from("tea")
              .select("id")
              .eq("url", mapped.url)
              .single();

            if (existing) {
              if (isUpdate) {
                let teaCategoryId: number | null = null;
                if (mapped.teaCategoryKey) {
                  teaCategoryId = categoryMap.get(mapped.teaCategoryKey.toLowerCase()) || null;
                }

                const { error: updateError } = await supabase
                  .from("tea")
                  .update({
                    elevation_meters: mapped.elevationMeters,
                    cultivar_raw: mapped.cultivarRaw,
                    scraper_version: SCRAPER_VERSION,
                  })
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

          const hasTeaMetadata = mapped.cultivarRaw || mapped.harvestRaw ||
            mapped.notesRaw || mapped.origin || mapped.producerRaw;
          if (!hasTeaMetadata) {
            console.log(`   ⚠️  Skipping (no tea metadata): ${mapped.name}`);
            skippedNonTea++;
            continue;
          }

          if (isDryRun) {
            console.log(`\n   📄 ${mapped.name}`);
            console.log(`      URL: ${mapped.url}`);
            console.log(`      Category: ${mapped.teaCategoryKey}`);
            console.log(`      Processing: ${mapped.processingRaw}`);
            console.log(`      Origin: ${mapped.origin} (${mapped.originCountry})`);
            console.log(`      Producer: ${mapped.producerRaw}`);
            console.log(`      Cultivar: ${mapped.cultivarRaw}`);
            console.log(`      Elevation: ${mapped.elevationMeters}m`);
            console.log(`      Season: ${mapped.harvestRaw}`);
            console.log(`      Year: ${mapped.harvestYear}`);
            console.log(`      Offers: ${mapped.offers.length}`);
            newProducts++;
            continue;
          }

          let teaCategoryId: number | null = null;
          if (mapped.teaCategoryKey) {
            teaCategoryId = categoryMap.get(mapped.teaCategoryKey.toLowerCase()) || null;
          }

          const teaRecord = {
            name: mapped.name,
            url: mapped.url,
            vendor: vendorId,
            tea_category: teaCategoryId,
            processing_raw: mapped.processingRaw,
            origin: mapped.origin,
            origin_country: mapped.originCountry,
            elevation_meters: mapped.elevationMeters,
            harvest_raw: mapped.harvestRaw,
            harvest_year: mapped.harvestYear,
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
              await supabase.from("price_snapshot").insert({
                tea_id: teaData.id,
                weight_grams: offer.weightGrams,
                price: offer.price,
                currency: "USD",
              });
            }
          }

          newProducts++;
          console.log(`      ✓ ${mapped.name} (id: ${teaData.id})`);
          await new Promise(r => setTimeout(r, 200));
        }

        if (products.length < 250) break;
        page++;
        await new Promise(r => setTimeout(r, 500));
      }
    } catch (error) {
      console.log(`   ❌ Collection error: ${error instanceof Error ? error.message : error}`);
    }
  }

  console.log(`\n📊 Summary:`);
  console.log(`   Total products found: ${totalProducts}`);
  console.log(`   New products saved: ${newProducts}`);
  console.log(`   Updated: ${updatedCount}`);
  console.log(`   Skipped (existing): ${skippedProducts}`);
  console.log(`   Skipped (non-tea): ${skippedNonTea}`);
}

scrape().catch(console.error);
