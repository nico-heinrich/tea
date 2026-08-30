<script lang="ts">
	import { Button } from '$lib/components/ui/button/index.js';
	import { X } from '@lucide/svelte';
	import { fly } from 'svelte/transition';
	import {
		getConsent,
		isBannerOpen,
		closeConsent,
		acceptConsent,
		declineConsent
	} from '$lib/stores/consent.svelte.js';
	import { localizeHref } from '$lib/paraglide/runtime.js';
	import * as m from '$lib/paraglide/messages.js';

	let { root = false }: { root?: boolean } = $props();

	// Don't render during SSR: `consent` reads localStorage on the client only,
	// so on the server it's always null and the banner would flash for a split
	// second before hydration hides it. `mounted` flips to true after hydration
	// on the client, so the real consent value is known before deciding.
	let mounted = $state(false);
	$effect(() => {
		mounted = true;
	});

	// Show the initial prompt only on search (root) routes while undecided; the
	// footer "Consent settings" icon can re-open it anywhere to change the choice.
	let visible = $derived(mounted && (isBannerOpen() || (root && getConsent() === null)));
	let dismissible = $derived(isBannerOpen());
</script>

{#if visible}
	<div
		role="region"
		aria-label="Cookie consent"
		class="container fixed bottom-0 inset-x-0 z-50 p-4 sm:p-6"
		style="view-transition-name: consent-banner;"
		transition:fly={{ y: 50 }}
	>
		<div class="relative rounded-2xl border border-foreground/10 bg-card p-6 shadow-deep">
			{#if dismissible}
				<button
					type="button"
					onclick={closeConsent}
					aria-label={m['consent.close']()}
					class="absolute right-4 top-4 cursor-pointer rounded-full p-1 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
				>
					<X class="size-4 shrink-0" />
				</button>
			{/if}
			<h2 class="text-base font-semibold text-card-foreground">
				{m['consent.bannerTitle']()}
			</h2>
			<p class="mt-2 text-sm text-muted-foreground">
				{m['consent.bannerText']()}
				<a
					href={localizeHref('/privacy')}
					class="underline underline-offset-2 text-foreground hover:text-primary transition-colors"
				>
					{m['footer.privacy']()}
				</a>
			</p>
			<div class="mt-4 flex items-center gap-3">
				<Button variant="default" size="sm" onclick={acceptConsent}>
					{m['consent.accept']()}
				</Button>
				<Button variant="ghost" size="sm" onclick={declineConsent}>
					{m['consent.decline']()}
				</Button>
			</div>
		</div>
	</div>
{/if}
