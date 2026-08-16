<script lang="ts">
	// ── GlobePieces — the buildings, on the GPU ──────────────────────────────────
	// Replaces `NodePiece.svelte`, which drew each solid as SVG: every visible
	// facet stroked four times (seat, bloom, emissive, edge), each with a fresh
	// `d`, plus a live `<linearGradient>` and a `mix-blend-mode: screen` group per
	// node. On a 24-node globe that was ~1,300 path mutations per frame — and
	// measured on real hardware the scene ran at ~29fps with our own script at
	// 0.0ms, which is what it looks like when the cost is all downstream of you.
	//
	// Here the geometry is uploaded ONCE (127KB for all 17 buildings) and the only
	// thing that moves per frame is 27 floats per node.
	//
	// It stays a SIBLING layer inside the shared <Canvas>, exactly like GlobeFrame
	// and TerritoryCaps: it READS `ctx.transform` and never writes it. The moment a
	// GL layer owns a camera of its own is the moment it drifts a pixel away from
	// the SVG drawn on top of it, and that is the failure mode this whole port has
	// to avoid.
	import { getContext } from 'svelte';
	import { CANVAS_CTX, type CanvasContextValue } from '../../primitives/canvas-camera.js';
	import type { StudioNode } from '../studio.types.js';
	import { createGlContext, createProgram, createBuffer, type GlContext } from '../gl/context.js';
	import { PIECE_VERT, PIECE_FRAG, PIECE_PASSES, PIECE_ATTRIBS } from '../gl/piece-shaders.js';
	import { PIECE_MESHES, PIECE_VERT_FLOATS, PIECE_EDGE_FLOATS } from '../pieces/piece-mesh.js';
	import { packInstances, INSTANCE_FLOATS, type InstanceStyle } from '../gl/piece-instances.js';

	let {
		nodes = [],
		selectedId = null,
		/** Resolves a node's ink. Passed in because colour precedence — world hue,
		 *  degraded amber, offline red — is a STUDIO decision, and duplicating that
		 *  ordering here is how the two would drift. */
		styleOf
	}: {
		nodes?: StudioNode[];
		selectedId?: string | null;
		styleOf: (n: StudioNode) => InstanceStyle;
	} = $props();

	const ctx = getContext<CanvasContextValue>(CANVAS_CTX);
	const transform = ctx.transform;

	let canvas = $state<HTMLCanvasElement | null>(null);
	let glc: GlContext | null = null;
	let program: WebGLProgram | null = null;
	/** Two static buffers, each holding every piece concatenated: the solid faces
	 *  and the wireframe. Uploaded once, never touched again — that is the whole
	 *  premise. They share ONE vertex layout (7 floats: local, face normal,
	 *  normalised height), so the same attribute binding serves both and switching
	 *  between them costs a `bindBuffer` and a few pointer calls. */
	let triBuf: WebGLBuffer | null = null;
	let edgeBuf: WebGLBuffer | null = null;
	/** Where each piece's run starts, in vertices, within each buffer. */
	const triSpans = new Map<string, { first: number; count: number }>();
	const edgeSpans = new Map<string, { first: number; count: number }>();
	/** Reused across frames — see `packInstances`. */
	let instances: Float32Array | undefined;
	let failed = $state(false);

	/** Build the GL side once. Returns false when WebGL2 is unavailable, which is
	 *  a supported outcome: the caller keeps the SVG path and nothing breaks. */
	function init(el: HTMLCanvasElement): boolean {
		glc = createGlContext(el, { antialias: true });
		if (!glc) return false;
		const gl = glc.gl;
		program = createProgram(gl, PIECE_VERT, PIECE_FRAG);

		// Concatenate all 17 meshes into one buffer per kind, with a span per piece.
		// One bind for the whole scene beats a VAO switch per node at this size, and
		// the spans are what let a single buffer serve 17 different shapes.
		triBuf = pack(gl, (m) => m.verts, PIECE_VERT_FLOATS, triSpans);
		edgeBuf = pack(gl, (m) => m.edges, PIECE_EDGE_FLOATS, edgeSpans);
		return true;
	}

	/** Concatenate one field across every piece and upload it, recording where each
	 *  piece landed. */
	function pack(
		gl: WebGL2RenderingContext,
		pick: (m: (typeof PIECE_MESHES)[string]) => Float32Array,
		floats: number,
		spans: Map<string, { first: number; count: number }>
	): WebGLBuffer {
		let total = 0;
		for (const m of Object.values(PIECE_MESHES)) total += pick(m).length;
		const all = new Float32Array(total);
		let at = 0;
		for (const [id, m] of Object.entries(PIECE_MESHES)) {
			const src = pick(m);
			spans.set(id, { first: at / floats, count: src.length / floats });
			all.set(src, at);
			at += src.length;
		}
		return createBuffer(gl, all);
	}

	$effect(() => {
		const el = canvas;
		if (!el) return;
		if (!glc && !failed) {
			if (!init(el)) {
				failed = true;
				return;
			}
		}
		return () => {
			// Releasing the context matters beyond tidiness: browsers cap live WebGL
			// contexts per page (~16), so a studio that mounts and unmounts globes
			// would eventually start getting `null` back from `createGlContext`.
			glc?.dispose();
			glc = null;
			program = null;
			triBuf = null;
			edgeBuf = null;
			triSpans.clear();
			edgeSpans.clear();
		};
	});

	$effect(() => {
		// Every dependency is read up front so Svelte subscribes to all of them —
		// an effect only tracks what it touches while it runs, and the imperative
		// work below would otherwise register nothing.
		const cam = { tx: transform.tx, ty: transform.ty, tk: transform.tk };
		const ns = nodes;
		const sel = selectedId;
		if (!glc || glc.lost || !program || !triBuf || !edgeBuf) return;

		const gl = glc.gl;
		glc.resize();
		gl.clearColor(0, 0, 0, 0);
		gl.clear(gl.COLOR_BUFFER_BIT);

		const packed = packInstances(ns, styleOf, sel, instances);
		instances = packed.data;
		if (!packed.count) return;

		gl.useProgram(program);
		// The one GL constant this port turns on, and the one worth getting wrong
		// only once: faces are wound counter-clockwise seen from OUTSIDE in the
		// local right-handed frame, but screen-y points DOWN, so they project
		// CLOCKWISE. The default (CCW) renders every building inside-out — and it
		// looks like bad mesh data rather than bad GL state, which is why it costs a
		// day when it happens.
		gl.enable(gl.CULL_FACE);
		gl.frontFace(gl.CW);
		gl.cullFace(gl.BACK);
		// No depth test, deliberately. The globe is meant to be seen THROUGH — the
		// back-hemisphere fade and the faint far-side rings exist for exactly that —
		// and every pass here is order-independent, so a depth buffer would only
		// take the transparency away.
		gl.disable(gl.DEPTH_TEST);
		gl.enable(gl.BLEND);

		gl.uniform3f(gl.getUniformLocation(program, 'uCam'), cam.tx, cam.ty, cam.tk);
		gl.uniform2f(gl.getUniformLocation(program, 'uSize'), glc.cssWidth, glc.cssHeight);
		const uPass = gl.getUniformLocation(program, 'uPass');

		for (const pass of PIECE_PASSES) {
			// The edge pass is the only one drawn from the wireframe buffer. It is
			// also the one that matters most on this material: the faces are a
			// translucent wash, and the outline is what actually carries the shape.
			const wire = pass.name === 'edge';
			gl.bindBuffer(gl.ARRAY_BUFFER, wire ? edgeBuf : triBuf);
			bindStatic(gl, program);
			setBlend(gl, pass.blend);
			gl.uniform1i(uPass, pass.id);
			const spans = wire ? edgeSpans : triSpans;
			const mode = wire ? gl.LINES : gl.TRIANGLES;
			for (let i = 0; i < packed.count; i++) {
				const n = packed.order[i];
				const span = spans.get(n.piece);
				if (!span) continue;
				bindInstance(gl, program, packed.data, i * INSTANCE_FLOATS);
				gl.drawArrays(mode, span.first, span.count);
			}
		}
	});

	/** Point the STATIC attributes at whatever is currently bound to ARRAY_BUFFER.
	 *
	 *  Called per pass rather than once, because an attribute pointer captures the
	 *  buffer bound at the moment it is set — switching buffers without re-pointing
	 *  silently keeps reading the old one, which draws the right shape from the
	 *  wrong geometry and looks like a maths bug. */
	function bindStatic(gl: WebGL2RenderingContext, prog: WebGLProgram): void {
		const stride = PIECE_VERT_FLOATS * 4;
		let offset = 0;
		for (const a of PIECE_ATTRIBS) {
			if (a.divisor) continue;
			const loc = gl.getAttribLocation(prog, a.name);
			if (loc >= 0) {
				gl.enableVertexAttribArray(loc);
				gl.vertexAttribPointer(loc, a.size, gl.FLOAT, false, stride, offset);
			}
			offset += a.size * 4;
		}
	}

	/** Feed one node's 27 floats as CONSTANT vertex attributes.
	 *
	 *  Not an instance buffer, and the reason is arithmetic rather than taste: the
	 *  17 buildings are 17 DIFFERENT meshes with about one node each, so there is
	 *  no batch to instance. WebGL2 has no `baseInstance`, so real instancing would
	 *  mean re-pointing thirteen attributes at a new byte offset for every group —
	 *  the same call count, plus offset arithmetic to get wrong.
	 *
	 *  A constant attribute (array disabled, value set directly) reads identically
	 *  in the shader, so the `in` declarations the shader module publishes stay
	 *  exactly as specified. If the mesh ever grows to many nodes sharing a piece,
	 *  this is the one function that changes. */
	function bindInstance(
		gl: WebGL2RenderingContext,
		prog: WebGLProgram,
		data: Float32Array,
		base: number
	): void {
		let o = base;
		for (const a of PIECE_ATTRIBS) {
			if (!a.divisor) continue;
			const loc = gl.getAttribLocation(prog, a.name);
			if (loc >= 0) {
				gl.disableVertexAttribArray(loc);
				if (a.size === 2) gl.vertexAttrib2f(loc, data[o], data[o + 1]);
				else if (a.size === 3) gl.vertexAttrib3f(loc, data[o], data[o + 1], data[o + 2]);
				else if (a.size === 4)
					gl.vertexAttrib4f(loc, data[o], data[o + 1], data[o + 2], data[o + 3]);
				else gl.vertexAttrib1f(loc, data[o]);
			}
			o += a.size;
		}
	}

	/** `screen` is EXACTLY `src + dst − src·dst`, which is what
	 *  `blendFunc(ONE, ONE_MINUS_SRC_COLOR)` computes — not an approximation of the
	 *  CSS blend mode but the same arithmetic. That is the whole reason the
	 *  hologram look survives the port intact. */
	function setBlend(gl: WebGL2RenderingContext, mode: 'over' | 'add' | 'screen'): void {
		if (mode === 'add') gl.blendFunc(gl.SRC_ALPHA, gl.ONE);
		else if (mode === 'screen') gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_COLOR);
		else gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
	}
</script>

<canvas class="gp" bind:this={canvas} aria-hidden="true"></canvas>

<style>
	.gp {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		/* Chrome, not a target. Selection and hover ride the SVG hit proxies in
		   MeshStudio, which is what keeps keyboard focus and screen readers working
		   after the pixels move to the GPU. */
		pointer-events: none;
	}
</style>
