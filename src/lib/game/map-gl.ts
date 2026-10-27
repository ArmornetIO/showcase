// ── game/map-gl — how a composed map is drawn ───────────────────────────────
// The shaders, camera matrices and token colours a `ComposedMap` is drawn
// with, shared by BREACH's first-person view and the Builder's 3D scenes, so a
// map looks the same walked as it does while it is being built.
//
// Baked vertices are the pieces' layout with an identity model, (x, −z, y): a
// proper rotation, so counter-clockwise-from-outside survives and the default
// `frontFace(CCW)` culls correctly.
import type { MapDef, Tone } from './map.js';

export const MAX_LIGHTS = 16;

export const MAP_VERT = `#version 300 es
in vec3 aLocal; in vec3 aNormal; in float aHNorm;
uniform mat4 uVP; uniform mat4 uModel; uniform vec3 uEye;
out vec3 vN; out float vH; out float vDist; out vec3 vW;
void main() {
	vec4 w = uModel * vec4(aLocal.x, aLocal.z, -aLocal.y, 1.0);
	vN = normalize(mat3(uModel) * vec3(aNormal.x, aNormal.z, -aNormal.y));
	vH = aHNorm;
	vDist = distance(w.xyz, uEye);
	vW = w.xyz;
	gl_Position = uVP * w;
}`;

// Three hard bands, not a ramp — the pieces' house look (see piece-mesh).
// uCode paints a screen as scrolling lines of text of ragged length, from
// world position so it needs no UVs: the rows climb with time.
// uAmb is the map's ambient as this viewer's cues leave it, tinted; the
// nearest MAX_LIGHTS prop lights add to it, their falloff banded in steps
// like the shade. A glowing surface ignores both: it is the light.
// One spot cone adds on top: uS is its origin and reach, uSD its direction and
// the cosine of its edge. A scene that never sets uSC (zero) has no spot.
// Fog reaches by how lit the surface is, not the eye: an unlit one greys and
// is gone by 14m, a lit one carries to uFar, so a lamp-lit room still reads
// down a black corridor and whoever stands in the dark between does not.
export const MAP_FRAG = `#version 300 es
precision mediump float;
in vec3 vN; in float vH; in float vDist; in vec3 vW;
uniform vec3 uColor; uniform vec3 uFog; uniform float uLit; uniform float uFar;
uniform float uCode; uniform float uTime;
uniform float uGlow; uniform vec3 uAmb; uniform int uLN;
uniform vec4 uL[${MAX_LIGHTS}]; uniform vec3 uLC[${MAX_LIGHTS}];
uniform vec4 uS; uniform vec4 uSD; uniform vec3 uSC;
out vec4 o;
void main() {
	float l = dot(vN, normalize(vec3(0.45, 1.0, 0.3)));
	float band = l > 0.6 ? 1.0 : l > 0.05 ? 0.7 : 0.48;
	vec3 c = mix(uColor, uColor * band * (0.8 + 0.3 * vH), uLit);
	if (uCode > 0.5) {
		float y = vW.y * 60.0 - uTime * 5.0;
		float len = fract(sin(floor(y) * 12.9898) * 43758.5453);
		float across = fract((vW.x + vW.z) * 1.8);
		float on = step(across, len) * step(0.2, len) * step(0.35, fract(y));
		c = mix(uColor * 0.15, uColor, on);
	}
	vec3 add = vec3(0.0);
	if (uGlow < 0.5) {
		for (int i = 0; i < ${MAX_LIGHTS}; i++) {
			if (i >= uLN) break;
			vec3 d = uL[i].xyz - vW;
			float r = max(length(d), 0.001);
			float f = clamp(1.0 - r / uL[i].w, 0.0, 1.0);
			f = ceil(f * f * 4.0) / 4.0;
			add += uLC[i] * f * mix(1.0, max(dot(vN, d / r), 0.0) * 0.8 + 0.2, uLit);
		}
		vec3 sd = uS.xyz - vW;
		float sr = max(length(sd), 0.001);
		float sf = clamp(1.0 - sr / max(uS.w, 0.001), 0.0, 1.0);
		sf = ceil(sf * sf * 4.0) / 4.0 * smoothstep(uSD.w, mix(uSD.w, 1.0, 0.3), dot(-sd / sr, uSD.xyz));
		add += uSC * sf * mix(1.0, max(dot(vN, sd / sr), 0.0) * 0.8 + 0.2, uLit);
		c = c * uAmb + uColor * add;
	}
	float lum = uGlow > 0.5 ? 1.0 : dot(uAmb + add, vec3(0.3, 0.59, 0.11));
	float lit = smoothstep(0.25, 0.8, lum);
	float fog = smoothstep(mix(1.5, uFar * 0.3, lit), mix(14.0, uFar, lit * lit), vDist);
	c = mix(c, vec3(dot(c, vec3(0.3, 0.59, 0.11))), fog * (1.0 - lit) * 0.8);
	o = vec4(mix(c, uFog, fog), 1.0);
}`;

export const MAP_ATTRIBS = [
	{ name: 'aLocal', size: 3 as const },
	{ name: 'aNormal', size: 3 as const },
	{ name: 'aHNorm', size: 1 as const }
];

export const IDENTITY = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);

// ── Tokens → GL colours ───────────────────────────────────────────────────
export type RGB = [number, number, number];

/** Painted over --bg on a 1px canvas so any CSS colour syntax (and alpha) reads
 *  back as sRGB. A `--name` is read off `el`; anything else is a colour. */
export function tokenRGB(el: HTMLElement, names: string[]): Record<string, RGB> {
	const css = getComputedStyle(el);
	const c = document.createElement('canvas').getContext('2d', { willReadFrequently: true })!;
	const out: Record<string, RGB> = {};
	for (const n of names) {
		c.fillStyle = css.getPropertyValue('--bg');
		c.fillRect(0, 0, 1, 1);
		c.fillStyle = n.startsWith('--') ? css.getPropertyValue(n) : n;
		c.fillRect(0, 0, 1, 1);
		const [r, g, b] = c.getImageData(0, 0, 1, 1).data;
		out[n] = [r / 255, g / 255, b / 255];
	}
	return out;
}

export const mix3 = (a: number[], b: number[], t: number) => a.map((v, i) => v + (b[i] - v) * t) as RGB;

/** Every colour a map's materials name. */
export const tonesOf = (def: MapDef) =>
	Object.values(def.materials).flatMap((m) =>
		[m.face, m.edge ?? []].flat().filter((t): t is string => typeof t === 'string')
	);

/** A tone, resolved against `T` (filled in on first use). */
export function toneRGB(el: HTMLElement, T: Record<string, RGB>, t: Tone): RGB {
	for (const n of typeof t === 'string' ? [t] : [t[0], t[1]]) T[n] ??= tokenRGB(el, [n])[n];
	return typeof t === 'string' ? T[t] : mix3(T[t[0]], T[t[1]], t[2]);
}

// ── Matrices (column-major) ───────────────────────────────────────────────
export function perspective(fovy: number, aspect: number, near: number, far: number): Float32Array {
	const f = 1 / Math.tan(fovy / 2),
		nf = 1 / (near - far);
	return new Float32Array([f / aspect, 0, 0, 0, 0, f, 0, 0, 0, 0, (far + near) * nf, -1, 0, 0, 2 * far * near * nf, 0]);
}

/** View from an eye with yaw (0 = looking −z) and pitch. */
export function view(ex: number, ey: number, ez: number, yaw: number, pitch: number): Float32Array {
	const cy = Math.cos(yaw),
		sy = Math.sin(yaw),
		cp = Math.cos(pitch),
		sp = Math.sin(pitch);
	const f = [sy * cp, sp, -cy * cp]; // forward
	const r = [cy, 0, sy]; // right
	const u = [r[1] * f[2] - r[2] * f[1], r[2] * f[0] - r[0] * f[2], r[0] * f[1] - r[1] * f[0]];
	const d = (a: number[]) => -(a[0] * ex + a[1] * ey + a[2] * ez);
	return new Float32Array([r[0], u[0], -f[0], 0, r[1], u[1], -f[1], 0, r[2], u[2], -f[2], 0, d(r), d(u), -d(f), 1]);
}

export function mul(a: Float32Array, b: Float32Array): Float32Array {
	const o = new Float32Array(16);
	for (let c = 0; c < 4; c++)
		for (let r = 0; r < 4; r++)
			o[c * 4 + r] = a[r] * b[c * 4] + a[4 + r] * b[c * 4 + 1] + a[8 + r] * b[c * 4 + 2] + a[12 + r] * b[c * 4 + 3];
	return o;
}

/** The 12 edges of an axis-aligned box, as LINES in the map vertex layout,
 *  written into `out` at `o`. Returns the offset past them. */
export function boxLines(out: Float32Array, o: number, x0: number, y0: number, z0: number, x1: number, y1: number, z1: number): number {
	const c = [[x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1], [x0, y1, z0], [x1, y1, z0], [x1, y1, z1], [x0, y1, z1]];
	for (const [a, b] of [[0, 1], [1, 2], [2, 3], [3, 0], [4, 5], [5, 6], [6, 7], [7, 4], [0, 4], [1, 5], [2, 6], [3, 7]])
		for (const [x, y, z] of [c[a], c[b]]) {
			out.set([x, -z, y, 0, 0, 1, 0], o);
			o += 7;
		}
	return o;
}

// ── Third person ──────────────────────────────────────────────────────────
/** An orbit: looking at `target` from `dist` metres, turned by yaw and pitch
 *  (negative pitch looks down). The same yaw/pitch `view` takes. */
export interface Orbit {
	target: { x: number; y: number; z: number };
	yaw: number;
	pitch: number;
	dist: number;
}

export function orbitEye(o: Orbit) {
	const cp = Math.cos(o.pitch);
	return {
		x: o.target.x - Math.sin(o.yaw) * cp * o.dist,
		y: o.target.y - Math.sin(o.pitch) * o.dist,
		z: o.target.z + Math.cos(o.yaw) * cp * o.dist
	};
}

/** Where a point on screen (−1..1 NDC, y up) meets the ground, y = 0. Null when
 *  the ray runs away from it — above the horizon. */
export function groundAt(o: Orbit, fovy: number, aspect: number, nx: number, ny: number) {
	const eye = orbitEye(o);
	const cy = Math.cos(o.yaw),
		sy = Math.sin(o.yaw),
		cp = Math.cos(o.pitch),
		sp = Math.sin(o.pitch);
	const f = [sy * cp, sp, -cy * cp];
	const r = [cy, 0, sy];
	const u = [r[1] * f[2] - r[2] * f[1], r[2] * f[0] - r[0] * f[2], r[0] * f[1] - r[1] * f[0]];
	const t = Math.tan(fovy / 2);
	const d = [0, 1, 2].map((i) => f[i] + r[i] * nx * t * aspect + u[i] * ny * t);
	if (d[1] >= -1e-6) return null;
	const k = -eye.y / d[1];
	return { x: eye.x + d[0] * k, z: eye.z + d[2] * k };
}
