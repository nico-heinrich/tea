<script lang="ts">
	import { RotateCcwClock, Search, X } from '@lucide/svelte';
	import { Button } from '$lib/components/ui/button/index.js';
	import { cn } from '$lib/utils.js';

	let {
		suggestion,
		query,
		onSelect,
		selected = false,
		recent = false,
		onRemove,
		class: className = '',
		onmousedown,
		onmouseenter
	}: {
		/** Search suggestion to display */
		suggestion: string;
		/** Current search query for highlighting */
		query: string;
		/** Called when the suggestion is selected via click or keyboard */
		onSelect: (suggestion: string) => void;
		/** Whether this suggestion is the currently highlighted/active option */
		selected?: boolean;
		/** True when the suggestion comes from the user's recent searches (shows a clock icon). */
		recent?: boolean;
		/** Called when the user removes this suggestion from recent searches (only rendered for recent items). */
		onRemove?: (suggestion: string) => void;
		/** Additional CSS classes */
		class?: string;
		onmousedown?: (e: MouseEvent) => void;
		onmouseenter?: (e: MouseEvent) => void;
	} = $props();

	/**
	 * Split the suggestion name into highlighted and non-highlighted parts
	 * based on the query string (case-insensitive).
	 */
	let nameParts = $derived.by(() => {
		if (!query) return [{ text: suggestion, highlight: false }];

		const lowerName = suggestion.toLowerCase();
		const lowerQuery = query.toLowerCase();
		const parts: { text: string; highlight: boolean }[] = [];
		let lastIndex = 0;
		let matchIndex = lowerName.indexOf(lowerQuery, lastIndex);

		while (matchIndex !== -1) {
			// Text before the match
			if (matchIndex > lastIndex) {
				parts.push({
					text: suggestion.slice(lastIndex, matchIndex),
					highlight: false
				});
			}
			// The matched portion
			parts.push({
				text: suggestion.slice(matchIndex, matchIndex + lowerQuery.length),
				highlight: true
			});
			lastIndex = matchIndex + lowerQuery.length;
			matchIndex = lowerName.indexOf(lowerQuery, lastIndex);
		}

		// Remaining text after the last match
		if (lastIndex < suggestion.length) {
			parts.push({
				text: suggestion.slice(lastIndex),
				highlight: false
			});
		}

		return parts;
	});

	function handleClick() {
		onSelect(suggestion);
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter' || e.key === ' ') {
			e.preventDefault();
			onSelect(suggestion);
		}
	}
</script>

<div
	role="option"
	aria-selected={selected}
	aria-label={suggestion}
	tabindex="0"
	class={cn(
		'flex w-full cursor-pointer items-start gap-3 px-3 py-2 text-left',
		'transition-colors rounded-none',
		'focus-visible:outline-none focus-visible:bg-muted focus-visible:text-foreground',
		'hover:bg-muted hover:text-foreground',
		selected && 'bg-muted',
		'group/suggestion',
		className
	)}
	onclick={handleClick}
	onkeydown={handleKeydown}
	{onmousedown}
	{onmouseenter}
>
	<div class="flex min-w-0 flex-1 items-center gap-2 my-auto">
		{#if recent}
			<RotateCcwClock class="size-4 shrink-0 opacity-50" />
		{:else}
			<Search class="size-4 shrink-0 opacity-50" />
		{/if}
		<div class="flex min-w-0 flex-1 flex-col gap-1">
			<!-- Tea name with query highlighting -->
			<span class="truncate text-base">
				{#each nameParts as part}
					{#if part.highlight}
						<strong class="text-foreground decoration-foreground/30 underline-offset-2">
							{part.text}
						</strong>
					{:else}
						{part.text}
					{/if}
				{/each}
			</span>
		</div>
	</div>
	{#if recent && onRemove}
		<Button
			variant="ghost"
			size="icon-sm"
			type="button"
			class="-mr-2 shrink-0 self-center text-muted-foreground/70 hover:bg-transparent hover:text-foreground"
			aria-label={`Remove ${suggestion} from recent searches`}
			onclick={(e) => {
				e.stopPropagation();
				onRemove(suggestion);
			}}
			onmousedown={(e) => {
				e.preventDefault();
				e.stopPropagation();
			}}
			onkeydown={(e) => e.stopPropagation()}
		>
			<X class="size-4 shrink-0" />
		</Button>
	{/if}
</div>
