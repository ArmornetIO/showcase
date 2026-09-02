// ── logo-nanotech · the sparks the mark is thrown together by ────────────────
// A firework read backwards: the shells come in from off-frame, converge, and
// each one lands on a point of the mark and detonates there.
//
// Everything here is a PURE function of `t`. There is no integrator and no
// per-spark mutable state, so the whole field can be scrubbed backwards, paused
// on a frame, or replayed — and the trails still work, because a trail is drawn
// as the segment between `pos(t - dt)` and `pos(t)` rather than remembered from
// the last frame. That is the one design decision the rest of this file falls
// out of.
//
// Coordinates are the CHROME box (200×220), same as `nanite.ts`, so a target
// handed in from the plate field lands where the plate does.

export interface SparkTarget {
	x: number;
	y: number;
	/** ms into the beat at which the spark should ARRIVE — not when it departs. */
	delay: number;
}

/** Deterministic per-spark noise, borrowed from `nanite.ts` for the same reason:
 *  a scatter you cannot re-watch is a scatter you cannot tune. */
function hash(i: number, salt = 0): number {
	const x = Math.sin(i * 127.1 + salt * 311.7) * 43758.5453;
	return x - Math.floor(x);
}

const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);
const outQuad = (x: number) => 1 - (1 - x) * (1 - x);
const smooth = (a: number, b: number, x: number) => {
	const t = clamp01((x - a) / (b - a));
	return t * t * (3 - 2 * t);
};
/**
 * A SPEED profile, not a shape: near-constant while the spark crosses the
 * frame, then a hard brake over the last fifth.
 *
 * This is the difference between comets and dots, and it was not the first
 * guess. A conventional ease-out spends ~90% of the distance in the first half
 * of the time — and since a spark starts well outside the 200×220 box, all of
 * that happens off screen. By the moment it becomes visible it is already
 * crawling, one or two pixels per frame, and the decay trail collapses to a
 * smudge behind a dot. Cruising until the seat is close puts the SPEED inside
 * the frame, where it can be seen.
 */
const CRUISE = 0.8;
const CRUISE_K = 1 / (CRUISE + (1 - CRUISE) / 2);
function cruiseBrake(u: number): number {
	if (u <= CRUISE) return CRUISE_K * u;
	const v = u - CRUISE;
	return CRUISE_K * (CRUISE + v - (v * v) / (2 * (1 - CRUISE)));
}

/** Overshoot on the way in — the spark passes its seat and falls back onto it.
 *  A spark that merely decelerates onto a point reads as PLACED; one that
 *  overshoots reads as thrown, which is the difference between assembly and a
 *  firework. */
const OVER = 1.07;
const SETTLE = 0.86;
function flightEase(u: number, over: boolean): number {
	if (!over) return cruiseBrake(u);
	if (u <= SETTLE) return OVER * cruiseBrake(u / SETTLE);
	const k = (u - SETTLE) / (1 - SETTLE);
	return OVER + (1 - OVER) * k * k * (3 - 2 * k);
}

/** How long the detonation flash and its shrapnel live, and how long the seat
 *  keeps glowing after. The afterglow is what makes the mark ACCUMULATE rather
 *  than blink — without it the frame is empty a beat after the last arrival. */
const BURST_MS = 150;
const GLOW_MS = 340;

export interface Spark {
	/** Seat, in box coords. */
	tx: number;
	ty: number;
	/** ms into the beat when it reaches the seat. */
	arrive: number;
	/** ms of flight before that. */
	travel: number;
	/** Where it comes in from — a short way out from its own seat, not off-frame.
	 *  See `BuildOpts.reach`. */
	ox: number;
	oy: number;
	/** Perpendicular arc amplitude in box units. A straight line between two
	 *  points is a laser; the bow is what makes it a thrown ember. */
	cx: number;
	cy: number;
	/** Overshoots its seat rather than easing onto it. */
	over: boolean;
	/** Reads as a pale ember instead of accent teal. A minority in a second tone
	 *  is what stops several hundred identical strokes reading as one object. */
	warm: boolean;
	width: number;
	/** Shrapnel thrown off at the seat. */
	kids: number;
	seed: number;
}

/** Beat span the field occupies, so the caller can size its own timeline. */
export function sparksSpan(sparks: Spark[]): number {
	let end = 0;
	for (const s of sparks) end = Math.max(end, s.arrive + GLOW_MS);
	return end;
}

export interface BuildOpts {
	/** Sparks per target. Left undefined it fills toward `want`, because the
	 *  density the user is after is a property of the FRAME, not of how finely
	 *  the caller happened to tile the mark. */
	repeat?: number;
	want?: number;
	/**
	 * How far, in box units, a spark runs up to its seat.
	 *
	 * The single most load-bearing number in the file, and the first cut had it
	 * at 150–305 — larger than the mark itself. Every spark then drew a straight
	 * ray clean across the shield before it arrived, and a few hundred of those
	 * at once is a starburst: the silhouette is unreadable because the strongest
	 * lines in the frame are the ones LEAVING it. Kept local, the run-up stays
	 * inside the shape being built and the seats are what you read.
	 */
	reach?: number;
}

/** Box units per ms. Fixed across the field rather than per spark: sparks with
 *  different run-ups but the same flight time move at different speeds, and the
 *  slow ones smear while the fast ones streak. One speed, varying duration. */
const SPEED = 0.33;

export function buildSparks(targets: SparkTarget[], opts: BuildOpts = {}): Spark[] {
	if (targets.length === 0) return [];
	const want = opts.want ?? 320;
	const repeat = Math.max(1, Math.min(4, opts.repeat ?? Math.round(want / targets.length)));
	const reach = opts.reach ?? 78;

	// The hub the flight angles are measured from. Fixed rather than derived from
	// the targets: the mark's own centre is what the sparks should look like they
	// are converging ON, and a bbox centre drifts with whatever subset of the
	// mark the caller passed.
	const HX = 100;
	const HY = 110;

	const out: Spark[] = [];
	let i = 0;
	for (const tg of targets) {
		for (let r = 0; r < repeat; r++, i++) {
			// Approach angle follows the seat's own bearing from the hub, so the
			// field opens outward like a shell burst instead of raining from one
			// side. The jitter is wide enough that neighbouring seats do not fly
			// in as a comb.
			const base = Math.atan2(tg.y - HY, tg.x - HX);
			const th = base + (hash(i, 1) - 0.5) * 2.5;
			// Measured back from the SEAT, not out from the hub. Off the hub, a
			// seat near the rim on the same bearing as its origin ends up with a
			// 20-unit flight — a spark that crawls in and leaves a dot. From the
			// seat, every spark gets the same honest run-up.
			const dist = reach * (0.62 + hash(i, 2) * 0.76);
			const ox = tg.x + Math.cos(th) * dist;
			const oy = tg.y + Math.sin(th) * dist;

			const travel = dist / SPEED;
			// Spread the repeats around their shared seat in time, or every copy
			// lands on the same pixel on the same frame and the burst is one dot.
			const arrive = tg.delay + (r === 0 ? 0 : (hash(i, 4) - 0.5) * 260);

			// Bow perpendicular to the flight line, signed per spark.
			const dx = tg.x - ox;
			const dy = tg.y - oy;
			const len = Math.hypot(dx, dy) || 1;
			const bow = (hash(i, 5) - 0.5) * 0.22 * len;

			out.push({
				tx: tg.x,
				ty: tg.y,
				arrive,
				travel,
				ox,
				oy,
				cx: (-dy / len) * bow,
				cy: (dx / len) * bow,
				over: hash(i, 6) < 0.45,
				warm: hash(i, 7) < 0.18,
				width: 0.5 + hash(i, 8) * 1.05,
				kids: 2 + Math.floor(hash(i, 9) * 4),
				seed: hash(i, 10)
			});
		}
	}
	return out;
}

/** A drawn stroke: two box-space endpoints plus how hot and how solid it is.
 *  Filled in place — several hundred of these per frame allocated fresh is the
 *  one thing in a canvas loop that reliably shows up as GC sawtooth. */
export interface Seg {
	x0: number;
	y0: number;
	x1: number;
	y1: number;
	/** 0..1 opacity. */
	a: number;
	/** 0..1 toward white-hot. */
	heat: number;
	/** Box-space stroke width. */
	w: number;
}

export const makeSeg = (): Seg => ({ x0: 0, y0: 0, x1: 0, y1: 0, a: 0, heat: 0, w: 1 });

/** Position along the flight at normalised progress `u`, written into `p`. */
function flightAt(s: Spark, u: number, p: { x: number; y: number }): void {
	const e = flightEase(u, s.over);
	// The bow is zero at both ends by construction, so the spark still departs
	// from its origin and still lands exactly on its seat. Squared, because a
	// plain sine still carries a third of its swing into the last tenth of the
	// flight — and a curve fighting the overshoot right at the seat draws a
	// little S that reads as a worm rather than as an arc.
	const s0 = Math.sin(Math.PI * clamp01(u));
	const b = s0 * s0;
	p.x = s.ox + (s.tx - s.ox) * e + s.cx * b;
	p.y = s.oy + (s.ty - s.oy) * e + s.cy * b;
}

const pa = { x: 0, y: 0 };
const pb = { x: 0, y: 0 };

/** The comet itself. Returns false when the spark is not in flight this frame. */
export function sparkSeg(s: Spark, t: number, dt: number, out: Seg): boolean {
	const t0 = s.arrive - s.travel;
	const u = (t - t0) / s.travel;
	if (u < 0 || u > 1) return false;

	const u0 = Math.max(0, (t - dt - t0) / s.travel);
	flightAt(s, u0, pa);
	flightAt(s, u, pb);
	out.x0 = pa.x;
	out.y0 = pa.y;
	out.x1 = pb.x;
	out.y1 = pb.y;
	// Faint on the way out of the dark, full by the time it is committed. The
	// heat ramp is late and sharp so the whitening reads as impact, not as a
	// long fade-up.
	out.a = 0.45 + 0.55 * smooth(0, 0.4, u);
	// Late and narrow. Whitening over the last third leaves a long pale streak
	// that reads as smoke; confined to the final moments it reads as the spark
	// going white-hot as it hits.
	out.heat = smooth(0.9, 1, u);
	out.w = s.width;
	return true;
}

/** One piece of shrapnel, `k` of `s.kids`. Same analytic trick as the comet:
 *  both endpoints come from the same closed form, so scrubbing is exact. */
export function burstSeg(s: Spark, k: number, t: number, dt: number, out: Seg): boolean {
	const bt = t - s.arrive;
	const life = BURST_MS * (0.6 + hash(s.seed * 977 + k, 21) * 0.8);
	if (bt < 0 || bt > life) return false;

	const th = hash(s.seed * 977 + k, 22) * Math.PI * 2;
	const reach = 7 + hash(s.seed * 977 + k, 23) * 15;
	const b = bt / life;
	const b0 = Math.max(0, (bt - dt) / life);
	const r1 = reach * outQuad(b);
	const r0 = reach * outQuad(b0);
	const c = Math.cos(th);
	const sn = Math.sin(th);
	out.x0 = s.tx + c * r0;
	out.y0 = s.ty + sn * r0;
	out.x1 = s.tx + c * r1;
	out.y1 = s.ty + sn * r1;
	out.a = (1 - b) * (1 - b);
	out.heat = 1 - b;
	out.w = s.width * 0.7;
	return true;
}

/** Brightness of the detonation at the seat: a hard flash that decays into the
 *  ember the mark is left glowing with. 0 means nothing to draw. */
export function flashAt(s: Spark, t: number): number {
	const bt = t - s.arrive;
	if (bt < 0) return 0;
	if (bt < BURST_MS) return 1 - 0.72 * (bt / BURST_MS);
	const g = (bt - BURST_MS) / GLOW_MS;
	// The afterglow is deliberately faint. Several hundred seats each holding an
	// ember, composited additively, is a fog with a shield-shaped hole in it —
	// what should stay lit is the mark under this layer, not this layer.
	return g > 1 ? 0 : 0.12 * (1 - g) * (1 - g);
}

/** Cheap cull so the draw loop skips the majority of the field on most frames. */
export function sparkIdle(s: Spark, t: number): boolean {
	return t < s.arrive - s.travel || t > s.arrive + BURST_MS + GLOW_MS;
}

export type RGB = [number, number, number];

/** CSS colour → channels, for building `rgba()` strings the canvas API can take.
 *  Only the forms tokens.css actually uses are handled; anything else falls back
 *  rather than half-parsing into black. */
export function parseRGB(css: string, fallback: RGB): RGB {
	const v = css.trim();
	if (v.startsWith('#')) {
		const h = v.slice(1);
		if (h.length === 3) {
			return [
				parseInt(h[0] + h[0], 16),
				parseInt(h[1] + h[1], 16),
				parseInt(h[2] + h[2], 16)
			];
		}
		if (h.length === 6 || h.length === 8) {
			return [
				parseInt(h.slice(0, 2), 16),
				parseInt(h.slice(2, 4), 16),
				parseInt(h.slice(4, 6), 16)
			];
		}
		return fallback;
	}
	const m = v.match(/-?\d*\.?\d+/g);
	if (v.startsWith('rgb') && m && m.length >= 3) {
		return [Number(m[0]), Number(m[1]), Number(m[2])];
	}
	return fallback;
}

export const mixRGB = (a: RGB, b: RGB, k: number): RGB => [
	a[0] + (b[0] - a[0]) * k,
	a[1] + (b[1] - a[1]) * k,
	a[2] + (b[2] - a[2]) * k
];

export const rgba = (c: RGB, a: number) =>
	`rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a < 0 ? 0 : a > 1 ? 1 : a})`;
