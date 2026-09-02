// ── Edge-label chip placement ────────────────────────────────────────────────
//
// A chip's natural home is partway along its line, parked one chip-height off to
// the side. When many lines run close together — every member of a stack keeping
// its own link to the hub — those homes land on top of each other and the labels
// become an unreadable pile.
//
// So placement is resolved for ALL labelled edges at once, greedily: each chip
// takes the first spot in its ladder that collides with nothing already placed.
// The ladder slides ALONG the line first and only then steps further off it, so a
// chip stays as close to the line it annotates as the crowding allows.
//
// ── Why this is its own module ───────────────────────────────────────────────
// It lives outside MeshStudio because it is the most expensive thing the canvas
// does and the only part of it that is pure. A profile of a 300-agent mesh put
// the naive form at 21% of the main thread — edges × 56 candidate spots × every
// blocker on the canvas, ~14M overlap tests per recompute, redone whenever nodes
// or edges change identity (i.e. every poll). Two changes fixed that:
//
//  · a uniform grid, so a candidate spot tests only what is NEAR it
//  · branch-and-bound on the hit count — a count that reaches the best-so-far can
//    never win, so it is abandoned there rather than completed
//
// Both are invisible in the output: the greedy order and the ladder are unchanged
// and the result is identical spot-for-spot, which chip-placement.spec.ts asserts
// against a naive reference implementation. Keep it that way — this is a visual
// algorithm, and a regression here is a subtle mess nobody traces back.

export type Pt = { x: number; y: number };
export type ChipBox = { x: number; y: number; w: number; h: number };

/** Something a chip must not land on. Nodes contribute both: a disc for the body
 *  and a box for the caption beneath it. */
export type Blocker =
	| { kind: 'box'; box: ChipBox }
	| { kind: 'disc'; x: number; y: number; r: number };

export const CHIP_H = 14;
export const CHIP_PAD = 2.5;

/** Offsets step outward in alternating signs so a crowded bundle fans to both
 *  sides of its lines rather than drifting one way. */
export const CHIP_OFFSETS = [11, -11, 19, -19, 27, -27, 35, -35];
/** Positions along the edge, natural home first. */
export const CHIP_TS = [0.68, 0.61, 0.75, 0.54, 0.82, 0.47, 0.89];

/** Grid cell size. Comfortably larger than a chip so a query touches few cells,
 *  small enough that a cell holds few blockers on a dense canvas. */
const CELL = 96;

export function chipsOverlap(a: ChipBox, b: ChipBox): boolean {
	return (
		Math.abs(a.x - b.x) * 2 < a.w + b.w + CHIP_PAD * 2 &&
		Math.abs(a.y - b.y) * 2 < a.h + b.h + CHIP_PAD * 2
	);
}

export function chipHitsDisc(c: ChipBox, d: { x: number; y: number; r: number }): boolean {
	// Distance from the disc's centre to the chip's rectangle: zero on each axis
	// the centre already falls within, so this handles side, corner and inside.
	const dx = Math.max(Math.abs(d.x - c.x) - c.w / 2 - CHIP_PAD, 0);
	const dy = Math.max(Math.abs(d.y - c.y) - c.h / 2 - CHIP_PAD, 0);
	return dx * dx + dy * dy < d.r * d.r;
}

export function chipBlocked(c: ChipBox, b: Blocker): boolean {
	return b.kind === 'disc' ? chipHitsDisc(c, b) : chipsOverlap(c, b.box);
}

/** One labelled edge, reduced to what placement actually needs. The caller keeps
 *  ownership of edge geometry; this module only knows points and widths. */
export interface ChipCandidate {
	/** Edge id — the key the resulting map is addressed by. */
	id: string;
	/** Rendered chip width. */
	w: number;
	/** Unit normal to the edge; the ladder steps along it. */
	nx: number;
	ny: number;
	/** A point per CHIP_TS entry, in order. Null where the edge has no geometry
	 *  at that position (a zero-length edge, an endpoint that failed to resolve). */
	pts: (Pt | null)[];
}

// ── Uniform grid ─────────────────────────────────────────────────────────────
// Cells hold INDICES into `all`, and a stamp array dedupes a blocker that spans
// several cells — a Set per candidate spot would allocate 56 times per chip.

interface Grid {
	all: Blocker[];
	cells: Map<number, number[]>;
	stamp: Int32Array;
	query: number;
}

const key = (cx: number, cy: number) => cx * 73856093 + cy * 19349663;

function newGrid(capacity: number): Grid {
	return { all: [], cells: new Map(), stamp: new Int32Array(Math.max(16, capacity)), query: 0 };
}

function bounds(b: Blocker): { x0: number; y0: number; x1: number; y1: number } {
	if (b.kind === 'disc') return { x0: b.x - b.r, y0: b.y - b.r, x1: b.x + b.r, y1: b.y + b.r };
	const { x, y, w, h } = b.box;
	return { x0: x - w / 2, y0: y - h / 2, x1: x + w / 2, y1: y + h / 2 };
}

function add(g: Grid, b: Blocker): void {
	const idx = g.all.length;
	g.all.push(b);
	if (idx >= g.stamp.length) {
		const next = new Int32Array(g.stamp.length * 2);
		next.set(g.stamp);
		g.stamp = next;
	}
	const { x0, y0, x1, y1 } = bounds(b);
	const cx1 = Math.floor(x1 / CELL);
	const cy1 = Math.floor(y1 / CELL);
	for (let cx = Math.floor(x0 / CELL); cx <= cx1; cx++)
		for (let cy = Math.floor(y0 / CELL); cy <= cy1; cy++) {
			const k = key(cx, cy);
			const list = g.cells.get(k);
			if (list) list.push(idx);
			else g.cells.set(k, [idx]);
		}
}

/** How many placed things this box overlaps, abandoning the count once it reaches
 *  `cap` — the caller only compares against the best-so-far, so counting past it
 *  is wasted work. Pass Infinity for an exact count. */
function countBlocked(g: Grid, box: ChipBox, cap: number): number {
	const q = ++g.query;
	const cx1 = Math.floor((box.x + box.w / 2 + CHIP_PAD) / CELL);
	const cy1 = Math.floor((box.y + box.h / 2 + CHIP_PAD) / CELL);
	let n = 0;
	for (let cx = Math.floor((box.x - box.w / 2 - CHIP_PAD) / CELL); cx <= cx1; cx++)
		for (let cy = Math.floor((box.y - box.h / 2 - CHIP_PAD) / CELL); cy <= cy1; cy++) {
			const list = g.cells.get(key(cx, cy));
			if (!list) continue;
			for (let i = 0; i < list.length; i++) {
				const idx = list[i];
				// spans several cells — count it once per query
				if (g.stamp[idx] === q) continue;
				g.stamp[idx] = q;
				if (chipBlocked(box, g.all[idx])) {
					n++;
					if (n >= cap) return n;
				}
			}
		}
	return n;
}

/**
 * Resolve every chip's position at once.
 *
 * `blockers` are already "placed" before any chip is: a chip may be pushed off
 * its line to clear a node, but a node never moves to make room for a chip.
 * Candidates are consumed in order and each placed chip becomes a blocker for
 * the ones after it, so the order the caller supplies is the priority order.
 *
 * A candidate that finds no free spot still lands — at the position overlapping
 * the fewest neighbours — rather than being dropped onto the pile at its natural
 * home. Only a candidate with no usable geometry at all is omitted from the map.
 */
export function placeChips(
	candidates: ChipCandidate[],
	blockers: Blocker[]
): Map<string, ChipBox> {
	const out = new Map<string, ChipBox>();
	const grid = newGrid(blockers.length + candidates.length);
	for (const b of blockers) add(grid, b);

	for (const c of candidates) {
		let best: ChipBox | null = null;
		let bestHits = Infinity;
		outer: for (const off of CHIP_OFFSETS) {
			for (let i = 0; i < c.pts.length; i++) {
				const at = c.pts[i];
				if (!at) continue;
				const box = { x: at.x + c.nx * off, y: at.y + c.ny * off, w: c.w, h: CHIP_H };
				// Exact for the first candidate spot (nothing to beat yet), bounded
				// after — a count that reaches the best-so-far can never win.
				const hits = countBlocked(grid, box, bestHits);
				if (hits === 0) {
					best = box;
					break outer;
				}
				if (hits < bestHits) {
					bestHits = hits;
					best = box;
				}
			}
		}
		if (best) {
			add(grid, { kind: 'box', box: best });
			out.set(c.id, best);
		}
	}
	return out;
}
