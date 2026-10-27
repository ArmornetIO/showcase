<script lang="ts">
	// ─────────────────────────────────────────────────────────────────────────
	// MODEL STUDIO — a bench for physical objects: enclosures, mounts, risers.
	//
	// One of the Builder's 3D-mode studios, so it fills its parent rather than
	// opening over anything: a header, one live subject in the middle and a
	// panel down the side. The subject is picked in 3D mode's palette; `New
	// canvas` is the empty one to start from.
	//
	// Drawn with the mesh globe's piece renderer rather than a 3D library: the
	// objects are boxes, tubes and holes in millimetres, which `pieceFacets`
	// already culls, shades and sorts. Geometry lives in `models.ts`; this file
	// only looks at it.
	//
	// THE VIEW PANEL IS NOT HAND-WRITTEN: its switches are toggle knobs drawn by
	// `BackdropControls`, the same panel the other studios use. The part list is
	// hand-rolled for the reason Icon Studio's glyph grid is — each row is a
	// subject (show it, pick it out), not a setting.

	import { untrack } from 'svelte';
	import BackdropControls from '../backdrop/BackdropControls.svelte';
	import type { Knob } from '../backdrop/backdrop-tokens.js';
	import Icon from '../icons/Icon.svelte';
	import StatTile from '../display/metric/StatTile.svelte';
	import { downloadColoredOBJs } from '../character/export.js';
	import type { Painted } from '../character/render.js';
	import CheckboxList from '../primitives/forms/CheckboxList.svelte';
	import { pieceProjector, studioFrame } from '../mesh-studio/pieces/piece-facets.js';
	import type { PieceVert } from '../mesh-studio/pieces/pieces.js';
	import { modelFacets, movePart, pickPart, PART_FILL, screenToModel, type Model, type Part } from './model-geometry.js';
	import { createModelStage, cssRgb, type ModelStage } from './model-gl.js';
	import { MODELS } from './models.js';

	interface Props {
		/** What is on the stage — picked in the Builder's 3D palette. */
		model?: Model;
	}

	let { model = MODELS[0] }: Props = $props();

	let rootEl = $state<HTMLElement | null>(null);
	const current = $derived(model);

	// ── View ──────────────────────────────────────────────────────────────────
	const VIEW_KNOBS: Knob[] = [
		{ kind: 'toggle', group: 'shape', prop: 'exploded', label: 'Exploded', hint: 'Pull the layers apart', value: false },
		{ kind: 'toggle', group: 'shape', prop: 'xray', label: 'X-ray', hint: 'See through the shell', value: false },
		{ kind: 'toggle', group: 'shape', prop: 'print', label: 'Print layout', hint: 'Every piece as it goes on the bed, holes cut', value: false },
		{ kind: 'toggle', group: 'shape', prop: 'grid', label: 'Grid', hint: '10 mm floor grid', value: true }
	];
	let knobs = $state<Knob[]>(VIEW_KNOBS);
	const on = (prop: string) => knobs.some((k) => k.kind === 'toggle' && k.prop === prop && k.value);

	/** The model's own knobs, reseated whenever the model changes. */
	let modelKnobs = $state<Knob[]>([]);
	const parts = $derived(current.build({ exploded: on('exploded'), xray: on('xray'), print: on('print') }, modelKnobs));
	const stats = $derived(typeof current.stats === 'function' ? current.stats(modelKnobs) : current.stats);
	let hidden = $state<string[]>([]);
	let selected = $state('');
	/** Millimetres each dragged part has been slid by, keyed by part id. */
	let moved = $state<Record<string, PieceVert>>({});
	let statsOpen = $state(false);

	// ── Camera ────────────────────────────────────────────────────────────────
	const CAMERAS: { id: string; label: string; at: [number, number] }[] = [
		{ id: 'iso', label: 'Iso', at: [-0.62, 0.7] },
		{ id: 'top', label: 'Top', at: [0, Math.PI / 2 - 0.001] },
		{ id: 'front', label: 'Front', at: [0, 0.12] },
		{ id: 'side', label: 'Side', at: [-Math.PI / 2, 0.12] },
		{ id: 'back', label: 'Back', at: [Math.PI - 0.25, 0.6] },
		{ id: 'under', label: 'Under', at: [-0.62, -0.9] }
	];
	let camera = $state('iso');
	let yaw = $state(CAMERAS[0].at[0]);
	let pitch = $state(CAMERAS[0].at[1]);
	let zoom = $state(4);
	let pan = $state({ x: 0, y: 0 });

	function aim(id: string) {
		const c = CAMERAS.find((x) => x.id === id);
		if (!c) return;
		camera = id;
		[yaw, pitch] = c.at;
		pan = { x: 0, y: 0 };
	}

	// A new model reseats its own knobs and the camera; the view switches stay.
	let seated: Model | null = null;
	$effect.pre(() => {
		const m = current;
		if (m === seated) return;
		seated = m;
		untrack(() => {
			modelKnobs = m.knobs ?? [];
			hidden = [];
			selected = '';
			moved = {};
			zoom = m.zoom;
			aim('iso');
		});
	});

	// Drag a part to move it in the screen plane; drag empty space to orbit;
	// shift-drag (or right-drag) pans; wheel zooms. A click selects, and a
	// double-click puts a part back.
	let drag: { x: number; y: number; mode: 'orbit' | 'pan' | 'move'; id?: string; travelled: boolean } | null = null;

	/** The pointer in viewBox units, the space the projector draws in. */
	function boxPoint(e: MouseEvent, x = e.clientX, y = e.clientY) {
		return new DOMPoint(x, y).matrixTransform((e.currentTarget as SVGSVGElement).getScreenCTM()!.inverse());
	}
	function partAt(e: MouseEvent): Part | undefined {
		const p = boxPoint(e);
		return placed[pickPart(placed, frame, { x: p.x - pan.x + centre.x, y: p.y - pan.y + centre.y })];
	}

	function down(e: PointerEvent) {
		const hit = e.button === 0 && !e.shiftKey ? partAt(e) : undefined;
		drag = { x: e.clientX, y: e.clientY, mode: hit ? 'move' : e.shiftKey || e.button === 2 ? 'pan' : 'orbit', id: hit?.id, travelled: false };
		(e.currentTarget as Element).setPointerCapture(e.pointerId);
	}
	function move(e: PointerEvent) {
		if (!drag) return;
		const dx = e.clientX - drag.x;
		const dy = e.clientY - drag.y;
		if (Math.abs(dx) + Math.abs(dy) > 2) drag.travelled = true;
		if (drag.mode === 'move' && drag.id) {
			const a = boxPoint(e, drag.x, drag.y);
			const b = boxPoint(e);
			const d = screenToModel(frame, zoom, b.x - a.x, b.y - a.y);
			const was = moved[drag.id] ?? { e: 0, n: 0, h: 0 };
			moved = { ...moved, [drag.id]: { e: was.e + d.e, n: was.n + d.n, h: was.h + d.h } };
		} else if (drag.mode === 'pan') {
			pan = { x: pan.x + dx, y: pan.y + dy };
		} else {
			yaw += dx * 0.008;
			pitch = Math.min(Math.PI / 2 - 0.001, Math.max(-Math.PI / 2 + 0.001, pitch + dy * 0.006));
			camera = '';
		}
		drag.x = e.clientX;
		drag.y = e.clientY;
	}
	function up() {
		if (drag && !drag.travelled && drag.mode !== 'pan') selected = drag.id && drag.id !== selected ? drag.id : '';
		drag = null;
	}
	function putBack(e: MouseEvent) {
		const hit = partAt(e);
		if (hit) moved = Object.fromEntries(Object.entries(moved).filter(([id]) => id !== hit.id));
	}
	function wheel(e: WheelEvent) {
		e.preventDefault();
		zoom = Math.min(24, Math.max(0.2, zoom * (e.deltaY > 0 ? 0.92 : 1.08)));
	}

	// ── Render ────────────────────────────────────────────────────────────────
	const frame = $derived(studioFrame(yaw, pitch, zoom));
	const at = $derived(pieceProjector(frame));
	const centre = $derived(at({ e: 0, n: 0, h: current.pivot + (on('exploded') ? 11 : 0) }));
	const shown = $derived(parts.filter((p) => !hidden.includes(p.id)));
	// Picking and the SVG fallback need dragged parts' real vertices; the GL
	// stage takes `shift` instead and never reads this.
	const placed = $derived(shown.map((p) => (moved[p.id] ? movePart(p, moved[p.id]) : p)));
	const shift = $derived(new Float32Array(shown.flatMap((p) => (moved[p.id] ? [moved[p.id].e, moved[p.id].n, moved[p.id].h] : [0, 0, 0]))));
	// Only read when WebGL2 is missing: 30k facets re-sorted per frame is the
	// lag the GL stage exists to remove.
	const facets = $derived(modelFacets(placed, frame, on('xray')));

	let canvasEl = $state<HTMLCanvasElement | null>(null);
	let stage = $state<ModelStage | null>(null);
	let glFailed = $state(false);
	let resized = $state(0);
	$effect(() => {
		if (!canvasEl) return;
		const s = createModelStage(canvasEl, () => resized++);
		if (!s) glFailed = true;
		stage = s;
		return () => {
			s?.dispose();
			stage = null;
		};
	});
	let baked = $state(0);
	$effect(() => {
		if (!stage) return;
		const xray = on('xray');
		stage.setParts(shown, (p) => xray && !!(p.shell || p.printed));
		untrack(() => baked++);
	});
	$effect(() => {
		void baked;
		void resized;
		stage?.draw({
			frame,
			zoom,
			off: { x: pan.x - centre.x, y: pan.y - centre.y },
			selected: shown.findIndex((p) => p.id === selected),
			shift
		});
	});

	const GRID = $derived(current.grid ?? 60);
	const grid = $derived(
		Array.from({ length: GRID ? (2 * GRID) / 10 + 1 : 0 }, (_, k) => -GRID + k * 10).flatMap((v) => {
			const line = (a: { e: number; n: number }, b: { e: number; n: number }) => {
				const p = at({ ...a, h: 0 });
				const q = at({ ...b, h: 0 });
				return `M ${p.x.toFixed(1)} ${p.y.toFixed(1)} L ${q.x.toFixed(1)} ${q.y.toFixed(1)}`;
			};
			return [line({ e: v, n: -GRID }, { e: v, n: GRID }), line({ e: -GRID, n: v }, { e: GRID, n: v })];
		})
	);

	const fill = (p: Part, color: string, shade: number) =>
		`color-mix(in oklab, ${p.id === selected ? 'var(--accent)' : color} ${Math.round(25 + shade * 70)}%, var(--bg))`;

	// ── Export ────────────────────────────────────────────────────────────────
	// The printed parts you can see, as laid on the bed, one OBJ per print and a
	// material per colour — the form Creality Print and Orca map onto loaded
	// filaments. Each `printed` part is a print of its own; shell parts are one
	// print per kind, as the riser's walls fuse into its base and its face plate
	// prints apart. Hide a part to leave it out.

	/** A token or any CSS colour, as the #rrggbb an .mtl can hold. Painted to
	 *  one canvas pixel, because a theme colour may be oklch and only the
	 *  canvas will say what it is in sRGB. */
	function hex(css: string): string {
		const rgb = cssRgb(css, rootEl ?? document.documentElement);
		return '#' + rgb.map((x) => Math.round(x * 255).toString(16).padStart(2, '0')).join('');
	}

	const printedParts = $derived(parts.filter((p) => (p.shell || p.printed) && !hidden.includes(p.id)));

	function exportModel() {
		const prints = new Map<string, Painted[]>();
		for (const p of current.build({ exploded: false, print: true }, modelKnobs)) {
			if (!printedParts.some((q) => q.id === p.id)) continue;
			// Named for what it is — `founder-maintainer-maintainer-head`.
			const name = `${current.id}-${p.printed ? p.id : p.kind}`;
			prints.set(name, [
				...(prints.get(name) ?? []),
				...p.solids.map((solid, k) => ({ solid, color: hex(p.colors?.[k] ?? PART_FILL[p.kind]), emits: false, tint: 1, name: p.id }))
			]);
		}
		// Model units are already millimetres, so the scale is 1.
		downloadColoredOBJs([...prints].map(([name, items]) => ({ name, items })), current.id, 1);
	}

	function toggleHidden(id: string) {
		hidden = hidden.includes(id) ? hidden.filter((h) => h !== id) : [...hidden, id];
	}
</script>

<section class="ms-root" bind:this={rootEl} aria-labelledby="ms-wordmark">
	<div class="ms-shell">
		<div class="ms-header">
			<span class="ms-wordmark" id="ms-wordmark">MODEL STUDIO</span>
			<span class="ms-spacer"></span>
			<!-- Only once the studio holds something printable. -->
			{#if printedParts.length}
				<button
					class="ms-icon-btn"
					onclick={exportModel}
					aria-label="Export printed parts as OBJ"
					title="Export the visible printed parts as a coloured OBJ"
				>
					<Icon name="download" size={15} />
				</button>
			{/if}
			{#if stats.length}
				<div class="ms-cog-wrap">
					<button
						class="ms-icon-btn"
						class:on={statsOpen}
						onclick={() => (statsOpen = !statsOpen)}
						aria-label="Model dimensions"
						aria-expanded={statsOpen}
					>
						<Icon name="settings" size={15} />
					</button>
					{#if statsOpen}
						<div class="ms-stats" role="dialog" aria-label="Model dimensions">
							{#each stats as s (s.label)}
								<StatTile label={s.label} value={s.value} sub={s.sub} mono />
							{/each}
						</div>
					{/if}
				</div>
			{/if}
		</div>

		<div class="ms-body">
			<div class="ms-stage">
				<svg
					class="ms-svg"
					viewBox="-450 -300 900 600"
					onpointerdown={down}
					onpointermove={move}
					onpointerup={up}
					onpointercancel={() => (drag = null)}
					ondblclick={putBack}
					onwheel={wheel}
					oncontextmenu={(e) => e.preventDefault()}
					role="img"
					aria-label="{current.name} model"
				>
					<g transform="translate({pan.x - centre.x} {pan.y - centre.y})">
						{#if on('grid')}
							<path class="ms-grid" d={grid.join(' ')} />
						{/if}
						{#if glFailed}
							{#each facets as f, k (k)}
								<path
									d={f.d}
									class="ms-facet"
									class:ghost={on('xray') && (f.part.shell || f.part.printed)}
									class:back={!f.front}
									style="fill: {fill(f.part, f.color, f.shade)}; stroke: {fill(f.part, f.color, f.shade)}"
								/>
							{/each}
						{/if}
					</g>
				</svg>
				<canvas class="ms-gl" bind:this={canvasEl}></canvas>
				{#if !parts.length}
					<p class="ms-empty">Empty canvas — describe a part and it is added to <code>models.ts</code></p>
				{/if}
				<span class="ms-hint"
					>drag a part to move it · drag empty space to orbit · shift-drag to pan · scroll to zoom · double-click a part to put it back</span
				>
			</div>

			<aside class="ms-panel">
				<div class="ms-group">
					<div class="ms-group-h">Camera</div>
					<div class="ms-pills">
						{#each CAMERAS as c (c.id)}
							<button class="ms-pill" class:on={camera === c.id} onclick={() => aim(c.id)}>{c.label}</button>
						{/each}
					</div>
				</div>

				<div class="ms-group">
					<div class="ms-group-h">View</div>
					<BackdropControls {knobs} group="shape" defaults={VIEW_KNOBS} showReset={false} onchange={(next) => (knobs = next)} />
				</div>

				{#if modelKnobs.length}
					<div class="ms-group">
						<div class="ms-group-h">{current.name}</div>
						<BackdropControls
							knobs={modelKnobs}
							defaults={current.knobs}
							showReset={false}
							onchange={(next) => (modelKnobs = next)}
						/>
					</div>
				{/if}

				{#if parts.length}
					<div class="ms-group">
						<div class="ms-group-h">Parts · shift-click for a range</div>
						<div class="ms-parts">
							<CheckboxList
								options={parts.map((p) => ({ value: p.id, label: p.label }))}
								selected={parts.filter((p) => !hidden.includes(p.id)).map((p) => p.id)}
								ontoggle={toggleHidden}
							>
								{#snippet row(opt)}
									{@const p = parts.find((x) => x.id === opt.value)!}
									<!-- A button inside the label: clicking it highlights the part
									     without toggling the box, since a label never activates its
									     control through an interactive child. -->
									<button
										class="ms-part-btn"
										class:sel={p.id === selected}
										onclick={() => (selected = selected === p.id ? '' : p.id)}
									>
										<span class="ms-swatch" style="background: {p.colors?.[0] ?? PART_FILL[p.kind]}"></span>
										<span class="ms-name">{p.label}</span>
										<span class="ms-size">{p.size}</span>
									</button>
								{/snippet}
							</CheckboxList>
						</div>
					</div>
				{/if}
			</aside>
		</div>

		<div class="ms-foot">
			<b>{current.name}</b>
			<i>{current.blurb}</i>
		</div>
	</div>
</section>

<style>
	.ms-root {
		height: 100%;
		background: var(--bg);
		color: var(--fg);
		overflow: hidden;
	}
	.ms-shell {
		display: flex;
		flex-direction: column;
		height: 100%;
	}

	.ms-header {
		display: flex;
		align-items: center;
		gap: 16px;
		height: 48px;
		padding: 0 16px;
		border-bottom: 1px solid var(--border);
		flex-shrink: 0;
	}
	.ms-wordmark {
		font-family: var(--mono);
		font-size: 0.72rem;
		letter-spacing: 0.16em;
		color: var(--accent);
		white-space: nowrap;
	}
	.ms-spacer {
		flex: 1;
	}
	.ms-pills {
		display: flex;
		flex-wrap: wrap;
		gap: 4px;
	}
	.ms-pill {
		padding: 5px 12px;
		border-radius: 999px;
		border: 1px solid var(--border);
		background: transparent;
		color: var(--fg-dim);
		font-family: var(--mono);
		font-size: 0.62rem;
		letter-spacing: 0.1em;
		cursor: pointer;
		transition: all 0.15s;
	}
	.ms-pill:hover {
		color: var(--fg);
		border-color: color-mix(in srgb, var(--accent) 50%, transparent);
	}
	.ms-pill.on {
		color: var(--accent);
		border-color: var(--accent);
		background: color-mix(in srgb, var(--accent) 14%, transparent);
	}
	.ms-icon-btn {
		display: grid;
		place-items: center;
		border: 1px solid var(--border);
		background: transparent;
		color: var(--fg-dim);
		border-radius: 6px;
		width: 28px;
		height: 28px;
		cursor: pointer;
	}
	.ms-icon-btn:hover,
	.ms-icon-btn.on {
		color: var(--fg);
		border-color: var(--border-strong);
	}
	.ms-cog-wrap {
		position: relative;
	}
	.ms-stats {
		position: absolute;
		top: calc(100% + 8px);
		right: 0;
		z-index: 5;
		width: 460px;
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 10px;
		padding: 12px;
		border: 1px solid var(--border);
		border-radius: var(--radius-surface);
		background: var(--bg);
		box-shadow: 0 12px 32px -12px rgba(0, 0, 0, 0.6);
	}

	.ms-body {
		flex: 1;
		min-height: 0;
		display: flex;
		align-items: stretch;
	}
	.ms-stage {
		position: relative;
		flex: 1;
		min-width: 0;
	}
	.ms-svg {
		display: block;
		width: 100%;
		height: 100%;
		cursor: grab;
		touch-action: none;
		user-select: none;
	}
	.ms-svg:active {
		cursor: grabbing;
	}
	/* Over the grid, under nothing: the SVG beneath keeps the pointer. */
	.ms-gl {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		pointer-events: none;
	}
	.ms-grid {
		fill: none;
		stroke: var(--border);
		stroke-width: 0.6;
	}
	.ms-facet {
		stroke-width: 0.6;
		stroke-linejoin: round;
	}
	.ms-facet.ghost {
		fill-opacity: 0.14;
		stroke-opacity: 0.25;
	}
	.ms-facet.ghost.back {
		fill-opacity: 0.06;
	}
	.ms-empty {
		position: absolute;
		left: 50%;
		top: 50%;
		transform: translate(-50%, -50%);
		margin: 0;
		color: var(--fg-dim);
		font-family: var(--mono);
		font-size: 0.7rem;
		pointer-events: none;
	}
	.ms-hint {
		position: absolute;
		left: 16px;
		bottom: 12px;
		color: var(--fg-muted);
		font-family: var(--mono);
		font-size: 0.58rem;
		letter-spacing: 0.08em;
		pointer-events: none;
	}

	.ms-panel {
		width: 340px;
		flex: none;
		border-left: 1px solid var(--border);
		padding: 14px;
		overflow-y: auto;
		display: flex;
		flex-direction: column;
		gap: 14px;
	}
	.ms-group {
		display: flex;
		flex-direction: column;
		gap: 6px;
	}
	.ms-group-h {
		font-family: var(--mono);
		font-size: 0.58rem;
		letter-spacing: 0.14em;
		text-transform: uppercase;
		color: var(--fg-dim);
	}
	/* The rows are Checkbox labels; stretch them so the size column right-aligns. */
	.ms-parts :global(.check) {
		display: flex;
	}
	.ms-part-btn {
		flex: 1;
		min-width: 0;
		display: grid;
		grid-template-columns: 10px 1fr auto;
		align-items: center;
		gap: 8px;
		padding: 2px 4px;
		border: 1px solid transparent;
		border-radius: var(--radius-control);
		background: none;
		color: var(--fg);
		text-align: left;
		cursor: pointer;
	}
	.ms-part-btn.sel {
		border-color: var(--accent);
	}
	.ms-swatch {
		width: 10px;
		height: 10px;
		border-radius: 2px;
	}
	.ms-name {
		font-size: 0.78rem;
	}
	.ms-size {
		font-family: var(--mono);
		font-size: 0.6rem;
		color: var(--fg-dim);
		text-align: right;
	}

	.ms-foot {
		display: flex;
		align-items: baseline;
		gap: 12px;
		padding: 10px 16px;
		border-top: 1px solid var(--border);
		flex-shrink: 0;
	}
	.ms-foot b {
		font-family: var(--mono);
		font-size: 0.72rem;
		color: var(--accent);
	}
	.ms-foot i {
		font-size: 0.72rem;
		color: var(--fg-dim);
	}
</style>
