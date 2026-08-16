<script lang="ts">
	// ── The objective line ───────────────────────────────────────────────────────
	// The score, read from the seat you are sitting in. Red counts what it holds;
	// blue counts what it can PROVE, and the gap between those two numbers is the
	// whole game. When the match ends this is where it says so.
	import { CHAIN } from '../internal/rules.js';
	import type { BreachMatch } from '../internal/match.svelte.js';

	interface Props {
		match: BreachMatch;
		class?: string;
	}

	let { match, class: cls = '' }: Props = $props();

	const held = $derived(
		match.seat.faction === 'red' ? match.chainHeld.length : match.chainShown.length
	);
	const tone = $derived(held >= 4 ? '#FB7185' : held >= 2 ? '#FBBF24' : '#34D399');
	const winTone = $derived(match.winner === 'red' ? '#FB7185' : '#34D399');
</script>

{#snippet chip(text: string, hue: string)}
	<span
		class="font-mono text-[0.56rem] font-bold tracking-[0.16em] uppercase px-1.5 py-0.5 rounded border"
		style:color={hue}
		style:border-color="color-mix(in srgb, {hue} 45%, transparent)"
		style:background="color-mix(in srgb, {hue} 12%, transparent)"
	>
		{text}
	</span>
{/snippet}

<div class="flex flex-wrap items-center gap-x-3 gap-y-1 {cls}">
	{#if match.winner}
		{@render chip('match over', winTone)}
		<span class="font-mono text-[0.78rem]">
			{match.winner === 'red'
				? 'Payload delivered — the path was completed before the horizon.'
				: 'The estate held — the horizon passed with the path unfinished.'}
		</span>
		<span class="flex-1"></span>
		<button
			type="button"
			onclick={() => match.newMatch()}
			class="font-mono text-[0.56rem] font-bold tracking-[0.14em] uppercase px-2 py-0.5 rounded border"
			style:color={winTone}
			style:border-color="color-mix(in srgb, {winTone} 45%, transparent)"
		>
			new match
		</button>
	{:else}
		{@render chip(match.seat.faction === 'red' ? 'payload path' : 'proven path', tone)}
		<span class="font-mono text-[0.78rem]">
			<b class="font-bold tabular-nums" style:color={tone}>{held}/{CHAIN.length}</b>
			{match.seat.faction === 'red'
				? `held — next is ${match.chainNext?.name ?? 'the core itself'}`
				: `proven compromised — ${match.footholds.length - match.chainShown.length} anomalies unexplained`}
		</span>
		<span class="flex-1"></span>
	{/if}

	<span class="font-mono text-[0.62rem] text-[var(--fg-dim)] tabular-nums">
		{Math.max(0, 12 - match.round)} rounds to horizon
	</span>
</div>
