<script module lang="ts">
	/** One reviewable building: the shape, and whatever the caller knows about
	 *  what stands in it. A caller-supplied list rather than something read off
	 *  the catalogue here, because the studio has no business deciding that a
	 *  piece with no mode should be shown — that is the page's editorial call,
	 *  and the arrows have to walk the same set the page laid out. */
	export interface StudioPiece {
		/** Catalogue key — `ALL_PIECES`, not a mode. Empty for a subject that has
		 *  no building yet, which the stage draws as the gap it is. */
		piece: string;
		label: string;
		/** The mode's wire key, when a mode stands here. */
		key?: string;
		color?: string;
		/** Icon name for the mode's flat glyph, shown beside the name. */
		icon?: string;
	}
</script>

<script lang="ts">
	// ─────────────────────────────────────────────────────────────────────────
	// PIECE STUDIO — a turntable for the settlement.
	//
	// The harness `mesh-studio/README` asks for and describes as the whole of the
	// review: every building on one turntable, at a size you choose, so two that
	// converge under a squint are caught as the same building however different
	// their geometry is on paper. It lived as a local mockup and did not survive;
	// this is it as a component, so it survives the next clone.
	//
	// Deliberately the same shape as CHARACTER STUDIO: a bare <dialog> rather
	// than `Modal` (Modal is title/body/footer at a fixed size; this is a
	// full-bleed stage), header of wordmark · pills · close, one live subject in
	// the middle, and a panel down the side.
	//
	// THE PANEL IS NOT HAND-WRITTEN. `piece-knobs.ts` declares what can be tuned
	// and `BackdropControls` draws it — the same generated panel the backdrop and
	// the characters use. A studio with its own sliders is a third copy of a
	// swatch and a modified-pip to keep in step with the other two.
	//
	// NOT EDITING GEOMETRY, for the reason `piece-knobs` gives: there is nowhere
	// to save a building to. Camera and palette are safe to expose because they
	// are view state — nothing about the piece changes when you turn it round.

	import { untrack } from 'svelte';
	import BackdropControls from '../../backdrop/BackdropControls.svelte';
	import type { Knob } from '../../backdrop/backdrop-tokens.js';
	import { tangentFrame } from '../../physics/sphere.js';
	import Icon from '../../icons/Icon.svelte';
	import { ALL_PIECES } from './piece-catalogue.js';
	import { SUSPENDED_PIECES } from './pieces-glyphs.js';
	import NodePiece from './NodePiece.svelte';
	import { pieceKnobs, readPieceKnobs, setPieceAngle } from './piece-knobs.js';

	interface Props {
		open: boolean;
		items: StudioPiece[];
		/** Which one is on the stage. Bindable so the page and the studio's own
		 *  arrows move one selection rather than two that drift. */
		index: number;
		onclose: () => void;
	}

	let { open, items, index = $bindable(0), onclose }: Props = $props();

	/** The stage's ink when the subject has no colour of its own — an unclaimed
	 *  building has no mode and so no hue to borrow. */
	const DEFAULT_INK = '#5eead4';

	let dialogEl = $state<HTMLDialogElement | null>(null);

	const subject = $derived(items[index] ?? items[0]);
	const solid = $derived(ALL_PIECES[subject?.piece ?? '']);
	const suspended = $derived(SUSPENDED_PIECES.has(subject?.piece ?? ''));

	// `free` is unconditional here, and that is the studio saying what it IS: a
	// turntable, not a globe. Nothing on this stage is standing on anything, so no
	// piece on it inherits the sphere's restraint on how far it may be turned.
	const base = $derived(pieceKnobs(subject?.color ?? DEFAULT_INK, true));
	let knobs = $state<Knob[]>(pieceKnobs(DEFAULT_INK, true));

	const tuned = $derived(readPieceKnobs(knobs));

	/** Reseating lives in an effect rather than in the arrow handler because
	 *  `index` is bindable: the page opens the studio by writing it directly, and
	 *  a handler would only have caught the arrows — the piece clicked in the
	 *  grid would arrive wearing the previous one's ink.
	 *
	 *  Colours reseat; the CAMERA is kept. Turning a building and then stepping to
	 *  the next to compare the same bearing is the entire review, and resetting
	 *  the camera between them compares two buildings from two angles, which
	 *  compares nothing. */
	let seatedAt = $state(-1);
	$effect(() => {
		if (index === seatedAt) return;
		seatedAt = index;
		const keep = untrack(() => knobs).filter((k) => k.kind === 'param');
		knobs = pieceKnobs(items[index]?.color ?? DEFAULT_INK, true).map(
			(k) => keep.find((x) => x.kind === 'param' && k.kind === 'param' && x.prop === k.prop) ?? k
		);
	});

	const step = (d: number) => (index = (index + d + items.length) % items.length);

	$effect(() => {
		if (!dialogEl) return;
		if (open && !dialogEl.open) dialogEl.showModal();
		else if (!open && dialogEl.open) dialogEl.close();
	});

	// ── The turntable ───────────────────────────────────────────────────────
	// Bearing lives in the knobs and the spin ADDS to it, rather than the spin
	// owning an angle of its own: two sources for one rotation is how a panel
	// starts disagreeing with the thing it describes, and stopping the spin
	// would snap the model back to whatever the slider still said.
	$effect(() => {
		if (!open || !tuned.spin) return;
		// 20fps rather than rAF. The stage is one SVG re-cull per tick, and the
		// turn reads as continuous well below the repaint rate.
		const t = setInterval(() => {
			knobs = setPieceAngle(knobs, 'bearing', tuned.bearing + (tuned.spin / 20) * (Math.PI / 180));
		}, 50);
		return () => clearInterval(t);
	});

	// ── Drag to turn ────────────────────────────────────────────────────────
	// Grabbing the model is how anybody expects to rotate one, and it writes
	// through the SAME knobs the sliders do.
	let drag = $state<{ x: number; y: number; bearing: number; lean: number } | null>(null);

	function grab(e: PointerEvent) {
		(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
		drag = { x: e.clientX, y: e.clientY, bearing: tuned.bearing, lean: tuned.lean };
	}

	function turn(e: PointerEvent) {
		if (!drag) return;
		// A quarter turn per ~300px across, and a gentler rate vertically because
		// lean has half the useful range bearing does.
		knobs = setPieceAngle(knobs, 'bearing', drag.bearing + (e.clientX - drag.x) * 0.005);
		knobs = setPieceAngle(knobs, 'lean', drag.lean - (e.clientY - drag.y) * 0.003);
	}

	const drop = () => (drag = null);

	/** Head-on: +z is straight at the viewer, so the piece is seen from the front
	 *  and the bearing turns it in place rather than walking it round a globe. */
	const frame = $derived(
		tangentFrame({ x: 0, y: 0, z: 1 }, 40, {
			step: tuned.step,
			lean: tuned.lean,
			viewDistance: tuned.viewDistance,
			bearing: tuned.bearing
		})
	);

	/** What a building costs, which is the number the catalogue is rationed by:
	 *  every face here is culled, shaded and depth-sorted on the CPU each frame
	 *  the globe turns. Derived from the geometry rather than declared, so it
	 *  cannot go stale against an edited shape. */
	const cost = $derived(
		solid
			? {
					solids: solid.length,
					faces: solid.reduce((n, s) => n + s.faces.length, 0),
					verts: solid.reduce((n, s) => n + s.verts.length, 0),
					tall: Math.max(...solid.flatMap((s) => s.verts.map((v) => v.h))).toFixed(2)
				}
			: null
	);

	/** Squint test, as a filter. Two buildings that converge under it are the same
	 *  building — the README's review, made available without a screenshot and a
	 *  photo editor. */
	let squint = $state(false);
</script>

<dialog
	class="ps-modal"
	bind:this={dialogEl}
	aria-labelledby="ps-wordmark"
	{onclose}
	onkeydown={(e) => {
		if (e.key === 'ArrowRight') step(1);
		if (e.key === 'ArrowLeft') step(-1);
	}}
	onclick={(e) => {
		if (e.target === dialogEl) onclose();
	}}
>
	<div class="ps-shell" style:--pk={tuned.ink}>
		<div class="ps-header">
			<span class="ps-wordmark" id="ps-wordmark">PIECE STUDIO</span>
			<!-- Eighteen buildings is too many for a pill each, so the header names
			     the one on the stage and the arrows walk the set. -->
			<span class="ps-subject">
				{#if subject?.icon}<Icon name={subject.icon as never} size={15} />{/if}
				<b>{subject?.label}</b>
				<em>{subject?.piece}</em>
				<span class="ps-count">{index + 1}/{items.length}</span>
			</span>
			<span class="ps-spacer"></span>
			<button class="ps-squint" class:on={squint} onclick={() => (squint = !squint)}>Squint</button>
			<button class="ps-close" onclick={onclose} aria-label="Close">✕</button>
		</div>

		<div class="ps-body">
			<button class="ps-arrow" onclick={() => step(-1)} aria-label="Previous piece">‹</button>

			<!-- The stage takes the drag; the arrows and the panel sit outside it so
			     a slider drag never turns the model. -->
			<div
				class="ps-stage"
				class:dragging={!!drag}
				class:squint
				role="presentation"
				onpointerdown={grab}
				onpointermove={turn}
				onpointerup={drop}
				onpointercancel={drop}
			>
				<div class="ps-glow"></div>
				{#if solid}
					<!-- Framed like the crest, with headroom: `beacon` is nearly twice the
					     height of `factory`, and a box fitted to the average clips the one
					     piece whose whole identity is that it is tall. -->
					<svg class="ps-svg" viewBox="-20 -34 40 44" aria-hidden="true">
						<NodePiece
							piece={solid}
							{frame}
							color={tuned.ink}
							groundColor={tuned.land}
							{suspended}
							holo={tuned.holo}
							plot={suspended ? 0 : tuned.plot}
							sink={suspended ? 0 : tuned.sink}
						/>
					</svg>
				{:else}
					<p class="ps-empty">No building yet</p>
				{/if}
				<!-- Only when there is something to turn. A drag hint over an empty
				     stage is an instruction for an interaction that does nothing. -->
				{#if solid}<span class="ps-drag-hint">drag to turn</span>{/if}
			</div>

			<button class="ps-arrow" onclick={() => step(1)} aria-label="Next piece">›</button>

			<aside class="ps-panel">
				{#snippet section(title: string, group: 'colour' | 'shape' | 'floor' | 'motion' | 'light')}
					<div class="ps-group">
						<div class="ps-group-h">{title}</div>
						<BackdropControls
							{knobs}
							{group}
							defaults={base}
							showReset={false}
							hideAlpha
							onchange={(next) => (knobs = next)}
						/>
					</div>
				{/snippet}

				{@render section('Palette', 'colour')}
				{@render section('Camera', 'shape')}
				<!-- Ground and Hologram are the same slot, because they are the same
				     question answered two ways: what is this piece's relationship to
				     the surface? A founded piece has a plot and a sink; a projection
				     has neither, and has a material instead. Showing both at once
				     would offer four controls that do nothing whichever kind is on
				     the stage. -->
				{#if suspended}
					{@render section('Hologram', 'light')}
				{:else}
					{@render section('Ground', 'floor')}
				{/if}
				{@render section('Turntable', 'motion')}

				<button class="ps-reset" onclick={() => (knobs = pieceKnobs(subject?.color ?? DEFAULT_INK, true))}
					>Reset</button
				>
			</aside>
		</div>

		<div class="ps-foot">
			<div class="ps-name">
				<b style:color={tuned.ink}>{subject?.piece || subject?.label}</b>
				<i>{subject?.key ?? 'no mode stands here'}</i>
			</div>
			{#if cost}
				<div class="ps-specs">
					<span><em>solids</em>{cost.solids}</span>
					<span><em>faces</em>{cost.faces}</span>
					<span><em>verts</em>{cost.verts}</span>
					<span><em>tall</em>{cost.tall}</span>
				</div>
			{/if}
		</div>
	</div>
</dialog>

<style>
	.ps-modal {
		width: 96vw;
		height: 92vh;
		max-width: none;
		max-height: none;
		padding: 0;
		border: 1px solid var(--border);
		border-radius: 12px;
		background: var(--bg);
		color: var(--fg);
		overflow: hidden;
	}
	.ps-modal::backdrop {
		background: rgba(3, 6, 10, 0.6);
		backdrop-filter: blur(4px);
	}
	.ps-shell {
		display: flex;
		flex-direction: column;
		height: 100%;
	}
	.ps-header {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		padding: 0.7rem 0.9rem;
		border-bottom: 1px solid var(--border);
	}
	.ps-wordmark {
		font-size: 0.68rem;
		font-weight: 700;
		letter-spacing: 0.22em;
		color: var(--fg-muted);
	}
	.ps-subject {
		display: flex;
		align-items: center;
		gap: 0.45rem;
		font-size: 0.8rem;
		color: var(--pk);
	}
	.ps-subject b {
		color: var(--fg);
	}
	.ps-subject em {
		font-style: normal;
		font-size: 0.66rem;
		letter-spacing: 0.14em;
		text-transform: uppercase;
	}
	.ps-count {
		font-family: var(--mono);
		font-size: 0.66rem;
		color: var(--fg-muted);
	}
	.ps-spacer {
		flex: 1;
	}
	.ps-squint,
	.ps-close,
	.ps-reset,
	.ps-arrow {
		background: transparent;
		border: 1px solid var(--border);
		border-radius: 6px;
		color: var(--fg-muted);
		cursor: pointer;
		font: inherit;
	}
	.ps-squint {
		font-size: 0.68rem;
		letter-spacing: 0.1em;
		padding: 0.25rem 0.6rem;
	}
	.ps-squint.on {
		color: var(--pk);
		border-color: var(--pk);
	}
	.ps-close {
		padding: 0.2rem 0.5rem;
	}
	.ps-body {
		flex: 1;
		display: flex;
		align-items: stretch;
		min-height: 0;
	}
	.ps-arrow {
		border: none;
		font-size: 1.6rem;
		padding: 0 0.7rem;
	}
	.ps-arrow:hover {
		color: var(--fg);
	}
	.ps-stage {
		position: relative;
		flex: 1;
		display: grid;
		place-items: center;
		cursor: grab;
		touch-action: none;
		min-width: 0;
	}
	.ps-stage.dragging {
		cursor: grabbing;
	}
	/* The README's review, as a filter. Blur alone leaves a colour cue the real
	   globe does not have at 40px, so the saturation goes with it. */
	.ps-stage.squint .ps-svg {
		filter: blur(3.5px) saturate(0.25);
	}
	.ps-glow {
		position: absolute;
		width: 52%;
		aspect-ratio: 1;
		border-radius: 50%;
		background: radial-gradient(circle, color-mix(in srgb, var(--pk) 14%, transparent), transparent 70%);
		pointer-events: none;
	}
	.ps-svg {
		width: min(62vh, 100%);
		height: min(62vh, 100%);
		overflow: visible;
	}
	.ps-empty,
	.ps-drag-hint {
		color: var(--fg-muted);
		font-size: 0.7rem;
	}
	.ps-drag-hint {
		position: absolute;
		bottom: 0.8rem;
		letter-spacing: 0.14em;
		text-transform: uppercase;
		opacity: 0.45;
		pointer-events: none;
	}
	.ps-panel {
		width: 300px;
		flex: none;
		border-left: 1px solid var(--border);
		padding: 0.9rem;
		overflow-y: auto;
		display: flex;
		flex-direction: column;
		gap: 1.1rem;
	}
	.ps-group-h {
		font-size: 0.62rem;
		font-weight: 700;
		letter-spacing: 0.2em;
		text-transform: uppercase;
		color: var(--fg-muted);
		margin-bottom: 0.5rem;
	}
	.ps-reset {
		padding: 0.4rem;
		font-size: 0.72rem;
	}
	.ps-foot {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		padding: 0.6rem 0.9rem;
		border-top: 1px solid var(--border);
		font-size: 0.72rem;
	}
	.ps-name i {
		color: var(--fg-muted);
		font-family: var(--mono);
		font-style: normal;
		margin-left: 0.5rem;
	}
	.ps-specs {
		display: flex;
		gap: 1rem;
		font-family: var(--mono);
		color: var(--fg);
	}
	.ps-specs em {
		font-style: normal;
		color: var(--fg-muted);
		margin-right: 0.35rem;
	}
</style>
