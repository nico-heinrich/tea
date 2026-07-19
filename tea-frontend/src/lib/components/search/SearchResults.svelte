<script lang="ts">
	import type { TeaResult } from '$lib/types/tea.js';
	import * as m from '$lib/paraglide/messages.js';

	let {
		results = [],
		totalCount = 0,
		hasMore = false,
		loadingMore = false,
		loading = false,
		onLoadMore
	}: {
		results?: TeaResult[];
		totalCount?: number;
		hasMore?: boolean;
		loadingMore?: boolean;
		loading?: boolean;
		onLoadMore?: () => void;
	} = $props();

	const TYPE_COLORS: Record<string, string> = {
		white: 'bg-gray-300',
		yellow: 'bg-yellow-400',
		green: 'bg-green-500',
		oolong: 'bg-blue-500',
		black: 'bg-gray-900',
		dark: 'bg-stone-600'
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

	function formatPrice(
		price: number | null,
		currency: string | null,
		weightGrams: number | null
	): string {
		if (price === null) return m['search.priceUnavailable']();
		const symbol = currency === 'EUR' ? '€' : currency === 'USD' ? '$' : currency ?? '€';
		if (weightGrams !== null && weightGrams > 0) {
			const per100g = (price / weightGrams) * 100;
			return `${per100g.toFixed(2)} ${symbol} / 100g`;
		}
		return `${price.toFixed(2)} ${symbol}`;
	}
</script>

{#if loading}
	<div class="space-y-3">
		{#each [1, 2, 3] as _}
			<div class="rounded-lg border border-border/40 p-4">
				<div class="h-5 w-1/3 animate-pulse rounded bg-muted"></div>
				<div class="mt-2 h-4 w-1/4 animate-pulse rounded bg-muted"></div>
				<div class="mt-2 h-4 w-1/5 animate-pulse rounded bg-muted"></div>
			</div>
		{/each}
	</div>
{:else if results.length === 0}
	<div class="py-16 text-center text-sm text-muted-foreground">
		{m['search.noResults']()}
	</div>
{:else}
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
							{#if tea.style_raw}
								<span class="text-muted-foreground/60">·</span>
								{tea.style_raw}
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
						{formatPrice(tea.price, tea.currency, tea.weight_grams)}
					</div>
				</div>
			</div>
		{/each}

		{#if hasMore}
			<div class="flex justify-center pt-2">
				<button
					onclick={() => onLoadMore?.()}
					disabled={loadingMore}
					class="rounded-md border border-border/40 bg-background px-4 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted/50 disabled:cursor-not-allowed disabled:opacity-50"
				>
					{#if loadingMore}
						{m['search.loading']()}
					{:else}
						{m['search.loadMore']()}
					{/if}
				</button>
			</div>
		{/if}
	</div>
{/if}
