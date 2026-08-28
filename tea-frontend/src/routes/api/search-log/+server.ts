import { createHash } from 'node:crypto';
import { env } from '$env/dynamic/private';
import { createServerClient } from '$lib/server/supabase';
import { json } from '@sveltejs/kit';
import type { RequestEvent } from '@sveltejs/kit';

/**
 * POST /api/search-log
 *
 * Implicitly records one executed search so the autocomplete can surface
 * search terms that stem from what users actually search for. This is the
 * write side of the crowdsourced suggestions — there is no manual "suggest a
 * term" form; every real search a user commits is captured here and its
 * popularity is aggregated from `search_log` on read.
 *
 * This endpoint is best-effort and fire-and-forget: the client never blocks on
 * it, and failures are swallowed server-side so a logging hiccup can never
 * break a user's search. It always returns 200.
 *
 * Anti-spam (DB-backed, survives serverless cold starts and scaling):
 * - Per-IP dedup: a single user searching the same term records only one row
 *   (unique (term, ip_hash)), so one person cannot inflate a term's popularity.
 * - Per-IP rate limit: at most 30 accepted logs per IP hash per hour, enforced
 *   inside `log_search()`.
 * - No raw IPs are stored — only a salted SHA-256 hash (GDPR-friendly).
 * - Normalization rejects stopword-only and junk queries before they reach the DB.
 *
 * Body: { "term": "sencha" }
 * Rate limited 429: { "error": "rate_limited" } (client ignores and moves on)
 */

const MIN_TERM_LENGTH = 2;
const MAX_TERM_LENGTH = 60;
const IP_HASH_SALT = 'tea-search-log@v1';
const GEO_API_BASE =
	env.PRIVATE_GEO_API_BASE?.replace(/\/+$/, '') || 'https://ip-location.exord.xyz';

// Stopwords that add no signal as a standalone suggestion ("tea", "tee", ...).
const STOPWORDS = new Set(['tea', 'tee', 'the', 'a', 'an', 'and', 'of']);

/** Normalize an executed search term. Returns null when it should not be stored. */
function normalizeTerm(raw: string): string | null {
	const t = raw
		.trim()
		// collapses runs of whitespace into a single space.
		// Keep the user's exact case — dedup is case-insensitive in the DB.
		.replace(/\s+/g, ' ')
		.replace(/[.\s]+$/, '');

	if (t.length < MIN_TERM_LENGTH || t.length > MAX_TERM_LENGTH) return null;
	if (STOPWORDS.has(t.toLowerCase())) return null;
	// Reject queries with no meaningful letters/digits (pure punctuation/symbols).
	if (!/[\p{L}\p{N}]/u.test(t)) return null;
	return t;
}

/** One-way hash of the client IP so no raw addresses are stored (GDPR-friendly). */
function hashIp(ip: string): string {
	return createHash('sha256').update(`${ip}:${IP_HASH_SALT}`).digest('hex');
}

async function resolveLocation(
	ip: string
): Promise<{ countryCode: string | null; city: string | null }> {
	try {
		const res = await fetch(`${GEO_API_BASE}/ip/${encodeURIComponent(ip)}`, {
			signal: AbortSignal.timeout(2000)
		});
		if (!res.ok) return { countryCode: null, city: null };
		const data = (await res.json()) as { country_code?: unknown; city?: unknown };
		const countryCode = typeof data.country_code === 'string' ? data.country_code : null;
		const city = typeof data.city === 'string' && data.city.trim() !== '' ? data.city : null;
		return { countryCode, city };
	} catch {
		return { countryCode: null, city: null };
	}
}

export async function POST(event: RequestEvent): Promise<Response> {
	let body: unknown;
	try {
		body = await event.request.json();
	} catch {
		// Malformed request: ignore (fire-and-forget).
		return json({ ok: true });
	}

	const { term } = (body ?? {}) as { term?: unknown };
	if (typeof term !== 'string') return json({ ok: true });

	const normalized = normalizeTerm(term);
	if (!normalized) return json({ ok: true });

	let ip: string;
	try {
		ip = event.getClientAddress();
	} catch {
		ip = 'unknown';
	}

	try {
		const { countryCode, city } = await resolveLocation(ip);
		const supabase = createServerClient(event);
		await supabase.rpc('log_search', {
			p_term: normalized,
			p_ip_hash: hashIp(ip),
			p_country_code: countryCode,
			p_city: city
		});
	} catch {
		// Best-effort: never fail the user's search because logging broke.
	}

	return json({ ok: true });
}
