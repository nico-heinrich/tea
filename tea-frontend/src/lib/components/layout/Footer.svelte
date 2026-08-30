<script lang="ts">
	import LanguageSwitcher from '$lib/components/ui/LanguageSwitcher.svelte';
	import Cookie from '@lucide/svelte/icons/cookie';
	import { getNavLinks } from '$lib/config/navigation.js';
	import { openConsent } from '$lib/stores/consent.svelte.js';
	import * as m from '$lib/paraglide/messages.js';

	const links = getNavLinks();
</script>

<footer class="bg-foreground text-sm text-background" style="view-transition-name: footer">
	<div class="container flex flex-col items-center justify-between gap-4 py-6 sm:flex-row">
		<nav aria-label="Footer" class="flex flex-wrap items-center gap-6">
			{#each links as link}
				<a href={link.href}>
					{link.label}
				</a>
			{/each}
		</nav>
		<div class="flex items-center gap-3">
			<button
				type="button"
				onclick={openConsent}
				aria-label={m['footer.consent']()}
				title={m['footer.consent']()}
				class="cursor-pointer text-muted-background transition-colors hover:text-background"
			>
				<Cookie class="size-4 shrink-0" />
			</button>
			<span class="text-muted-background/40" aria-hidden="true">|</span>
			<LanguageSwitcher />
		</div>
	</div>
</footer>
