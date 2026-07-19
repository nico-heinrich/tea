import { createClient } from '@supabase/supabase-js';
import { PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY } from '$env/static/public';

/**
 * Singleton Supabase client for browser-side use.
 *
 * Uses PUBLIC_ env vars automatically substituted at build time.
 * Safe to import and use in any `.svelte` file or client-side `.ts` module.
 *
 * Usage:
 * ```ts
 * import { supabase } from '$lib/supabase';
 *
 * const { data } = await supabase.from('tea').select('*').limit(10);
 * ```
 */
export const supabase = createClient(PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY);
