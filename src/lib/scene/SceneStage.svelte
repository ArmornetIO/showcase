<script lang="ts">
	// ── SceneStage — components and bursts, inside the canvas transform ────────
	// An HTML layer within <Canvas> (the CompositorLayer precedent) because both
	// things it draws are HTML: registry components go through the SAME
	// `ComponentRenderer` the builder canvas uses, and `Flourish` paints CSS
	// particles that cannot live inside an SVG.
	//
	// Positions are recomputed from the live camera transform every frame, so a
	// card stays glued to its spot and a glow stays glued to its node through a
	// pan, a zoom or a fly-to without either of them knowing that happened.
	import { getContext, onDestroy } from 'svelte';
	import { CANVAS_CTX, type CanvasContextValue } from '../primitives/canvas/canvas-camera.js';
	import ComponentRenderer from '../builder/ComponentRenderer.svelte';
	import Flourish from '../motion/Flourish.svelte';
	import type { SceneObject, ActiveBurst } from './types.js';
	import type { Placed } from './place.js';
	import type { FlourishKind } from '../motion/effects.js';

	let {
		components = [],
		bursts = [],
		placement,
		selectedId = null,
		interactive = true,
		onSelect,
		onMove,
	}: {
		components?: SceneObject[];
		bursts?: ActiveBurst[];
		placement: Map<string, Placed>;
		selectedId?: string | null;
		interactive?: boolean;
		onSelect?: (id: string) => void;
		onMove?: (id: string, x: number, y: number) => void;
	} = $props();

	const ctx = getContext<CanvasContextValue>(CANVAS_CTX);
	const transform = ctx.transform;

	// Register component extents so `fitAll` frames them too. Without this the
	// camera unions only MeshStudio's nodes, and a hand-placed card sits outside
	// the shot — which is exactly what it did.
	//
	// Registered at INIT, not in an $effect: the context maps are plain Maps, so
	// a sibling that mounts later must find the getter already present. The
	// getter reads live values, so one registration covers every frame.
	const boundsId = Symbol('scene-stage');
	ctx.boundsRegistry.set(boundsId, () => {
		if (!components.length) return null;
		let minX = Infinity;
		let minY = Infinity;
		let maxX = -Infinity;
		let maxY = -Infinity;
		for (const o of components) {
			const p = placement.get(o.id);
			if (!p || !o.component) continue;
			const hw = o.component.w / 2;
			// Height is not authored, so approximate from the width. Framing a
			// little generously beats clipping the payoff card.
			const hh = (o.component.w * 0.6) / 2;
			minX = Math.min(minX, p.x - hw);
			maxX = Math.max(maxX, p.x + hw);
			minY = Math.min(minY, p.y - hh);
			maxY = Math.max(maxY, p.y + hh);
		}
		return Number.isFinite(minX) ? { minX, minY, maxX, maxY } : null;
	});
	onDestroy(() => ctx.boundsRegistry.delete(boundsId));

	function screen(p: Placed) {
		return { x: p.x * transform.tk + transform.tx, y: p.y * transform.tk + transform.ty };
	}

	// ── Component dragging ───────────────────────────────────────────────────
	// A pure delta needs no origin — dividing the client delta by the scale is
	// the whole conversion, which is why this doesn't need the rect.
	let drag: { id: string; ox: number; oy: number; sx: number; sy: number } | null = $state(null);

	function down(e: PointerEvent, o: SceneObject) {
		if (!interactive) return;
		e.stopPropagation();
		onSelect?.(o.id);
		const p = placement.get(o.id);
		if (!p) return;
		drag = { id: o.id, ox: p.x, oy: p.y, sx: e.clientX, sy: e.clientY };
		(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
	}
	function move(e: PointerEvent) {
		if (!drag) return;
		onMove?.(
			drag.id,
			drag.ox + (e.clientX - drag.sx) / transform.tk,
			drag.oy + (e.clientY - drag.sy) / transform.tk,
		);
	}
	function up() {
		drag = null;
	}

	const FLOURISH_KINDS = ['sparkle', 'firework', 'shimmer', 'aurora'];

	/** `Flourish` replays on a trigger CHANGE and idles at 0, so a burst that is
	 *  alight is 1 and everything else is 0. The step is derived from progress,
	 *  never from a timer, so the loop re-arms it for free on the next pass. */
	function burstKind(id: string): FlourishKind | null {
		const k = id.replace('flourish.', '');
		return FLOURISH_KINDS.includes(k) ? (k as FlourishKind) : null;
	}
</script>

<div class="stage">
	{#each components as o (o.id)}
		{@const p = placement.get(o.id)}
		{#if p && o.component}
			{@const s = screen(p)}
			<div
				class="stage-item"
				class:stage-item--static={!interactive}
				class:stage-item--sel={selectedId === o.id}
				style:left="{s.x}px"
				style:top="{s.y}px"
				style:width="{o.component.w * transform.tk}px"
				style:opacity={o.component.opacity}
				style:transform="translate(-50%,-50%) scale({transform.tk})"
				style:--w="{o.component.w}px"
				onpointerdown={(e) => down(e, o)}
				onpointermove={move}
				onpointerup={up}
				onpointercancel={up}
				role="presentation"
			>
				<div class="stage-item-inner">
					<ComponentRenderer
						componentId={o.component.componentId}
						props={o.component.props}
						w={o.component.w}
						h={0}
						styleOverrides={o.component.styleOverrides}
					/>
				</div>
			</div>
		{/if}
	{/each}

	{#each bursts as b (b.cueId + b.objectId)}
		{@const p = placement.get(b.objectId)}
		{@const kind = burstKind(b.burst)}
		{#if p && kind}
			{@const s = screen(p)}
			<div class="stage-burst" style:left="{s.x}px" style:top="{s.y}px">
				<Flourish {kind} trigger={1} />
			</div>
		{/if}
	{/each}
</div>

<style>
	.stage {
		position: absolute;
		inset: 0;
		overflow: hidden;
		/* The layer is inert; only its children take a pointer. */
		pointer-events: none;
	}

	.stage-item {
		position: absolute;
		transform-origin: center center;
		pointer-events: auto;
		cursor: grab;
	}
	.stage-item:active {
		cursor: grabbing;
	}
	/* An audience should not be able to grab the set. */
	.stage-item--static {
		pointer-events: none;
		cursor: default;
	}
	.stage-item--sel {
		outline: 1px solid var(--accent);
		outline-offset: 4px;
		border-radius: 0.4rem;
	}
	/* The scale lives on the wrapper, so the inner box is authored at its real
	   width and the component inside never learns about zoom. */
	.stage-item-inner {
		width: var(--w);
	}

	.stage-burst {
		position: absolute;
		width: 90px;
		height: 90px;
		margin: -45px 0 0 -45px;
		border-radius: 50%;
		pointer-events: none;
	}
</style>
