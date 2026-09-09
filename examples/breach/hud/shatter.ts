// ── Cutting the crest up ─────────────────────────────────────────────────────
// The end screen shows the SAME shield either way — the mark from the pre-game
// forge, intact when the estate held and in pieces when it did not. Drawing a
// second "broken shield" asset would be two marks that have to be kept looking
// like each other; cutting the real one guarantees they are the same object.
//
// So the break is geometry rather than artwork: a fan of wedges radiating from
// one impact point, each used as a `clip-path` over its own copy of the crest.
// Every piece is a full crest showing through a different hole, which is why
// the fracture seams line up and why nothing has to be redrawn when the mark is.
//
// Percentages, not pixels: the clip is applied to a box whose size the caller
// picks, and a fracture that had to be re-cut per size would be a second place
// the art can drift.

/** A point in the clip box, 0–100 on both axes. */
type Pt = [number, number];

export interface Shard {
	/** The `clip-path: polygon(...)` body — points only, no wrapper. */
	poly: string;
	/** Where the piece ends up, as a fraction of the box. Outward from the
	 *  impact, so the fracture opens rather than merely scattering. */
	dx: number;
	dy: number;
	/** Degrees. Small — a shard that tumbles reads as confetti. */
	rot: number;
	/** Held at the end of the break. The far pieces are the ones that leave. */
	opacity: number;
	/** Seconds. The pieces nearest the impact go first. */
	delay: number;
}

/** Deterministic — the same break every time the screen is opened, so a player
 *  who lost twice is looking at one thing that happened twice, not two. */
function rng(seed: number): () => number {
	let s = seed >>> 0;
	return () => {
		s = (s * 1664525 + 1013904223) >>> 0;
		return s / 4294967296;
	};
}

const TAU = Math.PI * 2;
const norm = (a: number) => ((a % TAU) + TAU) % TAU;

/** Where a ray from `o` leaves the box. The wedge has to be closed on the box
 *  edge or the clip loses everything past the silhouette's widest point. */
function exit(o: Pt, a: number): Pt {
	const [ox, oy] = o;
	const cx = Math.cos(a);
	const cy = Math.sin(a);
	// The smallest positive scale that lands on a wall; guard the axis-aligned
	// case, where one component contributes nothing.
	let t = Infinity;
	if (cx > 1e-9) t = Math.min(t, (100 - ox) / cx);
	if (cx < -1e-9) t = Math.min(t, -ox / cx);
	if (cy > 1e-9) t = Math.min(t, (100 - oy) / cy);
	if (cy < -1e-9) t = Math.min(t, -oy / cy);
	return [ox + cx * t, oy + cy * t];
}

const fmt = (p: Pt) => `${p[0].toFixed(2)}% ${p[1].toFixed(2)}%`;

/**
 * The break, as `count` wedges around `origin`.
 *
 * The cuts are jittered rather than evenly spaced: a shield split into six equal
 * slices reads as a pie chart, and the thing this has to look like is a plate
 * that gave way at one spot.
 */
export function shatter(count = 7, origin: Pt = [36, 24], seed = 7): Shard[] {
	const rand = rng(seed);
	const corners: Pt[] = [
		[0, 0],
		[100, 0],
		[100, 100],
		[0, 100]
	];

	// Cut angles, ascending, starting from a fixed bearing so the seam pattern is
	// the same on every screen at the table.
	const step = TAU / count;
	const cuts = Array.from({ length: count }, (_, i) =>
		norm(-1.1 + i * step + (rand() - 0.5) * step * 0.55)
	).sort((a, b) => a - b);

	return cuts.map((a0, i) => {
		const a1 = cuts[(i + 1) % count] + (i === count - 1 ? TAU : 0);
		const mid = norm((a0 + a1) / 2);

		// Any box corner inside the sector belongs to this piece — skipping them
		// is what turns the outer wedges into triangles that cut the crest's
		// shoulders off.
		const inside = corners
			.map((c) => ({ c, a: norm(Math.atan2(c[1] - origin[1], c[0] - origin[0])) }))
			.filter(({ a }) => {
				const rel = norm(a - a0);
				return rel > 0 && rel < a1 - a0;
			})
			.sort((p, q) => norm(p.a - a0) - norm(q.a - a0))
			.map(({ c }) => c);

		const poly = [origin, exit(origin, a0), ...inside, exit(origin, a1)].map(fmt).join(', ');

		// Distance from the impact drives everything: the near pieces barely move
		// and stay lit, the far ones travel, turn and go.
		//
		// The travel is SMALL on purpose. The first cut threw the wedges a quarter
		// of the box apart, and a shield whose pieces are that far out has stopped
		// being a shield — it reads as debris that happens to be crest-coloured.
		// What has to survive is the silhouette with the fracture running through
		// it, so the seams open by a few percent and only the outermost pieces
		// leave.
		const far = 0.35 + rand() * 0.9;
		return {
			poly,
			dx: Math.cos(mid) * far * 5,
			dy: Math.sin(mid) * far * 5 + far * 2,
			rot: (rand() - 0.5) * 6 * far,
			opacity: Math.max(0.45, 1 - far * 0.4),
			delay: far * 0.14
		};
	});
}

export interface Speck {
	x: number;
	y: number;
	size: number;
	dx: number;
	dy: number;
	delay: number;
	/** What is left of it once it has travelled. Most go; a few stay, because the
	 *  end screen is looked at for a while and a break that ends up perfectly
	 *  clean reads as a shield that was cut rather than one that failed. */
	hold: number;
}

/** What is left of the edges. The wedges are the shield failing; these are the
 *  bits — without them the break reads as a shield that was neatly sliced. */
export function debris(count = 22, origin: Pt = [36, 24], seed = 19): Speck[] {
	const rand = rng(seed);
	return Array.from({ length: count }, (_, i) => {
		const a = rand() * TAU;
		const r = 12 + rand() * 34;
		const out = 0.6 + rand() * 1.6;
		return {
			x: origin[0] + Math.cos(a) * r,
			y: origin[1] + Math.sin(a) * r,
			size: 1 + Math.round(rand() * 2),
			dx: Math.cos(a) * out * 30,
			dy: Math.sin(a) * out * 30 + out * 22,
			delay: rand() * 0.3,
			hold: i % 3 === 0 ? 0.3 : 0
		};
	});
}
