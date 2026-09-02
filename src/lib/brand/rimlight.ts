// ── logo-nanotech · one lamp, and every edge answering to it ─────────────────
// The first cut swept a bright shape ACROSS the mark. That is a glare, not a
// light: the shield's own contours went on glowing at whatever constant the rim
// pass was set to, so a highlight would slide over an edge and the edge would
// not react. Nothing on screen agreed about where the light was, which is why it
// read as an effect laid over a picture rather than as a picture being lit.
//
// So: a single lamp, at a real position in the mark's own box, in front of it.
// Every contour the chrome cut draws — outer, frame mid, frame inner, floating
// rim — is broken into its edges, each edge is given the normal the BEVEL there
// would have, and each one is shaded from that lamp. The travelling highlight is
// then not drawn at all. It is what happens when the lamp goes past.
//
// The one thing that makes this cheap enough to be worth it: the contours are
// already computed by `chromeContours`, and an edge's normal falls out of its
// direction. There is no new geometry here, only a normal per segment.
//
// Pure: no Svelte, no DOM, no clock. The page supplies the lamp.

import { chromeContours } from '../icons/ArmornetCrestChrome.svelte';
import { LOGO_SHAPE } from '../icons/ArmornetLogo.svelte';
import type { Pt } from '../icons/ArmornetCrestMesh.svelte';

/** Which of the mark's four contours an edge belongs to. */
export type Band = 'outer' | 'mid' | 'inner' | 'rim';

/**
 * How the bevel stands at each contour, as (tilt from facing the viewer, which
 * way it leans).
 *
 * The signs are the emboss and they are the whole reason this is four bands and
 * not one outline. The outer edge is the top of the wall and leans OUT; the
 * frame's inner edge is the far side of the same wall and leans IN. Give them
 * the same normal and the frame lights evenly, which is what a sticker does.
 * Opposed, one is brightest exactly where the other is dying, and the band
 * between them reads as having thickness.
 */
const BEVEL: Record<Band, { tilt: number; sign: 1 | -1; weight: number; gain: number }> = {
	outer: { tilt: 0.94, sign: 1, weight: 2.6, gain: 1 },
	mid: { tilt: 0.6, sign: 1, weight: 1.3, gain: 0.6 },
	inner: { tilt: 0.86, sign: -1, weight: 1.7, gain: 0.85 },
	rim: { tilt: 0.5, sign: -1, weight: 1.1, gain: 0.45 }
};

export interface ContourEdge {
	d: string;
	/** Endpoints, kept because the contour is the mark's SILHOUETTE and other
	 *  passes want to walk it — sampling seats along it, for one. Re-parsing `d`
	 *  downstream would work and would also mean two readers of the same numbers. */
	x0: number;
	y0: number;
	x1: number;
	y1: number;
	/** Midpoint, where the lamp is sampled. */
	mx: number;
	my: number;
	/** Unit surface normal, y DOWN, +z toward the viewer. */
	nx: number;
	ny: number;
	nz: number;
	band: Band;
	weight: number;
	gain: number;
}

const r2 = (v: number) => Math.round(v * 100) / 100;

/** Pull the polygon back out of a contour's `d`.
 *
 *  Parsing rather than re-deriving. `chromeContours` builds all four by mitring
 *  ONE segment list, and re-running that here with the frame widths copied over
 *  would put a second opinion about the shield's wall in a second file — which
 *  is the exact failure the chrome component's own comments are about. The `d`
 *  it hands back is straight-line `M…L…Z` by construction, so reading the
 *  numbers off it recovers the polygon exactly. */
function parsePoly(d: string): Pt[] {
	const n = d.match(/-?\d+(?:\.\d+)?/g);
	if (!n) return [];
	const out: Pt[] = [];
	for (let i = 0; i + 1 < n.length; i += 2) out.push([parseFloat(n[i]), parseFloat(n[i + 1])]);
	return out;
}

/** Every edge of every contour, with the normal its bevel would have. */
export function buildEdges(shape = LOGO_SHAPE): ContourEdge[] {
	const C = chromeContours(shape);
	const bands: [Band, Pt[]][] = [
		['outer', parsePoly(C.outer)],
		['mid', parsePoly(C.mid)],
		['inner', parsePoly(C.inner)],
		['rim', parsePoly(C.rim)]
	];

	const out: ContourEdge[] = [];
	for (const [band, poly] of bands) {
		const b = BEVEL[band];
		const s = Math.sin(b.tilt) * b.sign;
		const c = Math.cos(b.tilt);
		for (let i = 0; i < poly.length; i++) {
			const [x0, y0] = poly[i];
			const [x1, y1] = poly[(i + 1) % poly.length];
			const dx = x1 - x0;
			const dy = y1 - y0;
			const L = Math.hypot(dx, dy);
			if (L < 1e-6) continue;
			// Outward for a clockwise polygon in y-down space — the same handedness
			// `insetPoints` assumes when it offsets inward.
			out.push({
				d: `M${r2(x0)} ${r2(y0)}L${r2(x1)} ${r2(y1)}`,
				x0,
				y0,
				x1,
				y1,
				mx: (x0 + x1) / 2,
				my: (y0 + y1) / 2,
				nx: (dy / L) * s,
				ny: (-dx / L) * s,
				nz: c,
				band,
				weight: b.weight,
				gain: b.gain
			});
		}
	}
	return out;
}

/** A point light in the mark's own box. `z` is how far in FRONT of the face it
 *  sits: small is a bare bulb held against the shield and picks out one edge at
 *  a time, large tends to directional and lights half the mark at once. */
export interface Lamp {
	x: number;
	y: number;
	z: number;
}

/**
 * How brightly one edge answers.
 *
 * Blinn–Phong, which is the cheapest model that still gets the thing the eye is
 * actually watching for: the specular lobe is tied to the HALFWAY vector, so the
 * highlight walks along a curved contour as the lamp moves instead of switching
 * on and off per segment. A pure `dot(normal, light)` would light the whole
 * left flank at once and never travel.
 */
export function edgeLight(e: ContourEdge, lamp: Lamp): number {
	const dx = lamp.x - e.mx;
	const dy = lamp.y - e.my;
	const L = Math.hypot(dx, dy, lamp.z);
	const lx = dx / L;
	const ly = dy / L;
	const lz = lamp.z / L;

	const diff = Math.max(0, e.nx * lx + e.ny * ly + e.nz * lz);

	const hz = lz + 1;
	const hl = Math.hypot(lx, ly, hz);
	const spec = Math.pow(Math.max(0, (e.nx * lx + e.ny * ly + e.nz * hz) / hl), 30);

	// Inverse-square would be correct and is wrong here: the lamp travels within
	// a couple of shield-widths, so true falloff swamps the shading and the mark
	// just gets brighter on one side. Softened to a gentle bias.
	const att = 1 / (1 + Math.pow(L / 260, 2));
	return (diff * 0.3 + spec * 1.75) * att * e.gain;
}

/**
 * The specular dot on a ball joint — same lamp, so the figure cannot disagree
 * with the shield about where the light is.
 *
 * Offset toward the lamp by a fraction of the radius rather than placed by
 * projecting a real sphere: on a ball this small the difference is under a pixel
 * and the fraction is a dial you can actually tune.
 */
export function ballLight(cx: number, cy: number, r: number, lamp: Lamp) {
	const dx = lamp.x - cx;
	const dy = lamp.y - cy;
	const L = Math.hypot(dx, dy, lamp.z) || 1;
	const k = 0.52;
	return {
		x: cx + (dx / L) * r * k,
		y: cy + (dy / L) * r * k,
		r: r * 0.3,
		level: (lamp.z / L) * (1 / (1 + Math.pow(L / 300, 2)))
	};
}

/**
 * Where along a tube the lamp's highlight sits, and how hard.
 *
 * The lamp is projected onto the run and clamped to it, which is the correct
 * place for the brightest point on a cylinder lit from the side. `across` is how
 * far off the axis the lamp is, and it kills the highlight when the lamp is
 * nowhere near — without it every tube keeps a hotspot pinned to whichever end
 * is closest, forever.
 */
export function tubeLight(a: Pt, b: Pt, lamp: Lamp) {
	const ex = b[0] - a[0];
	const ey = b[1] - a[1];
	const len2 = ex * ex + ey * ey || 1;
	const u = Math.max(0, Math.min(1, ((lamp.x - a[0]) * ex + (lamp.y - a[1]) * ey) / len2));
	const x = a[0] + ex * u;
	const y = a[1] + ey * u;
	const across = Math.hypot(lamp.x - x, lamp.y - y);
	return { x, y, level: Math.exp(-Math.pow(across / 64, 2)) };
}
