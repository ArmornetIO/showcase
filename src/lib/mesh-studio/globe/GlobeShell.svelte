<script lang="ts">
	// ── GlobeShell — the sphere itself, on the GPU ───────────────────────────────
	// A drop-in replacement for `GlobeFrame`, same props, same picture, two draw
	// calls instead of six SVG elements and ~1,500 coordinates serialised to text
	// per frame.
	//
	// What was actually expensive was never the four circles — it was the two
	// `<path d>` graticules. The rings are fixed to the globe, so a spin does not
	// change them; it changes only where they LAND, which means every frame threw
	// away a perfectly good grid, rebuilt the same 21 rings from scratch as a
	// string, and handed the browser something it had to re-parse, re-tessellate
	// and re-rasterise. The circles came along because once the graticule is on a
	// canvas, leaving the veil behind in SVG would put a DOM layer between the
	// sphere's inside and its wireframe.
	//
	// It stays a SIBLING layer inside the shared <Canvas>, exactly like
	// GlobePieces, TerritoryWalls and the caps: it READS `ctx.transform` and never
	// writes it. The moment a GL layer owns a camera of its own is the moment it
	// drifts a pixel away from the SVG drawn on top of it.
	//
	// ── The SVG is still here ───────────────────────────────────────────────────
	// `GlobeFrame` is the fallback, not dead code. WebGL2 is absent on old
	// hardware, on blocklisted drivers, and on any page that has already spent its
	// ~16 context budget — all of which are supported outcomes, because a globe
	// with no wireframe is not a globe. `gl={false}` forces that path, which is
	// also the A/B lever: the same scene, the same props, either renderer.
	import { getContext } from 'svelte';
	import { CANVAS_CTX } from '../../primitives/canvas/canvas-camera.js';
	import type { CanvasContextValue } from '../../primitives/canvas/canvas-camera.js';
	import type { Terrain } from '../../physics/terrain.js';
	import type { Vec3 } from '../../physics/sphere.js';
	import GlobeFrame from './GlobeFrame.svelte';
	import {
		createGlContext,
		createProgram,
		createBuffer,
		createVao,
		updateBuffer,
		type GlContext,
	} from '../gl/context.js';
	import {
		SHELL_DISC,
		SHELL_DISC_ATTRIBS,
		SHELL_DISC_FRAG,
		SHELL_DISC_VERT,
		SHELL_WEB_ATTRIBS,
		SHELL_WEB_FRAG,
		SHELL_WEB_PASSES,
		SHELL_WEB_VERT,
	} from '../gl/shell-shaders.js';
	import {
		buildShellDisc,
		buildShellGrid,
		buildShellWeb,
		shellLimb,
		type ShellSample,
	} from '../gl/shell-geometry.js';

	let {
		cx,
		cy,
		radius,
		yaw = 0,
		pitch = 0,
		viewDistance = 2.6,
		meridians = 12,
		parallels = 5,
		color = 'var(--accent)',
		surface = 0.72,
		terrain,
		relief = 0,
		gl = true,
	}: {
		/** Centre of the globe, in canvas coords. */
		cx: number;
		cy: number;
		/** The sphere the nodes sit on — the same radius they were placed with. */
		radius: number;
		yaw?: number;
		pitch?: number;
		/** Must match the projection the nodes use, or the web won't sit under them. */
		viewDistance?: number;
		meridians?: number;
		parallels?: number;
		/** Any CSS colour, `var(--accent)` included — resolved against the live
		 *  canvas, so a theme swap repaints without the caller converting anything. */
		color?: string;
		/** How solid the globe's interior is, 0..1. Not 1: the far side still has to
		 *  show through, or spinning the globe stops being a way to find anything. */
		surface?: number;
		/** The ground, masked to the territories — the grid rides the same terrain
		 *  the land does, or there are two surfaces instead of one. */
		terrain?: Terrain;
		/** Height of the highest ground, in globe radii. */
		relief?: number;
		/** Escape hatch and A/B lever — false draws the SVG `GlobeFrame` instead. */
		gl?: boolean;
	} = $props();

	const ctx = getContext<CanvasContextValue>(CANVAS_CTX);
	const transform = ctx.transform;

	let canvas = $state<HTMLCanvasElement | null>(null);
	/** Set once, when the context could not be created. $state because the
	 *  TEMPLATE reads it to swap the SVG in — which is safe only because the
	 *  render effect below never reads it back. */
	let noGl = $state(false);
	let glc: GlContext | null = null;
	let discProg: WebGLProgram | null = null;
	let webProg: WebGLProgram | null = null;
	let discBuf: WebGLBuffer | null = null;
	let discVao: WebGLVertexArrayObject | null = null;
	let webBuf: WebGLBuffer | null = null;
	let webVao: WebGLVertexArrayObject | null = null;
	let discUni: Record<string, WebGLUniformLocation | null> = {};
	let webUni: Record<string, WebGLUniformLocation | null> = {};
	/** Reused across frames — see `buildShellWeb`. */
	let scratch: Float32Array | undefined;
	let discScratch: Float32Array | undefined;

	const showGl = $derived(gl && !noGl);

	/** The rings, sampled once per density change rather than once per frame.
	 *  A ring is fixed to the globe; a spin moves where it lands, not what it is. */
	const grid = $derived.by((): ShellSample[][] =>
		buildShellGrid(
			meridians,
			parallels,
			terrain && relief ? (p: Vec3) => terrain.heightAt(p) * relief : undefined,
		),
	);

	/**
	 * Resolve any CSS colour — `var(--accent)`, a keyword, a hex — to RGB floats.
	 *
	 * Done by asking the browser rather than by parsing, because the alternative
	 * is a colour parser that has to keep up with `color-mix`, `oklch` and
	 * whatever the theme adopts next. Setting the property on the CANVAS ITSELF is
	 * what makes custom properties work: a var resolves against the element it is
	 * read on, so a detached probe would see nothing, and in Firefox
	 * `getComputedStyle` on a detached node returns empty anyway.
	 *
	 * It forces a style recalc, so it is called on mount and on a colour change —
	 * never inside a frame.
	 */
	function resolveRgb(el: HTMLElement, css: string): [number, number, number] {
		const prev = el.style.color;
		el.style.color = '';
		el.style.color = css;
		const out = getComputedStyle(el).color;
		el.style.color = prev;
		const m = out.match(/-?[\d.]+/g);
		if (!m || m.length < 3) return [0.5, 0.5, 0.5];
		return [+m[0] / 255, +m[1] / 255, +m[2] / 255];
	}

	let ink = $state<[number, number, number]>([0.5, 0.5, 0.5]);
	let veil = $state<[number, number, number]>([0, 0, 0]);

	$effect(() => {
		const el = canvas;
		const css = color;
		if (!el) return;
		ink = resolveRgb(el, css);
		// The interior is filled with the PAGE BACKGROUND rather than tinted with
		// the accent. What sells the globe as a body is that the canvas grid stops
		// at its edge — an object you cannot see the floor through — and a tint
		// recolours that grid instead of hiding it.
		veil = resolveRgb(el, 'var(--bg)');
	});

	function init(el: HTMLCanvasElement): boolean {
		// Premultiplied because every layer here composites "over" the one under it
		// — the veil, then the raster, then the rim, then the limb — which is what
		// the SVG's document order meant. With straight alpha the compositor
		// multiplies a second time and the graticule, at 0.03, disappears.
		glc = createGlContext(el, { antialias: true, premultipliedAlpha: true });
		if (!glc) return false;
		const g = glc.gl;
		discProg = createProgram(g, SHELL_DISC_VERT, SHELL_DISC_FRAG);
		for (const n of [
			'uCam',
			'uSize',
			'uCenter',
			'uLimb',
			'uVeil',
			'uVeilA',
			'uInk',
			'uScanA',
			'uRimMid',
			'uRimEdge',
			'uRingA',
			'uRingW',
		])
			discUni[n] = g.getUniformLocation(discProg, n);
		webProg = createProgram(g, SHELL_WEB_VERT, SHELL_WEB_FRAG);
		for (const n of ['uCam', 'uSize', 'uWidth', 'uInk', 'uAlpha'])
			webUni[n] = g.getUniformLocation(webProg, n);
		return true;
	}

	$effect(() => {
		const el = canvas;
		if (!el) return;
		if (!glc && !init(el)) {
			noGl = true;
			return;
		}
		return () => {
			// Browsers cap live WebGL contexts per page (~16), so a studio that mounts
			// and unmounts globes would eventually start getting `null` back from
			// `createGlContext` if these were left to the collector.
			glc?.dispose();
			glc = null;
			discProg = webProg = null;
			discBuf = webBuf = null;
			discVao = webVao = null;
			discUni = {};
			webUni = {};
		};
	});

	$effect(() => {
		// Read every dependency up front so Svelte subscribes to all of them — an
		// effect only tracks what it touches while it runs, and the imperative work
		// below would otherwise register almost none of it.
		const cam = { tx: transform.tx, ty: transform.ty, tk: transform.tk };
		const rings = grid;
		const opts = { yaw, pitch, radius, viewDistance, cx, cy };
		const solid = surface;
		const tint = ink;
		const bg = veil;
		if (!glc || glc.lost || !discProg || !webProg) return;
		if (!(radius > 0)) return;

		const g = glc.gl;
		glc.resize();
		g.clearColor(0, 0, 0, 0);
		g.clear(g.COLOR_BUFFER_BIT);
		g.disable(g.CULL_FACE);
		g.enable(g.BLEND);
		// Premultiplied "over" — see the compositing note in `shell-shaders`.
		g.blendFunc(g.ONE, g.ONE_MINUS_SRC_ALPHA);

		const limb = shellLimb(opts.radius, opts.viewDistance);

		// ── The disc: veil, scanlines, rim, limb ────────────────────────────────
		const disc = buildShellDisc(opts.cx, opts.cy, limb, discScratch);
		discScratch = disc;
		if (!discBuf) {
			discBuf = createBuffer(g, disc, g.DYNAMIC_DRAW);
			discVao = createVao(g, discProg, [{ buffer: discBuf, attribs: SHELL_DISC_ATTRIBS }]);
		} else {
			updateBuffer(g, discBuf, disc);
		}
		g.useProgram(discProg);
		g.bindVertexArray(discVao);
		g.uniform3f(discUni.uCam ?? null, cam.tx, cam.ty, cam.tk);
		g.uniform2f(discUni.uSize ?? null, glc.cssWidth, glc.cssHeight);
		g.uniform2f(discUni.uCenter ?? null, opts.cx, opts.cy);
		g.uniform1f(discUni.uLimb ?? null, limb);
		g.uniform3f(discUni.uVeil ?? null, bg[0], bg[1], bg[2]);
		g.uniform1f(discUni.uVeilA ?? null, solid);
		g.uniform3f(discUni.uInk ?? null, tint[0], tint[1], tint[2]);
		g.uniform1f(discUni.uScanA ?? null, SHELL_DISC.scan);
		g.uniform1f(discUni.uRimMid ?? null, SHELL_DISC.rimMid);
		g.uniform1f(discUni.uRimEdge ?? null, SHELL_DISC.rimEdge);
		g.uniform1f(discUni.uRingA ?? null, SHELL_DISC.ringAlpha);
		g.uniform1f(discUni.uRingW ?? null, SHELL_DISC.ringWidth);
		g.drawArrays(g.TRIANGLES, 0, 6);

		// ── The graticule ───────────────────────────────────────────────────────
		const build = buildShellWeb(rings, opts, scratch);
		scratch = build.data;
		if (build.vertices) {
			if (!webBuf) {
				webBuf = createBuffer(g, build.data, g.DYNAMIC_DRAW);
				webVao = createVao(g, webProg, [{ buffer: webBuf, attribs: SHELL_WEB_ATTRIBS }]);
			} else {
				updateBuffer(g, webBuf, build.data);
			}
			g.useProgram(webProg);
			g.bindVertexArray(webVao);
			g.uniform3f(webUni.uCam ?? null, cam.tx, cam.ty, cam.tk);
			g.uniform2f(webUni.uSize ?? null, glc.cssWidth, glc.cssHeight);
			g.uniform3f(webUni.uInk ?? null, tint[0], tint[1], tint[2]);
			for (const pass of SHELL_WEB_PASSES) {
				const span = pass.back ? build.back : build.front;
				if (!span.count) continue;
				// Scaled by the zoom, because GlobeFrame's paths were inside the scaled
				// group — see the note on `SHELL_WEB_VERT`.
				g.uniform1f(webUni.uWidth ?? null, pass.width * cam.tk);
				g.uniform1f(webUni.uAlpha ?? null, pass.alpha);
				g.drawArrays(g.TRIANGLES, span.first, span.count);
			}
		}

		g.bindVertexArray(null);
	});
</script>

{#if showGl}
	<canvas class="gs" bind:this={canvas} aria-hidden="true"></canvas>
{:else}
	<GlobeFrame
		{cx}
		{cy}
		{radius}
		{yaw}
		{pitch}
		{viewDistance}
		{meridians}
		{parallels}
		{color}
		{surface}
		{terrain}
		{relief}
	/>
{/if}

<style>
	.gs {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		/* Chrome, not a target — every click belongs to the canvas under it. */
		pointer-events: none;
	}
</style>
