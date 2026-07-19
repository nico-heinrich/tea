<script lang="ts">
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import * as m from '$lib/paraglide/messages.js';
	import SearchInput from '$lib/components/search/SearchInput.svelte';
	import SearchResults from '$lib/components/search/SearchResults.svelte';
	import { getSearchActive, setSearchActive } from '$lib/stores/search-active.svelte.js';
	import type { TeaResult } from '$lib/types/tea.js';

	const PAGE_SIZE = 10;

	let searchActive = $derived(getSearchActive());
	let currentQuery = $derived($page.url.searchParams.get('q') ?? '');
	let results = $state<TeaResult[]>([]);
	let resultsLoading = $state(false);
	let loadingMore = $state(false);
	let totalCount = $state(0);

	let hasMore = $derived(results.length < totalCount);

	async function fetchResults(query: string, offset: number, append: boolean) {
		const res = await fetch(`/api/search?q=${encodeURIComponent(query)}&offset=${offset}`);
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
		// Update URL
		const url = new URL($page.url);
		url.searchParams.set('q', query);
		await goto(url, { replaceState: true });

		setSearchActive(true);
		resultsLoading = true;
		try {
			await fetchResults(query, 0, false);
		} catch {
			results = [];
			totalCount = 0;
		} finally {
			resultsLoading = false;
		}
	}

	async function loadMore() {
		if (!currentQuery || loadingMore || !hasMore) return;
		loadingMore = true;
		try {
			await fetchResults(currentQuery, results.length, true);
		} catch {
			// keep existing results on error
		} finally {
			loadingMore = false;
		}
	}

	function handleQueryCommit(query: string) {
		executeSearch(query);
	}

	// On mount: if URL has ?q=, execute the search
	$effect(() => {
		const q = $page.url.searchParams.get('q');
		if (q && !searchActive) {
			executeSearch(q);
		}
	});

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
		<h1 class="mb-8 text-center text-4xl font-bold tracking-tight text-foreground">
			{m['search.heading']()}
		</h1>
		<div class="mx-auto max-w-2xl">
			<SearchInput autofocus={true} onQueryCommit={handleQueryCommit} />
		</div>
	</div>
{:else}
	<div class="container pt-8">
		<SearchResults
			{results}
			{totalCount}
			{hasMore}
			{loadingMore}
			loading={resultsLoading}
			onLoadMore={loadMore}
		/>
	</div>
{/if}
