<script lang="ts">
	import { Button } from '$lib/components/ui/button/index.js';
	import { getConsent, acceptConsent, declineConsent } from '$lib/stores/consent.svelte.js';
	import { localizeHref } from '$lib/paraglide/runtime.js';
	import * as m from '$lib/paraglide/messages.js';

	let visible = $derived(getConsent() === null);
</script>

{#if visible}
	<div role="region" aria-label="Cookie consent" class="fixed bottom-0 inset-x-0 z-50 p-4 sm:p-6">
		<div
			class="container mx-auto max-w-2xl rounded-2xl border border-border bg-card p-6 shadow-deep"
		>
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
