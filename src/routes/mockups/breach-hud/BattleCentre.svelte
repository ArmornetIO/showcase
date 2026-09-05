<script lang="ts">
	// ── THE BATTLE CENTRE ────────────────────────────────────────────────────────
	// Who you are, and what you are about to do — as ONE card.
	//
	// These were two plates with a gap between them, each with its own rim, fill
	// and shadow. Two frames is two objects, and a player reading "I am the
	// Maintainer, I have 3 AP, I am playing Sleeper Implant at the Forge" is
	// reading one continuous thought. The gap was asking them to cross a border
	// mid-sentence.
	//
	// So the frame lives HERE and nowhere else: `SeatPlate` and `Breech` are
	// content now. That also kills the duplication — the chamfer, the two-layer
	// rim trick and the lit fill were written out twice and had already drifted
	// apart once (18px cut on one, 22px on the other).
	import type { BreachMatch } from '$examples/breach/internal/match.svelte.js';
	import type { TableSocket } from '$examples/breach/net.svelte.js';
	import { PLATE_SHADOW_UP, plateFill, type HudState } from './hud-state.js';
	import SeatPlate from './SeatPlate.svelte';
	import Breech from './Breech.svelte';

	interface Props {
		match: BreachMatch;
		state: HudState;
		takeover?: boolean;
		socket?: TableSocket | null;
		refusal?: string | null;
		class?: string;
	}

	let {
		match,
		state,
		takeover = false,
		socket = null,
		refusal = null,
		class: cls = ''
	}: Props = $props();
</script>

<!-- ONE card, cut the way the rails are cut.
     It used to be a two-layer chamfer with the state colour showing as a 1px rim
     the whole way round — a frame the rest of the screen does not own. The rim is
     now the 3px spine every hero and building row already wears, the corners are
     the rails' 10px, and the fill is their radial. Nothing here is invented; it is
     the same card, wider. -->
<!-- The spine is an INSET SHADOW, not the absolutely-positioned span the rails
     use. `cls` is where the caller puts `absolute bottom-6 …`, and a `relative`
     of our own to hang a span off would land in the same cascade layer and win —
     which drops the whole card back into flow at the top of the screen. -->
<div
	class="pointer-events-auto flex flex-col overflow-hidden rounded-[12px] border {cls}"
	style:border-color="color-mix(in srgb, {state.color} 55%, transparent)"
	style:background={plateFill(state.color)}
	style:box-shadow="inset 3px 0 0 0 {state.color}, 0 0 0 1px color-mix(in srgb, {state.color} 35%, transparent), {PLATE_SHADOW_UP}"
>
	<SeatPlate {match} {state} />

	<!-- The divider. A rule in the state colour rather than a gap: it says
	     "these are two halves" while a gap says "these are two things". -->
	<div
		class="h-px w-full shrink-0"
		style:background="color-mix(in srgb, {state.color} 30%, transparent)"
	></div>

	<Breech {match} {state} {takeover} {socket} {refusal} class="h-[var(--play-h)] shrink-0" />
</div>
