<script lang="ts">
	// ── EdgeParticles — energy along the links, on the GPU ───────────────────────
	// Replaces the `<circle><animateMotion><mpath/></animateMotion></circle>`
	// stack in MeshStudio: up to six particles per energy edge, each carrying a
	// `filter="url(#ms-particle)"` Gaussian blur, each interpolated by the browser
	// against a live `<path>` whose `d` is rewritten whenever a node moves. SMIL
	// motion is the least-optimised animation path in every engine, and a blur on
	// a moving element is a full re-rasterise per particle per frame with nothing
	// cached between them — the two costs that put the mesh in `perfBudget`'s
	// `reduced` tier and kept it there.
	//
	// Here a particle is ONE VERTEX. Its curve, colour, phase and speed are packed
	// when the edges change; a frame is a clock uniform and a single `drawArrays`.
	// The blur is gone entirely — the sprite draws its own falloff in the fragment
	// shader, which costs nothing because it was always just a radial gradient.
	//
	// A SIBLING layer inside the shared <Canvas>, like GlobePieces: it READS
	// `ctx.transform` and never writes it. A GL layer that owns a camera drifts a
	// pixel off the SVG drawn over it, and here that would show as energy running
	// beside its own edge rather than along it.
	import { getContext } from 'svelte';
	import { CANVAS_CTX, type CanvasContextValue } from '../primitives/canvas/canvas-camera.js';
	import { createGlContext, createProgram, createBuffer, updateBuffer, type GlContext } from './gl/context.js';
	import {
		PARTICLE_VERT,
		PARTICLE_FRAG,
		PARTICLE_ATTRIBS,
		PARTICLE_FLOATS,
		SPRITE_PAD
	} from './gl/particle-shaders.js';
	import { packParticles, type ParticleRun } from './gl/particle-instances.js';

	let {
		runs = [],
		/** Ink for a run whose colour the theme returned in a form with no value
		 *  outside a live element. Defaults to the studio's own energy cyan. */
		fallback = [0.13, 0.83, 0.93] as [number, number, number]
	}: {
		runs?: ParticleRun[];
		fallback?: [number, number, number];
	} = $props();

	const ctx = getContext<CanvasContextValue>(CANVAS_CTX);
	const transform = ctx.transform;

	let canvas = $state<HTMLCanvasElement | null>(null);
	let glc: GlContext | null = null;
	let program: WebGLProgram | null = null;
	let buffer: WebGLBuffer | null = null;
	/** Reused across packs — see `packParticles`. */
	let packed: Float32Array | undefined;
	let count = 0;
	/** Deliberately NOT `$state`. It is written from inside the mount effect, and
	 *  a reactive read there would re-run that effect — whose cleanup disposes the
	 *  context by LOSING it. The result was a live layer left holding a dead
	 *  context: a "WebGL context lost" on every load and a permanently blank
	 *  canvas, because nothing ever rebuilds after a loss it did not expect. */
	let failed = false;

	/** Seconds since the layer started drawing. Not `performance.now()` directly:
	 *  a clock that starts at page load puts every particle at an arbitrary phase
	 *  the first time the layer mounts, and at float32 precision a browser left
	 *  open for a day quantises the position visibly. */
	let clock = 0;
	let origin = 0;

	function build(el: HTMLCanvasElement): boolean {
		// `onRestore` is not optional politeness. A context can be lost for reasons
		// that have nothing to do with us — another tab taking the GPU, a laptop
		// switching graphics, the browser reclaiming the oldest context once a page
		// holds too many — and EVERY GL object made before that moment is dead.
		// Without a rebuild the layer is blank for the life of the page.
		glc = createGlContext(el, { antialias: true, onRestore: () => rebuild(el) });
		if (!glc) return false;
		program = createProgram(glc.gl, PARTICLE_VERT, PARTICLE_FRAG);
		buffer = createBuffer(glc.gl, new Float32Array(0), glc.gl.DYNAMIC_DRAW);
		// The pack is keyed to a buffer that no longer exists after a restore, so it
		// has to be redone rather than reused.
		packed = undefined;
		count = 0;
		return true;
	}

	function rebuild(el: HTMLCanvasElement): void {
		program = null;
		buffer = null;
		if (!glc || glc.lost) return;
		program = createProgram(glc.gl, PARTICLE_VERT, PARTICLE_FRAG);
		buffer = createBuffer(glc.gl, new Float32Array(0), glc.gl.DYNAMIC_DRAW);
		packed = undefined;
		count = 0;
	}

	// Depends on `canvas` ALONE. Every other value this reads is non-reactive on
	// purpose: this effect's cleanup destroys the GL context, so anything that
	// re-runs it destroys a context belonging to a component that is still mounted.
	$effect(() => {
		const el = canvas;
		if (!el) return;
		if (!glc && !failed && !build(el)) failed = true;
		return () => {
			// Browsers cap live WebGL contexts per page (~16) and the mesh already
			// spends one on GlobePieces. Releasing on unmount is what keeps a studio
			// that mounts and unmounts meshes from eventually getting `null` back.
			glc?.dispose();
			glc = null;
			program = null;
			buffer = null;
			count = 0;
		};
	});

	// Repack only when the runs actually change. Separated from the draw effect
	// below because the draw runs at frame rate and this must not.
	$effect(() => {
		const rs = runs;
		if (!glc || glc.lost || !buffer) return;
		const p = packParticles(rs, fallback, packed);
		packed = p.data;
		count = p.count;
		if (count) updateBuffer(glc.gl, buffer, p.data.subarray(0, count * PARTICLE_FLOATS));
	});

	$effect(() => {
		// Depends on the two pieces of $state that gate a live context, and
		// deliberately NOT on the camera. The transform is read inside the frame
		// instead: subscribing to it here would tear down and restart the rAF loop
		// on every pointer move of a pan, and the loop is already reading the same
		// numbers a frame later anyway.
		const el = canvas;
		if (!el || !glc || glc.lost || !program || !buffer) return;

		let frame = 0;
		const gl = glc.gl;

		// Re-resolved whenever the PROGRAM identity changes, not once at setup. A
		// context restore builds a new program, and this effect does not re-run for
		// it (it tracks `canvas` alone) — locations cached from the dead program
		// would silently address nothing and draw a blank layer.
		let uFor: WebGLProgram | null = null;
		let uCam: WebGLUniformLocation | null = null;
		let uSize: WebGLUniformLocation | null = null;
		let uTime: WebGLUniformLocation | null = null;
		let uDpr: WebGLUniformLocation | null = null;
		let uPad: WebGLUniformLocation | null = null;

		const draw = (ts: number) => {
			frame = requestAnimationFrame(draw);
			if (!glc || glc.lost || !program || !buffer) return;

			if (uFor !== program) {
				uFor = program;
				uCam = gl.getUniformLocation(program, 'uCam');
				uSize = gl.getUniformLocation(program, 'uSize');
				uTime = gl.getUniformLocation(program, 'uTime');
				uDpr = gl.getUniformLocation(program, 'uDpr');
				uPad = gl.getUniformLocation(program, 'uPad');
			}

			if (!origin) origin = ts;
			clock = (ts - origin) / 1000;

			const dpr = globalThis.devicePixelRatio || 1;
			glc.resize(dpr);
			gl.clearColor(0, 0, 0, 0);
			gl.clear(gl.COLOR_BUFFER_BIT);
			// An empty scene still clears — otherwise the last frame's particles stay
			// burnt into the canvas after the tier drops them to zero.
			if (!count) return;

			gl.useProgram(program);
			gl.disable(gl.DEPTH_TEST);
			gl.enable(gl.BLEND);
			// Additive, matching what the blurred SVG dots did over the edge beneath
			// them: energy reads as light on the line, and two particles crossing
			// should brighten rather than one occluding the other.
			gl.blendFunc(gl.SRC_ALPHA, gl.ONE);

			gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
			bindAttribs(gl, program);

			gl.uniform3f(uCam, transform.tx, transform.ty, transform.tk);
			gl.uniform2f(uSize, glc.cssWidth, glc.cssHeight);
			gl.uniform1f(uTime, clock);
			gl.uniform1f(uDpr, dpr);
			gl.uniform1f(uPad, SPRITE_PAD);

			gl.drawArrays(gl.POINTS, 0, count);
		};

		frame = requestAnimationFrame(draw);
		return () => cancelAnimationFrame(frame);
	});

	/** Point every attribute at the packed buffer.
	 *
	 *  Re-pointed per effect rather than cached in a VAO because an attribute
	 *  pointer captures the buffer bound when it was set, and `updateBuffer` can
	 *  reallocate underneath one — which draws the right count of particles from
	 *  freed memory and looks like a maths bug rather than a binding one. */
	function bindAttribs(gl: WebGL2RenderingContext, prog: WebGLProgram): void {
		const stride = PARTICLE_FLOATS * 4;
		let offset = 0;
		for (const a of PARTICLE_ATTRIBS) {
			const loc = gl.getAttribLocation(prog, a.name);
			if (loc >= 0) {
				gl.enableVertexAttribArray(loc);
				gl.vertexAttribPointer(loc, a.size, gl.FLOAT, false, stride, offset);
			}
			offset += a.size * 4;
		}
	}
</script>

<canvas class="ms-particles" bind:this={canvas} aria-hidden="true"></canvas>

<style>
	.ms-particles {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		/* Chrome, not an input surface. Every hit target — edges included — stays in
		   the SVG, which is what keeps hover, selection and screen readers working
		   after the pixels move to the GPU. */
		pointer-events: none;
	}
</style>
