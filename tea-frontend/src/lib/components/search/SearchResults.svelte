<script lang="ts">
	import type { TeaResult, SearchSort } from '$lib/types/tea.js';
	import * as m from '$lib/paraglide/messages.js';
	import { Skeleton } from '$lib/components/ui/skeleton/index.js';
	import * as NativeSelect from '$lib/components/ui/native-select/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import { getCurrency, setCurrency } from '$lib/stores/search.svelte.js';

	let {
		results = [],
		totalCount = 0,
		hasMore = false,
		loadingMore = false,
		loading = false,
		sort = 'relevance',
		onLoadMore,
		onSortChange
	}: {
		results?: TeaResult[];
		totalCount?: number;
		hasMore?: boolean;
		loadingMore?: boolean;
		loading?: boolean;
		sort?: SearchSort;
		onLoadMore?: () => void;
		onSortChange?: (sort: SearchSort) => void;
	} = $props();

	let currentCurrency = $derived(getCurrency());

	const TYPE_COLORS: Record<string, string> = {
		white: 'bg-white-tea',
		yellow: 'bg-yellow-tea',
		green: 'bg-green-tea',
		oolong: 'bg-oolong-tea',
		black: 'bg-black-tea',
		dark: 'bg-dark-tea'
	};

	function typeColor(typeKey: string): string {
		return TYPE_COLORS[typeKey] ?? 'bg-gray-400';
	}

	function translateType(typeKey: string): string {
		switch (typeKey) {
			case 'white':
				return m['type.white']();
			case 'yellow':
				return m['type.yellow']();
			case 'green':
				return m['type.green']();
			case 'oolong':
				return m['type.oolong']();
			case 'black':
				return m['type.black']();
			case 'dark':
				return m['type.dark']();
			default:
				return typeKey;
		}
	}

	function countryName(code: string | null): string {
		if (!code) return '';
		const map: Record<string, string> = {
			JP: 'Japan',
			CN: 'China',
			IN: 'India',
			NP: 'Nepal',
			LK: 'Sri Lanka',
			TW: 'Taiwan',
			KR: 'South Korea',
			VN: 'Vietnam',
			DE: 'Germany',
			FR: 'France',
			IT: 'Italy',
			GB: 'UK',
			US: 'USA',
			AU: 'Australia',
			NZ: 'New Zealand',
			ID: 'Indonesia',
			TH: 'Thailand',
			KE: 'Kenya',
			TZ: 'Tanzania',
			UG: 'Uganda',
			RW: 'Rwanda',
			PT: 'Portugal',
			ES: 'Spain',
			GR: 'Georgia',
			TR: 'Turkey'
		};
		return map[code] ?? code;
	}

	function formatPrice(priceDisplay: number | null, currencyDisplay: string | null): string {
		if (priceDisplay === null) return m['search.priceUnavailable']();
		const symbol =
			currencyDisplay === 'EUR'
				? '\u20AC'
				: currencyDisplay === 'USD'
					? '$'
					: (currencyDisplay ?? '\u20AC');
		return `${priceDisplay.toFixed(2)} ${symbol} / 100g`;
	}
</script>

{#if loading}
	<div class="mb-4 flex items-center justify-between gap-4" aria-hidden="true">
		<Skeleton class="h-4 w-24" />
		<div class="flex items-center gap-3">
			<Skeleton class="h-7 w-19" />
			<Skeleton class="h-7 w-40" />
		</div>
	</div>
	<div class="space-y-3">
		{#each [1, 2, 3] as _}
			<div class="rounded-lg border border-border/40 p-4">
				<Skeleton class="h-5 w-1/3" />
				<Skeleton class="mt-2 h-4 w-" />
				<Skeleton class="mt-2 h-4 w-1/5" />
			</div>
		{/each}
	</div>
{:else if results.length === 0}
	<div class="py-16 text-center text-sm text-muted-foreground">
		{m['search.noResults']()}
	</div>
{:else}
	<div class="mb-4 flex flex-wrap items-center justify-between gap-4">
		<span class="text-sm text-muted-foreground">
			{m['search.resultCount']({ count: totalCount })}
		</span>
		<div class="flex items-center gap-3 text-sm text-muted-foreground">
			<div class="flex items-center gap-2">
				<span class="hidden whitespace-nowrap sm:inline">{m['search.currencyLabel']()}</span>
				<NativeSelect.Root
					size="sm"
					class="w-20"
					value={currentCurrency}
					aria-label={m['search.currencyLabel']()}
					onchange={(e) => setCurrency(e.currentTarget.value as 'EUR' | 'USD')}
				>
					<NativeSelect.Option value="EUR">EUR</NativeSelect.Option>
					<NativeSelect.Option value="USD">USD</NativeSelect.Option>
				</NativeSelect.Root>
			</div>
			<div class="flex items-center gap-2">
				<span class="hidden whitespace-nowrap sm:inline">{m['search.sortLabel']()}</span>
				<NativeSelect.Root
					size="sm"
					class="w-40"
					value={sort}
					aria-label={m['search.sortLabel']()}
					onchange={(e) => onSortChange?.(e.currentTarget.value as SearchSort)}
				>
					<NativeSelect.Option value="relevance">{m['search.sortRelevance']()}</NativeSelect.Option>
					<NativeSelect.Option value="price_asc">{m['search.sortPriceAsc']()}</NativeSelect.Option>
					<NativeSelect.Option value="price_desc">{m['search.sortPriceDesc']()}</NativeSelect.Option
					>
				</NativeSelect.Root>
			</div>
		</div>
	</div>
	<div class="space-y-2 mb-8">
		{#each results as tea}
			<div class="rounded-lg border border-border/40 px-4 py-3 transition-colors hover:bg-muted/50">
				<div class="flex items-start justify-between gap-4">
					<div class="min-w-0 flex-1">
						<div class="text-base font-medium text-foreground">
							<a
								href={tea.url || '#'}
								target="_blank"
								rel="noopener noreferrer"
								class="hover:underline"
							>
								{tea.name}

								{#if tea.vendor_name}
									<span class="text-sm font-normal text-muted-foreground">
										— {tea.vendor_name}</span
									>
								{/if}
							</a>
						</div>
						<div class="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
							<span
								class="inline-block size-2 rounded-full {typeColor(tea.type_key)}"
								aria-hidden="true"
							></span>
							{translateType(tea.type_key)}
							{#if tea.style_label}
								<span class="text-muted-foreground/60">·</span>
								{tea.style_label}
							{/if}
							{#if tea.harvest_year}
								<span class="text-muted-foreground/60">·</span>
								{tea.harvest_year}
							{/if}
						</div>
						<div class="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
							{#if tea.origin}
								{tea.origin}
							{/if}
							{#if tea.origin_country}
								{#if tea.origin}
									<span class="text-muted-foreground/60">·</span>
								{/if}
								{countryName(tea.origin_country)}
							{/if}
						</div>
					</div>
					<div class="shrink-0 text-right text-sm text-muted-foreground">
						{formatPrice(tea.price_display, tea.currency_display)}
					</div>
				</div>
			</div>
		{/each}

		{#if hasMore}
			<div class="flex justify-center pt-2">
				<Button variant="outline" onclick={() => onLoadMore?.()} disabled={loadingMore}>
					{#if loadingMore}
						{m['search.loading']()}
					{:else}
						{m['search.loadMore']()}
					{/if}
				</Button>
			</div>
		{/if}
	</div>
{/if}
