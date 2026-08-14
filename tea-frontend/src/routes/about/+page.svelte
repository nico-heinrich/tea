<script lang="ts">
	import * as m from '$lib/paraglide/messages.js'
</script>

<svelte:head>
	<title>{m['footer.about']()}</title>
</svelte:head>

<div class="container py-12">
	<h1 class="text-2xl font-semibold tracking-tight">{m['footer.about']()}</h1>
	<p class="mt-4 max-w-prose text-muted-foreground">{m['page.placeholder']()}</p>
</div>
