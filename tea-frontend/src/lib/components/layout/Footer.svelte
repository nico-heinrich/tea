<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { localizeHref } from '$lib/paraglide/runtime.js';
	import LanguageSwitcher from '$lib/components/ui/LanguageSwitcher.svelte';
</script>

<footer class="bg-foreground text-sm text-background">
	<div class="container flex flex-col items-center justify-between gap-4 py-6 sm:flex-row">
		<nav aria-label="Footer" class="flex flex-wrap items-center gap-6">
			<a href={localizeHref('/legal')}>
				{m['footer.legal']()}
			</a>
			<a href={localizeHref('/privacy')}>
				{m['footer.privacy']()}
			</a>
			<a href={localizeHref('/about')}>
				{m['footer.about']()}
			</a>
			<a href={localizeHref('/contact')}>
				{m['footer.contact']()}
			</a>
		</nav>
		<div class="flex items-center gap-2">
			<LanguageSwitcher />
		</div>
	</div>
</footer>
