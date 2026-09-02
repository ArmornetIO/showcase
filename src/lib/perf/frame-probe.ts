// ── perf/frame-probe — a capture-scoped frame timer ──────────────────────────
// What a game engine reaches for when someone says "it feels laggy", and
// deliberately NOT what `budget.svelte.ts` does.
//
// Three things separate this from an FPS counter, and each one is the reason a
// counter cannot find the bug you are looking for:
//
//  · A MEAN HIDES A HITCH. `perfBudget` averages 60 frames. One 40ms stall in
//    that window moves the average by about four tenths of a frame per second —
//    invisible, while being exactly the thing a hand feels. Lag lives in p95 and
//    max, so those are what this reports. Engines stopped shipping average FPS
//    for this reason decades ago.
//
//  · SCRIPT TIME AND FRAME TIME ARE DIFFERENT QUESTIONS. The single most useful
//    split available, and it costs two timestamps: how long OUR callback ran,
//    against how long the whole frame took. It answers the only question worth
//    asking first — is this our arithmetic, or is it the browser painting what
//    the arithmetic produced? If script is 1ms inside a 30ms frame, no amount of
//    optimising the maths will move it, and you go and look at what you are
//    asking the renderer to redraw instead. This is the browser's version of an
//    engine's CPU-time vs present-time split.
//
//  · INSTRUMENTATION MUST COST NOTHING WHEN OFF. An engine compiles its
//    profiler out; the honest web equivalent is one boolean check on entry, a
//    buffer allocated ONLY when a capture is armed, and no reactive state
//    written per frame. That last one matters more than it looks: writing
//    `$state` every frame is itself work, and it perturbs the very measurement
//    it is taking. `budget.svelte.ts` pushes a fresh array into `$state` sixty
//    times a second forever, which is a cost you carry in production to display
//    a number that cannot see the problem.
//
// Pure: no Svelte, no DOM beyond `performance.now`. Two call sites, two lines
// each, both no-ops unless a capture is running.

export interface Quantiles {
	p50: number;
	p95: number;
	max: number;
}

export interface FrameStats {
	label: string;
	/** Frames captured. */
	frames: number;
	/** Whole-frame time: what the display actually delivered. */
	dt: Quantiles;
	/** Time inside our own callback. The rest of `dt` is layout, paint, composite
	 *  and whatever else the page is doing. */
	script: Quantiles;
	/** Frames that missed a 60Hz budget (16.7ms). The headline number: a count of
	 *  visible stutters, not a rate. */
	dropped: number;
	/** Share of the average frame our script accounts for, 0..1. Low means the
	 *  cost is in what we asked the renderer to do, not in what we computed. */
	scriptShare: number;
}

/** 60Hz. Anything past this is a frame the viewer did not get. */
const BUDGET_MS = 1000 / 60;

function quantile(sorted: Float64Array, n: number, q: number): number {
	if (!n) return 0;
	const i = Math.min(n - 1, Math.max(0, Math.round(q * (n - 1))));
	return sorted[i];
}

function stats(buf: Float64Array, n: number): Quantiles {
	if (!n) return { p50: 0, p95: 0, max: 0 };
	const s = buf.slice(0, n).sort();
	return { p50: quantile(s, n, 0.5), p95: quantile(s, n, 0.95), max: s[n - 1] };
}

let armed = false;
let label = '';
let cap = 0;
let n = 0;
let dtBuf: Float64Array | null = null;
let scriptBuf: Float64Array | null = null;
let lastTs = 0;
let frameStart = 0;
let last: FrameStats | null = null;

export const frameProbe = {
	/** Is a capture running? Exposed so a UI can show it without polling. */
	get isArmed(): boolean {
		return armed;
	},
	/** The most recent finished capture, or null. */
	get last(): FrameStats | null {
		return last;
	},

	/** Start capturing. Buffers are allocated HERE and nowhere else, so a page
	 *  that never profiles never pays for one. */
	arm(name: string, frames = 240): void {
		label = name;
		cap = frames;
		n = 0;
		lastTs = 0;
		dtBuf = new Float64Array(frames);
		scriptBuf = new Float64Array(frames);
		armed = true;
	},

	/** Call at the TOP of an animation frame, with the rAF timestamp. */
	begin(ts: number): void {
		if (!armed) return;
		frameStart = performance.now();
		if (lastTs && n < cap) dtBuf![n] = ts - lastTs;
		lastTs = ts;
	},

	/** Call at the END of the same callback — before handing control back. */
	endScript(): void {
		if (!armed) return;
		if (n < cap) {
			// Only count a frame once it has BOTH halves, so the first frame (which
			// has no previous timestamp to subtract) never lands as a zero and drags
			// the quantiles down.
			if (dtBuf![n] > 0) {
				scriptBuf![n] = performance.now() - frameStart;
				n++;
			}
		} else {
			this.stop();
		}
	},

	/** End the capture and compute the report. Buffers are dropped immediately. */
	stop(): FrameStats | null {
		if (!armed) return last;
		armed = false;
		const dt = stats(dtBuf!, n);
		const script = stats(scriptBuf!, n);
		let dropped = 0;
		let dtSum = 0;
		let scriptSum = 0;
		for (let i = 0; i < n; i++) {
			if (dtBuf![i] > BUDGET_MS) dropped++;
			dtSum += dtBuf![i];
			scriptSum += scriptBuf![i];
		}
		last = {
			label,
			frames: n,
			dt,
			script,
			dropped,
			scriptShare: dtSum > 0 ? scriptSum / dtSum : 0
		};
		dtBuf = null;
		scriptBuf = null;
		return last;
	},

	/** One line, for a console or a cog. The shape a profiler prints: where the
	 *  time went, not how fast it went on average. */
	format(s: FrameStats | null = last): string {
		if (!s || !s.frames) return 'no capture';
		const ms = (v: number) => v.toFixed(1);
		return (
			`${s.label}: ${s.frames}f · dt p50 ${ms(s.dt.p50)} p95 ${ms(s.dt.p95)} max ${ms(s.dt.max)}ms` +
			` · script p95 ${ms(s.script.p95)}ms (${Math.round(s.scriptShare * 100)}%)` +
			` · dropped ${s.dropped}/${s.frames}`
		);
	}
};
