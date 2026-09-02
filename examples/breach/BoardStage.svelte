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
	import { PlayerPresence, DEFAULT_MODES, type PresenceRenderMode } from './presence/index.js';

	interface Props {
		match: BreachMatch;
		/** Space the HUD occupies, so the globe is fitted around it and never under
		 *  it — a building must never be placed beneath a panel. */
		insets: { top?: number; right?: number; bottom?: number; left?: number };
		/** Distance from the top the canvas starts, in px. */
		top?: number;
		/** Which player-presence modes draw over the board. Owned by the app, not
		 *  here — the HUD column renders the panel modes from the same set. */
		presenceModes?: PresenceRenderMode[];
		/** Toggle a mode, for the tactical rail. */
		onpresence?: (id: PresenceRenderMode) => void;
		/** Terrain seed. A setting rather than a constant: the same number is the
		 *  same ground, which is what makes a table reproducible and shareable. */
		seed?: number;
	}

	let {
		match,
		insets,
		top = 40,
		presenceModes = DEFAULT_MODES,
		onpresence,
		seed = 20260809
	}: Props = $props();

	let mesh = $state<MeshHandle | null>(null);
	let camera = $state<CanvasCamera>();
	let pov = $state<FirstPerson | null>(null);
	let layout = $state<MeshLayoutId>('globe');

	// ── Everybody look here ──────────────────────────────────────────────────
	// The camera only ever moved on `focusOnSelect`, which fires on `selectedId`
	// — a LOCAL ui state, meaning what THIS browser last clicked. So a move by
	// anybody else resolved wherever you happened to be looking, which on a
	// spinning globe is frequently the back of it. The most expensive three
	// seconds the board spends were regularly spent off screen.
	//
	// `activeFx` is the right trigger because both paths already run through
	// `#stage`: a local resolution and a replayed server verdict publish the
	// same effect with the same id, so every seat at the table flies to the same
	// building at the same beat. That is the whole "everyone sees it" property,
	// and it needed no new message — only somebody to read the one being sent.
	//
	// `flyTo` rather than writing `selectedId`: selection also drives the target
	// sheet and the aim overlay, so borrowing it to move the camera would silently
	// re-target the player mid-resolution.
	let flownFor = $state(0);
	$effect(() => {
		const fx = match.activeFx;
		if (!fx || fx.id === flownFor || !camera) return;
		flownFor = fx.id;
		// A fogged ripple names no building — `toId` is the arbitrary anchor the
		// region was hung on, and flying to it would point at a specific house the
		// fog exists to not name.
		if (fx.fogged) return;
		// Fire and forget. A rejected fly (the node is not laid out yet, the view
		// switched mid-flight) must not take the resolution down with it.
		void camera.flyTo(fx.toId, { duration: 620 }).catch(() => {});
	});

	// Seeded, and rebuilt ONLY when the seed changes — a landscape that redraws
	// itself every turn is a different world every turn, and a board game needs
	// the ground to stay put.
	//
	// `$derived` rather than `const` because the seed is a setting now: a `const`
	// is evaluated once at component init and would silently keep the first
	// table's ground for every table after it. The other three values are
	// calibration, not preference — they decide whether the terrain is legible,
	// which is not a choice worth handing to a player.
	const terrain = $derived(makeTerrain({ seed, octaves: 4, frequency: 9, gain: 0.5 }));

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

<!-- `autoRotate` is globe-only. The canvas advances the same yaw in both views,
     but on the map that advance is not a turning planet — it is the sheet
     sliding sideways under the pieces, and a board that scrolls while nobody
     is touching it is a board you cannot plan on. The map holds still. -->
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
		autoRotate={layout === 'globe'}
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
		glPieces
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

	<!-- The other three seats, standing around the world. A fourth sibling for
	     the same reason as the others: it measures the drawn `[data-node]` boxes
	     and has to sit in the coordinate space the canvas draws into. Above the
	     combat overlay, because a marker is furniture and a resolution is an
	     event — an event should play over the furniture, not under it. -->
	<PlayerPresence {match} modes={presenceModes} surface="board" />

	<!-- Idle, this is an invisible, inert div. -->
	<FirstPerson bind:this={pov} {mesh} {camera} {insets} />
</div>

<!-- The tactical rail. Bottom-right, above the scrim, and out of the way of the
     felt — it is a commander's control, not a card. -->
<div class="absolute right-3 bottom-[13.5rem] z-[6] pointer-events-auto">
	<TacticalToolbar
		{match}
		{camera}
		{layout}
		onlayout={(id) => (layout = id)}
		{presenceModes}
		{onpresence}
	/>
</div>
