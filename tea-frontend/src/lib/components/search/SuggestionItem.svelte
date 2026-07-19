<script lang="ts">
	import { Badge } from "$lib/components/ui/badge/index.js";
	import { cn } from "$lib/utils.js";
	import type { TeaSuggestion } from "$lib/types/tea.js";

	let {
		suggestion,
		query,
		onSelect,
		selected = false,
		class: className = "",
	}: {
		/** Search suggestion to display */
		suggestion: TeaSuggestion;
		/** Current search query for highlighting */
		query: string;
		/** Called when the suggestion is selected via click or keyboard */
		onSelect: (suggestion: TeaSuggestion) => void;
		/** Whether this suggestion is the currently highlighted/active option */
		selected?: boolean;
		/** Additional CSS classes */
		class?: string;
	} = $props();

	/**
	 * Split the suggestion name into highlighted and non-highlighted parts
	 * based on the query string (case-insensitive).
	 */
	let nameParts = $derived.by(() => {
		if (!query) return [{ text: suggestion.name, highlight: false }];

		const lowerName = suggestion.name.toLowerCase();
		const lowerQuery = query.toLowerCase();
		const parts: { text: string; highlight: boolean }[] = [];
		let lastIndex = 0;
		let matchIndex = lowerName.indexOf(lowerQuery, lastIndex);

		while (matchIndex !== -1) {
			// Text before the match
			if (matchIndex > lastIndex) {
				parts.push({
					text: suggestion.name.slice(lastIndex, matchIndex),
					highlight: false,
				});
			}
			// The matched portion
			parts.push({
				text: suggestion.name.slice(matchIndex, matchIndex + lowerQuery.length),
				highlight: true,
			});
			lastIndex = matchIndex + lowerQuery.length;
			matchIndex = lowerName.indexOf(lowerQuery, lastIndex);
		}

		// Remaining text after the last match
		if (lastIndex < suggestion.name.length) {
			parts.push({
				text: suggestion.name.slice(lastIndex),
				highlight: false,
			});
		}

		return parts;
	});

	/**
	 * Map the type_key to an appropriate Badge variant color.
	 */
	function badgeVariant(typeKey: string) {
		switch (typeKey) {
			case "green":
			case "black":
				return "default";
			case "oolong":
				return "secondary";
			case "white":
			case "yellow":
				return "outline";
			case "dark":
				return "destructive";
			default:
				return "secondary";
		}
	}

	/**
	 * Build a combined origin display string from origin and origin_country.
	 */
	let originDisplay = $derived.by(() => {
		if (suggestion.origin && suggestion.origin_country) {
			return `${suggestion.origin}, ${suggestion.origin_country}`;
		}
		return suggestion.origin ?? suggestion.origin_country ?? null;
	});

	function handleClick() {
		onSelect(suggestion);
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === "Enter" || e.key === " ") {
			e.preventDefault();
			onSelect(suggestion);
		}
	}
</script>

<button
	type="button"
	role="option"
	aria-selected={selected}
	aria-label={suggestion.name}
	class={cn(
		"flex w-full items-start gap-3 px-3 py-2 text-left text-sm",
		"transition-colors rounded-none",
		"focus-visible:outline-none focus-visible:bg-muted focus-visible:text-foreground",
		"hover:bg-muted hover:text-foreground",
		selected && "bg-muted",
		"group/suggestion",
		className,
	)}
	onclick={handleClick}
	onkeydown={handleKeydown}
>
	<div class="flex min-w-0 flex-1 flex-col gap-1">
		<!-- Tea name with query highlighting -->
		<span class="truncate font-medium">
			{#each nameParts as part}
				{#if part.highlight}
					<strong class="text-foreground underline decoration-foreground/30 underline-offset-2">
						{part.text}
					</strong>
				{:else}
					{part.text}
				{/if}
			{/each}
		</span>

		<!-- Badges and origin row -->
		<div class="flex flex-wrap items-center gap-1.5">
			{#if suggestion.style_raw}
				<Badge
					variant="outline"
					class="text-[10px] leading-none px-1.5 py-0"
				>
					{suggestion.style_raw}
				</Badge>
			{/if}

			<Badge
				variant={badgeVariant(suggestion.type_key)}
				class="text-[10px] leading-none px-1.5 py-0 capitalize"
			>
				{suggestion.type_key}
			</Badge>

			{#if originDisplay}
				<span class="truncate text-xs text-muted-foreground">
					{originDisplay}
				</span>
			{/if}
		</div>
	</div>
</button>
