<script lang="ts">
	import '../app.css';
	import { page } from '$app/state';
	import { goto, onNavigate } from '$app/navigation';
	import { tick } from 'svelte';
	import favicon from '$lib/assets/favicon.svg';
	import BackToTop from '$lib/components/ui/back-to-top/BackToTop.svelte';
	import Footer from '$lib/components/layout/Footer.svelte';
	import SearchInput from '$lib/components/search/SearchInput.svelte';
	import ConsentBanner from '$lib/components/ui/ConsentBanner.svelte';
	import BurgerMenu from '$lib/components/ui/burger-menu/BurgerMenu.svelte';
	import { getSearchActive, setSearchActive } from '$lib/stores/search-active.svelte.js';
	import { localizeHref, locales, baseLocale } from '$lib/paraglide/runtime.js';
	import * as m from '$lib/paraglide/messages.js';

	let { children } = $props();

	let searchActive = $derived(getSearchActive());
	let currentQuery = $derived(page.url.searchParams.get('q') ?? '');

	// Check if we're on the root page (handles i18n: "/" or "/de" or "/de/")
	let isRootPage = $derived.by(() => {
		const path = page.url.pathname.replace(/\/$/, '') || '/';
		return path === '/' || locales.some((l) => l !== baseLocale && path === `/${l}`);
	});

	// Map path segments to page titles
	const pageTitleKeys: Record<string, () => string> = {
		about: m['footer.about'],
		contact: m['footer.contact'],
		legal: m['footer.legal'],
		privacy: m['footer.privacy']
	};

	let pageTitle = $derived.by(() => {
		const path = page.url.pathname;
		// Strip locale prefix if present
		const segment = path
			.replace(/^\/(en|de)\//, '')
			.replace(/^\//, '')
			.split('/')[0];
		return segment && pageTitleKeys[segment] ? pageTitleKeys[segment]() : '';
	});

	// Initialize the store from the URL before children render, so SSR/first paint
	// already shows the results view when a query is present (no hero flash on refresh).
	setSearchActive(page.url.searchParams.has('q'));

	onNavigate((navigation) => {
		const toPath = navigation.to?.url.pathname.replace(/\/$/, '') || '/';
		const isTargetRoot =
			toPath === '/' || locales.some((l) => l !== baseLocale && toPath === `/${l}`);

		if (!document.startViewTransition) {
			// Fallback: apply state directly without transition
			if (isTargetRoot) {
				setSearchActive(navigation.to?.url.searchParams.has('q') ?? false);
			}
			return;
		}

		return new Promise((resolve) => {
			document.startViewTransition(async () => {
				// Apply state changes INSIDE the callback so the transition
				// captures the old DOM, then animates to the new DOM.
				if (isTargetRoot) {
					setSearchActive(navigation.to?.url.searchParams.has('q') ?? false);
				}
				await tick();
				resolve();
			});
		});
	});

	function handleQueryCommit(query: string) {
		window.dispatchEvent(new CustomEvent('tea-search', { detail: { query } }));
	}

	async function handleLogoClick(e: MouseEvent) {
		// Let modified clicks (cmd/ctrl/shift/middle) behave like a plain link.
		if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey)
			return;
		e.preventDefault();
		await goto(localizeHref('/'));
	}

	// Blur-gradient header backdrop (technique: exord.de/blog/blur-gradients-mit-css).
	// Several thin layers, each blurred slightly more than the last, each masked so its
	// opaque->transparent window sits one segment higher than the previous layer. Blur
	// compounds where all layers overlap (top) and fades to sharp at the bottom edge,
	// avoiding the "fogged glass" look of one large blur under an alpha-fade mask.
	const BLUR_LAYERS = 6;
	/** Height of the blurry→sharp transition zone in rem (header is h-18 = 4.5rem). */
	const BLUR_GRADIENT_HEIGHT_REM = 2.25;

	function blurLayerStyle(layer: number) {
		const segmentRem = BLUR_GRADIENT_HEIGHT_REM / BLUR_LAYERS;
		const blur = `${(layer * 0.5).toFixed(1)}px`;
		const opaqueStop = `calc(100% - ${(segmentRem * layer).toFixed(3)}rem)`;
		const transparentStop = `calc(100% - ${(segmentRem * (layer - 1)).toFixed(3)}rem)`;
		const mask = `linear-gradient(to bottom, black ${opaqueStop}, transparent ${transparentStop})`;
		return [
			`backdrop-filter: blur(${blur})`,
			`-webkit-backdrop-filter: blur(${blur})`,
			`mask-image: ${mask}`,
			`-webkit-mask-image: ${mask}`
		].join('; ');
	}
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

<header class="fixed z-40 top-0 left-0 right-0 h-22">
	{#if searchActive || !isRootPage}
		{#each Array.from({ length: BLUR_LAYERS }, (_, i) => i + 1) as layer (layer)}
			<div
				aria-hidden="true"
				class="pointer-events-none absolute inset-0 bg-background/10"
				style={blurLayerStyle(layer)}
			></div>
		{/each}
	{/if}
	<div class="relative flex h-full items-center gap-3 container pb-2">
		{#if searchActive || !isRootPage}
			<a
				href={localizeHref('/')}
				class="shrink-0 hover:scale-105 active:scale-100 active:duration-75 transition-all"
				aria-label="Tea Explorer"
				onclick={handleLogoClick}
			>
				<img
					src="/assets/images/logo.svg"
					alt=""
					aria-hidden="true"
					class="size-11"
					style="view-transition-name: logo"
				/>
			</a>
		{/if}
		{#if isRootPage && searchActive}
			<div class="flex-1 max-w-2xl">
				<SearchInput value={currentQuery} onQueryCommit={handleQueryCommit} />
			</div>
		{:else if pageTitle}
			<h1
				class="w-auto text-lg font-semibold tracking-tight text-foreground"
				style="view-transition-name: heading"
			>
				{pageTitle}
			</h1>
		{/if}
		<div class="ml-auto">
			<BurgerMenu />
		</div>
	</div>
</header>

<main class="flex-1 pt-18">
	{@render children()}
</main>

<Footer />

<BackToTop />

<ConsentBanner />
