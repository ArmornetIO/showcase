<script lang="ts">
	// A 3D page's left bar: the Builder's component palette, listing what can be
	// put in a scene (`scene3d.SUBJECTS`) instead of 2D components. Drag a card
	// onto the stage to place it; double-click (or Enter) opens it on its own,
	// in the subject's studio — a model's parts, a building's squint test, a
	// character's poses — the way Icon Studio shows one glyph.
	import ComponentPalette from './ComponentPalette.svelte';
	import PieceCrest from '../mesh-studio/pieces/PieceCrest.svelte';
	import Figure from '../character/Figure.svelte';
	import { CHARACTERS } from '../character/characters.js';
	import { MODELS } from '../model-studio/models.js';
	import { pieceFacets, pieceProjector, studioFrame } from '../mesh-studio/pieces/piece-facets.js';
	import { modelFacets } from '../model-studio/model-geometry.js';
	import { cssRgb } from '../model-studio/model-gl.js';
	import { mapSubjects, parseSubject, SUBJECT_KEY, SUBJECTS, subjectProp } from './scene3d.js';

	let { onopen }: { onopen: (id: string) => void } = $props();

	// Map props after the built-ins, under each map's name. Read once: the maps
	// are handed to the Builder before this mounts.
	const items = [...SUBJECTS, ...mapSubjects()];

	/** A model or map prop at the studio's iso bearing, fitted to its card and
	 *  painted ONCE into a canvas: the founders set is 30k facets, which as live
	 *  SVG paths cost every frame of the page around them. */
	function paintSolids(canvas: HTMLCanvasElement, subject: string) {
		const ctx = canvas.getContext('2d');
		const s = parseSubject(subject);
		if (!ctx || !s) return;
		const frame = studioFrame(-0.62, 0.7, 1);
		const at = pieceProjector(frame);
		const m = s.kind === 'model' ? MODELS.find((x) => x.id === s.key) : undefined;
		const prop = s.kind === 'map' ? subjectProp(subject)?.prop : undefined;
		const facets = m
			? modelFacets(m.build({ exploded: false }, m.knobs ?? []), frame)
			: prop
				? pieceFacets(prop.solids, frame).map((f) => ({ ...f, color: 'var(--fg-dim)' }))
				: [];
		const pts = facets.flatMap((f) => f.verts.map(at));
		if (!pts.length) return;
		const xs = pts.map((p) => p.x);
		const ys = pts.map((p) => p.y);
		const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
		const dpr = devicePixelRatio || 1;
		const { width: w, height: h } = canvas.getBoundingClientRect();
		canvas.width = w * dpr;
		canvas.height = h * dpr;
		const k = Math.min(w / (x1 - x0), h / (y1 - y0)) * 0.9 * dpr || 1;
		ctx.setTransform(k, 0, 0, k, (w * dpr) / 2 - ((x0 + x1) / 2) * k, (h * dpr) / 2 - ((y0 + y1) / 2) * k);
		const rgb = new Map<string, number[]>();
		const bg = cssRgb('var(--bg)', canvas);
		for (const f of facets) {
			const c = rgb.get(f.color) ?? rgb.set(f.color, cssRgb(f.color, canvas)).get(f.color)!;
			const t = 0.25 + f.shade * 0.7;
			ctx.fillStyle = `rgb(${c.map((v, i) => Math.round((bg[i] + (v - bg[i]) * t) * 255)).join(' ')})`;
			ctx.fill(new Path2D(f.d));
		}
	}
</script>

<ComponentPalette
	{items}
	onAdd={onopen}
	addHint="open it on its own"
	dragKey={SUBJECT_KEY}
	noun="SUBJECTS"
	placeholder="Search models, buildings…"
>
	{#snippet thumb(id)}
		{@const s = parseSubject(id)}
		<div class="sp-thumb">
			{#if s?.kind === 'piece'}
				<PieceCrest piece={s.key} color="var(--accent)" size={46} />
			{:else if s?.kind === 'character'}
				{@const c = CHARACTERS.find((x) => x.key === s.key)}
				{#if c}<div class="sp-figure"><Figure klass={c} crop="hero" /></div>{/if}
			{:else if s}
				<canvas class="sp-model" use:paintSolids={id} aria-hidden="true"></canvas>
			{/if}
		</div>
	{/snippet}
</ComponentPalette>

<style>
	.sp-thumb {
		width: 100%;
		height: 100%;
		display: grid;
		place-items: center;
	}
	.sp-figure,
	.sp-model {
		width: 100%;
		height: 100%;
	}
</style>
