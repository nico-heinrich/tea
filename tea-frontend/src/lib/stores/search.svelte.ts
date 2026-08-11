// ──────────────────────────────────────────────
// Currency state
// ──────────────────────────────────────────────

const VALID_CURRENCY_CODES = ['EUR', 'USD'] as const;

function readCurrencyFromStorage(): string {
	try {
		if (typeof localStorage === 'undefined') return 'EUR';
		const stored = localStorage.getItem('tea-currency');
		if (stored && VALID_CURRENCY_CODES.includes(stored as (typeof VALID_CURRENCY_CODES)[number])) {
			return stored;
		}
	} catch {
		return 'EUR';
	}
	return 'EUR';
}

let currency = $state<string>(readCurrencyFromStorage());

export function getCurrency(): string {
	return currency;
}

export function setCurrency(code: 'EUR' | 'USD'): void {
	currency = code;
	try {
		if (typeof localStorage !== 'undefined') {
			localStorage.setItem('tea-currency', code);
		}
	} catch {
		// localStorage may be unavailable
	}
}
