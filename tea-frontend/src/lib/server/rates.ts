/**
 * Server-side FX rate cache.
 *
 * Fetches rates from the Open Exchange Rates free API and caches them
 * at module scope. Rates are how many units of a target currency you
 * get for 1 USD (e.g. { EUR: 0.92 } means 1 USD = 0.92 EUR).
 *
 * Cache lifetime: 12 hours. On stale refresh failure, the last cached
 * rates are reused (fail-soft). If no cache exists at all, the error
 * propagates so the caller can fall back to native pricing.
 */

interface RatesResponse {
	base_code: string;
	rates: Record<string, number>;
}

const CACHE_MAX_AGE_MS = 12 * 60 * 60 * 1000; // 12 hours

let cache: { rates: Record<string, number>; timestamp: number } | null = null;

async function fetchRates(): Promise<Record<string, number>> {
	const res = await fetch('https://open.er-api.com/v6/latest/USD');

	if (!res.ok) {
		throw new Error(`FX rate fetch failed: ${res.status} ${res.statusText}`);
	}

	const body: unknown = await res.json();

	if (
		typeof body !== 'object' ||
		body === null ||
		typeof (body as RatesResponse).base_code !== 'string' ||
		(body as RatesResponse).base_code !== 'USD' ||
		typeof (body as RatesResponse).rates !== 'object' ||
		(body as RatesResponse).rates === null
	) {
		throw new Error('FX rate response has unexpected shape');
	}

	const rates = (body as RatesResponse).rates;

	// Validate that requested currencies exist as numbers
	for (const key of Object.keys(rates)) {
		if (typeof rates[key] !== 'number') {
			throw new Error(`FX rate for "${key}" is not a number`);
		}
	}

	return rates;
}

/**
 * Get the number of units of `currency` per 1 USD.
 *
 * Example: getUsdToCurrencyRate('EUR') → 0.92 means 1 USD = 0.92 EUR.
 */
export async function getUsdToCurrencyRate(currency: string): Promise<number> {
	const now = Date.now();
	const isStale = cache === null || now - cache.timestamp > CACHE_MAX_AGE_MS;

	if (!isStale && cache !== null) {
		const rate = cache.rates[currency];
		if (rate === undefined) {
			throw new Error(`Unknown currency: ${currency}`);
		}
		return rate;
	}

	try {
		const rates = await fetchRates();
		cache = { rates, timestamp: now };
	} catch (err) {
		// Fail-soft: reuse stale cache if available
		if (cache !== null) {
			const rate = cache.rates[currency];
			if (rate !== undefined) return rate;
		}
		// No cache at all — propagate the error
		throw err;
	}

	const rate = cache.rates[currency];
	if (rate === undefined) {
		throw new Error(`Unknown currency: ${currency}`);
	}
	return rate;
}
