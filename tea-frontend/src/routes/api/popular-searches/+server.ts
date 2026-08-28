import { createServerClient } from '$lib/server/supabase';
import { json } from '@sveltejs/kit';
import type { RequestEvent } from '@sveltejs/kit';

export interface PopularSearch {
	id: number | null;
	query: string;
}

const DEFAULT_LIMIT = 15;
const MAX_LIMIT = 30;

/**
 * GET /api/popular-searches
 *
 * Returns search-term suggestions for the autocomplete dropdown. The terms
 * come from what users actually search for: `search_log` is aggregated into
 * `popular_search_terms()` (ranked by distinct-user popularity) and returned
 * first. Hardcoded `popular_search` rows are appended as a curated fallback
 * for anything not already covered — so the dropdown (both empty and while
 * typing) is never empty even before real usage accrues.
 *
 * With `?q=<query>`, returns terms — real and curated alike — matching the
 * current partial input: live "as you type" suggestions.
 *
 * Params: q (optional, partial term), limit (optional, default 15, max 30)
 * Response: { "searches": [{ "id": null, "query": "sencha" }, ...] }
 */
export async function GET(event: RequestEvent): Promise<Response> {
	try {
		const q = event.url.searchParams.get('q')?.trim() ?? null;
		const requested = parseInt(event.url.searchParams.get('limit') ?? `${DEFAULT_LIMIT}`, 10);
		const limit = Number.isFinite(requested)
			? Math.min(Math.max(requested, 1), MAX_LIMIT)
			: DEFAULT_LIMIT;

		const supabase = createServerClient(event);

		const { data: suggested, error: suggestedError } = await supabase.rpc('popular_search_terms', {
			p_limit: limit,
			p_query: q
		});

		if (suggestedError) {
			console.error('Popular searches error:', suggestedError);
			return json({ error: 'Failed to load popular searches' }, { status: 500 });
		}

		const suggestedQueries = new Set<string>();
		const merged: PopularSearch[] = [];

		for (const s of (suggested ?? []) as { term?: unknown; count?: unknown }[]) {
			const query = typeof s.term === 'string' ? s.term : null;
			if (!query) continue;
			const key = query.toLowerCase();
			if (suggestedQueries.has(key)) continue;
			suggestedQueries.add(key);
			merged.push({ id: null, query });
		}

		// Curated fallback keeps the box non-empty in both cases: match hardcoded
		// terms against the partial query when typing (mirroring the real-term
		// match), and dedup so real terms always win.
		const { data: hardcoded } = await supabase
			.from('popular_search')
			.select('id, query')
			.order('query');

		for (const h of (hardcoded ?? []) as { id?: unknown; query?: unknown }[]) {
			const query = typeof h.query === 'string' ? h.query : null;
			if (!query) continue;
			if (q && !query.toLowerCase().includes(q.toLowerCase())) continue;
			const key = query.toLowerCase();
			if (suggestedQueries.has(key)) continue;
			suggestedQueries.add(key);
			merged.push({ id: typeof h.id === 'number' ? h.id : null, query });
		}

		return json({ searches: merged.slice(0, limit) });
	} catch (err) {
		console.error('Popular searches error:', err);
		return json({ error: 'Failed to load popular searches' }, { status: 500 });
	}
}
