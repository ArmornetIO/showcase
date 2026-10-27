<script lang="ts">
	// ── Stage3D — a Builder 3D page, drawn the way BREACH draws a map ────────
	// Drawn with the first-person view's own shaders (`game/map-gl`), from an
	// orbit instead of a walker's eye, so a scene looks here as it will walked.
	//
	// NOT through `composeMap`'s batches. Those bake every put into world space,
	// which is right for a map that never moves and wrong for one being edited:
	// recomposing the founders set is 31 ms and a 16 MB upload per drag event.
	// Each subject is meshed once instead, and each object drawn with its own
	// model matrix — the way the game draws other players — so a move is a
	// uniform. Draws on change, not per frame: nothing here moves on its own.
	//
	// Drag an object to move it over the ground; drag empty ground to orbit,
	// shift- or right-drag to pan, scroll to zoom. A palette card dropped here
	// lands where it was let go.
	import { untrack } from 'svelte';
	import { createGlContext, createProgram, createBuffer, createVao } from '../mesh-studio/gl/context.js';
	import { composeMap } from '../game/map.js';
	import { meshPiece } from '../mesh-studio/pieces/piece-mesh.js';
	import type { Solid } from '../mesh-studio/pieces/pieces.js';
	import {
		MAP_VERT,
		MAP_FRAG,
		MAP_ATTRIBS,
		IDENTITY,
		boxLines,
		groundAt,
		mul,
		orbitEye,
		perspective,
		tokenRGB,
		toneRGB,
		view,
		type Orbit,
		type RGB
	} from '../game/map-gl.js';
	import type { CanvasItem } from './store.svelte.js';
	import { OBJECT3D, object3d, pickAt, sceneMap, subjectProp, SUBJECT_KEY } from './scene3d.js';

	interface Props {
		items: CanvasItem[];
		selectedId: string | null;
		onselect: (id: string | null) => void;
		/** A drag moved an object to this ground point. */
		onmove: (id: string, x: number, z: number) => void;
		/** A palette card was dropped at this ground point. */
		ondrop: (subject: string, x: number, z: number) => void;
		/** The BREACH map this page was imported from, whose floor it stands on. */
		base?: string;
	}
	let { items, selectedId, onselect, onmove, ondrop, base }: Props = $props();

	const FOV = 1.0;
	// A scene holds a 15 cm figure and a 40 m street, so the camera's reach and
	// its clip planes scale with how close it is rather than being fixed.
	const MIN_DIST = 0.05;
	const MAX_DIST = 400;
	const far = () => Math.max(600, orbit.dist * 30);

	let canvas = $state<HTMLCanvasElement | null>(null);
	let noGl = $state(false);
	let over = $state(false);
	let orbit = $state<Orbit>({ target: { x: 0, y: 0, z: 0 }, yaw: 0.6, pitch: -0.55, dist: 45 });

	/** Bumped when the canvas size changes; the draw effect reads it. */
	let uploaded = $state(0);
	let draw: (() => void) | null = null;

	$effect(() => {
		const el = canvas;
		if (!el) return;
		const glc = createGlContext(el, { depth: true, alpha: false, onResize: () => uploaded++ });
		if (!glc) {
			noGl = true;
			return;
		}
		const gl = glc.gl;
		const prog = createProgram(gl, MAP_VERT, MAP_FRAG);
		const u = (n: string) => gl.getUniformLocation(prog, n);
		const U = {
			vp: u('uVP'), model: u('uModel'), eye: u('uEye'), color: u('uColor'), fog: u('uFog'), lit: u('uLit'),
			far: u('uFar'), code: u('uCode'), glow: u('uGlow'), amb: u('uAmb'), ln: u('uLN')
		};
		type Drawable = { vao: WebGLVertexArrayObject; count: number };
		const vao = (data: Float32Array): Drawable => ({
			vao: createVao(gl, prog, [{ buffer: createBuffer(gl, data), attribs: MAP_ATTRIBS }]),
			count: data.length / 7
		});
		const C = tokenRGB(el, ['--bg', '--accent']);
		const T: Record<string, RGB> = {};

		// The ground is an empty scene composed once: the same floor and grid a
		// map exported from here will have. Read here so a new base rebuilds it.
		// ponytail: slot fills (a desk's clutter) are drawn in the game and in
		// an export, not here; compose the host prop if the editor needs them.
		// Untracked, as is everything read in this setup: a WebGL context cannot
		// be made twice on one canvas (the second comes back lost), so this effect
		// must run once per canvas. A page with another base remounts the stage.
		const empty = composeMap(sceneMap([], 'scene', 'Scene', untrack(() => base)), 1);
		const mat0 = (id: string) => empty.def.materials[id];
		const floor = empty.floor.map((l) => ({ g: vao(l.tris), color: toneRGB(el, T, mat0(l.material).face) }));
		const grid = empty.grid && empty.def.grid ? { g: vao(empty.grid), color: toneRGB(el, T, mat0(empty.def.grid.material).face) } : null;

		/** A subject on the GPU, one mesh per material. Meshed on first sight and
		 *  kept for the life of the context. */
		type Mesh = { tris: Drawable; edges: Drawable | null; face: RGB; edge: RGB | null; lit: number; glow: boolean };
		const meshes = new Map<string, Mesh[]>();
		function meshesFor(subject: string): Mesh[] {
			const hit = meshes.get(subject);
			if (hit) return hit;
			const b = subjectProp(subject);
			const out: Mesh[] = [];
			if (b) {
				const ids = typeof b.prop.material === 'string' ? b.prop.solids.map(() => b.prop.material as string) : b.prop.material;
				const byMat = new Map<string, Solid[]>();
				b.prop.solids.forEach((s, i) => byMat.set(ids[i], [...(byMat.get(ids[i]) ?? []), s]));
				for (const [id, solids] of byMat) {
					const ma = b.materials[id];
					const m = meshPiece(solids);
					out.push({
						tris: vao(m.verts),
						edges: ma.edge ? vao(m.edges) : null,
						face: toneRGB(el!, T, ma.face),
						edge: ma.edge ? toneRGB(el!, T, ma.edge) : null,
						lit: ma.lit ?? 1,
						glow: !!ma.glow
					});
				}
			}
			meshes.set(subject, out);
			return out;
		}

		/** Where an object stands: `game/map`'s turn about +y, then its scale. */
		function place(item: CanvasItem): Float32Array {
			const o = object3d(item);
			const a = (o.yaw * Math.PI) / 180;
			const c = Math.cos(a) * o.scale;
			const s = Math.sin(a) * o.scale;
			return new Float32Array([c, 0, -s, 0, 0, o.scale, 0, 0, s, 0, c, 0, o.x, o.lift, o.z, 1]);
		}

		let box: Drawable | null = null;
		let boxFor = '';

		const paint = (g: Drawable, mode: number, color: number[], lit: number, glow = false) => {
			gl.bindVertexArray(g.vao);
			gl.uniform3fv(U.color, color);
			gl.uniform1f(U.lit, lit);
			gl.uniform1f(U.glow, glow ? 1 : 0);
			gl.drawArrays(mode, 0, g.count);
		};

		/** The selected subject's bounds as box lines in its own frame, drawn with
		 *  its model matrix so it follows a drag for free. */
		function selectionBox(subject: string): Drawable | null {
			const b = subjectProp(subject);
			if (!b) return null;
			const data = new Float32Array(24 * 7);
			// Piece (e, n) is world (x, −z), the same swap the vertices take.
			boxLines(data, 0, b.box.e0, 0, -b.box.n1, b.box.e1, b.tall, -b.box.n0);
			return vao(data);
		}

		draw = () => {
			if (glc.lost) return;
			glc.resize();
			gl.useProgram(prog);
			const eye = orbitEye(orbit);
			gl.clearColor(C['--bg'][0], C['--bg'][1], C['--bg'][2], 1);
			gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
			const near = Math.max(0.001, orbit.dist / 200);
			const vp = mul(perspective(FOV, glc.cssWidth / glc.cssHeight, near, far()), view(eye.x, eye.y, eye.z, orbit.yaw, orbit.pitch));
			gl.uniformMatrix4fv(U.vp, false, vp);
			gl.uniformMatrix4fv(U.model, false, IDENTITY);
			gl.uniform3f(U.eye, eye.x, eye.y, eye.z);
			gl.uniform3fv(U.fog, C['--bg']);
			gl.uniform1f(U.far, far());
			gl.uniform1f(U.code, 0);
			// Daylight: an authored scene is lit to be looked at, not played in.
			gl.uniform3f(U.amb, 1, 1, 1);
			gl.uniform1i(U.ln, 0);

			// Same pass order as the first-person view: flat floor layers in
			// painter's order, then the solids depth-tested with their edges on top.
			gl.disable(gl.DEPTH_TEST);
			gl.disable(gl.CULL_FACE);
			for (const l of floor) paint(l.g, gl.TRIANGLES, l.color, 0);
			if (grid) paint(grid.g, gl.LINES, grid.color, 0);
			const shown = items.filter((i) => i.visible && i.componentId === OBJECT3D);
			gl.enable(gl.DEPTH_TEST);
			gl.depthFunc(gl.LEQUAL);
			gl.enable(gl.CULL_FACE);
			gl.enable(gl.POLYGON_OFFSET_FILL);
			gl.polygonOffset(1, 1);
			for (const item of shown) {
				gl.uniformMatrix4fv(U.model, false, place(item));
				for (const m of meshesFor(object3d(item).subject)) paint(m.tris, gl.TRIANGLES, m.face, m.lit, m.glow);
			}
			gl.disable(gl.POLYGON_OFFSET_FILL);
			for (const item of shown) {
				gl.uniformMatrix4fv(U.model, false, place(item));
				for (const m of meshesFor(object3d(item).subject)) if (m.edges && m.edge) paint(m.edges, gl.LINES, m.edge, 0);
			}

			const sel = shown.find((i) => i.id === selectedId);
			if (sel) {
				const subject = object3d(sel).subject;
				if (boxFor !== subject) {
					box = selectionBox(subject);
					boxFor = subject;
				}
				gl.disable(gl.DEPTH_TEST);
				gl.uniformMatrix4fv(U.model, false, place(sel));
				if (box) paint(box, gl.LINES, C['--accent'], 0, true);
			}
			gl.uniformMatrix4fv(U.model, false, IDENTITY);
			gl.bindVertexArray(null);
		};
		// Untracked: `++` READS the counter, and a GL effect that depended on it
		// would tear its context down on the first redraw and come back lost.
		untrack(() => uploaded++);

		return () => {
			draw = null;
			glc.dispose();
		};
	});

	$effect(() => {
		void uploaded;
		void selectedId;
		void items;
		void [orbit.yaw, orbit.pitch, orbit.dist, orbit.target.x, orbit.target.z];
		draw?.();
	});

	// ── Framing ───────────────────────────────────────────────────────────────
	/** Ground positions round to a step that suits the view: 10 cm from a
	 *  street's height, a millimetre over a figure. */
	function snap(v: number) {
		const q = 10 ** Math.floor(Math.log10(Math.max(orbit.dist, 0.01) / 50));
		return Number((Math.round(v / q) * q).toFixed(4));
	}

	/** Size of a subject at a scale, metres: what the camera has to hold. */
	function sizeOf(subject: string, scale = 1) {
		const b = subjectProp(subject);
		return b
			? { size: Math.max(b.box.e1 - b.box.e0, b.box.n1 - b.box.n0, b.tall) * scale, tall: b.tall * scale }
			: null;
	}

	/** Look at a spot holding something this big, filling about half the view. */
	function look(x: number, y: number, z: number, size: number) {
		orbit.target = { x, y, z };
		orbit.dist = Math.min(MAX_DIST, Math.max(MIN_DIST, size * 1.8));
	}

	/** Something just placed that is too small to see from here (a printed
	 *  figure on a street) brings the camera to it; a building stays in the
	 *  view it was placed into. */
	export function reveal(subject: string, x: number, z: number) {
		const s = sizeOf(subject);
		if (s && s.size < orbit.dist / 25) look(x, s.tall / 2, z, s.size);
	}

	/** The ground under the middle of the view: where "add to scene" lands. */
	export function centre() {
		return { x: snap(orbit.target.x), z: snap(orbit.target.z) };
	}

	/** Put the camera on one object. */
	export function frame(id: string | null) {
		const item = items.find((i) => i.id === id);
		const o = item && object3d(item);
		const s = o && sizeOf(o.subject, o.scale);
		if (o && s) look(o.x, o.lift + s.tall / 2, o.z, s.size);
	}

	/** Put the camera on everything in the scene. */
	export function fitAll() {
		const boxes = items.flatMap((i) => {
			const o = object3d(i);
			const s = sizeOf(o.subject, o.scale);
			return s && i.visible ? [{ o, s }] : [];
		});
		if (!boxes.length) return;
		const x0 = Math.min(...boxes.map((b) => b.o.x - b.s.size / 2));
		const x1 = Math.max(...boxes.map((b) => b.o.x + b.s.size / 2));
		const z0 = Math.min(...boxes.map((b) => b.o.z - b.s.size / 2));
		const z1 = Math.max(...boxes.map((b) => b.o.z + b.s.size / 2));
		const tall = Math.max(...boxes.map((b) => b.o.lift + b.s.tall));
		look((x0 + x1) / 2, tall / 2, (z0 + z1) / 2, Math.max(x1 - x0, z1 - z0, tall));
	}

	// ── Pointer ───────────────────────────────────────────────────────────────
	function ground(e: { clientX: number; clientY: number }) {
		const r = canvas!.getBoundingClientRect();
		const nx = ((e.clientX - r.left) / r.width) * 2 - 1;
		const ny = 1 - ((e.clientY - r.top) / r.height) * 2;
		return groundAt(orbit, FOV, r.width / r.height, nx, ny);
	}

	let drag: { mode: 'orbit' | 'pan' | 'move'; x: number; y: number; id?: string; dx?: number; dz?: number; moved: boolean } | null =
		null;

	function down(e: PointerEvent) {
		canvas!.setPointerCapture(e.pointerId);
		const g = ground(e);
		const hit = g && pickAt(items, g.x, g.z);
		if (hit && e.button === 0 && !e.shiftKey) {
			onselect(hit.id);
			const o = object3d(hit);
			drag = hit.locked
				? { mode: 'orbit', x: e.clientX, y: e.clientY, moved: true }
				: { mode: 'move', x: e.clientX, y: e.clientY, id: hit.id, dx: g!.x - o.x, dz: g!.z - o.z, moved: false };
			return;
		}
		drag = { mode: e.shiftKey || e.button === 2 ? 'pan' : 'orbit', x: e.clientX, y: e.clientY, moved: false };
	}

	function move(e: PointerEvent) {
		if (!drag) return;
		const dx = e.clientX - drag.x;
		const dy = e.clientY - drag.y;
		if (Math.abs(dx) + Math.abs(dy) > 2) drag.moved = true;
		if (drag.mode === 'move') {
			const g = ground(e);
			if (g && drag.id) {
				onmove(drag.id, snap(g.x - drag.dx!), snap(g.z - drag.dz!));
			}
			return;
		}
		if (drag.mode === 'pan') {
			const a = ground({ clientX: drag.x, clientY: drag.y });
			const b = ground(e);
			if (a && b) orbit.target = { x: orbit.target.x - (b.x - a.x), y: 0, z: orbit.target.z - (b.z - a.z) };
		} else {
			orbit.yaw += dx * 0.008;
			orbit.pitch = Math.min(-0.05, Math.max(-1.5, orbit.pitch - dy * 0.006));
		}
		drag.x = e.clientX;
		drag.y = e.clientY;
	}

	function up() {
		// A click on empty ground lets go of the selection, as the 2D canvas does.
		if (drag && drag.mode === 'orbit' && !drag.moved) onselect(null);
		drag = null;
	}

	function wheel(e: WheelEvent) {
		e.preventDefault();
		orbit.dist = Math.min(MAX_DIST, Math.max(MIN_DIST, orbit.dist * (e.deltaY > 0 ? 1.1 : 0.9)));
	}
</script>

<div
	class="ss-root"
	class:ss-over={over}
	role="region"
	aria-label="3D scene"
	ondragover={(e) => {
		if (!e.dataTransfer?.types.includes(SUBJECT_KEY)) return;
		e.preventDefault();
		over = true;
	}}
	ondragleave={() => (over = false)}
	ondrop={(e) => {
		over = false;
		const subject = e.dataTransfer?.getData(SUBJECT_KEY);
		const g = ground(e);
		if (!subject || !g) return;
		e.preventDefault();
		const x = snap(g.x);
		const z = snap(g.z);
		ondrop(subject, x, z);
		reveal(subject, x, z);
	}}
>
	<canvas
		class="ss-canvas"
		bind:this={canvas}
		onpointerdown={down}
		onpointermove={move}
		onpointerup={up}
		onpointercancel={up}
		onwheel={wheel}
		ondblclick={(e) => {
			const g = ground(e);
			const hit = g && pickAt(items, g.x, g.z);
			if (hit) frame(hit.id);
		}}
		oncontextmenu={(e) => e.preventDefault()}
	></canvas>
	{#if noGl}
		<p class="ss-note">This scene needs WebGL2, which this browser did not provide.</p>
	{:else if !items.length}
		<p class="ss-note">Drag a model, building or character here</p>
	{/if}
	<span class="ss-hint"
		>drag to orbit · shift-drag to pan · scroll to zoom · drag an object to move it · double-click to frame it</span
	>
</div>

<style>
	.ss-root {
		position: relative;
		width: 100%;
		height: 100%;
	}
	.ss-over {
		outline: 2px dashed var(--accent);
		outline-offset: -2px;
	}
	.ss-canvas {
		display: block;
		width: 100%;
		height: 100%;
		cursor: grab;
		touch-action: none;
	}
	.ss-canvas:active {
		cursor: grabbing;
	}
	.ss-note {
		position: absolute;
		left: 50%;
		top: 45%;
		transform: translate(-50%, -50%);
		margin: 0;
		color: var(--fg-dim);
		font-family: var(--mono);
		font-size: 0.72rem;
		pointer-events: none;
	}
	.ss-hint {
		position: absolute;
		right: 12px;
		bottom: 12px;
		color: var(--fg-muted);
		font-family: var(--mono);
		font-size: 0.6rem;
		pointer-events: none;
	}
</style>
