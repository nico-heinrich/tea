<script lang="ts">
	import type { Snippet } from 'svelte';
	import { cn } from '$lib/utils.js';

	let {
		class: className,
		topFade = true,
		bottomFade = true,
		fadeColor = 'var(--background, white)',
		fadeSize = '2rem',
		children
	}: {
		class?: string;
		topFade?: boolean;
		bottomFade?: boolean;
		fadeColor?: string;
		fadeSize?: string;
		children?: Snippet;
	} = $props();

	let containerRef = $state<HTMLDivElement | null>(null);
	let showTop = $state(false);
	let showBottom = $state(false);

	function updateScrollState() {
		const el = containerRef;
		if (!el) return;

		showTop = el.scrollTop > 0;
		showBottom = el.scrollHeight - el.scrollTop > el.clientHeight;
	}

	$effect(() => {
		const el = containerRef;
		if (!el) return;

		updateScrollState();

		el.addEventListener('scroll', updateScrollState, { passive: true });

		const observer = new ResizeObserver(updateScrollState);
		observer.observe(el);

		return () => {
			el.removeEventListener('scroll', updateScrollState);
			observer.disconnect();
		};
	});
</script>

<div
	bind:this={containerRef}
	class={cn('relative overflow-hidden', className)}
>
	{@render children?.()}

	{#if topFade}
		<div
			aria-hidden="true"
			class="pointer-events-none absolute inset-x-0 top-0 z-10 transition-opacity duration-200"
			style="height: {fadeSize}; opacity: {showTop ? 1 : 0}; background: linear-gradient(to bottom, {fadeColor}, transparent);"
		></div>
	{/if}

	{#if bottomFade}
		<div
			aria-hidden="true"
			class="pointer-events-none absolute inset-x-0 bottom-0 z-10 transition-opacity duration-200"
			style="height: {fadeSize}; opacity: {showBottom ? 1 : 0}; background: linear-gradient(to top, {fadeColor}, transparent);"
		></div>
	{/if}
</div>
