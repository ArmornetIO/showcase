<script lang="ts">
	// ── Game events ──────────────────────────────────────────────────────────────
	// A named region of the board's chrome, for things that HAPPEN.
	//
	// The rest of the HUD answers standing questions — who is at the table, how
	// the buildings are doing, what I have to spend. Those panels are always
	// there and always full. An event is the opposite shape: nothing at all for
	// most of a turn, then something loud for three seconds, then nothing again.
	// Mixing the two is what put the entire announcement of a roll into a 0.6rem
	// line at the end of the action bar, because that was the only place with
	// room for something transient.
	//
	// So this column is empty by default and that is correct. It has no frame, no
	// label and no placeholder — an empty box with a heading is a box you learn to
	// stop looking at, and the whole value of the region is that something
	// appearing in it means something just happened.
	//
	// FIRST EVENT TYPE: the verdict. A card resolving — who, what, the dice, and
	// what the dice bought. `match.verdict` is published by `#stage` on the beat
	// clock the board is already animating to, so the panel starts and stops
	// itself.
	//
	// Adding the second type is adding a branch here. The region owns WHERE an
	// event goes and how long it lives; each event type owns what it looks like.
	import type { BreachMatch } from '../internal/match.svelte.js';
	import VerdictCard from './VerdictCard.svelte';

	interface Props {
		match: BreachMatch;
		class?: string;
	}

	let { match, class: cls = '' }: Props = $props();
</script>

<!-- `pointer-events-none` on the region, not just its contents: the board runs
     underneath this column and stays draggable through the empty space, which is
     most of the space most of the time. -->
<div class="pointer-events-none flex flex-col items-end gap-2 {cls}">
	{#if match.verdict}
		<VerdictCard {match} />
	{/if}
</div>
