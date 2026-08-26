<script lang="ts">
	import LanguageSwitcher from '$lib/components/ui/LanguageSwitcher.svelte';
	import { getNavLinks } from '$lib/config/navigation.js';

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
		<div class="flex items-center gap-2">
			<LanguageSwitcher />
		</div>
	</div>
</footer>
