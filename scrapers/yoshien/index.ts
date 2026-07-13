import { parseProductPage, mapToTeaRecord } from "./parse.js";

const VENDOR_NAME = "Yoshi en";
const VENDOR_WEBSITE = "https://www.yoshien.com";

let supabase: any = null;
let upsertUnique: any = null;

async function initDb() {
  const db = await import("../shared/db.js");
  supabase = db.supabase;
  upsertUnique = db.upsertUnique;
}

const CATEGORIES = [
  { url: "https://www.yoshien.com/matcha/", oxidationLevel: "Green" },
  { url: "https://www.yoshien.com/gruener-tee/", oxidationLevel: "Green" },
  { url: "https://www.yoshien.com/weisser-tee/", oxidationLevel: "White" },
  { url: "https://www.yoshien.com/oolong-tee/", oxidationLevel: "Oolong" },
  { url: "https://www.yoshien.com/schwarzer-tee/", oxidationLevel: "Black" },
  { url: "https://www.yoshien.com/pu-erh-tee/", oxidationLevel: "Dark" },
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

  if (!isDryRun) {
    await initDb();
  }

  console.log(`🌿 Starting Yoshien scraper${isDryRun ? " (DRY RUN)" : ""}`);

  let vendorId = 1;
  let oxidationMap = new Map<string, number>();
  let processingMap = new Map<string, number>();
  let cultivarMap = new Map<string, number>();
  let producerMap = new Map<string, number>();

  if (!isDryRun) {
    vendorId = await upsertUnique(
      "vendor",
      { name: VENDOR_NAME, website: VENDOR_WEBSITE },
      "name"
    );
    console.log(`✓ Vendor: ${VENDOR_NAME} (id: ${vendorId})`);

    const [oxidationLevels, processingMethods, cultivars, producers] =
      await Promise.all([
        supabase.from("oxidation_level").select("id, key"),
        supabase.from("processing").select("id, key"),
        supabase.from("cultivar").select("id, key"),
        supabase.from("producer").select("id, name"),
      ]);

    oxidationMap = new Map(
      (oxidationLevels.data || []).map((r: any) => [r.key, r.id])
    );
    processingMap = new Map(
      (processingMethods.data || []).map((r: any) => [r.key, r.id])
    );
    cultivarMap = new Map(
      (cultivars.data || []).map((r: any) => [r.key, r.id])
    );
    producerMap = new Map(
      (producers.data || []).map((r: any) => [r.name, r.id])
    );

    console.log(
      `✓ Reference data: ${oxidationMap.size} oxidation, ${processingMap.size} processing`
    );
  }

  let totalProducts = 0;
  let newProducts = 0;
  let skippedProducts = 0;

  for (const category of CATEGORIES) {
    console.log(`\n📂 Fetching category: ${category.url}`);

    try {
      const categoryHtml = await fetchPage(category.url);
      const productUrls = extractProductUrls(categoryHtml);

      console.log(`   Found ${productUrls.length} products`);

      for (const url of productUrls) {
        totalProducts++;

        if (!isDryRun) {
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

          const mapped = mapToTeaRecord(detail, category.oxidationLevel);

          if (isDryRun) {
            console.log(`\n   📄 ${detail.name}`);
            console.log(`      URL: ${url}`);
            console.log(`      Category: ${detail.category}`);
            console.log(`      Oxidation: ${mapped.oxidationLevelKey}`);
            console.log(`      Processing: ${mapped.processingKey}`);
            console.log(`      Origin: ${mapped.origin}`);
            console.log(`      Country: ${mapped.originCountry}`);
            console.log(`      Elevation: ${mapped.elevationMeters}m`);
            console.log(`      Producer: ${mapped.producerName}`);
            console.log(`      Shading: ${mapped.shading}`);
            console.log(`      Cultivar: ${detail.cultivar}`);
            console.log(`      Harvest: ${detail.ernte}`);

            newProducts++;
            await new Promise((r) => setTimeout(r, 300));
            continue;
          }

          // Resolve IDs
          let oxidationLevelId: number | null = null;
          if (mapped.oxidationLevelKey) {
            oxidationLevelId = oxidationMap.get(mapped.oxidationLevelKey.toLowerCase()) || null;
          }

          let processingId: number | null = null;
          if (mapped.processingKey) {
            processingId = processingMap.get(mapped.processingKey.toLowerCase()) || null;
          }

          let cultivarId: number | null = null;
          if (detail.cultivar) {
            const cultivarKey = detail.cultivar.toLowerCase();
            cultivarId = cultivarMap.get(cultivarKey) || null;
            if (!cultivarId) {
              cultivarId = await upsertUnique(
                "cultivar",
                { label: detail.cultivar, key: cultivarKey },
                "key"
              );
              if (cultivarId) cultivarMap.set(cultivarKey, cultivarId);
            }
          }

          let producerId: number | null = null;
          if (mapped.producerName) {
            producerId = producerMap.get(mapped.producerName) || null;
            if (!producerId) {
              producerId = await upsertUnique(
                "producer",
                { name: mapped.producerName },
                "name"
              );
              if (producerId) producerMap.set(mapped.producerName, producerId);
            }
          }

          const teaRecord = {
            name: detail.name,
            url,
            vendor_id: vendorId,
            oxidation_level_id: oxidationLevelId,
            processing_id: processingId,
            origin: mapped.origin,
            origin_country: mapped.originCountry,
            elevation_meters: mapped.elevationMeters,
            producer_id: producerId,
            shading: mapped.shading,
            is_available: detail.availability.includes("InStock"),
            raw_notes: mapped.rawNotes,
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

          if (detail.price > 0) {
            await supabase.from("price_snapshot").insert({
              tea_id: teaData.id,
              weight_grams: null, // TODO: extract from product page
              price: Math.round(detail.price * 100),
              currency_code: "EUR",
            });
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
  console.log(`   Skipped (existing): ${skippedProducts}`);
}

scrape().catch(console.error);
