<script lang="ts">
	import { Button } from '$lib/components/ui/button/index.js';
	import { Menu, X } from '@lucide/svelte';
	import { fly } from 'svelte/transition';
	import { backdropBlur } from '$lib/transitions';
	import { getNavLinks } from '$lib/config/navigation.js';
	import { page } from '$app/stores';

	let open = $state(false);

	const links = getNavLinks();

	function isActive(href: string): boolean {
		const currentPath = $page.url.pathname.replace(/\/$/, '') || '/';
		const linkPath = new URL(href, $page.url.origin).pathname.replace(/\/$/, '') || '/';
		return currentPath === linkPath;
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') {
			open = false;
		}
	}

	$effect(() => {
		if (open) {
			document.addEventListener('keydown', handleKeydown);
			return () => {
				document.removeEventListener('keydown', handleKeydown);
			};
		}
	});
</script>

<div class="relative">
	<Button
		variant="ghost"
		size="icon-sm"
		onclick={() => (open = !open)}
		aria-label={open ? 'Close menu' : 'Open menu'}
		aria-expanded={open}
	>
		{#if open}
			<X class="size-5" />
		{:else}
			<Menu class="size-5" />
		{/if}
	</Button>

	{#if open}
		<div
			class="fixed inset-0 z-50"
			role="dialog"
			aria-modal="true"
			transition:backdropBlur={{ duration: 200, blur: 4, opacity: 0.2 }}
			onclick={(e) => {
				if (e.target === e.currentTarget) open = false;
			}}
		>
			<div
				role="menu"
				class="absolute inset-y-0 right-0 w-full max-w-[calc(100vw-3rem)] sm:max-w-sm bg-background p-6 shadow-xl"
				transition:fly={{ x: '100%', duration: 300 }}
			>
				<div class="flex justify-end mb-8">
					<Button
						variant="ghost"
						size="icon-sm"
						onclick={() => (open = false)}
						aria-label="Close menu"
					>
						<X class="size-5" />
					</Button>
				</div>

				<nav class="flex flex-col gap-2">
					{#each links as link}
						<a
							href={link.href}
							role="menuitem"
							class="block rounded-lg px-4 py-3 text-lg transition-colors {isActive(link.href)
								? 'font-medium hover:bg-muted'
								: 'hover:bg-muted'}"
							onclick={() => (open = false)}
						>
							{link.label}
						</a>
					{/each}
				</nav>
			</div>
		</div>
	{/if}
</div>
