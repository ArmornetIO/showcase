<script lang="ts">
	// ── The edge wash ────────────────────────────────────────────────────────────
	// The cheapest way to say "this is yours now" across the whole screen without
	// putting anything ON the screen: an inset glow at the four edges, in the
	// seat's colour, that blooms as the turn arrives and then settles to a
	// resting level it holds for as long as the turn lasts.
	//
	// z-index 2 is load-bearing. Above the globe so it reads as atmosphere, and
	// BELOW every HUD rail — over the rails it washes out the numerals it is
	// trying to draw attention to, and over the felt it tints the card fan.
	//
	// A box-shadow on a positioned layer, not a filter and not a gradient the
	// globe has to composite through: it never triggers layout, and the only
	// thing that animates is `opacity`, which the compositor owns.
	interface Props {
		color: string;
		/** Blooms to 0.35 on arrival, then settles. Driven by the parent so the
		 *  timing lives with the rest of the ceremony rather than in here. */
		level: number;
	}

	let { color, level }: Props = $props();
</script>

<div
	class="pointer-events-none fixed inset-0 z-[2]"
	style:box-shadow="inset 0 0 120px 0 {color}"
	style:opacity={level}
	style:transition="opacity 240ms ease-out, box-shadow 200ms ease"
	aria-hidden="true"
></div>
