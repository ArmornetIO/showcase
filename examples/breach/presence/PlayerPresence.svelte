<script lang="ts">
	// ── PlayerPresence ───────────────────────────────────────────────────────────
	// The module. Everything that answers "who else is in this match, and where
	// are they pointed" lives behind here, in one of six render modes.
	//
	// It replaced a panel. The panel is still one of the modes — that is the
	// point of building it this way rather than swapping one treatment for
	// another: presence is a QUESTION with several good answers, several of which
	// are worth running at once, and the shape that admits that is a mode set.
	//
	// ── What this component owns ─────────────────────────────────────────────────
	// Sampling, and nothing else. The board's geometry is measured ONCE a frame
	// here and handed down, so three world-layer modes cost one rAF loop and one
	// pass of getBoundingClientRect rather than three of each. A mode is a pure
	// renderer: it is given a fogged model and some boxes, and it draws.
	//
	// The loop runs only while a mode that needs it is on. All six off is an
	// inert div and zero work a frame.
	import type { BreachMatch } from '../internal/match.svelte.js';
	import { sampleStage, sampleTerritories, type StageBox, type TerritoryAnchor } from './anchors.js';
	import { DEFAULT_MODES, type PresenceRenderMode } from './modes.js';
	import RosterPanel from './RosterPanel.svelte';
	import InitiativeRing from './InitiativeRing.svelte';
	import LimbMarkers from './LimbMarkers.svelte';
	import AttentionTrails from './AttentionTrails.svelte';
	import ContestedGround from './ContestedGround.svelte';
	import SeatCameras from './SeatCameras.svelte';

	interface Props {
		match: BreachMatch;
		/** Which modes are drawing. Compose freely — they are layers, not a radio
		 *  group. */
		modes?: PresenceRenderMode[];
		/** Which layer this instance renders. The panel modes belong in the HUD
		 *  column and the board modes belong over the canvas, and those are two
		 *  different places in the tree — so the module mounts twice and each
		 *  mount draws its own half. */
		surface?: 'board' | 'panel';
		/** Fly the camera, for the cameras mode. */
		onvisit?: (structureId: string) => void;
		/** Open a seat's sheet, for the roster mode. */
		oninspect?: (key: string) => void;
		class?: string;
	}

	let {
		match,
		modes = DEFAULT_MODES,
		surface = 'board',
		onvisit,
		oninspect,
		class: cls = ''
	}: Props = $props();

	const model = $derived(match.presence);
	const on = (id: PresenceRenderMode) => modes.includes(id);

	let host = $state<HTMLDivElement | null>(null);
	let stage = $state<StageBox | null>(null);
	let anchors = $state<TerritoryAnchor[]>([]);

	/** Every board mode needs the stage box — it is also the overlay's own size,
	 *  so an SVG cannot be laid out without it — but only some need per-region
	 *  anchors. Tracked separately so turning on the ring alone does not start
	 *  measuring sixteen buildings a frame. */
	const needsWorld = $derived(
		surface === 'board' && (on('limb') || on('trails') || on('contested'))
	);
	const needsStage = $derived(surface === 'board' && (needsWorld || on('ring')));

	// Re-read every frame rather than on a state change: the globe auto-rotates,
	// so the boxes are moving even when the game is doing nothing at all. This is
	// the same bargain `BoardFx` makes — read the globe instead of predicting it,
	// and it cannot desync.
	$effect(() => {
		if (!host || (!needsStage && !needsWorld)) {
			stage = null;
			anchors = [];
			return;
		}
		const el = host;
		const wantStage = needsStage;
		const wantWorld = needsWorld;
		let raf = 0;
		const tick = () => {
			if (wantStage) stage = sampleStage(el);
			if (wantWorld) anchors = sampleTerritories(el);
			raf = requestAnimationFrame(tick);
		};
		tick();
		return () => cancelAnimationFrame(raf);
	});
</script>

{#if surface === 'board'}
	<!-- Never intercepts a pointer: the globe stays draggable through every one
	     of these layers, the same rule the combat overlay follows. -->
	<div bind:this={host} class="absolute inset-0 pointer-events-none {cls}">
		{#if stage}
			{#if on('contested')}
				<ContestedGround {model} {anchors} width={stage.w} height={stage.h} />
			{/if}
			{#if on('trails')}
				<AttentionTrails {model} {anchors} width={stage.w} height={stage.h} />
			{/if}
			{#if on('limb')}
				<LimbMarkers {model} {stage} {anchors} />
			{/if}
			{#if on('ring')}
				<InitiativeRing {model} {stage} />
			{/if}
		{/if}
	</div>
{:else}
	<div class="flex flex-col gap-3 {cls}">
		{#if on('roster')}
			<!-- The roster is where a chair is named, so it is where one is taken.
			     Offered only by a table whose settings allow it; the engine refuses
			     the call regardless of what is on screen. -->
			<RosterPanel
				{model}
				{oninspect}
				ontakeover={match.takeover ? (key) => void match.claim(key) : undefined}
			/>
		{/if}
		{#if on('cameras')}
			<SeatCameras {model} {onvisit} />
		{/if}
	</div>
{/if}
