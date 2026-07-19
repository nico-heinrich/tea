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
 * Search suggestion returned by the `/api/search` endpoint.
 *
 * Matches the `search_teas()` SQL function return shape exactly
 * (snake_case columns from the Supabase RPC response).
 */
export interface TeaSuggestion {
	id: number;
	name: string;
	/** Tea style / type as stated by the source (maps to `style_raw` in the DB) */
	style_raw: string | null;
	/** Resolved type key from the `type` table, e.g. "green", "oolong", "black" (maps to `type.key`) */
	type_key: string;
	/** Region / terroir */
	origin: string | null;
	/** ISO 3166-1 alpha-2 country code */
	origin_country: string | null;
}

/**
 * Full search result returned by the `/api/search` endpoint.
 * Includes pricing data from the Supabase RPC.
 */
export interface TeaResult {
	id: number;
	name: string;
	style_raw: string | null;
	type_key: string;
	origin: string | null;
	origin_country: string | null;
	url: string | null;
	price: number | null;
	currency: string | null;
	weight_grams: number | null;
	vendor_name: string | null;
}

/**
 * Wrapper returned by the search API endpoint.
 */
export interface SearchResponse {
	suggestions: TeaSuggestion[];
	results: TeaResult[];
}

/**
 * Paginated search results returned by the /api/search endpoint.
 */
export interface SearchResultsResponse {
	results: TeaResult[];
	totalCount: number;
}
