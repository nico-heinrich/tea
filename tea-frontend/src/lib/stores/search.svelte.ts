import type { TeaSuggestion, SearchResponse } from '$lib/types/tea';

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

// ──────────────────────────────────────────────
// Reactive state (internal, not exported directly)
// ──────────────────────────────────────────────

let query = $state<string>('');

let suggestions = $state<TeaSuggestion[]>([]);

let loading = $state<boolean>(false);

let error = $state<string | null>(null);

// ──────────────────────────────────────────────
// Derived state (internal)
// ──────────────────────────────────────────────

let resultCount = $derived(suggestions.length);

let hasQuery = $derived(query.trim().length > 0);

let hasSuggestions = $derived(suggestions.length > 0);

// ──────────────────────────────────────────────
// Public API: getter functions for reactive access
// ──────────────────────────────────────────────

export function getQuery(): string {
	return query;
}

export function getSuggestions(): TeaSuggestion[] {
	return suggestions;
}

export function getLoading(): boolean {
	return loading;
}

export function getError(): string | null {
	return error;
}

export function getResultCount(): number {
	return resultCount;
}

export function getHasQuery(): boolean {
	return hasQuery;
}

export function getHasSuggestions(): boolean {
	return hasSuggestions;
}

export function search(searchQuery: string): void {
	query = searchQuery;
}

export function clearSearch(): void {
	query = '';
}

// ──────────────────────────────────────────────
// Internal: debounced API call via $effect
// ──────────────────────────────────────────────

let debounceTimer: ReturnType<typeof setTimeout> | null = null;

$effect.root(() => {
	$effect(() => {
		const q = query;
		const cur = currency;

		if (debounceTimer !== null) {
			clearTimeout(debounceTimer);
			debounceTimer = null;
		}

		if (!q.trim()) {
			suggestions = [];
			loading = false;
			error = null;
			return;
		}

		loading = true;
		error = null;

		debounceTimer = setTimeout(async () => {
			try {
				const response = await fetch(
					`/api/search?q=${encodeURIComponent(q.trim())}&currency=${encodeURIComponent(cur)}`
				);

				if (!response.ok) {
					throw new Error(`Search failed: ${response.statusText}`);
				}

				const data: SearchResponse = await response.json();

				if (query === q && currency === cur) {
					suggestions = data.suggestions;
					error = null;
					loading = false;
				}
			} catch (e) {
				if (query === q && currency === cur) {
					error = e instanceof Error ? e.message : 'An unknown error occurred';
					suggestions = [];
					loading = false;
				}
			}
		}, 300);

		return () => {
			if (debounceTimer !== null) {
				clearTimeout(debounceTimer);
				debounceTimer = null;
			}
		};
	});
});
