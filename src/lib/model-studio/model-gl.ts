// ── model-gl — the Model Studio stage, drawn on the GPU ──────────────────────
// The SVG stage re-projected, re-sorted and rewrote every facet on every orbit
// frame: 80 ms of CPU for the founders set's 30k facets, before the browser had
// painted a single path. Here the parts are baked into one vertex buffer when
// they CHANGE, and a frame is a few uniforms and one draw. The depth buffer does
// what the facet sort and `modelFacets`' cavity ranks did by hand.
//
// Same camera as the SVG it replaces: `studioFrame`'s axes, the same 900×600
// viewBox fitted with `meet`, so the grid (still SVG, underneath) lines up. The
// shade is not the pieces' three bands: at this size those land neighbouring
// faces a few percent apart, and a black print vanished into the stage.
import { createGlContext, createBuffer, createProgram, createVao, type AttribSpec } from '../mesh-studio/gl/context.js';
import { PIECE_LIGHT } from '../mesh-studio/pieces/piece-facets.js';
import type { TangentFrame } from '../physics/sphere.js';
import { PART_FILL, type Part } from './model-geometry.js';

/** Parts a drag can move without a rebake; any past it stay put. */
const MAX_SHIFT = 128;

const VERT = `#version 300 es
in vec3 aPos;
in vec3 aNrm;
in vec3 aCol;
in vec2 aFlag;
uniform mat3 uAxis;
uniform float uStep;
uniform vec2 uOff;
uniform vec2 uPx;
uniform float uDepth;
uniform vec3 uShift[${MAX_SHIFT}];
out vec3 vNrm;
out vec3 vCol;
out vec2 vFlag;
void main() {
	int part = int(aFlag.y + 0.5);
	vec3 w = uAxis * (aPos + (part < ${MAX_SHIFT} ? uShift[part] : vec3(0.0)));
	vec2 s = w.xy * uStep + uOff;
	gl_Position = vec4(s.x * uPx.x, -s.y * uPx.y, -w.z * uDepth, 1.0);
	vNrm = uAxis * aNrm;
	vCol = aCol;
	vFlag = aFlag;
}`;

const FRAG = `#version 300 es
precision highp float;
in vec3 vNrm;
in vec3 vCol;
in vec2 vFlag;
uniform vec3 uLight;
uniform vec3 uBg;
uniform vec3 uAccent;
uniform float uSel;
uniform int uPass;
out vec4 o;
void main() {
	bool ghost = vFlag.x > 0.5;
	if ((uPass == 0) == ghost) discard;
	vec3 n = normalize(vNrm);
	bool front = n.z > 0.001;
	if (!front && uPass == 0) discard;
	if (!front) n = -n;
	// A key over the left shoulder, a weaker fill from the right, and a floor
	// of ambient: every face turned a different way lands a different value.
	float key = max(dot(n, uLight), 0.0);
	float fill = max(dot(n, normalize(vec3(0.7, 0.2, 0.7))), 0.0);
	vec3 col = abs(vFlag.y - uSel) < 0.5 ? uAccent : vCol;
	// A dark spool lit only by its own colour stays near black on every face, so
	// a sheen it doesn't have to carry picks out the faces turned to the key.
	float lum = dot(col, vec3(0.299, 0.587, 0.114));
	vec3 c = col * (0.3 + 0.6 * key + 0.25 * fill) + (1.0 - lum) * 0.3 * key * key;
	c = mix(uBg, c, 0.94);
	o = uPass == 0 ? vec4(c, 1.0) : vec4(c, front ? 0.14 : 0.06);
}`;

const ATTRIBS: AttribSpec[] = [
	{ name: 'aPos', size: 3 },
	{ name: 'aNrm', size: 3 },
	{ name: 'aCol', size: 3 },
	{ name: 'aFlag', size: 2 }
];
const FLOATS = 11;

export interface StageView {
	frame: TangentFrame;
	/** Step the frame was built with — its e/n/u already carry it. */
	zoom: number;
	/** ViewBox-unit offset: pan minus the projected pivot. */
	off: { x: number; y: number };
	/** Index into the baked parts, or −1. */
	selected: number;
	/** Millimetres each baked part is dragged by, e/n/h per part. A uniform, so
	 *  a drag moves a part without rebaking every facet per pointer event. */
	shift: Float32Array;
}

export interface ModelStage {
	/** Rebake. `ghost` parts draw see-through, back faces included. */
	setParts(parts: Part[], ghost: (p: Part) => boolean): void;
	draw(view: StageView): void;
	dispose(): void;
}

type Rgb = [number, number, number];

/** A token or any CSS colour as linear-ish 0..1 RGB, painted to one pixel
 *  because a theme colour may be oklch and only a canvas will say what it is. */
export function cssRgb(css: string, scope: Element): Rgb {
	const value = css.startsWith('var(') ? getComputedStyle(scope).getPropertyValue(css.slice(4, -1)).trim() : css;
	const ctx = document.createElement('canvas').getContext('2d');
	if (!ctx) return [0.5, 0.5, 0.5];
	ctx.fillStyle = value;
	ctx.fillRect(0, 0, 1, 1);
	const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
	return [r / 255, g / 255, b / 255];
}

/** Every face of every part as a triangle fan, flat-normalled. Pure. */
export function bakeParts(parts: Part[], ghost: (p: Part) => boolean, rgb: (css: string) => Rgb) {
	let tris = 0;
	for (const p of parts) for (const s of p.solids) for (const f of s.faces) tris += f.length - 2;
	const out = new Float32Array(tris * 3 * FLOATS);
	let o = 0;
	let reach = 1;
	parts.forEach((p, pi) => {
		const g = ghost(p) ? 1 : 0;
		p.solids.forEach((s, si) => {
			const col = rgb(p.colors?.[si] ?? PART_FILL[p.kind]);
			for (const v of s.verts) reach = Math.max(reach, Math.abs(v.e), Math.abs(v.n), Math.abs(v.h));
			for (const f of s.faces) {
				const a = s.verts[f[0]];
				const b = s.verts[f[1]];
				const c = s.verts[f[2]];
				const u = [b.e - a.e, b.n - a.n, b.h - a.h];
				const w = [c.e - a.e, c.n - a.n, c.h - a.h];
				const nrm = [u[1] * w[2] - u[2] * w[1], u[2] * w[0] - u[0] * w[2], u[0] * w[1] - u[1] * w[0]];
				for (let k = 1; k < f.length - 1; k++) {
					for (const vi of [f[0], f[k], f[k + 1]]) {
						const v = s.verts[vi];
						out.set([v.e, v.n, v.h, nrm[0], nrm[1], nrm[2], col[0], col[1], col[2], g, pi], o);
						o += FLOATS;
					}
				}
			}
		});
	});
	return { verts: out, count: tris * 3, reach, ghosts: parts.some(ghost) };
}

/** Null when WebGL2 is unavailable; the caller keeps its SVG path. */
export function createModelStage(canvas: HTMLCanvasElement, onResize: () => void): ModelStage | null {
	const glc = createGlContext(canvas, { depth: true, alpha: true, onResize });
	if (!glc) return null;
	const { gl } = glc;
	const prog = createProgram(gl, VERT, FRAG);
	const U = Object.fromEntries(
		['uAxis', 'uStep', 'uOff', 'uPx', 'uDepth', 'uShift', 'uLight', 'uBg', 'uAccent', 'uSel', 'uPass'].map((n) => [
			n,
			gl.getUniformLocation(prog, n)
		])
	);
	let buffer: WebGLBuffer | null = null;
	let vao: WebGLVertexArrayObject | null = null;
	let count = 0;
	let reach = 1;
	let ghosts = false;
	const ink = { bg: [0, 0, 0] as Rgb, accent: [0, 1, 1] as Rgb };

	return {
		setParts(parts, ghost) {
			const cache = new Map<string, Rgb>();
			const rgb = (css: string) => cache.get(css) ?? cache.set(css, cssRgb(css, canvas)).get(css)!;
			ink.bg = rgb('var(--bg)');
			ink.accent = rgb('var(--accent)');
			const baked = bakeParts(parts, ghost, rgb);
			if (buffer) gl.deleteBuffer(buffer);
			if (vao) gl.deleteVertexArray(vao);
			buffer = createBuffer(gl, baked.verts);
			vao = createVao(gl, prog, [{ buffer, attribs: ATTRIBS }]);
			count = baked.count;
			ghosts = baked.ghosts;
			reach = baked.reach;
		},
		draw({ frame, zoom, off, selected, shift }) {
			if (glc.lost) return;
			glc.resize();
			gl.clearColor(0, 0, 0, 0);
			gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
			if (!vao || !count) return;
			const { e, n, u } = frame.axis;
			// `meet` on a 900×600 viewBox: one viewBox unit is this many CSS px.
			const s = Math.min(glc.cssWidth / 900, glc.cssHeight / 600);
			gl.useProgram(prog);
			gl.bindVertexArray(vao);
			gl.uniformMatrix3fv(U.uAxis, false, [e.x, e.y, e.z, n.x, n.y, n.z, u.x, u.y, u.z]);
			gl.uniform1f(U.uStep, zoom);
			gl.uniform2f(U.uOff, off.x, off.y);
			gl.uniform2f(U.uPx, (2 * s) / glc.cssWidth, (2 * s) / glc.cssHeight);
			const shifts = shift.subarray(0, MAX_SHIFT * 3);
			// A dragged part may leave the baked reach; widen depth so it isn't clipped.
			const far = shifts.reduce((m, v) => Math.max(m, Math.abs(v)), 0);
			gl.uniform1f(U.uDepth, 1 / ((reach + far) * 4));
			if (shifts.length) gl.uniform3fv(U.uShift, shifts);
			gl.uniform3f(U.uLight, PIECE_LIGHT.x, PIECE_LIGHT.y, PIECE_LIGHT.z);
			gl.uniform3fv(U.uBg, ink.bg);
			gl.uniform3fv(U.uAccent, ink.accent);
			gl.uniform1f(U.uSel, selected);

			gl.enable(gl.DEPTH_TEST);
			gl.depthMask(true);
			gl.disable(gl.BLEND);
			gl.uniform1i(U.uPass, 0);
			gl.drawArrays(gl.TRIANGLES, 0, count);

			if (ghosts) {
				// X-ray shells over the solid interior: blended, tested, not written.
				gl.depthMask(false);
				gl.enable(gl.BLEND);
				// Alpha accumulates as coverage, or a ghost over empty canvas squares to nothing.
				gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
				gl.uniform1i(U.uPass, 1);
				gl.drawArrays(gl.TRIANGLES, 0, count);
			}
			gl.bindVertexArray(null);
		},
		dispose() {
			if (buffer) gl.deleteBuffer(buffer);
			if (vao) gl.deleteVertexArray(vao);
			gl.deleteProgram(prog);
			glc.dispose();
		}
	};
}
