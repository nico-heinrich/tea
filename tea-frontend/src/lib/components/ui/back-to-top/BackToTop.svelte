<script lang="ts">
	import { ArrowUp } from '@lucide/svelte';
	import * as m from '$lib/paraglide/messages.js';
	import Button from '$lib/components/ui/button/button.svelte';
	import { fade } from 'svelte/transition';

	// exponential moving average weight — higher = snappier, lower = smoother
	const VELOCITY_ALPHA = 0.25;
	// px/ms; velocity must exceed this to flip direction, prevents jitter
	const DIRECTION_DEAD_ZONE = 0.15;

	let visible = $state(false);
	let prefersReducedMotion = $state(false);

	// Plain lets — intentionally NOT $state; only read inside the effect, never
	// referenced in the template, so reactivity would add overhead for no benefit.
	let lastScrollY = 0;
	let lastTime = performance.now();
	let smoothedVelocity = 0;
	let scrollingDown = false;

	$effect(() => {
		const mql = window.matchMedia('(prefers-reduced-motion: reduce)');
		prefersReducedMotion = mql.matches;

		function onChange() {
			prefersReducedMotion = mql.matches;
		}

		mql.addEventListener('change', onChange);
		return () => mql.removeEventListener('change', onChange);
	});

	$effect(() => {
		function onScroll() {
			const now = performance.now();
			const y = window.scrollY;
			const dt = now - lastTime;

			if (dt > 0) {
				const rawVelocity = (y - lastScrollY) / dt;
				smoothedVelocity = smoothedVelocity * (1 - VELOCITY_ALPHA) + rawVelocity * VELOCITY_ALPHA;

				if (smoothedVelocity > DIRECTION_DEAD_ZONE) {
					scrollingDown = true;
				} else if (smoothedVelocity < -DIRECTION_DEAD_ZONE) {
					scrollingDown = false;
				}
			}

			// Hide at page edges: pointless at top, redundant at bottom
			const atTop = y <= 1;
			const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
			const atBottom = y >= maxScroll - 1;
			visible = !atTop && !atBottom && !scrollingDown;

			lastScrollY = y;
			lastTime = now;
		}

		window.addEventListener('scroll', onScroll, { passive: true });
		onScroll();
		return () => window.removeEventListener('scroll', onScroll);
	});

	function scrollToTop() {
		window.scrollTo({
			top: 0,
			behavior: prefersReducedMotion ? 'auto' : 'smooth'
		});
	}
</script>

{#if visible}
	<div transition:fade={{ duration: 200 }} class="fixed bottom-6 right-6 z-10">
		<Button
			variant="outline"
			size="icon-lg"
			aria-label={m['backToTop.label']()}
			onclick={scrollToTop}
		>
			<ArrowUp />
		</Button>
	</div>
{/if}
