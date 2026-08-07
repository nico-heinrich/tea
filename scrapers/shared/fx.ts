/**
 * FX rate helpers for price normalization.
 *
 * Every scraper stores its price in the vendor's native currency and also
 * stores a normalized reference price on `price_snapshot`:
 *   - `price_100g_usd`: USD price per 100g, computed at scrape time
 *   - `fx_rate_usd`: the rate used (native currency per 1 USD)
 *
 * Rates come from open.er-api.com (free, no API key, updated daily). One
 * HTTP request is made per scraper run; the result is cached in module
 * scope. If the request fails, the rejection is cached too, so the
 * remaining inserts fail fast (no hammering the API) and store nulls.
 *
 * Rate semantics (matching open.er-api.com):
 *   getUsdToCurrencyRate("EUR") === 0.92  ⟹  1 USD = 0.92 EUR
 *   toUsd(priceEur, "EUR") = priceEur / 0.92
 */

const FX_API_URL = "https://open.er-api.com/v6/latest/USD";

interface ExchangeRateResponse {
  base_code: string;
  rates: Record<string, number>;
}

let ratesPromise: Promise<Record<string, number>> | null = null;

function loadRates(): Promise<Record<string, number>> {
  if (!ratesPromise) {
    ratesPromise = fetch(FX_API_URL)
      .then((response) => {
        if (!response.ok) {
          throw new Error(
            `FX rate request failed: ${response.status} ${response.statusText}`
          );
        }
        return response.json() as Promise<ExchangeRateResponse>;
      })
      .then((data) => {
        if (!data?.rates || typeof data.rates !== "object") {
          throw new Error("FX rate response did not contain rates");
        }
        return data.rates;
      })
      .catch((err: unknown) => {
        // Keep the rejection cached: a transient failure should not cause
        // a network retry per product. Normalization is skipped (nulls).
        console.warn(
          `⚠️ FX rate fetch failed — price normalization skipped for this run: ${
            err instanceof Error ? err.message : String(err)
          }`
        );
        throw err;
      });
  }
  return ratesPromise;
}

/**
 * How many units of `currency` equal 1 USD (e.g. 0.92 for EUR).
 * Throws if the rate cannot be fetched or the currency is unsupported.
 */
export async function getUsdToCurrencyRate(currency: string): Promise<number> {
  const rates = await loadRates();
  const rate = rates[currency.toUpperCase()];
  if (rate === undefined || rate <= 0) {
    throw new Error(`No FX rate available for currency: ${currency}`);
  }
  return rate;
}

/**
 * Convert a price in a native currency to USD.
 */
export async function toUsd(price: number, currency: string): Promise<number> {
  const usdToCurrency = await getUsdToCurrencyRate(currency);
  return price / usdToCurrency;
}

export interface UsdNormalizedPrice {
  /** USD price per 100g (2 decimals), null when weight is missing or the rate is unavailable */
  price100gUsd: number | null;
  /** Native currency per 1 USD at scrape time, null when the rate is unavailable */
  fxRateUsd: number | null;
}

/**
 * Normalize a price snapshot to USD per 100g using the scrape-time rate.
 * Fails soft: returns nulls (never throws) when the weight is missing or
 * the rate could not be fetched.
 */
export async function normalizeToUsd100g(
  price: number,
  weightGrams: number | null,
  currency: string
): Promise<UsdNormalizedPrice> {
  if (!weightGrams || weightGrams <= 0) {
    return { price100gUsd: null, fxRateUsd: null };
  }

  let usdToCurrency: number;
  try {
    usdToCurrency = await getUsdToCurrencyRate(currency);
  } catch {
    return { price100gUsd: null, fxRateUsd: null };
  }

  const per100g = (price / weightGrams) * 100;
  const price100gUsd = Math.round((per100g / usdToCurrency) * 100) / 100;
  return { price100gUsd, fxRateUsd: usdToCurrency };
}
