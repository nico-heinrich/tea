<script lang="ts">
	import '../app.css';
	import { page } from '$app/state';
	import favicon from '$lib/assets/favicon.svg';
	import LanguageSwitcher from '$lib/components/ui/LanguageSwitcher.svelte';
	import SearchInput from '$lib/components/search/SearchInput.svelte';
	import { getSearchActive } from '$lib/stores/search-active.svelte.js';
	import { getCurrency, setCurrency } from '$lib/stores/search.svelte.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import { cn } from '$lib/utils.js';

	let { children } = $props();

	let searchActive = $derived(getSearchActive());
	let currentQuery = $derived(page.url.searchParams.get('q') ?? '');
	let currentCurrency = $derived(getCurrency());

	const CURRENCIES = ['EUR', 'USD'] as const;
	const CURRENCY_SYMBOLS: Record<string, string> = { EUR: '\u20AC', USD: '$' };

	function handleQueryCommit(query: string) {
		window.dispatchEvent(new CustomEvent('tea-search', { detail: { query } }));
	}
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

<header
	class={cn(
		'bg-background h-18 top-0 left-0 right-0',
		searchActive ? 'fixed border-b border-border/40' : 'static'
	)}
>
	<div class="flex h-full items-center justify-between gap-4 container">
		{#if searchActive}
			<div class="flex-1 max-w-2xl">
				<SearchInput value={currentQuery} onQueryCommit={handleQueryCommit} />
			</div>
		{/if}
		<div class="ml-auto flex items-center gap-3">
			<div
				class="flex items-center rounded-md border border-border/40 text-xs"
				role="group"
				aria-label="Currency"
			>
				{#each CURRENCIES as code (code)}
					<Button
						type="button"
						aria-pressed={currentCurrency === code}
						onclick={() => setCurrency(code)}
						variant="ghost"
						size="sm"
						class={cn(
							'rounded-none px-2 py-1 text-xs',
							currentCurrency === code
								? 'bg-foreground text-background font-semibold'
								: 'text-muted-foreground hover:text-foreground'
						)}
					>
						{CURRENCY_SYMBOLS[code] ?? code}
					</Button>
				{/each}
			</div>
			<LanguageSwitcher />
		</div>
	</div>
</header>

<main class={searchActive ? 'pt-18' : ''}>
	{@render children()}
</main>
