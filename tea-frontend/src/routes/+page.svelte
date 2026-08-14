<script lang="ts">
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import * as m from '$lib/paraglide/messages.js';
	import SearchInput from '$lib/components/search/SearchInput.svelte';
	import SearchResults from '$lib/components/search/SearchResults.svelte';
	import { getSearchActive, setSearchActive } from '$lib/stores/search-active.svelte.js';
	import { getCurrency } from '$lib/stores/search.svelte.js';
	import type { SearchSort, TeaResult } from '$lib/types/tea.js';

	const PAGE_SIZE = 10;

	let searchActive = $derived(getSearchActive());
	let currentQuery = $derived($page.url.searchParams.get('q') ?? '');
	let results = $state<TeaResult[]>([]);
	// Start in loading state when the URL carries a query, so SSR/first paint
	// shows the skeleton instead of "No teas found." before the first fetch.
	let resultsLoading = $state($page.url.searchParams.has('q'));
	let loadingMore = $state(false);
	let totalCount = $state(0);
	function readSortFromUrl(): SearchSort {
		const s = $page.url.searchParams.get('sort');
		return s === 'price_asc' || s === 'price_desc' ? s : 'relevance';
	}

	let sort = $derived(readSortFromUrl());

	let hasMore = $derived(results.length < totalCount);

	async function fetchResults(
		query: string,
		sort: SearchSort,
		cur: string,
		offset: number,
		append: boolean
	) {
		const res = await fetch(
			`/api/search?q=${encodeURIComponent(query)}&offset=${offset}&currency=${encodeURIComponent(cur)}&sort=${sort}`
		);
		if (res.ok) {
			const data = await res.json();
			if (append) {
				results = [...results, ...(data.results ?? [])];
			} else {
				results = data.results ?? [];
			}
			totalCount = data.totalCount ?? 0;
		}
	}

	async function executeSearch(query: string) {
		const url = new URL($page.url);
		url.searchParams.set('q', query);
		await goto(url, { replaceState: true });

		setSearchActive(true);
	}

	async function loadMore() {
		if (!currentQuery || loadingMore || !hasMore) return;
		loadingMore = true;
		try {
			await fetchResults(currentQuery, sort, getCurrency(), results.length, true);
		} catch {
			// keep existing results on error
		} finally {
			loadingMore = false;
		}
	}

	function handleQueryCommit(query: string) {
		executeSearch(query);
	}

	function handleSortChange(value: SearchSort) {
		const url = new URL($page.url);
		if (value === 'relevance') url.searchParams.delete('sort');
		else url.searchParams.set('sort', value);
		goto(url, { replaceState: true });
	}

	// Single watcher: any change to query, sort, or currency re-runs the search.
	// Covers initial load (URL ?q=), header search, and sort/currency switches.
	$effect(() => {
		const q = $page.url.searchParams.get('q') ?? '';
		if (!q) return;

		const s = readSortFromUrl();
		const cur = getCurrency();

		// A query in the URL activates the results view (initial load / external navigation).
		if (!searchActive) {
			setSearchActive(true);
			return;
		}

		resultsLoading = true;
		fetchResults(q, s, cur, 0, false)
			.catch(() => {
				results = [];
				totalCount = 0;
			})
			.finally(() => {
				resultsLoading = false;
			});
	});

	// Window event subscription — no derived alternative, kept as the only other effect.
	$effect(() => {
		function handleHeaderSearch(e: Event) {
			const detail = (e as CustomEvent).detail as { query: string };
			if (detail.query) executeSearch(detail.query);
		}
		window.addEventListener('tea-search', handleHeaderSearch);
		return () => window.removeEventListener('tea-search', handleHeaderSearch);
	});
</script>

{#if !searchActive}
	<div class="container pt-16">
		<img src="/assets/images/logo.svg" alt="" aria-hidden="true" class="mx-auto size-16" />
		<h1 class="mt-6 mb-8 text-center text-4xl font-bold tracking-tight text-foreground">
			{m['search.heading']()}
		</h1>
		<div class="mx-auto max-w-2xl">
			<SearchInput autofocus={true} onQueryCommit={handleQueryCommit} />
		</div>
	</div>
{:else}
	<div class="container pt-4">
		<SearchResults
			{results}
			{totalCount}
			{hasMore}
			{loadingMore}
			loading={resultsLoading}
			{sort}
			onLoadMore={loadMore}
			onSortChange={handleSortChange}
		/>
	</div>
{/if}
