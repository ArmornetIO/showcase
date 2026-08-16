<script lang="ts">
	// ── The board ────────────────────────────────────────────────────────────────
	// The globe, the combat feedback drawn on top of it, and the POV scene that
	// occasionally takes the camera away for a second and a half. Three siblings
	// rather than a nest, because BoardFx and FirstPerson both measure the drawn
	// `[data-node]` boxes and must sit in the same coordinate space the canvas
	// draws into.
	//
	// The stage OWNS the cinema port: it mounts FirstPerson, so it is the only
	// thing that can hand the match a working one. On unmount it hands back
	// nothing, and the engine falls back to running the beats with no cutaway.
	import { MeshCanvas, makeTerrain, type CanvasCamera, type MeshLayoutId } from 'showcase';
	import { CORE_ID } from './internal/rules.js';
	import { fxFor } from './internal/fx.js';
	import type { BreachMatch } from './internal/match.svelte.js';
	import { boardEdges, boardNodes, groupKeyOf, nodeFootprint, styleOf } from './board-view.js';
	import BoardFx from './Board.svelte';
	import FirstPerson, { type MeshHandle } from './FirstPerson.svelte';
	import TacticalToolbar from './TacticalToolbar.svelte';

	interface Props {
		match: BreachMatch;
		/** Space the HUD occupies, so the globe is fitted around it and never under
		 *  it — a building must never be placed beneath a panel. */
		insets: { top?: number; right?: number; bottom?: number; left?: number };
		/** Distance from the top the canvas starts, in px. */
		top?: number;
	}

	let { match, insets, top = 40 }: Props = $props();

	let mesh = $state<MeshHandle | null>(null);
	let camera = $state<CanvasCamera>();
	let pov = $state<FirstPerson | null>(null);
	let layout = $state<MeshLayoutId>('globe');

	// Built once, seeded — a landscape that redraws itself every turn is a
	// different world every turn, and a board game needs the ground to stay put.
	const terrain = makeTerrain({ seed: 20260809, octaves: 4, frequency: 9, gain: 0.5 });

	const nodes = $derived(boardNodes(match));
	const edges = $derived(boardEdges(match));

	// Hand the engine a way to play a cutaway, and take it back on teardown.
	$effect(() => {
		match.setCinema(pov ?? null);
		return () => match.setCinema(null);
	});
</script>

<!-- A scrim between the board and the HUD, rather than an opacity on each panel:
     one element, and it cannot miss a panel somebody adds later. The z-ordering
     is the whole mechanism — the board is lifted above the scrim, the scrim is
     above every panel, and nothing is unmounted, so the insets the canvas is
     fitted to never change and the globe does not resize on the way in or out. -->
<div
	class="pointer-events-none absolute inset-0 z-[10] bg-[#04070d] transition-opacity duration-300"
	style:opacity={match.povLive ? 0.92 : 0}
></div>

<div class="absolute inset-x-0 bottom-0 {match.povLive ? 'z-[20]' : ''}" style:top="{top}px">
	<MeshCanvas
		bind:this={mesh}
		bind:camera
		bind:layout
		bind:selectedId={match.selectedId}
		{nodes}
		{edges}
		hubId={CORE_ID}
		globeLabel="Breach board"
		hudInsets={insets}
		globeFill={0.94}
		radiusOf={nodeFootprint}
		autoRotate
		autoRotateSpeed={0.0016}
		axialTilt={(23 * Math.PI) / 180}
		insetLeafLabels
		typeLabels={false}
		focusOnSelect
		focusDurationMs={700}
		{groupKeyOf}
		globeTerritories
		territoryOf={styleOf}
		{terrain}
	/>

	<!-- Combat feedback rides ON TOP of the canvas, anchored to live node boxes.
	     It never intercepts a pointer, so the globe is still draggable
	     mid-resolution. -->
	<BoardFx
		active={match.activeFx}
		foggedAnchorId={match.foggedAnchorId}
		aimIds={match.aimIds}
		aimHoverId={match.drag?.over ?? match.selectedId}
		aimHue={match.armed ? fxFor(match.armed.key, match.seat.faction).hue : match.seat.color}
		bars={match.boardBars}
		garrison={match.visibleGarrison}
		pings={match.pings}
		severed={match.severedLinks}
	/>

	<!-- Idle, this is an invisible, inert div. -->
	<FirstPerson bind:this={pov} {mesh} {camera} {insets} />
</div>

<!-- The tactical rail. Bottom-right, above the scrim, and out of the way of the
     felt — it is a commander's control, not a card. -->
<div class="absolute right-3 bottom-[13.5rem] z-[6] pointer-events-auto">
	<TacticalToolbar {match} {camera} {layout} onlayout={(id) => (layout = id as MeshLayoutId)} />
</div>
