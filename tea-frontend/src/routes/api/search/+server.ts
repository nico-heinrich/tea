import { createServerClient } from '$lib/server/supabase';
import { getUsdToCurrencyRate } from '$lib/server/rates';
import { json } from '@sveltejs/kit';
import type { RequestEvent } from '@sveltejs/kit';
import type { TeaResult, SearchResultsResponse, SearchSort } from '$lib/types/tea';

const PAGE_SIZE = 10;
const VALID_CURRENCIES = ['EUR', 'USD'] as const;
const VALID_SORTS = ['relevance', 'price_asc', 'price_desc'] as const;

function round2(n: number): number {
	return Math.round(n * 100) / 100;
}

/**
 * GET /api/search?q=<term>&offset=<n>&currency=<EUR|USD>&sort=<relevance|price_asc|price_desc>
 *
 * Fuzzy-search teas using pg_trgm `word_similarity`.
 * Returns paginated results (10 per page) with totalCount.
 *
 * `currency` param (default "EUR") controls the display currency.
 * Invalid values fall back to "EUR".
 *
 * `sort` param (default "relevance") controls result ordering.
 * Invalid values fall back to "relevance".
 *
 * Requires the `search_teas` PostgreSQL function with pagination support.
 */
export async function GET(event: RequestEvent): Promise<Response> {
	const q = event.url.searchParams.get('q');
	const offset = parseInt(event.url.searchParams.get('offset') ?? '0', 10);
	const requestedCurrency = (event.url.searchParams.get('currency') ?? 'EUR').toUpperCase();
	const displayCurrency: string = VALID_CURRENCIES.includes(
		requestedCurrency as (typeof VALID_CURRENCIES)[number]
	)
		? requestedCurrency
		: 'EUR';
	const requestedSort = (event.url.searchParams.get('sort') ?? 'relevance').toLowerCase();
	const sort: SearchSort = VALID_SORTS.includes(requestedSort as SearchSort)
		? (requestedSort as SearchSort)
		: 'relevance';

	if (!q || q.trim() === '') {
		const empty: SearchResultsResponse = { results: [], totalCount: 0 };
		return json(empty);
	}

	try {
		const supabase = createServerClient(event);

		const { data, error } = await supabase.rpc('search_teas', {
			p_search_term: q.trim(),
			p_limit: PAGE_SIZE,
			p_offset: offset,
			p_sort: sort
		});

		if (error) {
			console.error('Search error:', error);
			return json({ error: 'Search failed' }, { status: 500 });
		}

		const raw = (data ?? []) as Record<string, unknown>[];

		let displayRate: number | null = null;
		try {
			displayRate = await getUsdToCurrencyRate(displayCurrency);
		} catch {
			displayRate = null;
		}

		const nativeRateCache = new Map<string, number>();

		async function nativeToDisplayPer100g(
			nativePer100g: number,
			nativeCurrency: string
		): Promise<number | null> {
			if (nativeCurrency === displayCurrency) return nativePer100g;
			if (displayRate === null) return null;
			let nativeRate: number | null | undefined = nativeRateCache.get(nativeCurrency);
			if (nativeRate === undefined) {
				try {
					nativeRate = await getUsdToCurrencyRate(nativeCurrency);
					nativeRateCache.set(nativeCurrency, nativeRate);
				} catch {
					nativeRate = null;
				}
			}
			if (nativeRate == null) return null;
			// native per 100g → USD → display currency
			return (nativePer100g / nativeRate) * displayRate;
		}

		const results: TeaResult[] = [];
		for (const row of raw) {
			const price100gUsd = row.p_price_100g_usd != null ? Number(row.p_price_100g_usd) : null;
			const nativePrice = row.p_price != null ? Number(row.p_price) : null;
			const weightGrams = row.p_weight_grams != null ? Number(row.p_weight_grams) : null;
			const nativeCurrency = (row.p_currency as string) ?? null;

			let priceDisplay: number | null = null;
			let currencyDisplay: string | null = null;

			if (price100gUsd != null && displayRate != null) {
				priceDisplay = round2(price100gUsd * displayRate);
				currencyDisplay = displayCurrency;
			} else if (nativePrice != null && weightGrams != null && weightGrams > 0) {
				const nativePer100g = (nativePrice / weightGrams) * 100;
				const converted = nativeCurrency
					? await nativeToDisplayPer100g(nativePer100g, nativeCurrency)
					: null;
				if (converted !== null) {
					priceDisplay = round2(converted);
					currencyDisplay = displayCurrency;
				} else {
					priceDisplay = round2(nativePer100g);
					currencyDisplay = nativeCurrency;
				}
			}

			results.push({
				id: row.p_id as number,
				name: row.p_name as string,
				style_label: (row.p_style_label as string) ?? null,
				type_key: row.p_type_key as string,
				origin: (row.p_origin as string) ?? null,
				origin_country: (row.p_origin_country as string) ?? null,
				url: (row.p_url as string) ?? null,
				price: nativePrice,
				currency: nativeCurrency,
				weight_grams: weightGrams,
				vendor_name: (row.p_vendor_name as string) ?? null,
				harvest_year: row.p_harvest_year ? Number(row.p_harvest_year) : null,
				price_100g_usd: price100gUsd,
				price_display: priceDisplay,
				currency_display: currencyDisplay
			});
		}

		const totalCount = raw.length > 0 ? Number(raw[0].p_total_count) : 0;

		const response: SearchResultsResponse = { results, totalCount };
		return json(response);
	} catch (err) {
		console.error('Search error:', err);
		return json({ error: 'Search failed' }, { status: 500 });
	}
}
