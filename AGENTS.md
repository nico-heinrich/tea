# AGENTS.md

## Rules

- Scraping requires explicit permission before running. Always ask first.
- Scraper version number must be updated after every major change.

## Scraper Guidelines

### Database Schema

The `tea` table stores all tea data. Every field that stores unparsed/original text from the source uses the `_raw` suffix.

**Normalized fields (IDs / structured):**
- `type` → FK to `type` table (1=White, 2=Yellow, 3=Green, 4=Oolong, 5=Black, 6=Dark). Must always be set.
- `vendor` → FK to `vendor` table. One vendor per scraper (e.g., "Yoshi en", "Yunnan Sourcing").
- `origin_country` → ISO 3166-1 alpha-2 country code (e.g., "JP", "CN", "IN"). Null if unknown.
- `elevation_meters` → smallint, parsed from source. Null if not available.
- `harvest_year` → smallint, 4-digit year. Null if not available.
- `scraper_version` → text, format `"{vendor_slug}@v{N}"` (e.g., `"yoshien@v1"`, `"yunnansourcing@v1"`).

**Raw fields (unparsed text from source):**
- `style_raw` → text. Tea style/type as stated by the source (e.g., "Sheng Pu Erh", "Sencha", "Liu Bao Cha").
- `cultivar_raw` → text. Tea cultivar/varietal as stated by the source.
- `producer_raw` → text. Producer/farm name as stated by the source.
- `shading_raw` → text. Shading information as stated by the source.
- `harvest_raw` → text. Full harvest description as stated by the source (e.g., "1. Ernte (Ichibancha), Mai 2025").
- `notes_raw` → text. Combined relevant description fields (flavor notes, cultivation method, quality grade, etc.).
- `origin` → text. Region/terroir as stated by the source (e.g., "Fuji, Shizuoka").

**Snapshot tables (track changes over time):**
- `price_snapshot` → `tea_id`, `weight_grams` (numeric 10,1), `price` (numeric 10,2), `currency` (text, ISO 4217), `created_at`. One row per offer/variant.
- `availability_snapshot` → `tea_id`, `available` (boolean), `created_at`. One row per scrape run per tea.

### Naming Conventions

- **DB columns**: snake_case (e.g., `style_raw`, `origin_country`, `harvest_year`)
- **Internal variables**: camelCase, matching the DB column (e.g., `styleRaw`, `originCountry`, `harvestYear`)
- **Do NOT use**: `raw_notes` (use `notes_raw`), `is_available` (use `availability_snapshot`), `harvest_season` (use `harvest_raw`), `processing_raw` (use `style_raw`)

### Scraper Structure

Each scraper lives in `scrapers/{vendor_slug}/` with:
- `index.ts` — main entry point, orchestrates fetching + DB writes
- `parse.ts` — parsing logic (HTML, JSON, or API response → tea record fields)
- `types.ts` — TypeScript types for the source's data structure (if complex enough)

Shared code lives in `scrapers/shared/`:
- `db.ts` — Supabase client, `upsertUnique` helper
- `types.ts` — shared types (`TeaRecord`, etc.)

### Data Flow

1. Fetch category/collection pages (HTML or JSON API)
2. Extract product URLs or product data
3. For each product: parse into internal record using `mapToTeaRecord()`
4. Check: skip if no tea metadata (see below)
5. Check: skip if `style_raw` matches known non-tea patterns
6. Upsert vendor, resolve type ID
7. Insert tea row
8. Insert price_snapshot for each offer/variant
9. Insert availability_snapshot

### Non-Tea Filtering

Every product must pass these checks before being saved:

1. **Tea metadata check**: At least one of these must be present from the source data:
   - `cultivar_raw`, `harvest_raw`, `shading_raw`, `notes_raw` (non-empty), `origin`, `producer_raw`

2. **Style exclusion**: Skip if `style_raw` contains any of:
   - `schokolade`, `teezubehör`, `glas`, `löffel`, `teekanne`, `teetasse`, `flasche`, `becher`
   - Adapt per vendor (e.g., for Shopify stores: skip "Teaware", "Accessories", "Puzzle" product types)

3. **Product type / collection filtering**: Only scrape collections that map to real tea types. Skip samplers, accessories, teaware, blooming teas, herbal teas.

### Weight Extraction

- Prefer body/HTML weight for single-size products
- Fall back to URL weight for multi-size products
- Store as `numeric(10,1)` — supports fractional grams (e.g., 7.5g)
- For Shopify stores: parse weight from variant `title` field (e.g., "25 Grams Sample" → 25, "1 Tuo (100 Grams)" → 100)

### Price Storage

- Store as `numeric(10,2)` in the product's native currency
- One `price_snapshot` per variant/offer
- Include `weight_grams` on each snapshot (nullable — but should rarely be null for real tea)

### Country Codes

Map country names to ISO 3166-1 alpha-2 codes. Common mappings:
- `china`, `yunnan`, `fujian` → `CN`
- `japan`, `kyoto`, `shizuoka` → `JP`
- `india`, `indien` → `IN`
- `nepal` → `NP`
- `sri lanka`, `ceylon` → `LK`
- `taiwan` → `TW`
- `south korea`, `korea` → `KR`
- `vietnam` → `VN`

### Tea Type Mapping

| ID | Key    | Description |
|----|--------|-------------|
| 1  | white  | Minimal processing, sun-withered |
| 2  | yellow | Similar to green, with yellowing step |
| 3  | green  | Unoxidized, heated to halt oxidation |
| 4  | oolong | Partially oxidized (10–85%) |
| 5  | black  | Fully oxidized |
| 6  | dark   | Post-fermented (Pu-erh, Hei Cha) |

Use `product_type`, `tags`, collection name, or name patterns to determine tea type.

### Scraper Versioning

- Format: `{vendor_slug}@v{N}` (e.g., `"yoshien@v1"`, `"yunnansourcing@v1"`)
- Increment N after every major change (schema change, parsing fix, new data field)
- Store in `SCRAPER_VERSION` constant at top of `index.ts`
- Written to `tea.scraper_version` on every insert
