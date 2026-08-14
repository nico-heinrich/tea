<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { localizeHref, getLocale } from '$lib/paraglide/runtime.js';

	let currentLocale = $derived(getLocale());
</script>

<nav class="flex items-center gap-2 text-sm">
	<button
		type="button"
		onclick={() => {
			window.location.href = localizeHref(window.location.pathname + window.location.search, {
				locale: 'en'
			});
		}}
		class={currentLocale === 'en'
			? 'font-semibold text-background underline underline-offset-4 pointer-events-none'
			: 'text-muted-background cursor-pointer'}
	>
		EN
	</button>
	<span class="text-muted-background/40" aria-hidden="true">/</span>
	<button
		type="button"
		onclick={() => {
			window.location.href = localizeHref(window.location.pathname + window.location.search, {
				locale: 'de'
			});
		}}
		class={currentLocale === 'de'
			? 'font-semibold text-background underline underline-offset-4 pointer-events-none'
			: 'text-muted-background cursor-pointer'}
	>
		DE
	</button>
</nav>
