import type { TeaSuggestion, SearchResponse } from '$lib/types/tea';

// ──────────────────────────────────────────────
// Reactive state (internal, not exported directly)
// ──────────────────────────────────────────────

/** Current search query string */
let query = $state<string>('');

/** Search suggestions returned by the API */
let suggestions = $state<TeaSuggestion[]>([]);

/** Whether a search request is in-flight */
let loading = $state<boolean>(false);

/** Error message, if any */
let error = $state<string | null>(null);

// ──────────────────────────────────────────────
// Derived state (internal)
// ──────────────────────────────────────────────

/** Number of suggestions returned */
let resultCount = $derived(suggestions.length);

/** Whether the user has typed a non-whitespace query */
let hasQuery = $derived(query.trim().length > 0);

/** Whether the API returned any suggestions */
let hasSuggestions = $derived(suggestions.length > 0);

// ──────────────────────────────────────────────
// Public API: getter functions for reactive access
// ──────────────────────────────────────────────

/** Get current query */
export function getQuery(): string {
	return query;
}

/** Get current suggestions */
export function getSuggestions(): TeaSuggestion[] {
	return suggestions;
}

/** Get loading state */
export function getLoading(): boolean {
	return loading;
}

/** Get error message */
export function getError(): string | null {
	return error;
}

/** Get result count */
export function getResultCount(): number {
	return resultCount;
}

/** Check if query is non-empty */
export function getHasQuery(): boolean {
	return hasQuery;
}

/** Check if has suggestions */
export function getHasSuggestions(): boolean {
	return hasSuggestions;
}

/**
 * Update the search query. Triggers a debounced fetch
 * against `/api/search?q=...` with a 300 ms delay.
 */
export function search(searchQuery: string): void {
	query = searchQuery;
}

/**
 * Clear the current search query and reset results.
 */
export function clearSearch(): void {
	query = '';
}

// ──────────────────────────────────────────────
// Internal: debounced API call via $effect
// ──────────────────────────────────────────────

let debounceTimer: ReturnType<typeof setTimeout> | null = null;

// Use $effect.root() so this module-level effect doesn't need a component context.
// Without root(), Svelte throws effect_orphan during SSR/hydration.
$effect.root(() => {
	$effect(() => {
		// Read `query` to register it as a dependency
		const q = query;

		// Cancel any pending request from a previous query change
		if (debounceTimer !== null) {
			clearTimeout(debounceTimer);
			debounceTimer = null;
		}

		// Empty query → reset immediately
		if (!q.trim()) {
			suggestions = [];
			loading = false;
			error = null;
			return;
		}

		// Start loading and schedule the actual fetch
		loading = true;
		error = null;

		debounceTimer = setTimeout(async () => {
			try {
				const response = await fetch(`/api/search?q=${encodeURIComponent(q.trim())}`);

				if (!response.ok) {
					throw new Error(`Search failed: ${response.statusText}`);
				}

				const data: SearchResponse = await response.json();

				// Only apply the result if the query hasn't changed again while we were fetching
				if (query === q) {
					suggestions = data.suggestions;
					error = null;
					loading = false;
				}
			} catch (e) {
				// Only apply the error if the query hasn't changed again
				if (query === q) {
					error = e instanceof Error ? e.message : 'An unknown error occurred';
					suggestions = [];
					loading = false;
				}
			}
		}, 300);

		// Cleanup: cancel the timer when the effect re-runs or the component unmounts
		return () => {
			if (debounceTimer !== null) {
				clearTimeout(debounceTimer);
				debounceTimer = null;
			}
		};
	});
});