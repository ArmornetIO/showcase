<script lang="ts">
	// ── TerritoryWalls — the ramparts, on the GPU ────────────────────────────────
	// Replaces the four SVG paths per territory that `TerritoryCaps` used to draw
	// for a raised wall. Those paths were cheap as DOM — four elements — but not as
	// work: `shown` re-derives on every yaw change, so each frame rebuilt a `d`
	// string of ~72 samples for the pane, the footing, the posts and the crest, in
	// every region, and handed the browser a fresh path to re-parse, re-tessellate
	// and re-rasterise. Here the same picture is one buffer upload and four draws.
	//
	// It stays a SIBLING layer inside the shared <Canvas>, exactly like GlobeFrame,
	// GlobePieces and the caps themselves: it READS `ctx.transform` and never
	// writes it. The moment a GL layer owns a camera of its own is the moment it
	// drifts a pixel away from the SVG drawn on top of it.
	//
	// The two behaviours the SVG wall was built around are unchanged and live
	// upstream, in TerritoryCaps: only front-facing rim runs are ever passed in
	// (`rimRuns`), and `face` fades a cap out as it turns toward the limb. Neither
	// is a rasterizer workaround, so neither moved.
	import { getContext } from 'svelte';
	import { CANVAS_CTX, type CanvasContextValue } from '../../primitives/canvas/canvas-camera.js';
	import {
		createGlContext,
		createProgram,
		createBuffer,
		createVao,
		updateBuffer,
		type GlContext
	} from '../gl/context.js';
	import {
		WALL_VERT,
		WALL_FRAG,
		WALL_ATTRIBS,
		WALL_PASSES,
		WALL_BLOOM,
		type WallPaint
	} from '../gl/wall-shaders.js';
	import { buildWalls, type WallCapInput } from '../gl/wall-geometry.js';
	import { hexRgb } from '../gl/piece-instances.js';

	let {
		/** One entry per territory whose wall should stand this frame. Empty when
		 *  `wallHeight` is 0 — a flat wall is a screen-space parapet, a different
		 *  object, and it stays in the SVG that can draw it. */
		caps = [],
		postEvery = 6
	}: { caps?: (WallCapInput & WallPaint)[]; postEvery?: number } = $props();

	const ctx = getContext<CanvasContextValue>(CANVAS_CTX);
	const transform = ctx.transform;

	let canvas = $state<HTMLCanvasElement | null>(null);
	let glc: GlContext | null = null;
	let program: WebGLProgram | null = null;
	/** One dynamic buffer holding every territory's quads, rebuilt each frame.
	 *  Its identity is stable — `updateBuffer` re-uploads in place and only calls
	 *  `bufferData` when the geometry outgrows the allocation — which is what lets
	 *  the VAO below be built once. */
	let buffer: WebGLBuffer | null = null;
	let vao: WebGLVertexArrayObject | null = null;
	let uni: Record<string, WebGLUniformLocation | null> = {};
	/** Reused across frames — see `buildWalls`. */
	let scratch: Float32Array | undefined;
	/** Deliberately NOT `$state` — see EdgeParticles. It is written from inside the
	 *  mount effect, and a reactive read there re-runs that effect, whose cleanup
	 *  disposes the context by LOSING it. That left a mounted layer holding a dead
	 *  context: a "WebGL context lost" on every page load, and a blank canvas. */
	let failed = false;

	/** Returns false when WebGL2 is unavailable, which is a supported outcome:
	 *  nothing else in the scene depends on this layer existing. */
	function init(el: HTMLCanvasElement): boolean {
		// Premultiplied because the passes accumulate ordered translucent quads into
		// a transparent framebuffer. With the default (straight alpha) the
		// compositor multiplies a second time and the pane, at 0.07, lands at
		// ~0.005 — a wall that is not there.
		glc = createGlContext(el, { antialias: true, premultipliedAlpha: true });
		if (!glc) return false;
		const gl = glc.gl;
		program = createProgram(gl, WALL_VERT, WALL_FRAG);
		for (const name of ['uCam', 'uSize', 'uWidth', 'uInk', 'uAlpha'])
			uni[name] = gl.getUniformLocation(program, name);
		return true;
	}

	$effect(() => {
		const el = canvas;
		if (!el) return;
		if (!glc && !failed && !init(el)) {
			failed = true;
			return;
		}
		return () => {
			// Browsers cap live WebGL contexts per page (~16), so a studio that mounts
			// and unmounts globes would eventually start getting `null` back from
			// `createGlContext` if these were left to the collector.
			glc?.dispose();
			glc = null;
			program = null;
			buffer = null;
			vao = null;
			uni = {};
		};
	});

	$effect(() => {
		// Read every dependency up front so Svelte subscribes to all of them — an
		// effect only tracks what it touches while it runs, and the imperative work
		// below would otherwise register nothing.
		const cam = { tx: transform.tx, ty: transform.ty, tk: transform.tk };
		const cs = caps;
		const stride = postEvery;
		if (!glc || glc.lost || !program) return;

		const gl = glc.gl;
		glc.resize();
		gl.clearColor(0, 0, 0, 0);
		gl.clear(gl.COLOR_BUFFER_BIT);

		const build = buildWalls(cs, stride, scratch);
		scratch = build.data;
		if (!build.vertices) return;

		if (!buffer) {
			buffer = createBuffer(gl, build.data, gl.DYNAMIC_DRAW);
			vao = createVao(gl, program, [{ buffer, attribs: WALL_ATTRIBS }]);
		} else {
			updateBuffer(gl, buffer, build.data);
		}

		gl.useProgram(program);
		gl.bindVertexArray(vao);
		// No culling: a pane is a two-sided sheet, and the run that wraps round the
		// side of a cap presents both faces within one wall.
		gl.disable(gl.CULL_FACE);
		gl.enable(gl.BLEND);
		// Premultiplied "over" — see the compositing note in `wall-shaders`.
		gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

		gl.uniform3f(uni.uCam ?? null, cam.tx, cam.ty, cam.tk);
		gl.uniform2f(uni.uSize ?? null, glc.cssWidth, glc.cssHeight);

		for (let c = 0; c < build.caps.length; c++) {
			const paint = cs[c];
			const { spans } = build.caps[c];
			const [r, g, b] = hexRgb(paint.ink);
			gl.uniform3f(uni.uInk ?? null, r, g, b);

			// `face` was the SVG group's own opacity. Folding it into each pass rather
			// than flattening the group first is the one place this differs from the
			// document model, and it only shows where two passes overlap.
			const dim = paint.face;
			const draw = (i: number, wScale: number, aScale: number) => {
				const pass = WALL_PASSES[i];
				const span = spans[pass.kind];
				if (!span.count) return;
				gl.uniform1f(uni.uWidth ?? null, pass.width(paint.lit) * wScale);
				gl.uniform1f(uni.uAlpha ?? null, pass.alpha(paint.lit) * aScale * dim);
				gl.drawArrays(gl.TRIANGLES, span.first, span.count);
			};

			draw(0, 1, 1);
			// The bloom goes UNDER the strokes it belongs to, so the sharp line lands
			// on its own halo rather than being softened by it.
			if (paint.glow)
				for (let i = 1; i < WALL_PASSES.length; i++)
					draw(i, WALL_BLOOM.width, WALL_BLOOM.alpha);
			for (let i = 1; i < WALL_PASSES.length; i++) draw(i, 1, 1);
		}

		gl.bindVertexArray(null);
	});
</script>

<canvas class="tw" bind:this={canvas} aria-hidden="true"></canvas>

<style>
	.tw {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		/* Chrome, not a target. A boundary is not something you point at; the
		   territory's own nodes are, and they live in the SVG above. */
		pointer-events: none;
	}
</style>
