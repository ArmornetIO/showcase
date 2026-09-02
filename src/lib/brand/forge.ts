// ── The forge timeline and the geometry it runs over ─────────────────────────
// Split out of `LogoForge.svelte` for two reasons, and only one of them is
// tidiness.
//
// The first: the seat plan is a walk over every contour in the crest at a
// spacing finer than the eye resolves, and it comes out around a thousand
// points. Computed in the component's instance script it is paid again on every
// mount — and this scene now mounts in front of a game, where the frame it
// stalls is the first one the player sees. Memoised here it is paid once per
// page, whoever asks first.
//
// The second: the beat boundaries are read by things that are not the scene —
// a scrubber wants to jump to them, a host wants to know when the mark has
// finished arriving. A component cannot hand those out before it exists.
import { buildAssembly } from './nanite.js';
import { buildEdges } from './rimlight.js';
import { readTripod } from './tripod.js';
import type { Pt } from '../icons/ArmornetCrestMesh.svelte';

/** Seat spacing along a contour, in box units — finer than the eye resolves
 *  at this scale, because a sparse outline reads as a dotted line. */
const SEAT_STEP = 4.2;

/** The window the sparks arrive over. Everything downstream of the assembly
 *  beat is measured from it. */
const SPARK_RAMP = 2200;

// ── Beat boundaries, ms ─────────────────────────────────────────────────────
const T_SPIN = 800;
const T_IGNITE = 2900;
/**
 * The collapse, in five movements — a star dying, not a scale curve.
 *
 * The first cut of this was a smooth shrink and a smooth grow, and it read as
 * exactly that, because NOTHING ELSE IN THE FRAME KNEW IT WAS HAPPENING. A
 * collapse is an event the room reacts to. So every movement here owns
 * something beyond the mark's size:
 *
 *   WIND      Swells and dims. The breath in. A collapse with no anticipation
 *             is just a small number arriving.
 *   COLLAPSE  Rips in on a cube, spinning up as it goes — accretion — while
 *             the room goes black around it.
 *   CORE      The singularity, and the one beat with nothing else on screen.
 *             The dead air is what makes the next frame land.
 *   BLAST     Detonation: white frame, rings out, the mark thrown past its
 *             own size.
 *   SETTLE    It rings back down to exactly 1 — and is STILL ringing when the
 *             sparks start arriving, which is the point of the overlap.
 */
const T_IMPLODE = T_IGNITE + 500;
const WIND_MS = 180;
const COLLAPSE_MS = 260;
const CORE_MS = 130;
const BLAST_MS = 150;
const SETTLE_MS = 380;
const T_CORE = T_IMPLODE + WIND_MS + COLLAPSE_MS;
const T_BLAST = T_CORE + CORE_MS;
/** The sparks come in ON the shockwave, not after it has been tidied away. */
const T_ASSEMBLE = T_BLAST + 130;
/** The last spark's flight plus the tail on its burst. */
const ASSEMBLE_MS = SPARK_RAMP + 950;
const T_LANDED = T_ASSEMBLE + ASSEMBLE_MS;
const T_HELD = T_LANDED + 800;

export const FORGE = {
	SPARK_RAMP,
	T_SPIN,
	T_IGNITE,
	T_IMPLODE,
	WIND_MS,
	COLLAPSE_MS,
	CORE_MS,
	BLAST_MS,
	SETTLE_MS,
	T_CORE,
	T_BLAST,
	T_ASSEMBLE,
	ASSEMBLE_MS,
	T_LANDED,
	T_HELD,
	/** Whole turns the figure makes before it settles. Whole, because the rest
	 *  pose is what it has to land on — see `tripod.ts`. */
	TURNS: 2,
	/** Whole for the same reason: three of them put every satellite back on the
	 *  pixel the flat logo draws it at, so the mark that comes back out of the
	 *  collapse is bit-identical to the one that went in. */
	ACCRETE_TURNS: 3
} as const;

export type ForgeBeat = 'matte' | 'spin' | 'ignition' | 'assembly' | 'chrome';

/** Where each beat starts, for anything that wants to jump to one. `chrome` is
 *  offset past the landing because the beat's first frames are still ringing. */
export const FORGE_BEATS: { beat: ForgeBeat; at: number }[] = [
	{ beat: 'matte', at: 0 },
	{ beat: 'spin', at: T_SPIN + 200 },
	{ beat: 'ignition', at: T_IGNITE },
	{ beat: 'assembly', at: T_ASSEMBLE + 700 },
	{ beat: 'chrome', at: T_HELD + 400 }
];

export function beatAt(t: number): ForgeBeat {
	if (t < T_SPIN) return 'matte';
	if (t < T_IGNITE) return 'spin';
	if (t < T_ASSEMBLE) return 'ignition';
	if (t < T_LANDED) return 'assembly';
	return 'chrome';
}

/** The mark is fully forged and lit by here. What a host waits for before
 *  taking the scene away — not `T_LANDED`, which is the frame the last spark
 *  hits and several hundred ms before the lamp has said anything. */
export const FORGE_SETTLED = T_HELD + 1200;

function walkSeg(a: Pt, b: Pt, into: Pt[]) {
	const n = Math.max(1, Math.round(Math.hypot(b[0] - a[0], b[1] - a[1]) / SEAT_STEP));
	for (let i = 0; i < n; i++) {
		const u = (i + 0.5) / n;
		into.push([a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u]);
	}
}
function walkRing(c: Pt, r: number, into: Pt[]) {
	const n = Math.max(8, Math.round((2 * Math.PI * r) / SEAT_STEP));
	for (let i = 0; i < n; i++) {
		const th = (i / n) * Math.PI * 2;
		into.push([c[0] + Math.cos(th) * r, c[1] + Math.sin(th) * r]);
	}
}

export type MarkGeometry = ReturnType<typeof buildMark>;
export type SeatPlan = ReturnType<typeof buildSeats>;

/** The mark itself, in the chrome cut's own 200×220 box: the shield contours,
 *  the figure, and the tripod reading of it. */
function buildMark() {
	const A = buildAssembly();
	return {
		A,
		EDGES: buildEdges(),
		TRI: readTripod(A.fig.hub, A.fig.nodes),
		/** The figure's own line weight, in chrome-box units. `ArmornetCrestMesh`
		 *  strokes the mark at 0.5 against a satellite of radius 1, and that ratio
		 *  is the part that has to survive being re-drawn at another scale. */
		figStroke: A.fig.nodeR * 0.5
	};
}

/**
 * Where the sparks are going.
 *
 * Two sets of seats, and the second is the one that does the work.
 *
 * Filling the shield's INTERIOR gets a cloud that happens to be shield-sized;
 * it does not read as the mark, because a silhouette is what the eye resolves
 * a shape from and a scatter has none. So the contours the chrome cut is
 * actually made of — the outer wall, both frame edges, the floating rim — get
 * walked at a fixed spacing and seated, and so does the figure. Those are the
 * sparks that draw the shield. The interior is what fills in behind them.
 *
 * The plate tiling survives for the fill, but not as anything you see: it is
 * already a scatter that CONFORMS to the silhouette, crown slot and point
 * included, which is the annoying half of producing one.
 */
function buildSeats() {
	const { A, EDGES } = markGeometry();

	const seats: Pt[] = [];
	for (const e of EDGES) walkSeg([e.x0, e.y0], [e.x1, e.y1], seats);
	const { hub, nodes, hubR, nodeR } = A.fig;
	walkRing(hub, hubR, seats);
	for (const n of nodes) {
		walkRing(n, nodeR, seats);
		walkSeg(hub, n, seats);
	}
	for (const p of A.plates) seats.push([p.cx, p.cy]);

	/**
	 * Every seat, ordered by how far out it sits.
	 *
	 * Radius from the figure's hub is the ONLY thing sequencing the beat, which
	 * is what makes "core first, wall last" true of the outline and the fill at
	 * once — rank them separately and the two sets cross, which reads as two
	 * effects. Flat ramp over the rank rather than the plates' own delays:
	 * `nanite` floors its frame ring at 1250ms so the wall plates close last, and
	 * inherited as arrival TIMES that leaves a trough in the middle of the beat
	 * where almost nothing is in the air.
	 */
	const ranked = seats
		.map((s) => ({ s, r: Math.hypot(s[0] - A.ox, s[1] - A.oy) }))
		.sort((a, b) => a.r - b.r);

	return {
		targets: ranked.map(({ s }, k) => ({
			x: s[0],
			y: s[1],
			delay: (k / ranked.length) * SPARK_RAMP
		})),
		/** The same seats' radii, ascending — the reveal indexes this to find out
		 *  where the arrival front actually IS at a given moment. */
		radii: ranked.map((e) => e.r)
	};
}

let mark: MarkGeometry | null = null;
let seats: SeatPlan | null = null;

/**
 * Both builders are memoised, and they are SEPARATE because their costs are
 * three orders of magnitude apart.
 *
 * The mark is a handful of contours. The seat plan walks every one of them at a
 * spacing finer than the eye resolves and sorts the ~1000 points that come out,
 * and only the assembly beat needs it — so a page mounting `ForgeMark` on its
 * own must not pay for a spark field it never draws. Lazy for the same reason
 * one level up: importing the timeline should cost nothing at all.
 */
export function markGeometry(): MarkGeometry {
	return (mark ??= buildMark());
}

export function seatPlan(): SeatPlan {
	return (seats ??= buildSeats());
}
