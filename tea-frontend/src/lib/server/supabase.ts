import { createClient } from '@supabase/supabase-js';
import { PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY } from '$env/static/public';
import type { RequestEvent } from '@sveltejs/kit';

/**
 * Creates a Supabase client for server-side use.
 *
 * Accepts the SvelteKit RequestEvent to:
 * - Use the platform-native `fetch` for cookie-aware requests
 * - Avoid stale session state across requests (stateless)
 *
 * Usage:
 * ```ts
 * // In a load function or server endpoint:
 * import { createServerClient } from '$lib/server/supabase';
 *
 * export const load = async (event) => {
 *   const supabase = createServerClient(event);
 *   const { data } = await supabase.from('tea').select('*');
 *   return { teas: data };
 * };
 * ```
 */
export function createServerClient(event: RequestEvent) {
	return createClient(PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY, {
		global: {
			// Use the request-scoped fetch to forward auth cookies
			fetch: event.fetch
		},
		auth: {
			persistSession: false,
			autoRefreshToken: false,
			detectSessionInUrl: false
		}
	});
}
