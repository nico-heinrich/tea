import { createServerClient } from '$lib/server/supabase';
import { json } from '@sveltejs/kit';
import type { RequestEvent } from '@sveltejs/kit';
import type { TeaResult, SearchResultsResponse } from '$lib/types/tea';

const PAGE_SIZE = 10;

/**
 * GET /api/search?q=<term>&offset=<n>
 *
 * Fuzzy-search teas using pg_trgm `word_similarity`.
 * Returns paginated results (10 per page) with totalCount.
 *
 * Requires the `search_teas` PostgreSQL function with pagination support.
 */
export async function GET(event: RequestEvent): Promise<Response> {
	const q = event.url.searchParams.get('q');
	const offset = parseInt(event.url.searchParams.get('offset') ?? '0', 10);

	if (!q || q.trim() === '') {
		const empty: SearchResultsResponse = { results: [], totalCount: 0 };
		return json(empty);
	}

	try {
		const supabase = createServerClient(event);

		const { data, error } = await supabase.rpc('search_teas', {
			p_search_term: q.trim(),
			p_limit: PAGE_SIZE,
			p_offset: offset
		});

		if (error) {
			console.error('Search error:', error);
			return json({ error: 'Search failed' }, { status: 500 });
		}

		const raw = (data ?? []) as Record<string, unknown>[];

		const results: TeaResult[] = raw.map((row) => ({
			id: row.p_id as number,
			name: row.p_name as string,
			style_raw: (row.p_style_raw as string) ?? null,
			type_key: row.p_type_key as string,
			origin: (row.p_origin as string) ?? null,
			origin_country: (row.p_origin_country as string) ?? null,
			url: (row.p_url as string) ?? null,
			price: row.p_price ? Number(row.p_price) : null,
			currency: (row.p_currency as string) ?? null,
			weight_grams: row.p_weight_grams ? Number(row.p_weight_grams) : null,
			vendor_name: (row.p_vendor_name as string) ?? null,
		}));

		// totalCount comes from the first row (same for all via window function)
		const totalCount = raw.length > 0 ? Number(raw[0].p_total_count) : 0;

		const response: SearchResultsResponse = { results, totalCount };
		return json(response);
	} catch (err) {
		console.error('Search error:', err);
		return json({ error: 'Search failed' }, { status: 500 });
	}
}
