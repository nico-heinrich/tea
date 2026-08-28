import { createHash } from 'node:crypto';
import { env } from '$env/dynamic/private';
import { createServerClient } from '$lib/server/supabase';
import { json } from '@sveltejs/kit';
import type { RequestEvent } from '@sveltejs/kit';

/**
 * POST /api/missing-shop
 *
 * Accepts a suggestion for a tea shop that is not yet in the database and
 * records one vote for its domain. Domains are normalized (lowercase, no
 * scheme, no "www.", no path) and stored once — resubmitting an existing
 * domain increments `missing_shop.votes` instead of inserting a new row.
 *
 * The submitter's (approximate) country and city are resolved from their IP
 * via a self-hosted GeoIP service and stored on the vote row, so we know
 * where each vote came from.
 *
 * Anti-spam (kept easy for humans, hostile to bots):
 * - Honeypot field: bots autofill every visible input, so a non-empty
 *   `website` field means "not human" → silently accepted, nothing stored.
 * - Per-IP rate limit: at most 5 accepted votes per IP hash per hour,
 *   enforced inside `vote_missing_shop()` (DB-backed, survives serverless
 *   cold starts and horizontal scaling).
 *
 * Body: { "domain": "shop-domain.com", "website": "" }
 *
 * Success 200: { "domain": "shop-domain.com", "votes": 3, "alreadyVoted": false }
 * Already voted 200: { "domain": "shop-domain.com", "votes": 3, "alreadyVoted": true }
 * Rate limited 429: { "error": "rate_limited" }
 * Invalid domain 400: { "error": "invalid" }
 */

const DOMAIN_RE = /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/;
const IP_HASH_SALT = 'tea-missing-shop@v1';
const GEO_API_BASE =
	env.PRIVATE_GEO_API_BASE?.replace(/\/+$/, '') || 'https://ip-location.exord.xyz';

/** Normalize a user-entered domain. Returns null when it does not look like a hostname. */
function normalizeDomain(raw: string): string | null {
	const d = raw
		.trim()
		.toLowerCase()
		// strip scheme: https://, http://, etc.
		.replace(/^[a-z][a-z0-9+.-]*:\/\//, '')
		// strip leading "www." so www.example.com and example.com merge
		.replace(/^www\./, '')
		// strip port ("example.com:8443")
		.split(':')[0]
		// strip path, query and hash ("example.com/tea?x=1")
		.split(/[/?#]/)[0]
		// strip trailing dots/spaces ("example.com." or trailing whitespace)
		.replace(/[.\s]+$/, '');

	if (d.length < 4 || d.length > 253) return null;
	if (!DOMAIN_RE.test(d)) return null;
	return d;
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
		return json({ error: 'invalid' }, { status: 400 });
	}

	const { domain, website } = (body ?? {}) as { domain?: unknown; website?: unknown };

	// Honeypot: bots fill hidden fields. Pretend success so naive bots
	// believe they worked and move on.
	if (typeof website === 'string' && website.trim() !== '') {
		return json({ accepted: true });
	}

	if (typeof domain !== 'string') {
		return json({ error: 'invalid' }, { status: 400 });
	}

	const normalized = normalizeDomain(domain);
	if (!normalized) {
		return json({ error: 'invalid' }, { status: 400 });
	}

	let ip: string;
	try {
		ip = event.getClientAddress();
	} catch {
		ip = 'unknown';
	}

	try {
		const { countryCode, city } = await resolveLocation(ip);
		const supabase = createServerClient(event);
		const { data, error } = await supabase.rpc('vote_missing_shop', {
			p_domain: normalized,
			p_ip_hash: hashIp(ip),
			p_country_code: countryCode,
			p_city: city
		});

		if (error) {
			console.error('Missing shop vote error:', error);
			return json({ error: 'server' }, { status: 500 });
		}

		const row = (data ?? [])[0] as
			| {
					out_domain?: string | null;
					votes?: number | null;
					already_voted?: boolean | null;
					rate_limited?: boolean | null;
			  }
			| undefined;

		if (!row || row.out_domain == null || row.votes == null) {
			return json({ error: 'server' }, { status: 500 });
		}

		if (row.rate_limited) {
			return json({ error: 'rate_limited' }, { status: 429 });
		}

		return json({
			domain: row.out_domain,
			votes: row.votes,
			alreadyVoted: Boolean(row.already_voted)
		});
	} catch (err) {
		console.error('Missing shop vote error:', err);
		return json({ error: 'server' }, { status: 500 });
	}
}
