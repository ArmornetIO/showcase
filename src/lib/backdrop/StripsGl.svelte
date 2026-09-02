<script lang="ts">
	// ── StripsGl — the belts, on the GPU ─────────────────────────────────────────
	// Everything in a Möbius strip that MOVES, in one WebGL2 layer.
	//
	// What it replaces, per strip: ~37 rim chunks running `belt-run`, ~37 more
	// running `energy-run`, a rung per slat running `slat-pass`, and a traveller
	// per lane carrying a `drop-shadow`. `stroke-dashoffset` and `stroke-width`
	// are not compositable properties, so every one of those keyframe frames was a
	// full main-thread repaint of a large stroked path — across the whole viewport,
	// forever, behind content someone is trying to read. The saving grace is that
	// the GEOMETRY never moved: `mobiusLayout` does not take a clock. So all of it
	// is phase, and phase is a uniform.
	//
	// ONE context for the whole backdrop, not one per strip: browsers cap live
	// WebGL contexts per page at around sixteen, and a stack of backdrops plus the
	// mesh's own two layers would walk straight into it.
	//
	// The band's BODY stays in the DOM. It is static geometry, so it costs nothing
	// per frame, and leaving it there keeps the per-strip CSS treatments — the
	// SvgFx chain, the defocus, the ghost's hue shift — applying to it for free
	// rather than needing four more shader paths to avoid a regression.
	import {
		createGlContext,
		createProgram,
		createBuffer,
		createVao,
		updateBuffer,
		type GlContext
	} from '../mesh-studio/gl/context.js';
	import { EDGE_STYLE_DASH } from '../primitives/canvas/canvas.types.js';
	import type { EdgeStyle } from '../primitives/canvas/canvas.types.js';
	import type { MobiusLayout } from './mobius.js';
	import type { StripSpec } from './strips.js';
	import {
		buildStripGeometry,
		trailPoint,
		STROKE_ATTRIBS,
		STROKE_FLOATS,
		type StripGeometry
	} from './gl/strip-geometry.js';
	import {
		fadeAt,
		fadeParams,
		stripBox,
		viewBoxOf,
		type Camera
	} from './gl/strip-placement.js';
	import { parseCssColor, rotateHue, type Rgba } from './gl/strip-colors.js';
	import {
		SPARK_ATTRIBS,
		SPARK_FLOATS,
		SPARK_FRAG,
		SPARK_VERT,
		STRIP_FRAG,
		STRIP_VERT,
		STROKE_MODE
	} from './gl/strip-shaders.js';

	interface Props {
		/** One entry per spec, carrying the layout that spec built. */
		strips: { spec: StripSpec; index: number; layout: MobiusLayout }[];
		/** Rainbow mode — the hue sweeps along the chain instead of per strip. */
		flowing?: boolean;
		/** The chain-wide energy clock, seconds. One value for every strip, or the
		 *  pulse stops crossing between them and becomes six blinkers. */
		energyPeriod?: number;
		/** The Canvas camera, when the backdrop is inside one. Read per frame and
		 *  never written — a GL layer that owns a camera drifts off the SVG drawn
		 *  beside it. */
		camera?: Camera | null;
		/** Saturated stand-in for rainbow mode; `hue-rotate` cannot invent
		 *  saturation out of the ground's near-grey. */
		rainbowBase?: string;
	}

	let {
		strips,
		flowing = false,
		energyPeriod = 9.6,
		camera = null,
		rainbowBase = 'hsl(170 85% 60%)'
	}: Props = $props();

	let canvasEl = $state<HTMLCanvasElement | null>(null);
	/** Deliberately NOT `$state` — see EdgeParticles. It is written from inside the
	 *  mount effect, and a reactive read there re-runs that effect, whose cleanup
	 *  disposes the context by LOSING it. That left a mounted layer holding a dead
	 *  context: a "WebGL context lost" on every page load, and a blank canvas. */
	let failed = false;
	/** Viewport width, because `size` is authored in `vw` and a shader cannot
	 *  resolve a CSS unit. */
	let vw = $state(typeof window === 'undefined' ? 1440 : window.innerWidth);
	let reduced = $state(false);
	let palette = $state<Palette>(FALLBACK_PALETTE());

	let glc: GlContext | null = null;
	let strokeProg: WebGLProgram | null = null;
	let sparkProg: WebGLProgram | null = null;
	let strokeLoc: Record<string, WebGLUniformLocation | null> = {};
	let sparkLoc: Record<string, WebGLUniformLocation | null> = {};
	let sparkBuf: WebGLBuffer | null = null;
	let sparkVao: WebGLVertexArrayObject | null = null;
	let sparks = new Float32Array(0);

	/** Built geometry, keyed by the layout it came from. `built` in the parent is
	 *  `$derived`, so a new array arrives whenever a spec changes — but the LAYOUT
	 *  objects inside it are reused unless the geometry genuinely changed, which
	 *  is what makes identity the right cache key here. */
	const packs = new Map<
		MobiusLayout,
		{ geom: StripGeometry; buf: WebGLBuffer; vao: WebGLVertexArrayObject }
	>();

	interface Palette {
		strip: Rgba;
		traveller: Rgba;
		rainbow: Rgba;
		/** Seconds for one full hue sweep along the chain. */
		rainbowSpeed: number;
	}

	function FALLBACK_PALETTE(): Palette {
		return {
			strip: [0.59, 0.7, 0.67, 0.5],
			traveller: [0.37, 0.92, 0.83, 1],
			rainbow: [0.28, 0.94, 0.79, 1],
			rainbowSpeed: 18
		};
	}

	/** Per-strip ink, resolved once per palette change rather than per frame —
	 *  only the hue ROTATION is per frame, and that is four multiplies. */
	const inks = $derived(
		strips.map(({ spec }) => ({
			line: flowing ? palette.rainbow : palette.strip,
			energy: flowing ? palette.rainbow : parseCssColor(spec.energyColor, palette.traveller),
			glow: parseCssColor(flowing ? rainbowBase : spec.fxColor, palette.traveller),
			traveller: flowing ? palette.rainbow : palette.traveller
		}))
	);

	/** Mark and full cycle, in pixels. `encrypted` and `pulse` have no entry in
	 *  EDGE_STYLE_DASH on purpose and fall through to a continuous stroke, which
	 *  is the table's silence honoured rather than papered over. */
	function energyDash(style: EdgeStyle | 'none'): [number, number] {
		const raw = style === 'none' ? '' : (EDGE_STYLE_DASH[style] ?? '');
		const parts = raw.split(/\s+/).map(Number).filter(Number.isFinite);
		return parts.length < 2 ? [0, 1] : [parts[0], parts[0] + parts[1]];
	}

	function init(el: HTMLCanvasElement): boolean {
		// `premultipliedAlpha` is the one attribute that must be right: these are
		// ordered translucent passes accumulating into a transparent buffer, and
		// with straight alpha the compositor multiplies a second time — a 6% mark
		// lands near 0.4% and disappears.
		glc = createGlContext(el, { antialias: true, premultipliedAlpha: true });
		if (!glc) return false;
		const gl = glc.gl;
		strokeProg = createProgram(gl, STRIP_VERT, STRIP_FRAG);
		sparkProg = createProgram(gl, SPARK_VERT, SPARK_FRAG);
		// prettier-ignore
		strokeLoc = locations(gl, strokeProg, [
			'uSize', 'uVbMin', 'uVbSize', 'uScale', 'uRot', 'uTrans', 'uOffset',
			'uMode', 'uTime', 'uBelt', 'uDelay', 'uEnergy', 'uPhase', 'uOpacity',
			'uSoft', 'uGlow', 'uGlowInk', 'uFade', 'uBox', 'uDash', 'uColor'
		]);
		sparkLoc = locations(gl, sparkProg, ['uSize', 'uDpr']);
		sparkBuf = createBuffer(gl, new Float32Array(0), gl.DYNAMIC_DRAW);
		sparkVao = createVao(gl, sparkProg, [{ buffer: sparkBuf, attribs: SPARK_ATTRIBS }]);
		return true;
	}

	function locations(
		gl: WebGL2RenderingContext,
		prog: WebGLProgram,
		names: string[]
	): Record<string, WebGLUniformLocation | null> {
		const out: Record<string, WebGLUniformLocation | null> = {};
		for (const n of names) out[n] = gl.getUniformLocation(prog, n);
		return out;
	}

	$effect(() => {
		const el = canvasEl;
		if (!el) return;
		if (!glc && !failed && !init(el)) {
			failed = true;
			return;
		}
		return () => {
			// Freeing the context on unmount rather than at GC is what keeps a page
			// that mounts and unmounts backdrops from exhausting the per-page cap and
			// getting `null` back the next time.
			glc?.dispose();
			glc = null;
			strokeProg = sparkProg = null;
			sparkBuf = null;
			sparkVao = null;
			packs.clear();
		};
	});

	// Geometry is uploaded ONCE per layout. Separated from the draw effect below
	// because the draw runs at frame rate and this must not.
	$effect(() => {
		const list = strips;
		if (!glc || glc.lost || !strokeProg) return;
		const gl = glc.gl;
		const live = new Set<MobiusLayout>();
		for (const { spec, layout } of list) {
			live.add(layout);
			if (packs.has(layout)) continue;
			const geom = buildStripGeometry(layout, spec.traffic);
			const buf = createBuffer(gl, geom.data);
			packs.set(layout, {
				geom,
				buf,
				vao: createVao(gl, strokeProg, [{ buffer: buf, attribs: STROKE_ATTRIBS }])
			});
		}
		for (const [layout, pack] of packs) {
			if (live.has(layout)) continue;
			gl.deleteBuffer(pack.buf);
			gl.deleteVertexArray(pack.vao);
			packs.delete(layout);
		}
	});

	$effect(() => {
		const el = canvasEl;
		if (!el) return;
		const onResize = () => (vw = window.innerWidth);
		window.addEventListener('resize', onResize);

		// Motion is the first thing to go; the geometry is the design. In GL that
		// means freezing the clock, not unmounting — the strips still have to be
		// there, they just stop running.
		const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
		reduced = motion.matches;
		const onMotion = () => (reduced = motion.matches);
		motion.addEventListener('change', onMotion);

		// The palette is CSS, so a theme switch is an attribute change on the root
		// rather than anything this component is told about. Watching for it beats
		// re-reading computed style every frame, which would put the style recalc
		// this port exists to remove straight back into the frame.
		const readAll = () => (palette = readPalette(el));
		readAll();
		const watch = new MutationObserver(readAll);
		watch.observe(document.documentElement, {
			attributes: true,
			attributeFilter: ['class', 'style', 'data-theme']
		});

		return () => {
			window.removeEventListener('resize', onResize);
			motion.removeEventListener('change', onMotion);
			watch.disconnect();
		};
	});

	/** Re-read whenever the wrapper's own tokens change — a preset carries its
	 *  palette on this component's ancestor, not on `:root`. */
	$effect(() => {
		void strips;
		void flowing;
		if (canvasEl) palette = readPalette(canvasEl);
	});

	function readPalette(el: HTMLElement): Palette {
		const cs = getComputedStyle(el);
		const token = (name: string) => cs.getPropertyValue(name).trim();
		const fb = FALLBACK_PALETTE();
		const line = parseCssColor(token('--backdrop-line'), fb.strip);
		const traveller = parseCssColor(
			token('--backdrop-traveller') || token('--accent'),
			fb.traveller
		);
		const speed = parseFloat(token('--rainbow-speed'));
		return {
			strip: parseCssColor(token('--backdrop-strip'), line),
			traveller,
			rainbow: parseCssColor(token('--backdrop-rainbow-base'), parseCssColor(rainbowBase, fb.rainbow)),
			rainbowSpeed: Number.isFinite(speed) && speed > 0 ? speed : fb.rainbowSpeed
		};
	}

	$effect(() => {
		// Read the gates up front so Svelte subscribes to them, and deliberately NOT
		// the camera: subscribing to the transform would tear down and restart the
		// loop on every pointer move of a pan, and the frame reads the same numbers
		// a moment later anyway.
		const el = canvasEl;
		void failed;
		void strips;
		void inks;
		void reduced;
		void vw;
		if (!el || !glc || glc.lost || !strokeProg || !sparkProg) return;

		let frame = 0;
		let origin = 0;
		/** Reduced motion draws once and then only when the view moves, so the
		 *  opt-out is an idle loop rather than a frozen animation. */
		let stale = true;
		let lastKey = '';

		const draw = (ts: number) => {
			frame = requestAnimationFrame(draw);
			if (!glc || glc.lost || !strokeProg || !sparkProg) return;
			if (!origin) origin = ts;
			// Not `performance.now()` directly: a clock that starts at page load puts
			// every belt at an arbitrary phase on mount, and at float32 precision a
			// tab left open for a day quantises the dash flow visibly.
			const time = reduced ? 0 : (ts - origin) / 1000;

			const dpr = globalThis.devicePixelRatio || 1;
			const resized = glc.resize(dpr);
			const key = `${camera?.tx ?? 0}|${camera?.ty ?? 0}|${camera?.tk ?? 1}`;
			if (reduced && !resized && !stale && key === lastKey) return;
			stale = false;
			lastKey = key;

			render(glc, time, dpr);
		};

		frame = requestAnimationFrame(draw);
		return () => cancelAnimationFrame(frame);
	});

	function render(ctx: GlContext, time: number, dpr: number): void {
		const gl = ctx.gl;
		gl.clearColor(0, 0, 0, 0);
		gl.clear(gl.COLOR_BUFFER_BIT);
		gl.disable(gl.DEPTH_TEST);
		gl.enable(gl.BLEND);

		const frame = { w: ctx.cssWidth, h: ctx.cssHeight };
		const total = Math.max(1, strips.length);
		let sparkCount = 0;
		let riders = 0;
		for (const { spec } of strips) riders += Math.max(0, spec.traffic) * (spec.ghost ? 2 : 1);
		if (sparks.length < riders * SPARK_FLOATS) {
			sparks = new Float32Array(riders * SPARK_FLOATS);
		}

		gl.useProgram(strokeProg);
		gl.uniform2f(strokeLoc.uSize, frame.w, frame.h);
		// Premultiplied `over` for every pass — the shader emits `rgb·a`, so this is
		// the ordinary source-over composite and not an approximation of one.
		gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

		for (const { spec, index, layout } of strips) {
			const pack = packs.get(layout);
			if (!pack) continue;
			const vb = viewBoxOf(layout);
			const box = stripBox(spec, frame, vw, camera);
			if (box.w <= 0 || vb.w <= 0) continue;
			const scale = box.w / vb.w;
			const boxH = box.w * (vb.h / vb.w);
			const fade = fadeParams(spec, box.w, boxH);
			const spin = (spec.spin * Math.PI) / 180;
			const ink = inks[index] ?? inks[0];
			// One continuous sweep travelling down the chain, not six strips each
			// cycling on their own: the strip's place in the order is a phase offset
			// into ONE cycle.
			const hue = flowing ? 360 * ((time / palette.rainbowSpeed + index / total) % 1) : 0;

			// The ghost pass first, so the base pass sits on top of it — the way a key
			// plate does over a misaligned colour plate.
			const passes = spec.ghost ? [spec.ghost, null] : [null];
			for (const ghost of passes) {
				const opacity = spec.opacity * (ghost ? ghost.opacity : 1);
				const spun = hue + (ghost ? ghost.hue : 0);

				gl.uniform2f(strokeLoc.uVbMin, vb.x, vb.y);
				gl.uniform2f(strokeLoc.uVbSize, vb.w, vb.h);
				gl.uniform1f(strokeLoc.uScale, scale);
				gl.uniform2f(strokeLoc.uRot, Math.cos(spin), Math.sin(spin));
				gl.uniform2f(strokeLoc.uTrans, box.cx, box.cy);
				gl.uniform2f(strokeLoc.uOffset, ghost?.dx ?? 0, ghost?.dy ?? 0);
				gl.uniform1f(strokeLoc.uTime, time);
				gl.uniform1f(strokeLoc.uBelt, Math.max(0.05, spec.belt));
				gl.uniform1f(strokeLoc.uDelay, spec.delay);
				gl.uniform2f(strokeLoc.uEnergy, Math.max(0.05, energyPeriod), 16);
				gl.uniform2f(strokeLoc.uPhase, index / total, 1 / total);
				gl.uniform1f(strokeLoc.uOpacity, opacity);
				gl.uniform1f(strokeLoc.uSoft, spec.blur);
				gl.uniform1f(strokeLoc.uGlow, Math.max(0.5, spec.fxSize));
				gl.uniform1f(strokeLoc.uGlowInk, spec.fxStrength * 0.3);
				gl.uniform4f(strokeLoc.uFade, fade.amount, fade.dx, fade.dy, fade.invLen);
				gl.uniform2f(strokeLoc.uBox, box.w, boxH);

				gl.bindVertexArray(pack.vao);

				// The bloom SvgFx bled off the source alpha, merged UNDERNEATH the art.
				// Composited OVER rather than added, because that is what the merge did:
				// an additive halo accumulates without bound where a large strip crosses
				// itself, and blows a coloured glow out to white. Only `glow` is
				// reproduced; the lit effects still treat the band's body, which stayed
				// in the DOM.
				if (spec.fx === 'glow' && pack.geom.edgeCount) {
					stroke(gl, STROKE_MODE.bloom, [0, 1], rotateHue(ink.glow, spun));
					gl.drawArrays(gl.TRIANGLES, pack.geom.edgeFirst, pack.geom.edgeCount);
				}

				const line = rotateHue(ink.line, spun);
				if (pack.geom.rungCount) {
					stroke(gl, STROKE_MODE.rung, [0, 1], line);
					gl.drawArrays(gl.TRIANGLES, pack.geom.rungFirst, pack.geom.rungCount);
				}
				if (pack.geom.edgeCount) {
					stroke(gl, STROKE_MODE.belt, [7, 12], line);
					gl.drawArrays(gl.TRIANGLES, pack.geom.edgeFirst, pack.geom.edgeCount);

					if (spec.energy !== 'none') {
						stroke(gl, STROKE_MODE.energy, energyDash(spec.energy), rotateHue(ink.energy, spun));
						gl.drawArrays(gl.TRIANGLES, pack.geom.edgeFirst, pack.geom.edgeCount);
					}
				}

				sparkCount = packSparks(
					sparkCount,
					pack.geom,
					spec,
					{ vb, box, boxH, scale, spin, fade },
					ghost,
					rotateHue(ink.traveller, spun),
					opacity,
					time
				);
			}
		}
		gl.bindVertexArray(null);

		if (!sparkCount || !sparkBuf || !sparkVao) return;
		gl.useProgram(sparkProg);
		gl.uniform2f(sparkLoc.uSize, frame.w, frame.h);
		gl.uniform1f(sparkLoc.uDpr, dpr);
		gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
		updateBuffer(gl, sparkBuf, sparks.subarray(0, sparkCount * SPARK_FLOATS));
		gl.bindVertexArray(sparkVao);
		gl.drawArrays(gl.POINTS, 0, sparkCount);
		gl.bindVertexArray(null);
	}

	function stroke(
		gl: WebGL2RenderingContext,
		mode: number,
		dash: [number, number],
		color: Rgba
	): void {
		gl.uniform1i(strokeLoc.uMode, mode);
		gl.uniform2f(strokeLoc.uDash, dash[0], dash[1]);
		gl.uniform4f(strokeLoc.uColor, color[0], color[1], color[2], color[3]);
	}

	/** Place this strip's riders, in CSS pixels.
	 *
	 *  On the CPU, and that is not a concession: there are two per strip, each
	 *  looping ONE chunk of the rim, so the whole thing is a handful of lerps —
	 *  cheaper than the per-vertex geometry a GPU-side path evaluation would need,
	 *  and it keeps them in a single batched draw. */
	function packSparks(
		at: number,
		geom: StripGeometry,
		spec: StripSpec,
		place: {
			vb: { x: number; y: number; w: number; h: number };
			box: { cx: number; cy: number; w: number };
			boxH: number;
			scale: number;
			spin: number;
			fade: ReturnType<typeof fadeParams>;
		},
		ghost: StripSpec['ghost'] | null,
		color: Rgba,
		opacity: number,
		time: number
	): number {
		const { vb, box, boxH, scale, spin, fade } = place;
		const cos = Math.cos(spin);
		const sin = Math.sin(spin);
		const cx = vb.x + vb.w / 2;
		const cy = vb.y + vb.h / 2;
		const core = Math.max(0.6, 4 * scale);

		for (let i = 0; i < geom.trails.length; i++) {
			if ((at + 1) * SPARK_FLOATS > sparks.length) break;
			// `animation-delay: calc(var(--delay) - {i * 3}s)` — lanes offset so the
			// riders are strung out along the rim rather than stacked.
			const t = (time - spec.delay + i * 3) / Math.max(0.05, spec.period);
			const p = trailPoint(geom.trails[i], t);
			const lx = p.x - cx;
			const ly = p.y - cy;
			const alpha =
				color[3] *
				opacity *
				fadeAt(fade, ((p.x - vb.x) / vb.w) * box.w, ((p.y - vb.y) / vb.h) * boxH, box.w, boxH);
			if (alpha <= 0.002) continue;

			let o = at * SPARK_FLOATS;
			sparks[o++] = (lx * cos - ly * sin) * scale + box.cx + (ghost?.dx ?? 0);
			sparks[o++] = (lx * sin + ly * cos) * scale + box.cy + (ghost?.dy ?? 0);
			sparks[o++] = core * 4;
			sparks[o++] = core;
			sparks[o++] = color[0];
			sparks[o++] = color[1];
			sparks[o++] = color[2];
			sparks[o++] = alpha;
			at++;
		}
		return at;
	}
</script>

<canvas class="strips-gl" bind:this={canvasEl} aria-hidden="true"></canvas>

<style>
	.strips-gl {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		/* Chrome, not an input surface. The only clickable thing in the backdrop is
		   the strip tag, which stays in the DOM. */
		pointer-events: none;
	}
</style>
