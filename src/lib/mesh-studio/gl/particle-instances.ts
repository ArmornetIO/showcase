// ── mesh-studio/gl/particle-instances — edge runs → one packed buffer ────────
// Takes the studio's particle edges and flattens them to the format
// `particle-shaders` reads. Repacked only when the edges, the theme or the
// tuning change — never per frame. Everything that varies with TIME is left to
// the shader's one clock uniform, which is the entire reason this pass is cheap.

import { bowControl, type EdgeCurve, type EdgePoint } from '../../primitives/canvas/edge-path.js';
import { PARTICLE_FLOATS, KIND_CUBIC, KIND_ELBOW } from './particle-shaders.js';

/** One edge's worth of particles, already resolved.
 *
 *  Colour, speed and count arrive resolved rather than as an edge, for the same
 *  reason `InstanceStyle` does: the precedence between a data type's hue, the
 *  tuning's energy colour and the theme's ink is a STUDIO decision, and a second
 *  copy of that ordering here is how the two would drift apart. */
export interface ParticleRun {
	a: EdgePoint;
	b: EdgePoint;
	curve: EdgeCurve;
	/** Any CSS colour the theme can hand back — see `cssRgb`. */
	color: string;
	/** Seconds for one traversal. */
	dur: number;
	count: number;
	/** Particle radius in WORLD units, matching the SVG circle's `r`. */
	size: number;
}

export interface ParticlePack {
	data: Float32Array;
	count: number;
}

/** `#rgb`, `#rrggbb`, `rgb()` and `rgba()` → three 0..1 floats.
 *
 *  Those four are what `meshPalette.ink` can return: it resolves a hue to the
 *  theme's hex, and re-spells an alpha-carrying input as `rgba()`. Anything else
 *  it passes through unchanged — including a `var(--palette-*)` name, which has
 *  no value outside a live element — so an unparseable colour falls back to the
 *  caller's default rather than to grey. A grey particle looks like a themed
 *  decision; the default looks like the untinted edge it belongs to. */
export function cssRgb(color: string, fallback: [number, number, number]): [number, number, number] {
	const s = color.trim().toLowerCase();

	if (s.startsWith('#')) {
		const h = s.slice(1);
		if (h.length === 3) {
			const n = parseInt(h[0] + h[0] + h[1] + h[1] + h[2] + h[2], 16);
			if (Number.isFinite(n)) return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
		}
		if (h.length === 6 || h.length === 8) {
			const n = parseInt(h.slice(0, 6), 16);
			if (Number.isFinite(n)) return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
		}
		return fallback;
	}

	const m = s.match(/^rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)/);
	// Alpha is deliberately dropped. The particle's opacity is the sprite's own
	// falloff, and multiplying a themed alpha into it dimmed the dot twice.
	if (m) return [Number(m[1]) / 255, Number(m[2]) / 255, Number(m[3]) / 255];

	return fallback;
}

/** The four `EdgeCurve` kinds as a cubic, where one exists.
 *
 *  `line` and `bow` are exact: a segment is a degenerate cubic, and a quadratic
 *  raises to a cubic without loss (`c1 = p0 + ⅔(c−p0)`). `elbow` is the odd one
 *  out — a two-segment polyline is not a cubic at any degree — so it is flagged
 *  for the shader's own branch and its control points are left unused. */
function controls(a: EdgePoint, b: EdgePoint, curve: EdgeCurve): { c1: EdgePoint; c2: EdgePoint; kind: number } {
	if (curve === 'bow') {
		const { cx, cy } = bowControl(a, b);
		return {
			c1: { x: a.x + (2 / 3) * (cx - a.x), y: a.y + (2 / 3) * (cy - a.y) },
			c2: { x: b.x + (2 / 3) * (cx - b.x), y: b.y + (2 / 3) * (cy - b.y) },
			kind: KIND_CUBIC,
		};
	}
	if (curve === 'bezier') {
		// Mirrors `edgePathBetween`'s horizontal-first handles exactly; the particle
		// has to ride the line that is drawn, not one that merely resembles it.
		const dx = (b.x - a.x) * 0.4;
		return { c1: { x: a.x + dx, y: a.y }, c2: { x: b.x - dx, y: b.y }, kind: KIND_CUBIC };
	}
	if (curve === 'elbow') {
		return { c1: a, c2: b, kind: KIND_ELBOW };
	}
	return {
		c1: { x: a.x + (b.x - a.x) / 3, y: a.y + (b.y - a.y) / 3 },
		c2: { x: a.x + (2 * (b.x - a.x)) / 3, y: a.y + (2 * (b.y - a.y)) / 3 },
		kind: KIND_CUBIC,
	};
}

/**
 * Flatten every run's particles into one buffer — one vertex per particle.
 *
 * `reuse` is grown but never shrunk, so a scene that briefly spikes to a
 * thousand particles keeps the allocation. Repacking runs on an edge change,
 * which can be every frame while a node is being dragged, and a fresh
 * Float32Array per frame is exactly the garbage this pass exists to stop
 * generating.
 */
export function packParticles(
	runs: ParticleRun[],
	fallback: [number, number, number],
	reuse?: Float32Array,
): ParticlePack {
	let total = 0;
	for (const r of runs) total += Math.max(0, r.count);

	const need = total * PARTICLE_FLOATS;
	const data = reuse && reuse.length >= need ? reuse : new Float32Array(Math.max(need, 64 * PARTICLE_FLOATS));
	if (!total) return { data, count: 0 };

	let o = 0;
	for (const r of runs) {
		if (r.count <= 0) continue;
		const { c1, c2, kind } = controls(r.a, r.b, r.curve);
		const [cr, cg, cb] = cssRgb(r.color, fallback);
		// Guard the divide rather than the caller: a zero-length edge is a legitimate
		// transient while a node is dragged onto another, and an infinite rate turns
		// every particle on that edge into a full-screen flicker.
		const rate = 1 / Math.max(r.dur, 0.05);

		for (let i = 0; i < r.count; i++) {
			data[o + 0] = r.a.x;
			data[o + 1] = r.a.y;
			data[o + 2] = c1.x;
			data[o + 3] = c1.y;
			data[o + 4] = c2.x;
			data[o + 5] = c2.y;
			data[o + 6] = r.b.x;
			data[o + 7] = r.b.y;
			data[o + 8] = cr;
			data[o + 9] = cg;
			data[o + 10] = cb;
			// The stagger that makes a stream out of a clump. The SVG spelled it as
			// `begin="{(i/count) * dur}s"` plus an opacity freeze to hide the
			// particles that had not started yet — a phase offset needs neither,
			// because every particle is already somewhere on the path at t=0.
			data[o + 11] = r.count > 1 ? i / r.count : 0;
			data[o + 12] = rate;
			data[o + 13] = r.size;
			data[o + 14] = kind;
			o += PARTICLE_FLOATS;
		}
	}

	return { data, count: total };
}
