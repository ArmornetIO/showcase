<script lang="ts">
	// ── THE BATTLE CENTRE ────────────────────────────────────────────────────────
	// Your seat, and the two keys that act on it. One card, one row.
	//
	// It was two: the seat plate, and a play row under it reading
	// `3/3 AP · LIVING OFF THE LAND → THE FORGE` with the commit key at the end.
	// Every word of that sentence was a restatement — the card is in your hand and
	// lifted, the target is selected and lit on the board, and AP now rides the
	// corner of your own chip at the top of the screen, where the feed and the
	// hero cards have always put a number about the thing you are looking at. A
	// row of permanent furniture to say three things back to you.
	//
	// What the row DID own that could not be deleted moved rather than died: the
	// commit and end keys are on the plate, and the connection notice takes the
	// header's readouts (see `SeatPlate`). The takeover ceremony stays here
	// because it covers the whole card now, not just a strip of it.
	import type { BreachMatch } from '../internal/match.svelte.js';
	import type { TableSocket } from '../net.svelte.js';
	import { PLATE_SHADOW_UP, plateFill, type HudState } from './hud-state.js';
	import SeatPlate from './SeatPlate.svelte';

	interface Props {
		match: BreachMatch;
		state: HudState;
		takeover?: boolean;
		socket?: TableSocket | null;
		refusal?: string | null;
		onrules?: () => void;
		class?: string;
	}

	let {
		match,
		state,
		takeover = false,
		socket = null,
		refusal = null,
		onrules = () => {},
		class: cls = ''
	}: Props = $props();
</script>

<!-- ONE card, cut the way the rails are cut.
     The spine is an INSET SHADOW, not the absolutely-positioned span the rails
     use: `cls` is where the caller puts `absolute bottom-6 …`, and a `relative`
     of our own to hang a span off would land in the same cascade layer and win —
     which drops the whole card back into flow at the top of the screen. -->
<div
	class="pointer-events-auto flex flex-col overflow-hidden rounded-[12px] border {cls}"
	style:border-color="color-mix(in srgb, {state.color} 55%, transparent)"
	style:background={plateFill(state.color)}
	style:box-shadow="inset 3px 0 0 0 {state.color}, 0 0 0 1px color-mix(in srgb, {state.color} 35%, transparent), {PLATE_SHADOW_UP}"
>
	<SeatPlate {match} {state} {takeover} {socket} {refusal} {onrules} />
</div>
