<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';

	let { data } = $props();
</script>

<svelte:head>
	<title>{m['footer.legal']()}</title>
</svelte:head>

<div class="container py-8">
	<div class="prose-custom max-w-prose text-muted-foreground">
		{@html data.html}
	</div>
</div>

<style>
	:global(.prose-custom h2) {
		font-size: 1.25rem;
		font-weight: 600;
		color: var(--color-foreground);
		margin-top: 2rem;
		margin-bottom: 0.75rem;
	}

	:global(.prose-custom h3) {
		font-size: 1.125rem;
		font-weight: 600;
		color: var(--color-foreground);
		margin-top: 1.5rem;
		margin-bottom: 0.5rem;
	}

	:global(.prose-custom p) {
		margin-bottom: 1rem;
		line-height: 1.75;
	}

	:global(.prose-custom ul) {
		list-style-type: disc;
		padding-left: 1.5rem;
		margin-bottom: 1rem;
	}

	:global(.prose-custom li) {
		margin-bottom: 0.25rem;
		line-height: 1.75;
	}

	:global(.prose-custom a) {
		color: var(--color-foreground);
		text-decoration: underline;
		text-underline-offset: 2px;
		transition: color 0.15s;
	}

	:global(.prose-custom a:hover) {
		color: var(--color-primary);
	}

	:global(.prose-custom strong) {
		color: var(--color-foreground);
		font-weight: 600;
	}

	:global(.prose-custom em) {
		font-style: italic;
	}
</style>
