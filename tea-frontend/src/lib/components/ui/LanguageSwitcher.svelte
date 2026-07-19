<script lang="ts">
	import * as m from "$lib/paraglide/messages.js";
	import { localizeHref, getLocale } from "$lib/paraglide/runtime.js";

	let currentLocale = $derived(getLocale());
</script>

<nav class="flex items-center gap-2 text-sm">
	<button
		type="button"
		onclick={() => { window.location.href = localizeHref("/", { locale: "en" }); }}
		class={currentLocale === "en"
			? "font-semibold text-foreground underline underline-offset-4"
			: "text-muted-foreground hover:text-foreground transition-colors"}
	>
		{m["language.english"]()}
	</button>
	<span class="text-muted-foreground/40" aria-hidden="true">/</span>
	<button
		type="button"
		onclick={() => { window.location.href = localizeHref("/", { locale: "de" }); }}
		class={currentLocale === "de"
			? "font-semibold text-foreground underline underline-offset-4"
			: "text-muted-foreground hover:text-foreground transition-colors"}
	>
		{m["language.german"]()}
	</button>
</nav>
