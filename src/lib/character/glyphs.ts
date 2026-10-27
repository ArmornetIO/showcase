// ── character · marks, as solids ─────────────────────────────────────────────
// The emblems, drawn the way everything else on this model is drawn: extruded
// plates in the character's own frame, culled, shaded and sorted by the one
// pass that draws the body. There is no second art pipeline here — no bezier
// paths, no `{@html}`, no private viewBox.
//
// WHY A GLYPH IS A LIST, not a shape. `prism` demands a CONVEX footprint, and
// almost no mark is convex: a chevron is not, a star is not, a ring is not, an
// X is not. Convexity is not a limitation to route around — it is what makes
// back-face culling exact with no z-buffer, which is the whole reason this
// renderer is fast enough to run a hundred figures. So a mark is decomposed
// into the convex pieces it is made of, which for marks at this size is two to
// six plates. A star is a pentagon and five points; a ring is its segments.
//
// Authored in a ±1 box with Y UP, then extruded thin and tipped upright by
// `glyph()`. Author flat, wear it standing — the same outline can then be a
// badge on a chest, a device on a flag, or a token on a table without being
// redrawn for each.

import { prism, type Solid } from '../mesh-studio/pieces/pieces.js';
import { ccw, tip } from './solids.js';
import { CRESTLINK_NODE_R, insetPoints, outlinePoly, placeFigure, type Pt } from '../icons/ArmornetCrestMesh.svelte';

// The filled logo's mask weights, in its 24-unit box (ArmornetCrestMesh.svelte),
// made heavier: the chest mark is ~17 mm tall on a 96 mm print, where the
// screen weights come out at 0.37–0.54 mm lines — under a 0.4 nozzle's reach.
// 1.25 lifts the thinnest to ~0.46 mm and still leaves the rings open; at 1.6
// the spoke tips filled the rings and the mark read as blobs.
const PRINT_WEIGHT = 1.25;
const WALL_W = 0.5 * PRINT_WEIGHT;
const INNER_WALL = 1.05;
const INNER_WALL_W = 0.4 * PRINT_WEIGHT;
import { LOGO_GEOMETRY } from '../icons/ArmornetLogo.svelte';

/** A mark: the convex plates it decomposes into, each wound however the author
 *  found natural — `glyph()` fixes the winding rather than trusting it. */
export type Glyph = [number, number][][];

// ── Outline helpers ──────────────────────────────────────────────────────────

/** A quad of width `w` laid along a segment. Most marks are bars: a chevron is
 *  two, a saltire is two, a tally is four. */
function bar(
	x0: number,
	y0: number,
	x1: number,
	y1: number,
	w: number
): [number, number][] {
	const dx = x1 - x0;
	const dy = y1 - y0;
	const len = Math.hypot(dx, dy) || 1;
	const mx = (-dy / len) * w;
	const my = (dx / len) * w;
	return [
		[x0 + mx, y0 + my],
		[x1 + mx, y1 + my],
		[x1 - mx, y1 - my],
		[x0 - mx, y0 - my]
	];
}

/** A regular k-gon. The stand-in for every circle here: at the size a mark is
 *  read, eight sides is a circle and costs eight edges. */
const disc = (r: number, k = 8, cx = 0, cy = 0, phase = 0): [number, number][] =>
	Array.from({ length: k }, (_, i) => {
		const th = phase + (i / k) * Math.PI * 2;
		return [cx + Math.cos(th) * r, cy + Math.sin(th) * r] as [number, number];
	});

/** An annulus as `k` trapezoids — the shape a convex kernel cannot hold whole.
 *  A ring drawn as a disc with a smaller disc on top would be a disc: there is
 *  no subtraction here, only parts. */
function annulus(r: number, w: number, k = 12, cx = 0, cy = 0): Glyph {
	return Array.from({ length: k }, (_, i) => {
		const a = (i / k) * Math.PI * 2;
		const b = ((i + 1) / k) * Math.PI * 2;
		const p = (t: number, rr: number): [number, number] => [
			cx + Math.cos(t) * rr,
			cy + Math.sin(t) * rr
		];
		return [p(a, r - w), p(b, r - w), p(b, r + w), p(a, r + w)];
	});
}

/** The part of a convex outline between heights `y0` and `y1` — itself convex. */
function band(poly: [number, number][], y0: number, y1: number): [number, number][] {
	const clip = (pts: [number, number][], y: number, keep: 1 | -1) =>
		pts.flatMap((a, i): [number, number][] => {
			const b = pts[(i + 1) % pts.length];
			const [sa, sb] = [(a[1] - y) * keep, (b[1] - y) * keep];
			const out: [number, number][] = sa >= 0 ? [a] : [];
			if (sa * sb < 0) out.push([a[0] + ((b[0] - a[0]) * sa) / (sa - sb), y]);
			return out;
		});
	return clip(clip(poly, y0, 1), y1, -1);
}

/** A triangle, as the author wrote it. */
const tri = (
	a: [number, number],
	b: [number, number],
	c: [number, number]
): [number, number][] => [a, b, c];

/**
 * The filled Armornet mark, traced off the logo's own geometry rather than
 * redrawn, so a retuned shield moves the chest plate with it. Two glyphs,
 * because the logo's figure is PUNCHED through the shield and a convex kernel
 * cannot punch: the wearer lays the figure over the shield in a darker material
 * instead, which a print renders as relief.
 */
function logoMark(): {
	shield: Glyph;
	figure: Glyph;
	halfWidth: number;
	/** Where the figure's rings sit, for a stencil that must bridge them. */
	hub: [number, number];
	nodes: [number, number][];
	nodeR: number;
	stroke: number;
} {
	const outline = outlinePoly(LOGO_GEOMETRY, 12);
	const ys = outline.map((p) => p[1]);
	const cy = (Math.min(...ys) + Math.max(...ys)) / 2;
	const s = 1 / (cy - Math.min(...ys));
	// SVG is y-down about (12, cy); a glyph is y-up about the origin.
	const to = ([x, y]: Pt): [number, number] => [(x - 12) * s, (cy - y) * s];

	// The shield is convex except where the key notch cuts the crown. Each ear
	// tip (a convex corner beside a reflex one) is cut off as a triangle, and
	// what remains is the convex body.
	const n = outline.length;
	const at = (i: number) => outline[(i + n) % n];
	const turn = (i: number) => {
		const [a, b, c] = [at(i - 1), at(i), at(i + 1)];
		return (b[0] - a[0]) * (c[1] - b[1]) - (b[1] - a[1]) * (c[0] - b[0]);
	};
	const sense = Math.sign(outline.reduce((t, _, i) => t + turn(i), 0));
	const reflex = (i: number) => Math.sign(turn(i)) === -sense;
	const tip = (i: number) => !reflex(i) && (reflex(i - 1) || reflex(i + 1));
	const idx = outline.map((_, i) => i);
	// The body in horizontal bands. Whole, it is one face whose centre sits
	// mid-shield, and from any camera above it the sort put it over the figure's
	// lower strokes: the inner wall vanished below the nodes.
	const body = idx.filter((i) => !tip(i)).map((i) => to(at(i)));
	const BANDS = 8;
	const shield: Glyph = [
		...Array.from({ length: BANDS }, (_, k) => band(body, -1 + (2 * k) / BANDS, -1 + (2 * (k + 1)) / BANDS)).filter(
			(p) => p.length >= 3
		),
		...idx.filter(tip).map((i) => [at(i - 1), at(i), at(i + 1)].map(to))
	];

	// Everything the filled logo's mask cuts, at the mask's own weights: the
	// inner wall, the spokes, a ring per satellite and the solid hub.
	const wall = (t: number) => insetPoints(outline, t);
	const [w0, w1] = [wall(INNER_WALL - INNER_WALL_W / 2), wall(INNER_WALL + INNER_WALL_W / 2)];
	const innerWall: Glyph = outline.map((_, i) => {
		const j = (i + 1) % n;
		return [w0[i], w0[j], w1[j], w1[i]].map(to);
	});
	const f = placeFigure(LOGO_GEOMETRY);
	const fk = f.nodeR / CRESTLINK_NODE_R;
	const half = (WALL_W / 2) * fk * s;
	// The hub is a solid disc, so it keeps the screen stroke: thickening it for
	// the nozzle only made it outgrow the logo's proportions.
	const hubR = (f.hubR + (WALL_W / PRINT_WEIGHT / 2) * fk) * s;
	const [hx, hy] = to(f.hub);
	// Each spoke ends in the node's centre on a round cap, as the SVG's
	// `stroke-linecap: round` draws it: a dot inside the ring, not a stub.
	const figure: Glyph = [
		...innerWall,
		disc(hubR, 32, hx, hy),
		...f.nodes.flatMap((p) => {
			const [nx, ny] = to(p);
			return [...annulus(f.nodeR * s, half, 24, nx, ny), bar(hx, hy, nx, ny, half), disc(half, 12, nx, ny)];
		})
	];
	const halfWidth = Math.max(...outline.map((p) => Math.abs(to(p)[0])));
	return { shield, figure, halfWidth, hub: [hx, hy], nodes: f.nodes.map(to), nodeR: f.nodeR * s, stroke: 2 * half };
}

export const LOGO = logoMark();

// ── The marks ────────────────────────────────────────────────────────────────
// The ten the game ships. Each is the SAME device the flat set carried, cut
// into convex pieces — the point is that the roster's emblems did not change,
// only what they are made of.

export const GLYPHS: Record<string, Glyph> = {
	chevron: [bar(-0.82, -0.12, 0, 0.58, 0.2), bar(0, 0.58, 0.82, -0.12, 0.2)],

	bars: [bar(-0.72, 0.42, 0.72, 0.42, 0.13), bar(-0.72, 0, 0.72, 0, 0.13), bar(-0.72, -0.42, 0.72, -0.42, 0.13)],

	// A pentagon and five points. The decomposition a star actually has.
	star: [
		disc(0.3, 5, 0, 0, Math.PI / 2),
		...Array.from({ length: 5 }, (_, i) => {
			const th = Math.PI / 2 + (i / 5) * Math.PI * 2;
			const sp = th + Math.PI / 5;
			const sm = th - Math.PI / 5;
			return tri(
				[Math.cos(th) * 0.95, Math.sin(th) * 0.95],
				[Math.cos(sm) * 0.3, Math.sin(sm) * 0.3],
				[Math.cos(sp) * 0.3, Math.sin(sp) * 0.3]
			);
		})
	],

	ring: annulus(0.66, 0.15),

	cross: [bar(-0.68, -0.68, 0.68, 0.68, 0.17), bar(-0.68, 0.68, 0.68, -0.68, 0.17)],

	wedge: [tri([0, 0.82], [-0.78, -0.6], [0.78, -0.6])],

	// Head and shaft — the outline of a keyhole is a circle meeting a taper, and
	// that is exactly two convex pieces.
	keyhole: [disc(0.42, 8, 0, 0.34), [[-0.17, 0.34], [0.17, 0.34], [0.36, -0.82], [-0.36, -0.82]]],

	// A lens is two arcs meeting at points, so: two fans off the centre line,
	// plus the pupil.
	eye: [
		[[-0.92, 0], [-0.4, 0.4], [0.4, 0.4], [0.92, 0]],
		[[-0.92, 0], [0.92, 0], [0.4, -0.4], [-0.4, -0.4]],
		disc(0.26, 8)
	],

	skull: [disc(0.62, 8, 0, 0.16), [[-0.34, -0.3], [0.34, -0.3], [0.28, -0.86], [-0.28, -0.86]]],

	crown: [
		bar(-0.74, -0.44, 0.74, -0.44, 0.22),
		tri([-0.74, -0.22], [-0.4, 0.72], [-0.06, -0.22]),
		tri([-0.34, -0.22], [0, 0.86], [0.34, -0.22]),
		tri([0.06, -0.22], [0.4, 0.72], [0.74, -0.22])
	],

	// A dial and a hand: the mark of somebody who was here at the start.
	zero: [...annulus(0.72, 0.13), bar(0, 0, 0, 0.46, 0.09), bar(0, 0, 0.32, 0, 0.09)]
};

export const glyphKeys = Object.keys(GLYPHS);

/**
 * A mark, standing up and facing forward.
 *
 * `scale` is the mark's half-size in the wearer's units; `thick` how far it
 * stands off whatever it is mounted on. Thin is the point — the user's rule is
 * that a super-skinny solid is fine and an SVG is not, because one of them goes
 * through the renderer everything else goes through.
 */
export function glyph(g: Glyph, scale: number, thick: number): Solid[] {
	return g.map((foot) =>
		tip(
			prism(ccw(foot.map(([x, y]) => [x * scale, y * scale] as [number, number])), 0, thick),
			Math.PI / 2
		)
	);
}
