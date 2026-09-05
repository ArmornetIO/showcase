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
	// ── When the GPU is missing or lying ────────────────────────────────────────
	// `shell-2d` draws the sphere with no GPU in its critical path, and it takes
	// the frame on every failure this component can detect: no WebGL2 at all, a
	// driver that rejects the shaders, a lost context that never comes back, and
	// the one that actually reaches users — a context that grants everything,
	// reports no error, and paints nothing.
	//
	// It replaced an SVG twin (`GlobeFrame`) that was deleted for good reasons: a
	// second DESCRIPTION of the sphere drifts from this one, and it re-serialised
	// ~1,500 coordinates into path strings every frame while doing it. The 2D
	// renderer is not a second description — it reads the same rings, the same
	// limb and the same variant paint, so the two cannot disagree.
	//
	// Detection is the other half and is worth as much: `gl-health` records which
	// renderer has the frame and why it changed hands, so a failure nobody here
	// can reproduce still arrives as a fact rather than as "the globe is missing".
	import { getContext, untrack } from 'svelte';
	import { CANVAS_CTX } from '../../primitives/canvas/canvas-camera.js';
	import type { CanvasContextValue } from '../../primitives/canvas/canvas-camera.js';
	import type { Terrain } from '../../physics/terrain.js';
	import type { Vec3 } from '../../physics/sphere.js';
	import {
		createGlContext,
		createProgram,
		createBuffer,
		createVao,
		updateBuffer,
		type GlContext,
	} from '../gl/context.js';
	import {
		SHELL_DISC_ATTRIBS,
		SHELL_DISC_FRAG,
		SHELL_DISC_VERT,
		SHELL_VARIANTS,
		SHELL_WEB_ATTRIBS,
		SHELL_WEB_FRAG,
		SHELL_WEB_VERT,
	} from '../gl/shell-shaders.js';
	import {
		buildShellDisc,
		buildShellGrid,
		buildShellWeb,
		shellLimb,
		type ShellSample,
	} from '../gl/shell-geometry.js';
	import { createGlHealth, glRenderer, type GlHealth } from '../gl/gl-health.js';
	import { drawShell2d } from './shell-2d.js';
	import { hitchWatch } from '../../perf/hitch-watch.js';

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
		variant = 'studio',
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
		/** Which globe this is. `studio` is the console's; `scenery` is the
		 *  marketing hero's — see `SHELL_VARIANTS` for what differs and why. */
		variant?: keyof typeof SHELL_VARIANTS;
		/** Escape hatch and A/B lever — false draws the same sphere with `shell-2d`
		 *  instead of the GPU. The same scene, the same props, either rasteriser,
		 *  which is what makes a "does the GL path look right" question answerable
		 *  without a broken driver to hand. */
		gl?: boolean;
	} = $props();

	const ctx = getContext<CanvasContextValue>(CANVAS_CTX);
	const transform = ctx.transform;

	let canvas = $state<HTMLCanvasElement | null>(null);
	/** Set once, when the GL path cannot be trusted to put a sphere on screen.
	 *  $state because the TEMPLATE reads it to swap the 2D renderer in — which is
	 *  safe only because the render effect below never reads it back. */
	let noGl = $state(false);
	/** Bumped by everything that invalidates the picture from OUTSIDE the
	 *  reactive graph — an element resize, a context restore. Without it a globe
	 *  that is not being spun draws exactly once, and any event that clears the
	 *  drawing buffer after that frame leaves a blank rectangle for good. */
	let redraw = $state(0);
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

	// ── Is there actually a sphere on screen? ───────────────────────────────────
	// Everything below exists because of one bug class this layer cannot see from
	// the inside: the context is created, the programs link, the uniforms take,
	// the draws issue, `getError` is clean — and the canvas composites nothing.
	// It is driver- and OS-specific (it shipped as "the globe is missing, but only
	// on Windows"), it reproduces on a machine none of us have, and no WebGL call
	// answers the question. The only way to know is to read a pixel back and look.
	//
	// The result is a metric, not just a fallback: `gl-health` keeps the granted
	// context attributes, the driver string, the frame the picture died on, and
	// prints one console line per transition. A reporter pastes `__glHealth`.
	let health: GlHealth | null = null;
	let lostTimer: ReturnType<typeof setTimeout> | undefined;
	/** What this layer asks the browser for, kept alongside what it GRANTED —
	 *  `desynchronized` in particular is a request an implementation may honour
	 *  or ignore per platform, and it changes how the canvas is presented. */
	const WANT = { antialias: true, premultipliedAlpha: true, desynchronized: false };
	/** How long the driver gets to hand a lost context back before the 2D renderer
	 *  takes over. Restoration is requested, never promised. */
	const LOST_GRACE = 3000;
	/** Wait before the first read, then check about once a second. The delay is
	 *  not politeness: the first frame is drawn before this canvas has ever been
	 *  presented, and a read can beat the paint. */
	const PROBE_DELAY = 250;
	const PROBE_EVERY = 1000;
	/** After the opening burst, a heartbeat. `readPixels` is a GPU→CPU sync — it
	 *  stalls the pipeline until the frame it is reading has actually finished —
	 *  so this cannot run per frame or the instrument becomes the jank. Three
	 *  reads at mount catch the reported failure (blank from the start); one every
	 *  ten seconds after that, ~0.02% of frames, catches a canvas that dies later
	 *  without being something anyone can feel. */
	const PROBE_IDLE = 10000;
	const PROBE_BURST = 3;
	/** Consecutive empty reads before giving up. Two, because one can be a resize
	 *  landing between the draw and the read; a second one a second later is not a
	 *  race, it is a blank canvas. */
	const BLANK_LIMIT = 2;
	let nextProbe = 0;
	let burstLeft = 0;
	let blankRun = 0;
	const pixel = new Uint8Array(4);

	/** Start (or restart) the opening burst — at mount, and after anything that
	 *  rebuilt the drawing buffer under us. */
	function armProbe(): void {
		burstLeft = PROBE_BURST;
		nextProbe = performance.now() + PROBE_DELAY;
	}

	/** Hand the frame to `shell-2d`, once. Reaching here means the canvas is — or
	 *  is about to be — empty, and a blank rectangle is worse than a sphere drawn
	 *  without the GPU that just failed to draw one. */
	function fail(reason: string): void {
		if (noGl) return;
		health?.mark('fallback', reason);
		noGl = true;
	}

	/**
	 * Read the centre pixel and record whether the sphere is there.
	 *
	 * `readPixels` stalls the pipeline, so this is throttled to roughly once a
	 * second and skipped whenever the answer would be meaningless — a transparent
	 * globe has no pixel to check, an unlaid-out canvas has nowhere to check it.
	 * It must run in the same task as the draws: with `preserveDrawingBuffer`
	 * false the buffer is only valid until the frame is composited.
	 *
	 * A false positive costs the GPU path and keeps the picture; a false negative
	 * is a blank hero. That asymmetry is the whole argument for the stall.
	 */
	function probePaint(
		g: WebGL2RenderingContext,
		cam: { tx: number; ty: number; tk: number },
		wx: number,
		wy: number,
		solid: number,
	): void {
		if (!glc || !health) return;
		const t = performance.now();
		if (t < nextProbe) return;
		nextProbe = t + (burstLeft > 0 ? PROBE_EVERY : PROBE_IDLE);
		if (burstLeft > 0) burstLeft--;
		if (solid < 0.05 || !glc.canvas.clientWidth) return;
		const scale = glc.canvas.width / Math.max(glc.cssWidth, 1);
		const x = Math.round((cam.tx + cam.tk * wx) * scale);
		// readPixels counts rows from the BOTTOM; everything else here is top-down.
		const y = glc.canvas.height - 1 - Math.round((cam.ty + cam.tk * wy) * scale);
		if (x < 0 || y < 0 || x >= glc.canvas.width || y >= glc.canvas.height) return;
		// Tagged because this is a GPU→CPU sync on a ten-second heartbeat, which is
		// exactly the shape of an occasional stutter — the tag is what lets a hitch
		// line either convict it or clear it.
		hitchWatch.mark('readPixels');
		g.readPixels(x, y, 1, 1, g.RGBA, g.UNSIGNED_BYTE, pixel);
		const painted = pixel[3] >= 2;
		health.probe(painted, painted ? undefined : `centre px (${x},${y}) came back empty`);
		blankRun = painted ? 0 : blankRun + 1;
		if (blankRun >= BLANK_LIMIT) fail(`${blankRun} empty reads — the canvas composited nothing`);
	}

	const showGl = $derived(gl && !noGl);

	/** The fallback's canvas — a different ELEMENT, not a different context on the
	 *  same one; see the note above the template. */
	let fbCanvas = $state<HTMLCanvasElement | null>(null);
	let c2d: CanvasRenderingContext2D | null = null;
	/** The handover is recorded once, not once per effect run. */
	let told2d = false;
	/** CSS size, from the observer rather than from a layout read in the frame —
	 *  the same discipline `createGlContext` follows, and for the same reason. */
	let fbW = 0;
	let fbH = 0;

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

	const paint = $derived(SHELL_VARIANTS[variant] ?? SHELL_VARIANTS.studio);

	type Rgb = [number, number, number];
	let ink = $state<Rgb>([0.5, 0.5, 0.5]);
	let body = $state<[Rgb, Rgb, Rgb]>([
		[0, 0, 0],
		[0, 0, 0],
		[0, 0, 0],
	]);

	$effect(() => {
		const el = canvas;
		const css = paint.ink ?? color;
		const stops = paint.body;
		if (!el) return;
		ink = resolveRgb(el, css);
		// Resolved here rather than taken as numbers so a variant can name
		// `var(--bg)` and follow a theme swap — the studio globe's interior is the
		// PAGE BACKGROUND, because what sells it as a body is that the canvas grid
		// stops at its edge, and a tint would recolour that grid instead of hiding
		// it.
		body = [resolveRgb(el, stops[0]), resolveRgb(el, stops[1]), resolveRgb(el, stops[2])];
	});

	/** Programs and their uniform locations. Split out of `init` because a context
	 *  restore hands back a live context whose every GL object is dead — that is a
	 *  rebuild, not a resume, and it must not create a second context. */
	function buildPrograms(g: WebGL2RenderingContext): void {
		discProg = createProgram(g, SHELL_DISC_VERT, SHELL_DISC_FRAG);
		for (const n of [
			'uCam',
			'uSize',
			'uCenter',
			'uLimb',
			'uBody0',
			'uBody1',
			'uBody2',
			'uBodyA',
			'uBodyStop',
			'uSurface',
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
	}

	function init(el: HTMLCanvasElement): boolean {
		// Premultiplied because every layer here composites "over" the one under it
		// — the veil, then the raster, then the rim, then the limb — which is what
		// the SVG's document order meant. With straight alpha the compositor
		// multiplies a second time and the graticule, at 0.03, disappears.
		glc = createGlContext(el, {
			antialias: WANT.antialias,
			premultipliedAlpha: WANT.premultipliedAlpha,
			onResize: () => {
				// A resize reallocates the drawing buffer, which is the other moment a
				// canvas has been seen to come back empty.
				armProbe();
				redraw++;
			},
			onLost: () => {
				health?.mark('lost');
				clearTimeout(lostTimer);
				lostTimer = setTimeout(() => fail('context lost and never restored'), LOST_GRACE);
			},
			onRestore: () => {
				clearTimeout(lostTimer);
				health?.mark('restored');
				armProbe();
				blankRun = 0;
				// Every program, buffer and VAO made before the loss is gone. Drop the
				// handles first — reusing one is a crash, not a glitch — then rebuild
				// and ask for a frame, because nothing else will: a globe at rest has
				// no prop change coming to trigger one.
				discBuf = webBuf = null;
				discVao = webVao = null;
				if (glc && !link(glc.gl)) return;
				redraw++;
			},
		});
		if (!glc) {
			// A record even with no context to describe: `__glHealth` is what a
			// reporter pastes back, and "there was no WebGL2" has to be one of the
			// answers it can give. Missing and broken look identical from the outside
			// and only one of them is a bug.
			health = createGlHealth('globe-shell', WANT, null, 'no webgl2 context');
			return false;
		}
		// Spread, not cast: `getContextAttributes` returns an interface with no
		// index signature, and a plain copy is what the record wants anyway.
		const granted = glc.gl.getContextAttributes();
		health = createGlHealth('globe-shell', WANT, granted && { ...granted }, glRenderer(glc.gl));
		armProbe();
		return link(glc.gl);
	}

	/** `buildPrograms`, but a compile failure ends in the SVG rather than in an
	 *  exception thrown out of an effect.
	 *
	 *  It is a real outcome, not a theoretical one: the same GLSL that links on
	 *  one driver can be rejected by another's backend, and the machine it happens
	 *  on is never the one holding the debugger. Thrown from here it would take
	 *  the whole component down with no fallback and no message. */
	function link(g: WebGL2RenderingContext): boolean {
		try {
			buildPrograms(g);
			return true;
		} catch (e) {
			// First line only: `createProgram` appends the numbered source, which is
			// what the second argument is for.
			const msg = e instanceof Error ? e.message.split('\n')[0] : String(e);
			health?.mark('fallback', msg);
			console.warn('[gl:globe-shell] shader build failed', e);
			noGl = true;
			glc?.dispose();
			glc = null;
			return false;
		}
	}

	$effect(() => {
		const el = canvas;
		if (!el) return;
		if (!glc && !init(el)) {
			noGl = true;
			return;
		}
		// A CSS resize changes nothing this effect reads, so the context's
		// `onResize` is what asks for the frame — without it the buffer keeps its
		// old size and the sphere stretches, or, on a globe nobody is spinning, is
		// never redrawn at the new size at all. The SVG this replaced re-laid-out
		// for free; a canvas has to be told.
		return () => {
			clearTimeout(lostTimer);
			// `health` deliberately survives this: the GL context is what died, and
			// the record is what explains why the 2D renderer now has the frame. It
			// is the same layer's story either way, and the fallback appends to it.
			blankRun = 0;
			burstLeft = 0;
			nextProbe = 0;
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
		const stops = body;
		const p = paint;
		// Read, not used: this is how a resize or a context restore asks for a frame
		// that no prop change would have produced.
		void redraw;
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
		g.uniform3f(discUni.uBody0 ?? null, stops[0][0], stops[0][1], stops[0][2]);
		g.uniform3f(discUni.uBody1 ?? null, stops[1][0], stops[1][1], stops[1][2]);
		g.uniform3f(discUni.uBody2 ?? null, stops[2][0], stops[2][1], stops[2][2]);
		g.uniform3f(discUni.uBodyA ?? null, p.bodyAlpha[0], p.bodyAlpha[1], p.bodyAlpha[2]);
		g.uniform1f(discUni.uBodyStop ?? null, p.bodyStop);
		g.uniform1f(discUni.uSurface ?? null, solid);
		g.uniform3f(discUni.uInk ?? null, tint[0], tint[1], tint[2]);
		g.uniform1f(discUni.uScanA ?? null, p.scan);
		g.uniform1f(discUni.uRimMid ?? null, p.rimMid);
		g.uniform1f(discUni.uRimEdge ?? null, p.rimEdge);
		g.uniform1f(discUni.uRingA ?? null, p.ringAlpha);
		g.uniform1f(discUni.uRingW ?? null, p.ringWidth);
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
			for (const pass of p.web) {
				const span = pass.back ? build.back : build.front;
				if (!span.count) continue;
				// Scaled by the zoom, because GlobeFrame's paths were inside the scaled
				// group — see the note on `SHELL_WEB_VERT`.
				const want = pass.width * cam.tk;
				// ── Never rasterise a sub-pixel quad ──────────────────────────────
				// The graticule's real weight is 0.4–0.6px. An SVG stroke that thin is
				// antialiased to partial coverage by the path rasteriser; a QUAD that
				// thin lands between MSAA sample points and disappears for most of its
				// length, which is why the first port of this drew a far fainter and
				// visibly broken grid than the SVG beside it. Widening to a pixel and
				// paying the difference back in alpha keeps the ink per unit length
				// identical — the same trade the rasteriser was making — while giving
				// the sampler something it can actually resolve.
				const w = Math.max(want, 1);
				g.uniform1f(webUni.uWidth ?? null, w);
				g.uniform1f(webUni.uAlpha ?? null, pass.alpha * (want / w));
				g.drawArrays(g.TRIANGLES, span.first, span.count);
			}
		}

		g.bindVertexArray(null);

		health?.frame([glc.cssWidth, glc.cssHeight], [glc.canvas.width, glc.canvas.height]);
		// A draw, not a spin tick: the caller writing `yaw` and Svelte flushing this
		// effect are two different events, and only this one put pixels on screen.
		hitchWatch.beat('globe-draw');
		// Same task as the draws, by necessity — see `probePaint`.
		probePaint(g, cam, opts.cx, opts.cy, solid);
	});

	// ── The fallback ────────────────────────────────────────────────────────────
	$effect(() => {
		const el = fbCanvas;
		if (!el) return;
		// Idempotent on purpose: this effect is re-entered more than once per mount,
		// and a second `getContext` on the same element must not be treated as a
		// second handover — that flooded the health record with duplicate events and
		// evicted the history that explains why the fallback engaged at all.
		if (c2d?.canvas !== el) c2d = el.getContext('2d');
		if (!c2d) {
			// The floor. A browser with neither WebGL2 nor a 2D context is not one we
			// can draw a sphere for, and saying so beats a silent empty rectangle.
			health?.mark('fallback', 'no 2d context either — nothing can draw this');
			console.warn('[gl:globe-shell] no 2d context; the globe cannot be drawn');
			return;
		}
		// A record exists by now for every route that FAILED here. This covers the
		// one that did not: `gl={false}`, where nothing went wrong and a paste
		// should still say which renderer drew the page.
		health ??= createGlHealth('globe-shell', WANT, null, gl ? 'no gl' : 'gl disabled by prop');
		if (!told2d) {
			told2d = true;
			health.mark('fallback', 'the 2d renderer has the frame');
		}
		const measure = () => {
			fbW = el.clientWidth || el.width || 1;
			fbH = el.clientHeight || el.height || 1;
			// `redraw++` READS `redraw` as well as writing it, and a read inside an
			// effect body is a subscription — so the first `measure()` below made this
			// effect its own dependency and it spun until Svelte's update-depth guard
			// killed it. Which it did, at 1000 iterations, leaving the fallback frozen
			// on whatever frame it had reached. The GL path is not exposed to this
			// only because its bumps come from callbacks that run outside the effect.
			untrack(() => redraw++);
		};
		measure();
		const ro = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure);
		ro?.observe(el);
		return () => {
			ro?.disconnect();
			c2d = null;
		};
	});

	$effect(() => {
		// Same read-everything-first discipline as the GL effect above: the drawing
		// is imperative, so nothing below would subscribe on its own.
		const cam = { tx: transform.tx, ty: transform.ty, tk: transform.tk };
		const rings = grid;
		const geom = { yaw, pitch, radius, viewDistance, cx, cy };
		const solid = surface;
		const tint = ink;
		const stops = body;
		const p = paint;
		void redraw;
		if (!c2d || !(radius > 0)) return;

		const el = c2d.canvas;
		const dpr = globalThis.devicePixelRatio || 1;
		const w = Math.max(1, Math.round(fbW * dpr));
		const h = Math.max(1, Math.round(fbH * dpr));
		// Assigning either dimension reallocates and clears the buffer even when the
		// value is unchanged, so this guard is not a micro-optimisation — writing it
		// every frame would throw the frame away.
		if (el.width !== w || el.height !== h) {
			el.width = w;
			el.height = h;
		}

		drawShell2d(c2d, rings, {
			cam,
			width: w,
			height: h,
			dpr,
			...geom,
			limb: shellLimb(geom.radius, geom.viewDistance),
			surface: solid,
			paint: p,
			ink: tint,
			body: stops,
		});
		// The same telemetry the GL path reports, so a record from a machine running
		// the fallback answers the same questions as one that never left the GPU.
		health?.frame([fbW, fbH], [w, h]);
	});
</script>

<!-- Two canvases, never one, and that is a platform rule rather than a style:
     an element keeps the first context type it is asked for FOREVER, so a canvas
     that has held a `webgl2` context answers null to `2d` for the rest of its
     life. Swapping renderers means swapping elements.

     The `{:else}` is not the SVG twin that used to live here. `GlobeFrame` was a
     second DESCRIPTION of the sphere — its own elements, its own gradient stops,
     its own stylesheet overrides on the marketing page — so it drifted, and it
     re-serialised ~1,500 coordinates into path strings every frame while doing
     it. `shell-2d` is the same description: the same rings, the same limb, the
     same variant paint, drawn with a rasteriser that has no GPU in its critical
     path. That last part is why it is worth having at all — the machines this
     engages on are the ones whose WebGL is missing, blocklisted, or lying. -->
{#if showGl}
	<canvas class="gs" bind:this={canvas} aria-hidden="true"></canvas>
{:else}
	<canvas class="gs" bind:this={fbCanvas} aria-hidden="true"></canvas>
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
