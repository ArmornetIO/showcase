// ── perf/hitch-watch — catch the stutter you cannot reproduce ────────────────
// `frame-probe` is the tool for a bug you can hold still: arm it, do the thing,
// read the quantiles. This is for the other kind — the marketing page's globe
// stumbling mid-rotation once in a while, on nobody's schedule, gone before a
// profiler can be started. You cannot capture a window around an event you
// cannot predict, so this runs continuously and prints only when a frame is
// actually late.
//
// It watches the PAGE, not one scene, and drives its own rAF loop. That is the
// whole design decision: the same stutter shows in the globe and in the
// pipeline scene, which are two independent rAF loops, and a hitch common to
// both is by definition not in either one's arithmetic. A per-scene instrument
// would have had each loop blaming itself.
//
// Four signals, because "it stuttered" has four different causes and only the
// attribution separates them:
//
//  · LATE FRAME (`dt`). The display period was missed. This is the fact; the
//    other three are the explanation.
//
//  · A LONGTASK overlapping it. The main thread was busy and the entry names
//    who. NO longtask on a late frame is the more valuable answer: the work was
//    not our JS, so it was the compositor, the GPU, or a missed vsync, and no
//    amount of tuning this code will move it.
//
//  · A HEAP DROP. `usedJSHeapSize` falling across a late frame means the
//    collector ran — the one cause that hits every rAF loop on the page at once
//    and leaves no other trace. Chrome only, quantised, and still the fastest
//    way to tell a GC pause from a slow frame.
//
//  · MISSED BEATS. Each loop reports a beat per frame; a hitch line prints the
//    counts. `spin:1 pipeline:0` is one scene stalling, `spin:0 pipeline:0` is
//    the page, and the difference is otherwise invisible.
//
// No console output unless something goes wrong, one line when it does,
// rate-limited then muted so an unattended tab cannot produce a thousand lines.
// The record is on `globalThis.__hitch`; `__hitch.report()` is the paste-back.
//
// Off costs one boolean check per call and allocates nothing.

/** A frame the viewer would have felt. */
export interface Hitch {
	/** Seconds since the watch started. */
	at: number;
	/** Whole-frame time from the rAF timestamps. */
	dt: number;
	/** The display period this frame was judged against. */
	period: number;
	/** Frames' worth of time lost, `dt / period`. */
	late: number;
	/** Heap change across the frame, MB. Negative means a collection ran. */
	heap: number;
	/** A `longtask` overlapping the frame, if the browser reported one. */
	task?: string;
	/** Beats each named loop reported during the frame — a 0 is a loop that did
	 *  not get a turn. */
	beats: Record<string, number>;
	/** Whatever the frame raised: a `readPixels` sync, a resize, a rebuild. */
	tags: string[];
	/** Seconds since the previous hitch. The tell for a periodic cause: tidy 10s
	 *  spacing is a heartbeat, not bad luck. */
	since: number;
}

/** One reading of the page, for a HUD. */
export interface HitchSnapshot {
	frames: number;
	/** The display period the watch is judging against, ms. */
	period: number;
	fps: number;
	p50: number;
	p95: number;
	max: number;
	hitches: number;
	/** …of which coincided with a heap drop. */
	gcHitches: number;
	/** Live heap, MB. Zero off Chrome. */
	heap: number;
	/** Garbage produced, MB/s. The leading indicator. */
	alloc: number;
	/** Collections per second, inferred from heap drops. */
	gcPerSec: number;
	/** Every named loop that reported a beat, and how often, per second. */
	loops: { name: string; rate: number }[];
	last: Hitch | null;
	/** Fills `out` with the most recent frame times and returns how many. */
	recent: (out: Float64Array) => number;
}

/** How far past the display period counts as late. 1.5 catches a single dropped
 *  frame at any refresh rate; lower, and ordinary vsync jitter on a 120Hz panel
 *  fires constantly and the log is worthless. */
const LATE_RATIO = 1.5;
/** …plus a floor, so a 4ms wobble on an 8ms period is not news. */
const LATE_FLOOR_MS = 4;
/** At most one line per this much wall clock. Hitches arrive in clusters and the
 *  first of a cluster is the informative one. */
const LOG_EVERY_MS = 400;
/** Lines before the watch goes quiet and only counts. Enough to see a pattern,
 *  few enough that leaving the tab open is harmless. */
const LOG_LIMIT = 30;
/** Rolling window for the display-period estimate — long enough to span a
 *  variable-refresh display changing its mind and settle again. */
const PERIOD_WINDOW = 240;
/** Frames ignored at the start. Mount, first paint, shader compilation and the
 *  first layout are all slow and none of them are the bug. */
const WARMUP = 60;
/** Rolling window of EVERY frame, for the quantiles in the summary. A hitch
 *  count alone cannot say whether the page is otherwise holding frame, and
 *  "p95 8.4ms with four hitches a minute" is a different bug from "p95 22ms". */
const ALL_WINDOW = 3600;
/** Hitches kept for the report; the oldest fall off. */
const KEEP = 60;
/** Summary cadence. Printed only when the window contained a hitch, so a clean
 *  page stays silent indefinitely. */
const SUMMARY_MS = 60_000;

let on = false;
let raf = 0;
let t0 = 0;
let lastTs = 0;
let heap = 0;
let periodN = 0;
let period = 16.7;
const periods = new Float64Array(PERIOD_WINDOW);
const all = new Float64Array(ALL_WINDOW);
/** 1ms buckets, 0..63ms. Refilled per estimate, never allocated. */
const buckets = new Uint16Array(64);
let lastCand = 0;
let pending = 0;

let tags: string[] = [];
/** Beat counters, reused across frames rather than reallocated — an instrument
 *  that allocates per frame would be feeding the collector it is trying to
 *  catch. */
const beats = new Map<string, number>();
/** The same counters, accumulated over the last second, so a HUD can show a rate
 *  per loop rather than a per-frame count that is always 0 or 1. */
const perSec = new Map<string, number>();
const rates = new Map<string, number>();
let rateAt = 0;
let allocSec = 0;
let gcSec = 0;
let allocRate = 0;
let gcRate = 0;

let lastLogAt = -Infinity;
let logged = 0;
let lastHitchAt = 0;
let lastSummaryAt = 0;
let summaryHitches = 0;
let task: { end: number; ms: number; name: string } | null = null;

const totals = { frames: 0, hitches: 0, worst: 0, gc: 0 };
const hitches: Hitch[] = [];

/** Chrome's heap gauge, absent everywhere else. */
function heapMb(): number {
	const m = (performance as Performance & { memory?: { usedJSHeapSize: number } }).memory;
	return m ? m.usedJSHeapSize / 1048576 : 0;
}

/**
 * The display period, as the MODE of recent frames — with hysteresis.
 *
 * Three estimators were tried and the first two were both wrong:
 *
 *  · The MEAN is dragged upward by every hitch, so the tenth hitch in a bad
 *    minute is judged against a baseline the earlier nine spoiled.
 *  · The MINIMUM is wrong in the other direction. A browser that occasionally
 *    delivers two frames close together convinces a floor-based estimate that
 *    the period is 7.5ms on a panel actually running at 16.6, and then three
 *    quarters of all frames report as late.
 *  · The MEDIAN survives both, and still flaps on the display this is aimed at.
 *    A ProMotion Mac switches between 120Hz and 60Hz on its own — on battery, on
 *    window occlusion, at the compositor's discretion — and while it is doing so
 *    the window holds a mix of 8.3s and 16.6s whose median jumps between the
 *    two. Measured: 1,521 "hitches" in 96 seconds on a page whose p95 was 17.6ms.
 *
 * So: the most common 1ms bucket, over a window long enough to span a cadence
 * change, and adopted only after it has won three estimates running. The
 * baseline moves when the display really has changed rate, not while it is
 * making up its mind.
 */
/** Set by `?period=16.7`, and the estimator stands down entirely when it is.
 *
 *  Not a tuning knob — a comparison tool. Two captures of identical code judged
 *  against two different inferred periods disagree about what a late frame even
 *  IS, so a before/after that spans a ProMotion cadence change measures the
 *  panel rather than the change. Pin it and the two runs are comparable. */
let periodPin = 0;

function estimatePeriod(): number {
	if (periodPin) return periodPin;
	const n = Math.min(periodN, PERIOD_WINDOW);
	if (n < 30) return period;
	buckets.fill(0);
	for (let i = 0; i < n; i++) {
		const b = Math.round(periods[i]);
		if (b >= 0 && b < buckets.length) buckets[b]++;
	}
	let best = 0;
	for (let b = 1; b < buckets.length; b++) if (buckets[b] > buckets[best]) best = b;
	// Clamped to plausible refresh rates so a run of throttled frames cannot
	// convince the watch that 200ms is normal and silence it.
	const cand = Math.min(Math.max(best, 6), 34);
	if (Math.abs(cand - period) / period < 0.15) {
		pending = 0;
		return period;
	}
	// A candidate has to hold across three estimates — about a second — before it
	// becomes the thing every frame is judged against.
	pending = Math.abs(cand - lastCand) < 1 ? pending + 1 : 1;
	lastCand = cand;
	return pending >= 3 ? cand : period;
}

function watchLongTasks(): void {
	try {
		const po = new PerformanceObserver((list) => {
			for (const e of list.getEntries()) {
				const attr = (e as PerformanceEntry & { attribution?: { name?: string }[] })
					.attribution?.[0];
				task = {
					end: e.startTime + e.duration,
					ms: e.duration,
					name: attr?.name || e.name || 'longtask'
				};
			}
		});
		po.observe({ type: 'longtask', buffered: false });
	} catch {
		// Not implemented in Safari. Worth no fallback: the absence of an entry is
		// itself a finding, and on a browser that never reports one the heap and
		// beat columns still carry the frame.
	}
}

function frame(ts: number): void {
	raf = requestAnimationFrame(frame);
	const dt = lastTs ? ts - lastTs : 0;
	lastTs = ts;
	const now = heapMb();
	const dHeap = heap ? now - heap : 0;
	heap = now;

	if (dt > 0) {
		totals.frames++;
		periods[periodN++ % PERIOD_WINDOW] = dt;
		all[totals.frames % ALL_WINDOW] = dt;
		// Every 15 frames rather than every frame: a sort is not free and a display
		// does not change refresh rate a quarter of a second at a time.
		if (totals.frames % 15 === 0) period = estimatePeriod();
		if (totals.frames > WARMUP && dt > Math.max(period * LATE_RATIO, period + LATE_FLOOR_MS))
			record(ts, dt, dHeap);
	}

	// Cleared AFTER judgement: everything a loop reported since the previous
	// rAF belongs to the frame being closed out, not to the one starting.
	tags = [];
	for (const [k, v] of beats) {
		perSec.set(k, (perSec.get(k) ?? 0) + v);
		beats.set(k, 0);
	}

	const wall = performance.now();
	if (dHeap > 0) allocSec += dHeap;
	else if (dHeap < -0.5) gcSec++;
	if (wall - rateAt >= 1000) {
		const span = (wall - rateAt) / 1000;
		for (const [k, v] of perSec) {
			rates.set(k, v / span);
			perSec.set(k, 0);
		}
		// Megabytes of garbage per second, and collections per second — the pair
		// that named the marketing page's stutter when every frame-time number
		// said the page was fine.
		allocRate = allocSec / span;
		gcRate = gcSec / span;
		allocSec = 0;
		gcSec = 0;
		rateAt = wall;
	}
	if (wall - lastSummaryAt >= SUMMARY_MS) {
		if (summaryHitches) console.warn(`[hitch] ${format()}`);
		summaryHitches = 0;
		lastSummaryAt = wall;
	}
}

function record(ts: number, dt: number, dHeap: number): void {
	const counts: Record<string, number> = {};
	for (const [k, v] of beats) counts[k] = v;
	const h: Hitch = {
		at: +((ts - t0) / 1000).toFixed(1),
		dt: +dt.toFixed(1),
		period: +period.toFixed(1),
		late: +(dt / period).toFixed(1),
		heap: +dHeap.toFixed(2),
		// Overlap, not containment: a task that ended inside this frame is the one
		// that ate it, even though it started during the previous.
		task: task && task.end >= ts - dt - 4 ? `${Math.round(task.ms)}ms ${task.name}` : undefined,
		beats: counts,
		tags: tags.slice(),
		since: lastHitchAt ? +((ts - lastHitchAt) / 1000).toFixed(1) : 0
	};
	lastHitchAt = ts;
	totals.hitches++;
	summaryHitches++;
	if (dHeap < -0.5) totals.gc++;
	if (dt > totals.worst) totals.worst = dt;
	hitches.push(h);
	if (hitches.length > KEEP) hitches.shift();

	const wall = performance.now();
	if (wall - lastLogAt < LOG_EVERY_MS) return;
	lastLogAt = wall;
	if (logged >= LOG_LIMIT) {
		if (logged === LOG_LIMIT) {
			logged++;
			console.warn('[hitch] muted after 30 lines — still counting; __hitch.report()');
		}
		return;
	}
	logged++;

	const loops = Object.entries(h.beats)
		.map(([k, v]) => `${k}:${v}`)
		.join(' ');
	console.warn(
		`[hitch] ${h.dt}ms (${h.late}× period ${h.period}) at ${h.at}s` +
			(h.task ? ` · longtask ${h.task}` : ' · no longtask → not our JS') +
			(h.heap ? ` · heap ${h.heap > 0 ? '+' : ''}${h.heap}MB${h.heap < -0.5 ? ' (GC)' : ''}` : '') +
			(loops ? ` · beats ${loops}` : '') +
			(h.tags.length ? ` · ${h.tags.join(',')}` : '') +
			(h.since ? ` · ${h.since}s since last` : '')
	);
}

function format(): string {
	const secs = Math.max((performance.now() - t0) / 1000, 1);
	const n = Math.min(totals.frames, ALL_WINDOW);
	const s = Array.prototype.slice.call(all, 0, n).sort((a: number, b: number) => a - b);
	const q = (p: number) => (n ? s[Math.min(n - 1, Math.round(p * (n - 1)))].toFixed(1) : '-');
	return (
		`${totals.frames} frames / ${secs.toFixed(0)}s · period ${period.toFixed(1)}ms · ` +
		`dt p50 ${q(0.5)} p95 ${q(0.95)} max ${totals.worst.toFixed(1)}ms · ` +
		`${totals.hitches} hitches (${totals.gc} on a heap drop) · ` +
		`${(totals.hitches / Math.max(secs, 1)).toFixed(2)}/s`
	);
}

export const hitchWatch = {
	get enabled(): boolean {
		return on;
	},

	/** Start watching. Idempotent; safe to call from every scene on the page. */
	enable(): void {
		if (on || typeof window === 'undefined') return;
		on = true;
		t0 = performance.now();
		lastSummaryAt = t0;
		heap = heapMb();
		watchLongTasks();
		raf = requestAnimationFrame(frame);
		console.debug('[hitch] watching frames — late frames print here; __hitch.report() to summarise');
	},

	/**
	 * The intended entry point: on in dev, and in ANY build when the URL carries
	 * `?hitch` or `localStorage.hitch` is set.
	 *
	 * Not dev-only on purpose. The stutter this exists for has only ever been
	 * seen on a real page over minutes of watching, and an instrument that
	 * refuses to run there cannot see it.
	 */
	auto(): void {
		if (on || typeof window === 'undefined') return;
		let stored = false;
		try {
			stored = window.localStorage.getItem('hitch') != null;
		} catch {
			// Storage can be blocked outright; the query param still works.
		}
		const q = new URLSearchParams(window.location.search);
		const pin = Number(q.get('period'));
		// Same clamp the estimator uses, so a typo cannot silence the watch by
		// declaring 200ms normal.
		if (pin >= 6 && pin <= 34) this.pinPeriod(pin);
		if (import.meta.env.DEV || q.has('hitch') || stored) this.enable();
	},

	/** Judge every frame against a fixed period instead of an inferred one.
	 *  0 restores estimation. See `periodPin`. */
	pinPeriod(ms: number): void {
		periodPin = ms > 0 ? ms : 0;
		if (periodPin) period = periodPin;
	},

	stop(): void {
		if (!on) return;
		cancelAnimationFrame(raf);
		on = false;
	},

	/** One call per frame from a named animation loop. A loop that reports 0
	 *  beats on a late frame is the loop that skipped. */
	beat(loop: string): void {
		if (!on) return;
		beats.set(loop, (beats.get(loop) ?? 0) + 1);
	},

	/** Tag the frame with anything that might explain it — a `readPixels` sync, a
	 *  buffer rebuild, a resize. Cheap enough for a render path. */
	mark(tag: string): void {
		if (!on || tags.length >= 6) return;
		tags.push(tag);
	},

	get hitches(): Hitch[] {
		return hitches;
	},

	/**
	 * One reading for a HUD. Built on demand, never per frame — a display that
	 * allocates a snapshot sixty times a second is measuring itself.
	 *
	 * `alloc` is the number to read first. Frame times say whether the page is
	 * smooth *right now*; megabytes-per-second of garbage says whether it is
	 * about to stop being, and it is the one that found the real bug.
	 */
	snapshot(): HitchSnapshot {
		const n = Math.min(totals.frames, ALL_WINDOW);
		const s = Array.prototype.slice.call(all, 0, n).sort((a: number, b: number) => a - b);
		const q = (p: number) => (n ? s[Math.min(n - 1, Math.round(p * (n - 1)))] : 0);
		const loops: { name: string; rate: number }[] = [];
		for (const [name, rate] of rates) loops.push({ name, rate });
		loops.sort((a, b) => b.rate - a.rate);
		return {
			frames: totals.frames,
			period,
			fps: period > 0 ? 1000 / period : 0,
			p50: q(0.5),
			p95: q(0.95),
			max: totals.worst,
			hitches: totals.hitches,
			gcHitches: totals.gc,
			heap: heap,
			alloc: allocRate,
			gcPerSec: gcRate,
			loops,
			last: hitches.length ? hitches[hitches.length - 1] : null,
			// The window the graph draws, newest last.
			recent: (out: Float64Array) => {
				const m = Math.min(out.length, n);
				for (let i = 0; i < m; i++) {
					// `all` is a ring written at `frames % ALL_WINDOW`.
					const idx = (totals.frames - m + i + 1 + ALL_WINDOW) % ALL_WINDOW;
					out[i] = all[idx];
				}
				return m;
			}
		};
	},

	/** Everything seen since the watch started. */
	report(): string {
		const s = format();
		console.warn(`[hitch] ${s}`);
		if (hitches.length) console.table(hitches.slice(-20));
		return s;
	},

	reset(): void {
		hitches.length = 0;
		totals.frames = totals.hitches = totals.gc = 0;
		totals.worst = 0;
		logged = 0;
		periodN = 0;
		lastHitchAt = 0;
	}
};

if (typeof globalThis !== 'undefined') {
	(globalThis as Record<string, unknown>).__hitch = hitchWatch;
}
