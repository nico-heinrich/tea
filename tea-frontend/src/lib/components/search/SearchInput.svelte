<script lang="ts">
	import { Input } from '$lib/components/ui/input/index.js';
	import { cn } from '$lib/utils.js';
	import * as m from '$lib/paraglide/messages.js';

	const RECENT_KEY = 'tea-recent-searches';
	const MAX_RECENT = 5;

	let {
		placeholder = m['search.placeholder'](),
		compact = false,
		value = '',
		autofocus = false,
		onQueryCommit
	}: {
		placeholder?: string;
		compact?: boolean;
		value?: string;
		autofocus: boolean;
		onQueryCommit?: (query: string) => void;
	} = $props();

	let containerRef = $state<HTMLDivElement | null>(null);
	let inputRef = $state<HTMLInputElement | null>(null);
	let query = $state('');
	let isFocused = $state(autofocus);
	let activeIndex = $state(-1);
	let recentSearches = $state<string[]>([]);
	let popularSearches = $state<string[]>([]);

	// Sync with external value prop
	$effect(() => {
		query = value;
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

	// Filter suggestions based on query
	let filteredSuggestions = $derived.by(() => {
		const trimmed = query.trim().toLowerCase();
		if (!trimmed) {
			// Show recent first, then popular (no filter)
			return [...recentSearches, ...popularSearches.filter((p) => !recentSearches.includes(p))];
		}
		// Fuzzy filter both by query
		const recentFiltered = recentSearches.filter((r) => fuzzyMatch(trimmed, r.toLowerCase()));
		const popularFiltered = popularSearches.filter((p) => fuzzyMatch(trimmed, p.toLowerCase()));
		return [...recentFiltered, ...popularFiltered.filter((p) => !recentFiltered.includes(p))];
	});

	let showPopover = $derived(
		isFocused && filteredSuggestions.length > 0 && query.trim().length > 2
	);

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
	class={cn('relative w-full', compact ? 'max-w-lg' : '')}
	onfocusin={handleFocusin}
	onfocusout={handleFocusout}
>
	<div class="relative">
		<Input
			bind:ref={inputRef}
			value={query}
			oninput={handleInput}
			onkeydown={handleKeydown}
			{placeholder}
			class={cn('pr-8', compact ? 'h-9 text-sm' : '')}
			{autofocus}
		/>
		{#if query}
			<button
				onclick={handleClear}
				type="button"
				class="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
				aria-label="Clear search"
			>
				<svg
					class="size-4"
					xmlns="http://www.w3.org/2000/svg"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2"
					stroke-linecap="round"
					stroke-linejoin="round"
				>
					<path d="M18 6 6 18" /><path d="m6 6 12 12" />
				</svg>
			</button>
		{/if}
	</div>

	{#if showPopover}
		<div
			class="absolute top-full left-0 right-0 z-50 mt-2 max-h-80 overflow-y-auto rounded-md border border-border bg-popover text-popover-foreground shadow-md"
		>
			<div role="listbox" aria-label="Search suggestions">
				{#each filteredSuggestions as suggestion, i}
					<button
						type="button"
						role="option"
						aria-selected={i === activeIndex}
						class={cn(
							'flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors',
							i === activeIndex
								? 'bg-muted text-foreground'
								: 'text-muted-foreground hover:bg-muted hover:text-foreground'
						)}
						onmouseenter={() => (activeIndex = i)}
						onmousedown={(e) => handleSuggestionMousedown(e, suggestion)}
					>
						{#if isRecent(suggestion)}
							<svg
								class="size-3 shrink-0 opacity-50"
								xmlns="http://www.w3.org/2000/svg"
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								stroke-width="2"
								stroke-linecap="round"
								stroke-linejoin="round"
							>
								<path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" /><path
									d="M3 3v5h5"
								/><path d="M12 7v5l4 2" />
							</svg>
						{:else}
							<svg
								class="size-3 shrink-0 opacity-50"
								xmlns="http://www.w3.org/2000/svg"
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								stroke-width="2"
								stroke-linecap="round"
								stroke-linejoin="round"
							>
								<circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" />
							</svg>
						{/if}
						<span>{suggestion}</span>
					</button>
				{/each}
			</div>
		</div>
	{/if}
</div>
