import type { TransitionConfig } from 'svelte/transition';

export function backdropBlur(
	node: HTMLElement,
	{ duration = 200, blur = 8, opacity = 0.8 }: { duration?: number; blur?: number; opacity?: number } = {}
): TransitionConfig {
	return {
		duration,
		tick: (t: number) => {
			const blurValue = `blur(${t * blur}px)`;
			node.style.backdropFilter = blurValue;
			(node.style as any).webkitBackdropFilter = blurValue;
			node.style.backgroundColor = `rgba(0, 0, 0, ${t * opacity})`;
		},
		css: () => ``
	};
}
