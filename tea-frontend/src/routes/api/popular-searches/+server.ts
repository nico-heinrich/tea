import { createServerClient } from '$lib/server/supabase';
import { json } from '@sveltejs/kit';
import type { RequestEvent } from '@sveltejs/kit';

export interface PopularSearch {
	id: number;
	query: string;
}

/**
 * GET /api/popular-searches
 *
 * Returns all popular search queries from the popular_search table.
 * These are hardcoded popular tea searches shown in the autocomplete dropdown.
 */
export async function GET(_event: RequestEvent): Promise<Response> {
	try {
		const supabase = createServerClient(_event);

		const { data, error } = await supabase
			.from('popular_search')
			.select('id, query')
			.order('query');

		if (error) {
			console.error('Popular searches error:', error);
			return json({ error: 'Failed to load popular searches' }, { status: 500 });
		}

		const searches: PopularSearch[] = (data ?? []) as PopularSearch[];
		return json({ searches });
	} catch (err) {
		console.error('Popular searches error:', err);
		return json({ error: 'Failed to load popular searches' }, { status: 500 });
	}
}
