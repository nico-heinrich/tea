<script lang="ts">
	import '../app.css';
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import favicon from '$lib/assets/favicon.svg';
	import BackToTop from '$lib/components/ui/back-to-top/BackToTop.svelte';
	import Footer from '$lib/components/layout/Footer.svelte';
	import SearchInput from '$lib/components/search/SearchInput.svelte';
	import { getSearchActive, setSearchActive } from '$lib/stores/search-active.svelte.js';
	import { localizeHref } from '$lib/paraglide/runtime.js';
	import { cn } from '$lib/utils.js';

	let { children } = $props();

	let searchActive = $derived(getSearchActive());
	let currentQuery = $derived(page.url.searchParams.get('q') ?? '');

	// Initialize the store from the URL before children render, so SSR/first paint
	// already shows the results view when a query is present (no hero flash on refresh).
	setSearchActive(page.url.searchParams.has('q'));

	function handleQueryCommit(query: string) {
		window.dispatchEvent(new CustomEvent('tea-search', { detail: { query } }));
	}

	async function handleLogoClick(e: MouseEvent) {
		// Let modified clicks (cmd/ctrl/shift/middle) behave like a plain link.
		if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey)
			return;
		e.preventDefault();
		try {
			// Clear ?q= from the URL first; only then deactivate the results view.
			// (Setting the store before navigation lets +page.svelte's URL watcher
			// re-activate search while the query is still in the URL.)
			await goto(localizeHref('/'));
		} finally {
			setSearchActive(false);
		}
	}
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

{#if searchActive}
	<header
		class="bg-background/50 backdrop-blur-md fixed z-40 top-0 left-0 right-0 h-18 border-b border-border/40"
	>
		<div class="flex h-full items-center gap-3 container">
			<a
				href={localizeHref('/')}
				class="shrink-0"
				aria-label="Tea Explorer"
				onclick={handleLogoClick}
			>
				<img src="/assets/images/logo.svg" alt="" aria-hidden="true" class="size-11" />
			</a>
			<div class="flex-1 max-w-2xl">
				<SearchInput value={currentQuery} onQueryCommit={handleQueryCommit} />
			</div>
		</div>
	</header>
{/if}

<main class={cn('flex-1', searchActive ? 'pt-18' : '')}>
	{@render children()}
</main>

<Footer />

<BackToTop />
