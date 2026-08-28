<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Input } from '$lib/components/ui/input/index.js';

	const DOMAIN_RE = /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/i;

	let domain = $state('');
	// Hidden honeypot field — bots autofill it, humans never see it.
	// The server silently accepts (and ignores) submissions that carry it.
	let honeypot = $state('');
	let status = $state<'idle' | 'submitting' | 'error' | 'rateLimited'>('idle');
	let invalid = $state(false);
	let feedback: {
		type: 'success' | 'alreadyVoted' | 'error' | 'rateLimited';
		text: string;
	} | null = $state(null);

	/** Client-side mirror of the server's normalization — catches typos before submit. */
	function looksLikeDomain(raw: string): boolean {
		const d = raw
			.trim()
			.toLowerCase()
			.replace(/^[a-z][a-z0-9+.-]*:\/\//, '')
			.replace(/^www\./, '')
			.split(':')[0]
			.split(/[/?#]/)[0]
			.replace(/[.\s]+$/, '');
		return d.length >= 4 && DOMAIN_RE.test(d);
	}

	/** Keep the suffix of the last reply: count-up, or "already voted" (no change). */
	function successText(domainLabel: string, votes: number, alreadyVoted: boolean): string {
		if (votes === 1) {
			return alreadyVoted
				? m['shop.missing.alreadyOne']({ domain: domainLabel })
				: m['shop.missing.successOne']({ domain: domainLabel });
		}
		return alreadyVoted
			? m['shop.missing.alreadyOther']({ domain: domainLabel, votes })
			: m['shop.missing.successOther']({ domain: domainLabel, votes });
	}

	async function handleSubmit() {
		if (status === 'submitting') return;
		if (!looksLikeDomain(domain)) {
			invalid = true;
			return;
		}
		invalid = false;
		feedback = null;
		status = 'submitting';
		try {
			const res = await fetch('/api/missing-shop', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ domain: domain.trim(), website: honeypot })
			});
			if (res.status === 429) {
				feedback = { type: 'rateLimited', text: m['shop.missing.rateLimited']() };
				status = 'idle';
				return;
			}
			if (!res.ok) {
				feedback = { type: 'error', text: m['shop.missing.error']() };
				status = 'idle';
				return;
			}
			const data = (await res.json()) as {
				domain?: string;
				votes?: number;
				alreadyVoted?: boolean;
			};
			const normalized = data.domain ?? domain.trim();
			feedback = {
				type: data.alreadyVoted ? 'alreadyVoted' : 'success',
				text: successText(normalized, data.votes ?? 0, Boolean(data.alreadyVoted))
			};
			status = 'idle';
		} catch {
			feedback = { type: 'error', text: m['shop.missing.error']() };
			status = 'idle';
		}
	}
</script>

<div class="mt-8 rounded-lg border border-dashed border-border/60 p-4">
	<h2 class="text-sm font-medium text-foreground">{m['shop.missing.title']()}</h2>
	<p class="mt-1 text-sm text-muted-foreground">{m['shop.missing.subtitle']()}</p>

	<form
		class="mt-3 flex flex-col gap-2 sm:flex-row"
		onsubmit={(e) => {
			e.preventDefault();
			handleSubmit();
		}}
	>
		<!-- Honeypot: invisible to humans, irresistible to bots -->
		<input
			type="text"
			name="website"
			tabindex="-1"
			autocomplete="off"
			aria-hidden="true"
			class="absolute -left-[9999px] h-px w-px opacity-0"
			bind:value={honeypot}
		/>
		<Input
			type="text"
			bind:value={domain}
			placeholder={m['shop.missing.placeholder']()}
			aria-label={m['shop.missing.inputLabel']()}
			aria-invalid={invalid || undefined}
			autocomplete="off"
			class="sm:flex-1"
			oninput={() => {
				invalid = false;
				feedback = null;
			}}
		/>
		<Button
			type="submit"
			disabled={status === 'submitting' || domain.trim() === ''}
			class="w-full sm:w-auto"
		>
			{#if status === 'submitting'}
				{m['shop.missing.submitting']()}
			{:else}
				{m['shop.missing.submit']()}
			{/if}
		</Button>
	</form>

	{#if invalid}
		<p class="mt-2 text-sm text-destructive" role="status">{m['shop.missing.invalid']()}</p>
	{:else if feedback}
		<p
			class="mt-2 text-sm {feedback.type === 'success' ? 'text-foreground' : 'text-destructive'}"
			role="status"
		>
			{feedback.text}
		</p>
	{/if}
</div>
