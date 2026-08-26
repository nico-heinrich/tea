<script lang="ts">
	import { Input } from '$lib/components/ui/input/index.js';
	import { Popover, PopoverContent } from '$lib/components/ui/popover/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import { X } from '@lucide/svelte';
	import { Popover as PopoverPrimitive } from 'bits-ui';
	import { cn } from '$lib/utils.js';
	import * as m from '$lib/paraglide/messages.js';
	import SuggestionItem from './SuggestionItem.svelte';

	const RECENT_KEY = 'tea-recent-searches';
	const MAX_RECENT = 10;

	let {
		placeholder = m['search.placeholder'](),
		value = '',
		autofocus = false,
		onQueryCommit
	}: {
		placeholder?: string;
		value?: string;
		autofocus?: boolean;
		onQueryCommit?: (query: string) => void;
	} = $props();

	let containerRef = $state<HTMLDivElement | null>(null);
	let inputRef = $state<HTMLInputElement | null>(null);
	let query = $state('');
	let isFocused = $state(autofocus);
	let activeIndex = $state(-1);
	let recentSearches = $state<string[]>([]);
	let popularSearches = $state<string[]>([]);
	let popoverOpen = $state(false);

	// Sync with external value prop
	$effect(() => {
		query = value;
	});

	$effect(() => {
		popoverOpen = showPopover;
	});

	// Simple Levenshtein distance for fuzzy matching
	function levenshtein(a: string, b: string): number {
		const m = a.length;
		const n = b.length;
		const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
		for (let i = 0; i <= m; i++) dp[i][0] = i;
		for (let j = 0; j <= n; j++) dp[0][j] = j;
		for (let i = 1; i <= m; i++) {
			for (let j = 1; j <= n; j++) {
				dp[i][j] = Math.min(
					dp[i - 1][j] + 1,
					dp[i][j - 1] + 1,
					dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)
				);
			}
		}
		return dp[m][n];
	}

	// Check if query word fuzzy-matches a target word
	// Allows 2 edits
	function fuzzyWordMatch(queryWord: string, targetWord: string): boolean {
		if (targetWord.startsWith(queryWord)) return true;
		return levenshtein(queryWord, targetWord) <= 2;
	}

	// Check if query fuzzy-matches target using two strategies:
	// 1. Long words (>4 chars) matched word-by-word (catches typos in individual words)
	// 2. Full phrase match as a whole (catches multi-word typos like "bia mu dan" → "bai mu dan")
	function fuzzyMatch(query: string, target: string): boolean {
		const queryWords = query.split(/\s+/).filter(Boolean);
		const targetWords = target.toLowerCase().split(/\s+/);

		// Strategy 1: long words (>4 chars) matched word-by-word
		const hasLongWords = queryWords.some((qw) => qw.length > 4);
		if (hasLongWords) {
			const allMatch = queryWords.every((qw) =>
				qw.length > 4
					? targetWords.some((tw) => fuzzyWordMatch(qw, tw))
					: targetWords.some((tw) => tw.includes(qw))
			);
			if (allMatch) return true;
		}

		// Strategy 2: full phrase match (concatenate all words, compare as one string)
		const queryJoined = queryWords.join('');
		const targetJoined = targetWords.join('');
		if (targetJoined.startsWith(queryJoined)) return true;
		if (levenshtein(queryJoined, targetJoined) <= 3) return true;

		return false;
	}

	const MAX_SUGGESTIONS = 7;

	// Filter suggestions based on query
	let filteredSuggestions = $derived.by(() => {
		const trimmed = query.trim().toLowerCase();
		let results: string[];
		if (!trimmed) {
			// On focus with empty query: show only recent searches
			results = recentSearches;
		} else {
			// When typing: fuzzy filter recents, then popular
			const recentFiltered = recentSearches.filter((r) => fuzzyMatch(trimmed, r.toLowerCase()));
			const popularFiltered = popularSearches.filter((p) => fuzzyMatch(trimmed, p.toLowerCase()));
			results = [...recentFiltered, ...popularFiltered.filter((p) => !recentFiltered.includes(p))];
		}
		return results.slice(0, MAX_SUGGESTIONS);
	});

	// Show popover on focus (with recents) or when typing and there are matches
	let showPopover = $derived(isFocused && filteredSuggestions.length > 0);

	function loadRecents() {
		try {
			const raw = localStorage.getItem(RECENT_KEY);
			recentSearches = raw ? JSON.parse(raw) : [];
		} catch {
			recentSearches = [];
		}
	}

	function saveRecent(searchQuery: string) {
		const trimmed = searchQuery.trim();
		if (!trimmed) return;
		recentSearches = [trimmed, ...recentSearches.filter((r) => r !== trimmed)].slice(0, MAX_RECENT);
		try {
			localStorage.setItem(RECENT_KEY, JSON.stringify(recentSearches));
		} catch {
			// localStorage unavailable
		}
	}

	function removeRecent(searchQuery: string) {
		recentSearches = recentSearches.filter((r) => r !== searchQuery);
		try {
			localStorage.setItem(RECENT_KEY, JSON.stringify(recentSearches));
		} catch {
			// localStorage unavailable
		}
	}

	async function loadPopularSearches() {
		try {
			const res = await fetch('/api/popular-searches');
			if (res.ok) {
				const data = await res.json();
				popularSearches = (data.searches ?? []).map((s: { query: string }) => s.query);
			}
		} catch {
			popularSearches = [];
		}
	}

	$effect(() => {
		loadRecents();
		loadPopularSearches();
	});

	function handleInput(e: Event) {
		const value = (e.target as HTMLInputElement).value;
		query = value;
		activeIndex = -1;
	}

	function commitSearch(searchQuery: string) {
		const trimmed = searchQuery.trim();
		if (!trimmed) return;
		saveRecent(trimmed);
		query = trimmed;
		activeIndex = -1;
		inputRef?.blur();
		onQueryCommit?.(trimmed);
	}

	function handleKeydown(e: KeyboardEvent) {
		switch (e.key) {
			case 'ArrowDown': {
				e.preventDefault();
				if (!showPopover) return;
				const total = filteredSuggestions.length;
				activeIndex = Math.min(activeIndex + 1, total - 1);
				break;
			}
			case 'ArrowUp': {
				e.preventDefault();
				activeIndex = Math.max(activeIndex - 1, -1);
				break;
			}
			case 'Enter': {
				e.preventDefault();
				if (activeIndex >= 0 && activeIndex < filteredSuggestions.length) {
					commitSearch(filteredSuggestions[activeIndex]);
					return;
				}
				if (query.trim()) {
					commitSearch(query);
				}
				break;
			}
			case 'Escape': {
				e.preventDefault();
				if (query) {
					query = '';
					activeIndex = -1;
				} else {
					inputRef?.blur();
				}
				break;
			}
		}
	}

	function handleFocusin() {
		isFocused = true;
	}

	function handleFocusout() {
		requestAnimationFrame(() => {
			if (containerRef && !containerRef.contains(document.activeElement)) {
				isFocused = false;
			}
		});
	}

	function handleClear() {
		query = '';
		activeIndex = -1;
		inputRef?.focus();
	}

	function handleSuggestionMousedown(e: MouseEvent, suggestion: string) {
		e.preventDefault();
		commitSearch(suggestion);
	}

	function isRecent(suggestion: string): boolean {
		return recentSearches.includes(suggestion);
	}
</script>

<div
	bind:this={containerRef}
	class="relative w-full"
	onfocusin={handleFocusin}
	onfocusout={handleFocusout}
>
	<Popover bind:open={popoverOpen}>
		<PopoverPrimitive.Trigger disabled>
			{#snippet child({ props })}
				<div class="relative flex items-center" {...props}>
					<Input
						bind:ref={inputRef}
						value={query}
						oninput={handleInput}
						onkeydown={handleKeydown}
						{placeholder}
						class="pl-4 pr-4 h-11 rounded-full bg-background"
						{autofocus}
					/>
					{#if query}
						<Button
							variant="ghost"
							size="icon-sm"
							onclick={handleClear}
							type="button"
							aria-label="Clear search"
							class="absolute right-2 text-muted-foreground hover:text-foreground rounded-full"
						>
							<X class="size-4 shrink-0" />
						</Button>
					{/if}
				</div>
			{/snippet}
		</PopoverPrimitive.Trigger>
		<PopoverContent
			align="start"
			side="bottom"
			sideOffset={8}
			portalProps={{ disabled: true }}
			wrapperClass="w-full"
			class="w-full max-h-80 overflow-y-auto p-1 rounded-3xl"
			trapFocus={false}
			onOpenAutoFocus={(e) => e.preventDefault()}
			onCloseAutoFocus={(e) => e.preventDefault()}
		>
			<div role="listbox" aria-label="Search suggestions" class="rounded-[1.25rem] overflow-clip">
				{#each filteredSuggestions as suggestion, i}
					<SuggestionItem
						{suggestion}
						{query}
						recent={isRecent(suggestion)}
						selected={i === activeIndex}
						onSelect={commitSearch}
						onRemove={removeRecent}
						onmousedown={(e) => handleSuggestionMousedown(e, suggestion)}
						onmouseenter={() => (activeIndex = i)}
					/>
				{/each}
			</div>
		</PopoverContent>
	</Popover>
</div>
