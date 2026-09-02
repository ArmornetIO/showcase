import { describe, it, expect } from 'vitest';
import {
	placeChips,
	chipsOverlap,
	chipHitsDisc,
	chipBlocked,
	CHIP_H,
	CHIP_OFFSETS,
	CHIP_TS,
	type Blocker,
	type ChipBox,
	type ChipCandidate,
	type Pt
} from './chip-placement.js';

// ── Reference implementation ─────────────────────────────────────────────────
// The shape the solver had before it was optimised: no grid, no bound, every
// candidate spot tested against every blocker with `.filter().length`. It is the
// definition of correct here — the fast path is only allowed to be faster, never
// different — so the equivalence test below is the load-bearing one. If you change
// placement BEHAVIOUR on purpose, change this too, deliberately, in the same diff.
function referencePlaceChips(
	candidates: ChipCandidate[],
	blockers: Blocker[]
): Map<string, ChipBox> {
	const out = new Map<string, ChipBox>();
	const placed: Blocker[] = [...blockers];
	for (const c of candidates) {
		let best: ChipBox | null = null;
		let bestHits = Infinity;
		outer: for (const off of CHIP_OFFSETS) {
			for (let i = 0; i < c.pts.length; i++) {
				const at = c.pts[i];
				if (!at) continue;
				const box = { x: at.x + c.nx * off, y: at.y + c.ny * off, w: c.w, h: CHIP_H };
				const hits = placed.filter((p) => chipBlocked(box, p)).length;
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
			placed.push({ kind: 'box', box: best });
			out.set(c.id, best);
		}
	}
	return out;
}

// ── Scene generator ──────────────────────────────────────────────────────────
// Seeded, so a failure is reproducible and two runs compare the same scene.
function mulberry(seed: number): () => number {
	let a = seed >>> 0;
	return () => {
		a = (a + 0x6d2b79f5) >>> 0;
		let t = Math.imul(a ^ (a >>> 15), 1 | a);
		t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

function makeScene(nNodes: number, nEdges: number, seed: number, spread = 2000) {
	const rnd = mulberry(seed);
	const blockers: Blocker[] = [];
	const nodes: { x: number; y: number; r: number }[] = [];
	for (let i = 0; i < nNodes; i++) {
		const x = rnd() * spread;
		const y = rnd() * spread * 0.7;
		const r = 30 + rnd() * 25;
		nodes.push({ x, y, r });
		blockers.push({ kind: 'disc', x, y, r });
		// the node's caption, as a box beneath it
		blockers.push({ kind: 'box', box: { x, y: y + r + 10, w: 60 + rnd() * 40, h: 18 } });
	}
	const candidates: ChipCandidate[] = [];
	for (let i = 0; i < nEdges; i++) {
		const a = nodes[Math.floor(rnd() * nodes.length)];
		const b = nodes[Math.floor(rnd() * nodes.length)];
		const dx = b.x - a.x;
		const dy = b.y - a.y;
		const len = Math.hypot(dx, dy) || 1;
		candidates.push({
			id: `e${i}`,
			w: 40 + rnd() * 30,
			nx: -dy / len,
			ny: dx / len,
			pts: CHIP_TS.map<Pt>((t) => ({ x: a.x + dx * t, y: a.y + dy * t }))
		});
	}
	return { blockers, candidates };
}

describe('chip geometry', () => {
	it('treats two boxes as overlapping only within the pad', () => {
		const a: ChipBox = { x: 0, y: 0, w: 40, h: CHIP_H };
		expect(chipsOverlap(a, { x: 0, y: 0, w: 40, h: CHIP_H })).toBe(true);
		// half-widths (20 + 20) plus the pad on each side (2.5) => clear at 42.5 apart
		expect(chipsOverlap(a, { x: 42, y: 0, w: 40, h: CHIP_H })).toBe(true);
		expect(chipsOverlap(a, { x: 43, y: 0, w: 40, h: CHIP_H })).toBe(false);
		// and the same rule on the vertical axis
		expect(chipsOverlap(a, { x: 0, y: 16, w: 40, h: CHIP_H })).toBe(true);
		expect(chipsOverlap(a, { x: 0, y: 20, w: 40, h: CHIP_H })).toBe(false);
	});

	it('measures a disc against the chip RECTANGLE, not its centre', () => {
		const c: ChipBox = { x: 0, y: 0, w: 40, h: 14 };
		// well clear on both axes
		expect(chipHitsDisc(c, { x: 200, y: 200, r: 10 })).toBe(false);
		// beyond the chip's right edge (20) + pad (2.5), but within its radius
		expect(chipHitsDisc(c, { x: 30, y: 0, r: 10 })).toBe(true);
		expect(chipHitsDisc(c, { x: 40, y: 0, r: 10 })).toBe(false);
		// a disc swallowing the chip counts as a hit
		expect(chipHitsDisc(c, { x: 0, y: 0, r: 100 })).toBe(true);
	});

	it('dispatches on blocker kind', () => {
		const c: ChipBox = { x: 0, y: 0, w: 40, h: 14 };
		expect(chipBlocked(c, { kind: 'disc', x: 0, y: 0, r: 5 })).toBe(true);
		expect(chipBlocked(c, { kind: 'box', box: { x: 0, y: 0, w: 10, h: 10 } })).toBe(true);
		expect(chipBlocked(c, { kind: 'box', box: { x: 500, y: 500, w: 10, h: 10 } })).toBe(false);
	});
});

describe('placeChips', () => {
	it('puts an uncrowded chip at its natural home', () => {
		// One edge, nothing in the way: first offset, first position along the line.
		const pts = CHIP_TS.map<Pt>((t) => ({ x: 100 + 200 * t, y: 100 }));
		const box = placeChips([{ id: 'e', w: 40, nx: 0, ny: 1, pts }], []).get('e');
		expect(box).toEqual({ x: pts[0].x, y: pts[0].y + CHIP_OFFSETS[0], w: 40, h: CHIP_H });
	});

	it('steps off the line to clear a blocker', () => {
		const pts = CHIP_TS.map<Pt>((t) => ({ x: 100 + 200 * t, y: 100 }));
		const natural = { x: pts[0].x, y: pts[0].y + CHIP_OFFSETS[0] };
		const blockers: Blocker[] = [{ kind: 'disc', x: natural.x, y: natural.y, r: 20 }];
		const box = placeChips([{ id: 'e', w: 40, nx: 0, ny: 1, pts }], blockers).get('e')!;
		expect(box).toBeDefined();
		expect(chipBlocked(box, blockers[0])).toBe(false);
		expect({ x: box.x, y: box.y }).not.toEqual(natural);
	});

	it('never returns two chips that overlap each other when there is room', () => {
		const { blockers, candidates } = makeScene(30, 30, 99);
		const placed = [...placeChips(candidates, blockers).values()];
		let clashes = 0;
		for (let i = 0; i < placed.length; i++)
			for (let j = i + 1; j < placed.length; j++)
				if (chipsOverlap(placed[i], placed[j])) clashes++;
		expect(clashes).toBe(0);
	});

	it('still places a chip that has no free spot, at the least-bad one', () => {
		// A wall of discs over every candidate position — nothing is free, but the
		// chip must still land rather than be dropped.
		const pts = CHIP_TS.map<Pt>((t) => ({ x: 100 + 200 * t, y: 100 }));
		const blockers: Blocker[] = [];
		for (let i = 0; i < 40; i++)
			blockers.push({ kind: 'disc', x: 60 + i * 8, y: 100 + (i % 9) * 12 - 50, r: 60 });
		const box = placeChips([{ id: 'e', w: 40, nx: 0, ny: 1, pts }], blockers).get('e');
		expect(box).toBeDefined();
	});

	it('omits a candidate with no usable geometry', () => {
		const out = placeChips(
			[{ id: 'e', w: 40, nx: 0, ny: 1, pts: CHIP_TS.map(() => null) }],
			[]
		);
		expect(out.has('e')).toBe(false);
		expect(out.size).toBe(0);
	});

	it('is deterministic', () => {
		const { blockers, candidates } = makeScene(60, 60, 7);
		expect([...placeChips(candidates, blockers)]).toEqual([...placeChips(candidates, blockers)]);
	});

	it('treats candidate order as priority order', () => {
		// Two edges wanting the same spot: the first one asked gets it.
		const pts = CHIP_TS.map<Pt>((t) => ({ x: 100 + 200 * t, y: 100 }));
		const a: ChipCandidate = { id: 'a', w: 40, nx: 0, ny: 1, pts };
		const b: ChipCandidate = { id: 'b', w: 40, nx: 0, ny: 1, pts };
		const first = placeChips([a, b], []);
		const second = placeChips([b, a], []);
		expect(first.get('a')).toEqual(second.get('b'));
		expect(first.get('a')).not.toEqual(first.get('b'));
	});

	// ── The load-bearing one ────────────────────────────────────────────────────
	// The grid and the branch-and-bound exist only to make this faster. Any
	// divergence from the reference is a bug in the optimisation, not a new
	// behaviour — including in the crowded cases, where the "least-bad spot"
	// tie-breaking is easiest to get subtly wrong.
	it('matches the naive reference exactly', () => {
		const cases: [number, number, number][] = [
			[10, 10, 1],
			[40, 40, 7],
			[120, 120, 42],
			[300, 300, 1337],
			[300, 600, 90210]
		];
		for (const [nodes, edges, seed] of cases) {
			const { blockers, candidates } = makeScene(nodes, edges, seed);
			const fast = placeChips(candidates, blockers);
			const ref = referencePlaceChips(candidates, blockers);
			expect(fast.size, `size for ${nodes}/${edges}@${seed}`).toBe(ref.size);
			for (const [id, box] of ref) {
				expect(fast.get(id), `placement of ${id} in ${nodes}/${edges}@${seed}`).toEqual(box);
			}
		}
	});

	it('matches the reference on a DENSE scene, where nothing is free', () => {
		// Everything packed into a small area: most chips fall through to the
		// least-bad branch, which is the path the bound could break.
		const { blockers, candidates } = makeScene(80, 80, 5, 300);
		const fast = placeChips(candidates, blockers);
		const ref = referencePlaceChips(candidates, blockers);
		expect(fast.size).toBe(ref.size);
		for (const [id, box] of ref) expect(fast.get(id)).toEqual(box);
	});

	it('beats the reference by a wide margin at mesh scale', () => {
		// Not a benchmark — a regression guard. This solve ran on every poll and
		// measured at 21% of the main thread before the grid; if someone reverts to
		// a full scan, this fails long before anyone notices the canvas stuttering.
		const { blockers, candidates } = makeScene(300, 300, 5);
		const t0 = performance.now();
		placeChips(candidates, blockers);
		const fast = performance.now() - t0;
		const t1 = performance.now();
		referencePlaceChips(candidates, blockers);
		const ref = performance.now() - t1;
		expect(fast).toBeLessThan(ref / 4);
	});
});
