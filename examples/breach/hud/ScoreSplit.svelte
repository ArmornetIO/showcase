<script lang="ts">
	// ── THE SCORE, as two territories ────────────────────────────────────────────
	// The first pass was two small banners with numerals beside them and the words
	// `THE WATCH AHEAD` underneath. Three marks and a sentence to say `2 – 3`, and
	// the sentence was doing the work the numbers should do on their own.
	//
	// So the block is the score: two halves split on a diagonal, each one the
	// team's flag blown up to fill it, with that side's number standing on top.
	// A diagonal rather than a vertical rule because the seam is the thing being
	// contested — a straight line down the middle is a table with two cells, and a
	// slant reads as ground one side is pushing into.
	//
	// Only the lead is coloured. The leading half keeps its hue, its emblem and a
	// lit numeral; the trailing half falls back to the plate. That is the whole
	// "who is winning" signal, and it works at the edge of vision, which is where
	// this bar is actually read from.
	import { EMBLEMS, teamFlags } from './team-flags.svelte.js';
	import type { Faction } from '../internal/rules.js';
	import type { Score } from './score.js';

	interface Props {
		score: Score;
	}

	let { score }: Props = $props();

	// The seam. Two clips that stop a pixel short of each other, so the plate
	// shows through as the divider rather than a border being drawn on top.
	const LEFT = 'polygon(0 0, 60% 0, 44% 100%, 0 100%)';
	const RIGHT = 'polygon(62% 0, 100% 0, 100% 100%, 46% 100%)';

	const halves = $derived([
		{ faction: 'red' as Faction, n: score.taken, clip: LEFT, side: 'left' as const },
		{ faction: 'blue' as Faction, n: score.held, clip: RIGHT, side: 'right' as const }
	]);
</script>

<div class="relative w-[150px] shrink-0 self-stretch overflow-hidden rounded-[8px]">
	{#each halves as half (half.faction)}
		{@const flag = teamFlags.get(half.faction)}
		{@const em = EMBLEMS[flag.emblem]}
		{@const ahead = score.leader === half.faction}
		<span
			class="absolute inset-0"
			style:clip-path={half.clip}
			style:background={ahead
				? `linear-gradient(${half.side === 'left' ? 100 : 280}deg,
					color-mix(in srgb, ${flag.color} 34%, transparent) 0%,
					color-mix(in srgb, ${flag.color} 12%, transparent) 100%)`
				: 'color-mix(in srgb, var(--fg) 4%, transparent)'}
			style:transition="background 260ms ease"
		>
			<!-- The emblem, at flag scale rather than badge scale: it is the field
			     this number is standing on, so it is allowed to be cropped by the
			     seam. A watermark that fits inside its half is a logo. -->
			<svg
				class="absolute top-1/2 h-[150%] w-[150%] -translate-y-1/2"
				style:left={half.side === 'left' ? '-34%' : 'auto'}
				style:right={half.side === 'right' ? '-34%' : 'auto'}
				style:opacity={ahead ? 0.34 : 0.12}
				style:transition="opacity 260ms ease"
				viewBox="0 0 24 24"
				aria-hidden="true"
			>
				<path
					d={em.d}
					fill={em.fill ? flag.color : 'none'}
					stroke={flag.color}
					stroke-width={em.fill ? 0 : 3}
					stroke-linecap="round"
					stroke-linejoin="round"
				/>
			</svg>
		</span>
	{/each}

	<!-- The numerals sit above both fields rather than inside either, so the seam
	     can pass behind them without ever cutting a digit. -->
	{#each halves as half (half.faction)}
		{@const flag = teamFlags.get(half.faction)}
		{@const ahead = score.leader === half.faction}
		<b
			class="absolute top-1/2 -translate-y-1/2 font-mono text-[1.75rem] leading-none font-black tabular-nums"
			style:left={half.side === 'left' ? '14px' : 'auto'}
			style:right={half.side === 'right' ? '14px' : 'auto'}
			style:color={ahead ? flag.color : 'var(--fg-dim)'}
			style:text-shadow={ahead
				? `0 0 20px color-mix(in srgb, ${flag.color} 70%, transparent)`
				: 'none'}
			style:transition="color 260ms ease"
			title="{flag.name} · {half.faction === 'red' ? 'links taken' : 'links held'}"
		>
			{half.n}
		</b>
	{/each}
</div>
