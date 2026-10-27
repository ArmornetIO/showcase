<script lang="ts">
	// A side's banner, at three sizes: `chip` for a hero row, `plate` for the seat
	// you are playing, `card`/`banner` for the lobby, where picking a side is the whole
	// screen and the flag is the thing being chosen rather than a marker beside
	// something else. Swallowtail rather than a rectangle — at 16px a rectangle
	// with a glyph in it is a button, and the notch is the whole difference
	// between "a control" and "a flag".
	import type { Faction } from '../internal/rules.js';
	import { EMBLEMS, teamFlags } from './team-flags.svelte.js';

	interface Props {
		faction: Faction;
		size?: 'chip' | 'plate' | 'card' | 'banner';
		/** Off in the hero stack — four names in a 250px rail is a paragraph. */
		showName?: boolean;
		/** Flies the other way, for the right-hand side of a scoreboard. Two flags
		 *  facing the same direction either side of a score read as a list; facing
		 *  each other they read as a fixture. */
		mirror?: boolean;
		class?: string;
	}

	let { faction, size = 'chip', showName = false, mirror = false, class: cls = '' }: Props = $props();

	const flag = $derived(teamFlags.get(faction));
	const em = $derived(EMBLEMS[flag.emblem]);
	const w = $derived(
		size === 'banner' ? 92 : size === 'card' ? 46 : size === 'plate' ? 20 : 15
	);
	const h = $derived(
		size === 'banner' ? 68 : size === 'card' ? 34 : size === 'plate' ? 15 : 11
	);
	/** The emblem holds a constant PROPORTION of the flag rather than a constant
	 *  inset. `h - 3` is three pixels of margin at 11px tall and three pixels at
	 *  34, which draws the lobby's flag as a glyph floating in a field. */
	const big = $derived(size === 'card' || size === 'banner');
	const glyph = $derived(big ? Math.round(h * 0.72) : h - 3);
	/** The hoist — the solid bar down the flag's leading edge, where it is bound
	 *  to the staff. 2px reads as a rule at 15px wide and as a hairline at 46. */
	const hoist = $derived(size === 'banner' ? 9 : size === 'card' ? 5 : 2);

	const SWALLOW = $derived(
		mirror
			? 'polygon(0 0, 100% 0, 100% 100%, 0 100%, 18% 50%)'
			: 'polygon(0 0, 100% 0, 82% 50%, 100% 100%, 0 100%)'
	);
</script>

<span class="flex items-center gap-1.5 {cls}" title={flag.name}>
	<span
		class="grid shrink-0 place-items-center"
		style:width="{w}px"
		style:height="{h}px"
		style:clip-path={SWALLOW}
		style:background="color-mix(in srgb, {flag.color} 26%, var(--bg-elev, #0b0f16))"
		style:box-shadow="inset {mirror ? -hoist : hoist}px 0 0 0 {flag.color}"
	>
		<svg
			viewBox="0 0 24 24"
			width={glyph}
			height={glyph}
			style:margin-right={mirror ? '0' : `${Math.round(w * 0.12)}px`}
			style:margin-left={mirror ? `${Math.round(w * 0.12)}px` : '0'}
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
	{#if showName}
		<b
			class="truncate font-mono text-[0.5rem] leading-none font-black tracking-[0.14em] uppercase"
			style:color={flag.color}
		>
			{flag.name}
		</b>
	{/if}
</span>
