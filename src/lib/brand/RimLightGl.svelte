<script module lang="ts">
/** One lit thing. A segment with a width and two brightnesses — which covers
 *  all three shapes, because a specular dot is a segment of zero length and a
 *  hotspot is the same with a softer core. Collapsing them is not tidiness: it
 *  is one program, one buffer and one draw call instead of three. */
export interface RimQuad {
	x0: number;
	y0: number;
	x1: number;
	y1: number;
	/** Half-width of the crisp core, box units. */
	hw: number;
	/** Core alpha, 0 for a shape that is spill only. */
	core: number;
	/** Spill alpha at the core's edge, 0 for a shape with no glow. */
	spill: number;
	/** Linear RGB 0–1. */
	r: number;
	g: number;
	b: number;
}
</script>

<script lang="ts">
	// ── The lamp's moving passes, on the GPU ─────────────────────────────────────
	// Everything in `RimLight` that is redrawn when the lamp moves: the contour
	// spill, the contour core, the tube hotspots and the ball speculars. One
	// WebGL2 layer, one instanced quad program, one draw call each.
	//
	// What it replaces, per frame: 2N stroked `<path>` elements — N being every
	// contour edge currently facing the lamp — with the wide pass under an
	// `feGaussianBlur` whose region is expanded to 280%. `lamp` moves every frame
	// by construction, so the browser re-rasterised that blur every frame, over an
	// area much larger than the mark. That single filter was the intro's cost on a
	// phone. Same technique, and the same reasoning, as `StripsGl`.
	//
	// ── Why the blur is gone rather than ported ──
	// There is no offscreen pass here and there does not need to be one. The SVG
	// drew the spill by stroking each edge at 3.2× width and blurring the result;
	// a blurred stroke is just a falloff around a segment, and a falloff around a
	// segment is what a fragment shader computes directly from the distance it
	// already has. So the two passes collapse into one instance whose fragment
	// sums a crisp core and a gaussian spill — closer to the intent than the
	// filter chain was, because the spill is now exact rather than a blur of an
	// approximation of it.
	//
	// ── What stayed in the DOM, and why that is the seam ──
	// The brushed field and the streak did NOT come over. Both are clipped to the
	// shield, and both blend against what is UNDER the layer — `soft-light` and
	// `screen` against the chrome cut, which is a different element. A GL canvas
	// cannot read its own backdrop, so porting them would mean either bringing the
	// whole crest into the scene or faking the blend. Neither is worth it: the
	// brushed field is static, and the streak is one element whose only per-frame
	// change is a coordinate. They cost nothing where they are.
	//
	// That split is also why there is no stencil buffer here. In the SVG the two
	// clipped passes are the ONLY ones inside `<g clip-path>` — the edge, tube and
	// ball groups are outside it — so everything this file draws is unclipped by
	// construction, and no polygon has to be triangulated to clip it.
	import { onMount } from 'svelte';
	import {
		createGlContext,
		createProgram,
		createBuffer,
		createVao,
		updateBuffer,
		type GlContext
	} from '../mesh-studio/gl/context.js';

	interface Props {
		/** Rendered width, px — the same number `RimLight` is given, meaning the
		 *  200×220 artboard's fit height. */
		size?: number;
		quads: RimQuad[];
		/** Px to lift the artboard by. Matches `RimLight.offsetY` exactly or the
		 *  light lands off the thing it is lighting. */
		offsetY?: number;
		/** Reported once, when a context could not be had or was lost past its
		 *  grace. The host swaps back to the SVG passes — a canvas that has held a
		 *  `webgl2` context is no use to anyone afterwards, so this is a signal to
		 *  stop rendering THIS element, not to retry it. */
		onfallback?: () => void;
	}

	let { size = 470, quads, offsetY = 0, onfallback }: Props = $props();

	// Box units of headroom around the 200×220 artboard, so the spill can leave
	// it. The SVG got this from `overflow: visible`; a canvas has no such thing —
	// a fragment outside the drawing buffer is not dim, it is absent, and a glow
	// that ends on the artboard's straight edge is the one thing the original's
	// own comment says it must never do. 30 is `SPILL_REACH` rounded up.
	const PAD = 30;
	const BOX_W = 200 + 2 * PAD;
	const BOX_H = 220 + 2 * PAD;

	/** How far the gaussian is carried before it is cut, box units. The SVG blur
	 *  ran `stdDeviation="11"`; past ~2.4σ the contribution is below the 8-bit
	 *  floor and the only thing more reach buys is fill rate. */
	const SPILL_REACH = 26;
	const SIGMA = 11;

	let canvas = $state<HTMLCanvasElement | null>(null);
	let dead = $state(false);

	// The artboard's px scale. `viewBox="0 0 200 220"` at `width=height=size`
	// under the default `xMidYMid meet` fits the TALLER axis, so the scale is
	// size/220 and not size/200 — getting this wrong is a mark that is subtly the
	// wrong size and a light that no longer sits on its edges.
	const scale = $derived(size / 220);
	const cssW = $derived(BOX_W * scale);
	const cssH = $derived(BOX_H * scale);

	const VERT = `#version 300 es
	precision highp float;

	// Unit quad, expanded per instance into the segment's oriented bounding box.
	in vec2 a_corner;

	in vec4 a_seg;    // x0, y0, x1, y1 — box units
	in vec3 a_shape;  // half-width, core alpha, spill alpha
	in vec3 a_rgb;

	uniform vec2 u_box;   // artboard size including PAD, box units
	uniform vec2 u_pad;   // PAD, so box coords can be authored from 0,0
	uniform float u_reach;

	out vec2 v_p;         // fragment position, box units
	out vec4 v_seg;
	out vec3 v_shape;
	out vec3 v_rgb;

	void main() {
		vec2 p0 = a_seg.xy;
		vec2 p1 = a_seg.zw;
		vec2 mid = 0.5 * (p0 + p1);
		vec2 d = p1 - p0;
		float len = length(d);
		// A specular is a zero-length segment, and normalising it is a NaN that
		// takes the whole instance off screen rather than drawing a dot.
		vec2 axis = len > 1e-4 ? d / len : vec2(1.0, 0.0);
		vec2 perp = vec2(-axis.y, axis.x);

		// Half-extent along each axis: the segment plus everything the falloff can
		// reach. Spill-free instances get a pixel of room for the AA ramp only.
		// The wide pass's half-width plus everything the kernel carries past it —
		// the fragment measures its falloff from that same edge, so a quad sized to
		// the CORE would cut the glow off square around every segment.
		float grow = a_shape.z > 0.0 ? a_shape.x * 3.2 + u_reach : a_shape.x + 1.5;
		vec2 local = a_corner * vec2(0.5 * len + grow, grow);
		vec2 pos = mid + axis * local.x + perp * local.y;

		v_p = pos;
		v_seg = a_seg;
		v_shape = a_shape;
		v_rgb = a_rgb;

		// Box units → clip space. y is DOWN in the artboard and UP in clip space.
		vec2 unit = (pos + u_pad) / u_box;
		gl_Position = vec4(unit.x * 2.0 - 1.0, 1.0 - unit.y * 2.0, 0.0, 1.0);
	}`;

	const FRAG = `#version 300 es
	precision highp float;

	in vec2 v_p;
	in vec4 v_seg;
	in vec3 v_shape;
	in vec3 v_rgb;

	uniform float u_sigma;
	uniform float u_aa;   // one device pixel, in box units

	out vec4 outColor;

	float segDist(vec2 p, vec2 a, vec2 b) {
		vec2 pa = p - a;
		vec2 ba = b - a;
		float dd = dot(ba, ba);
		float h = dd > 1e-8 ? clamp(dot(pa, ba) / dd, 0.0, 1.0) : 0.0;
		return length(pa - ba * h);
	}

	void main() {
		float d = segDist(v_p, v_seg.xy, v_seg.zw);
		float hw = v_shape.x;

		// The crisp pass: a round-capped stroke of half-width hw, one pixel of
		// ramp. stroke-linecap=round in the original, and it matters — the
		// contours are broken into segments that meet at angles, and square caps
		// leave a notch at every joint.
		float core = v_shape.y * (1.0 - smoothstep(hw - u_aa, hw + u_aa, d));

		// The spill, as the wide pass would have come out of the blur.
		//
		// The correction that is easy to miss, and it is most of the look: a
		// gaussian blur CONSERVES energy. The SVG strokes the edge at 3.2× width
		// and up to 0.5 alpha and then spreads that over sigma 11, which drops the
		// peak by roughly the ratio of the stroke's width to the kernel's. Taking
		// the stroke's own alpha as the peak of the falloff instead — the first cut
		// here — puts an order of magnitude more light over a much larger area, and
		// the mark sits in a grey haze that reads as fog on the lens.
		//
		// 2.5066 is sqrt(2*pi), the gaussian's normalising constant.
		float wide = hw * 3.2;
		float gain = wide / (u_sigma * 2.5066);
		float out_d = max(0.0, d - wide);
		float spill = v_shape.z * gain * exp(-(out_d * out_d) / (2.0 * u_sigma * u_sigma));

		float a = min(1.0, core + spill);
		// Premultiplied: the context is created that way, and these are ordered
		// translucent lights accumulating into a transparent buffer. Straight
		// alpha here has the compositor multiply a second time and everything
		// faint — which is most of the spill — disappears.
		outColor = vec4(v_rgb * a, a);
	}`;

	const CORNERS = new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]);
	const INSTANCE_FLOATS = 10;

	let glc: GlContext | null = null;
	let prog: WebGLProgram | null = null;
	let vao: WebGLVertexArrayObject | null = null;
	let instanceBuf: WebGLBuffer | null = null;
	let uniforms: Record<string, WebGLUniformLocation | null> = {};
	let instances = new Float32Array(0);

	onMount(() => {
		const el = canvas;
		if (!el) return;
		glc = createGlContext(el, { antialias: true, premultipliedAlpha: true });
		if (!glc) {
			dead = true;
			onfallback?.();
			return;
		}
		const gl = glc.gl;
		prog = createProgram(gl, VERT, FRAG);
		const cornerBuf = createBuffer(gl, CORNERS);
		instanceBuf = createBuffer(gl, new Float32Array(INSTANCE_FLOATS), gl.DYNAMIC_DRAW);
		vao = createVao(gl, prog, [
			{ buffer: cornerBuf, attribs: [{ name: 'a_corner', size: 2 }] },
			{
				buffer: instanceBuf,
				attribs: [
					{ name: 'a_seg', size: 4, divisor: 1 },
					{ name: 'a_shape', size: 3, divisor: 1 },
					{ name: 'a_rgb', size: 3, divisor: 1 }
				]
			}
		]);
		for (const n of ['u_box', 'u_pad', 'u_reach', 'u_sigma', 'u_aa']) {
			uniforms[n] = gl.getUniformLocation(prog, n);
		}

		return () => {
			glc?.dispose();
			glc = null;
		};
	});

	// Pull-based, like every other GL layer here: this redraws when `quads`
	// changes and never on a clock of its own. The host already runs one — a
	// second rAF in here would be a second opinion about what time it is.
	$effect(() => {
		const q = quads;
		void size;
		if (!glc || !prog || !vao || !instanceBuf) return;
		if (glc.lost) {
			// One report, then stop. `dead` is what stops the effect re-entering
			// this branch on every subsequent change.
			if (!dead) {
				dead = true;
				onfallback?.();
			}
			return;
		}

		const gl = glc.gl;
		glc.resize();
		gl.clearColor(0, 0, 0, 0);
		gl.clear(gl.COLOR_BUFFER_BIT);
		if (!q.length) return;

		if (instances.length < q.length * INSTANCE_FLOATS) {
			instances = new Float32Array(q.length * INSTANCE_FLOATS);
		}
		for (let i = 0; i < q.length; i++) {
			const o = i * INSTANCE_FLOATS;
			const s = q[i];
			instances[o] = s.x0;
			instances[o + 1] = s.y0;
			instances[o + 2] = s.x1;
			instances[o + 3] = s.y1;
			instances[o + 4] = s.hw;
			instances[o + 5] = s.core;
			instances[o + 6] = s.spill;
			instances[o + 7] = s.r;
			instances[o + 8] = s.g;
			instances[o + 9] = s.b;
		}
		// The subarray, not the whole allocation: the buffer is grown to a high-
		// water mark and uploading its tail would draw whatever the last busier
		// frame left there.
		updateBuffer(gl, instanceBuf, instances.subarray(0, q.length * INSTANCE_FLOATS));

		gl.useProgram(prog);
		gl.bindVertexArray(vao);
		gl.enable(gl.BLEND);
		gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
		gl.uniform2f(uniforms.u_box, BOX_W, BOX_H);
		gl.uniform2f(uniforms.u_pad, PAD, PAD);
		gl.uniform1f(uniforms.u_reach, SPILL_REACH);
		gl.uniform1f(uniforms.u_sigma, SIGMA);
		// One device pixel expressed in box units — the AA ramp has to be a pixel
		// wide on the buffer that was actually allocated, so it reads `glc.dpr`
		// (post-clamp) rather than `devicePixelRatio`.
		gl.uniform1f(uniforms.u_aa, BOX_W / Math.max(1, glc.cssWidth * glc.dpr));
		gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, q.length);
		gl.bindVertexArray(null);
	});
</script>

<canvas
	bind:this={canvas}
	class="rimgl"
	class:dead
	style:--dy="{offsetY}px"
	style:width="{cssW}px"
	style:height="{cssH}px"
	aria-hidden="true"
></canvas>

<style>
	/* Registered on the artboard's centre the same way `.rim` is, then grown by
	   PAD on every side — the element is bigger than the mark, so centring it is
	   the only placement that keeps the two artboards on the same origin. */
	.rimgl {
		position: absolute;
		left: 50%;
		top: 50%;
		transform: translate(-50%, -50%) translateY(calc(-1 * var(--dy, 0px)));
		pointer-events: none;
		/* Every pass in here is a LIGHT — a highlight, a specular, a spill — so it
		   composites as one. This is also what makes the single canvas faithful to
		   an SVG that set `screen` on some groups and left others alone: on the
		   dark cut underneath, the two agree everywhere it matters. */
		mix-blend-mode: screen;
	}
	.dead {
		display: none;
	}
</style>
