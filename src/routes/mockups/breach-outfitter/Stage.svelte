<script lang="ts">
	// ── The stage ────────────────────────────────────────────────────────────
	// The figure, full size, turnable, animated, and droppable-on.
	//
	// There is no overlay here and there cannot be one: everything the character
	// is wearing is IN the figure, so this component draws exactly one `<svg>`.
	// That is the whole difference from the Mannequin it replaces, which drew
	// two and spent its length keeping them lined up.
	//
	// Everything on the deck at the bottom is a fact about the STAGE — the
	// camera, and what the model is doing — never about the loadout. That is the
	// line the right-hand panel sits on the other side of: the panel customises,
	// the deck looks. A clip picker in the panel would be a control that changes
	// nothing you can own.
	//
	// The hit regions come from `art().hit` — projected by the renderer, which
	// is the only thing that knows where the camera is. They are percentages of
	// `.frame`, NOT of the stage, and that is what makes them land: the figure's
	// `<svg>` scales with `meet`, so it letterboxes inside any box that is not
	// its own aspect ratio, and the stage is wide while the figure is tall.
	// Percentages of the stage were pointing to the left of the model. Giving
	// the frame the figure's exact aspect ratio removes the letterbox, which
	// makes a viewBox percentage and a CSS percentage the same number again.
	import Figure from '$lib/character/Figure.svelte';
	import { art } from '$lib/character/render.js';
	import { CLIPS, type Pose } from '$lib/character/poses.js';
	import type { Anchor } from '$lib/character/wearables.js';
	import type { OutfitterState } from './outfitter.svelte.js';

	interface Props {
		fit: OutfitterState;
		pose: Pose;
		/** What is being dragged over the model, if anything. */
		dragging?: Anchor | null;
		onpick: (anchor: Anchor) => void;
		ondrop: (anchor: Anchor) => void;
	}

	let { fit, pose, dragging = null, onpick, ondrop }: Props = $props();

	const opts = $derived({ yaw: fit.yaw, pitch: fit.pitch, worn: fit.worn, pose, ...fit.paint });
	const a = $derived(art(fit.skin, opts));
	const box = $derived(a.box);

	const pct = (r: { x: number; y: number; w: number; h: number }) => ({
		left: `${((r.x - box.x) / box.w) * 100}%`,
		top: `${((r.y - box.y) / box.h) * 100}%`,
		width: `${(r.w / box.w) * 100}%`,
		height: `${(r.h / box.h) * 100}%`
	});

	const regions = $derived(
		(Object.entries(a.hit) as [Anchor, { x: number; y: number; w: number; h: number }][]).map(
			([anchor, r]) => ({ anchor, style: pct(r) })
		)
	);

	// ── Drag to turn ────────────────────────────────────────────────────────
	// Writes through the SAME yaw/pitch every other control reads. Two paths to
	// one value is how a panel starts disagreeing with the thing it describes.
	let drag: { x: number; y: number; yaw: number; pitch: number } | null = $state(null);

	function grab(e: PointerEvent) {
		(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
		drag = { x: e.clientX, y: e.clientY, yaw: fit.yaw, pitch: fit.pitch };
	}

	function turn(e: PointerEvent) {
		if (!drag) return;
		// A quarter turn per ~300px across, and a gentler rate vertically because
		// pitch has a tenth of the useful range yaw does.
		fit.yaw = drag.yaw + (e.clientX - drag.x) * 0.005;
		fit.pitch = Math.max(-0.55, Math.min(0.85, drag.pitch + (e.clientY - drag.y) * 0.003));
	}

	const drop = () => (drag = null);
</script>

<div class="stage" class:turning={!!drag} style:--trim={fit.trim}>
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div
		class="frame"
		style:aspect-ratio={box.w / box.h}
		style:--zoom={fit.zoom}
		onpointerdown={grab}
		onpointermove={turn}
		onpointerup={drop}
		onpointercancel={drop}
	>
		<Figure klass={fit.skin} crop="hero" shadow art={opts} />

		<div class="hits">
			{#each regions as r (r.anchor)}
				<button
					class="hit"
					class:active={fit.category === r.anchor}
					class:armed={dragging === r.anchor}
					class:refused={!!dragging && dragging !== r.anchor}
					style:left={r.style.left}
					style:top={r.style.top}
					style:width={r.style.width}
					style:height={r.style.height}
					aria-label="Customise {r.anchor}"
					onclick={() => onpick(r.anchor)}
					ondragover={(e) => {
						// Only the matching anchor accepts. Refusing by NOT preventing
						// default is what makes the cursor say no — the browser's own
						// affordance rather than one drawn on top of it.
						if (dragging === r.anchor) e.preventDefault();
					}}
					ondrop={(e) => {
						e.preventDefault();
						ondrop(r.anchor);
					}}
				></button>
			{/each}
		</div>
	</div>

	<!-- ── Deck ────────────────────────────────────────────────────────────── -->
	<footer class="deck">
		<div class="clips">
			{#each CLIPS as c (c.id)}
				<button class:active={fit.clip === c.id} title={c.hint} onclick={() => (fit.clip = c.id)}>
					{c.label}
				</button>
			{/each}
		</div>

		<!-- Offered only while something is moving. A slider that does nothing is
		     a slider you try twice. -->
		{#if fit.clip !== 'still'}
			<label class="knob">
				<span>Speed</span>
				<input type="range" min="0.2" max="3" step="0.05" bind:value={fit.speed} />
				<b>{fit.speed.toFixed(2)}×</b>
			</label>
		{/if}

		{#if fit.clip === 'walk'}
			<label class="knob">
				<span>Stride</span>
				<input type="range" min="0" max="0.8" step="0.01" bind:value={fit.stride} />
			</label>
			<label class="knob">
				<span>Arms</span>
				<input type="range" min="0" max="0.8" step="0.01" bind:value={fit.swing} />
			</label>
		{/if}

		<label class="knob wide">
			<span>Zoom</span>
			<input type="range" min="0.25" max="1" step="0.01" bind:value={fit.zoom} />
		</label>
	</footer>
</div>

<style>
	.stage {
		position: relative;
		min-height: 0;
		overflow: hidden;
		display: grid;
		grid-template-rows: 1fr auto;
	}

	/* Exactly the figure's aspect ratio, so the SVG fills it with no letterbox
	   and the hit percentages are honest. Height is the zoom. */
	.frame {
		position: relative;
		height: calc(var(--zoom) * 100%);
		max-width: 100%;
		margin: auto;
		cursor: grab;
		touch-action: none;
		user-select: none;
	}
	.turning .frame {
		cursor: grabbing;
	}

	.hits {
		position: absolute;
		inset: 0;
		pointer-events: none;
	}
	.hit {
		position: absolute;
		padding: 0;
		border: 1px solid transparent;
		border-radius: 3px;
		background: transparent;
		pointer-events: auto;
		cursor: pointer;
		transition:
			border-color 120ms,
			background 120ms;
	}
	/* The active region is MARKED, not filled. A tinted block over the head
	   competes with the thing it points at, and on a screen whose whole job is
	   looking at the model that is the wrong trade. */
	.hit.active {
		border-color: color-mix(in srgb, var(--trim) 42%, transparent);
	}
	.hit:hover {
		border-color: color-mix(in srgb, var(--trim) 72%, transparent);
		background: color-mix(in srgb, var(--trim) 8%, transparent);
	}
	.hit.armed {
		border-color: var(--trim);
		background: color-mix(in srgb, var(--trim) 22%, transparent);
	}
	/* A drop that cannot land says so before it is attempted. */
	.hit.refused {
		border-color: color-mix(in srgb, var(--fg-dim) 35%, transparent);
		border-style: dashed;
		background: transparent;
	}
	.hit:focus-visible {
		outline: 2px solid var(--trim);
		outline-offset: 1px;
	}

	.deck {
		display: flex;
		align-items: center;
		gap: 16px;
		padding: 7px 14px;
		border-top: 1px solid var(--border);
	}
	.clips {
		display: flex;
		border: 1px solid var(--border);
		border-radius: 3px;
		overflow: hidden;
	}
	.clips button {
		padding: 4px 10px;
		border: 0;
		background: none;
		color: var(--fg-dim);
		font-family: var(--mono);
		font-size: 0.55rem;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		cursor: pointer;
	}
	.clips button.active {
		background: color-mix(in srgb, var(--trim) 20%, transparent);
		color: var(--fg);
	}

	.knob {
		display: flex;
		align-items: center;
		gap: 7px;
	}
	.knob.wide {
		margin-left: auto;
	}
	.knob span {
		font-family: var(--mono);
		font-size: 0.52rem;
		letter-spacing: 0.11em;
		text-transform: uppercase;
		color: var(--fg-dim);
	}
	.knob b {
		min-width: 36px;
		font-family: var(--mono);
		font-size: 0.55rem;
		color: var(--trim);
	}
	.knob input {
		width: 96px;
		accent-color: var(--trim);
	}
</style>
