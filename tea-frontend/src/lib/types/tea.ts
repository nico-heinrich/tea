/**
 * Full tea record matching the Supabase `tea` table schema.
 *
 * DB columns are snake_case; TypeScript properties are camelCase
 * per the project naming convention (see AGENTS.md).
 */
export interface Tea {
	/** Primary key (serial) */
	id: number;
	/** Tea product name */
	name: string;
	/** Product URL */
	url: string;
	/** Foreign key to `vendor` table */
	vendor: number;
	/** Foreign key to `type` table (1=White, 2=Yellow, 3=Green, 4=Oolong, 5=Black, 6=Dark) */
	type: number;
	/** Tea style / type as stated by the source (e.g. "Sencha", "Sheng Pu Erh") */
	styleRaw: string | null;
	/** Region / terroir as stated by the source */
	origin: string | null;
	/** ISO 3166-1 alpha-2 country code */
	originCountry: string | null;
	/** Elevation in meters */
	elevationMeters: number | null;
	/** Full harvest description from source (e.g. "1. Ernte (Ichibancha), Mai 2025") */
	harvestRaw: string | null;
	/** 4-digit harvest year */
	harvestYear: number | null;
	/** Harvest season (e.g. "Spring", "Summer") */
	season: string | null;
	/** Producer / farm name */
	producerRaw: string | null;
	/** Shading information */
	shadingRaw: string | null;
	/** Tea cultivar / varietal */
	cultivarRaw: string | null;
	/** Combined description notes (flavor, cultivation, quality grade, etc.) */
	notesRaw: string | null;
	/** Scraper version (format: `{vendor_slug}@v{N}`) */
	scraperVersion: string | null;
}

/**
 * Full search result returned by the `/api/search` endpoint.
 * Includes pricing data from the Supabase RPC.
 */
export interface TeaResult {
	id: number;
	name: string;
	style_label: string | null;
	type_key: string;
	origin: string | null;
	origin_country: string | null;
	url: string | null;
	price: number | null;
	currency: string | null;
	weight_grams: number | null;
	vendor_name: string | null;
	harvest_year: number | null;
	/** Raw normalized price per 100g in USD (null for legacy rows). */
	price_100g_usd: number | null;
	/** Computed price per 100g in the display currency (or native for legacy). */
	price_display: number | null;
	/** Currency used for price_display (e.g. "EUR", "USD", or native). */
	currency_display: string | null;
}

/**
 * Paginated search results returned by the /api/search endpoint.
 */
export interface SearchResultsResponse {
	results: TeaResult[];
	totalCount: number;
}

/**
 * Sort options for the search API: relevance (default) or representative
 * price_100g_usd ascending/descending.
 */
export type SearchSort = 'relevance' | 'price_asc' | 'price_desc';
