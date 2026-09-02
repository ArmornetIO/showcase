export type PerfTier = 'full' | 'reduced' | 'minimal';

interface BatteryManager extends EventTarget {
	level: number;
	charging: boolean;
}

/** Rolling window of frame deltas, and how much FPS history the sparkline keeps. */
const FPS_WINDOW = 60;
const FPS_HISTORY_MAX = 120;

/** How often the sparkline gains a point. The history is a NEW array each time
 *  it grows, so at frame rate it was an allocation and a reactive write every
 *  frame on behalf of a panel that is usually not even mounted. */
const HISTORY_MS = 250;

// Tier thresholds, in FPS. ENTER is the way down, LEAVE is the way back up, and
// the gap between them is the hysteresis band — wide enough that shedding the
// scene's own cost cannot immediately re-qualify it for the tier it just left.
const MINIMAL_ENTER = 30;
const MINIMAL_LEAVE = 38;
const REDUCED_ENTER = 50;
const REDUCED_LEAVE = 57;

/** Minimum time a tier holds before another change is allowed. A tier change
 *  re-renders the whole scene, so its own cost lands in the next measurement —
 *  the dwell is what keeps that from being read as a new verdict. */
const TIER_DWELL_MS = 1500;

/**
 * How much motion this device can afford right now.
 *
 * Samples FPS, battery and the reduced-motion preference, and folds them into a
 * single `tier` that heavy surfaces (the mesh canvas, the globe) read to decide
 * how much to draw.
 *
 * **Nothing samples until a host calls `start()`.** This module used to kick off
 * a `requestAnimationFrame` loop at import time, and because `lib/index.ts`
 * re-exports the store, importing *anything* from the barrel started a loop that
 * nothing ever tore down. `start()` is reference-counted, so several consumers
 * can each hold it open and the loop stops when the last one lets go.
 */
class PerfBudget {
	fps = $state(60);
	fpsHistory = $state<number[]>([]);
	batteryLevel = $state<number | null>(null);
	batteryCharging = $state<boolean | null>(null);
	prefersReducedMotion = $state(false);
	/** Dev override — the perf panel pins a tier to preview it. */
	forceTier = $state<PerfTier | null>(null);

	/**
	 * The tier every heavy surface reads. Not a pure `$derived` of `fps`, because
	 * the tier is what DECIDES the frame cost it is measured from: at a single
	 * threshold the globe drops under 50, loses its glow/animation/blur, gets
	 * cheap, climbs back over 50, and re-mounts all of it — a loop that flipped
	 * ~2× a second and re-rendered ~2,700 SVG elements each time. That thrash is
	 * the lag it exists to prevent. Downgrade and upgrade therefore run on
	 * separate thresholds, and no change is allowed to follow another inside
	 * TIER_DWELL_MS.
	 */
	tier = $state<PerfTier>('full');

	#refs = 0;
	#rafId = 0;
	#lastTs = 0;
	#frameBuf: number[] = [];
	#teardown: Array<() => void> = [];
	#tierSince = 0;
	#lastHistoryTs = 0;

	setForceTier(t: PerfTier | null): void {
		this.forceTier = t;
		this.#applyTier();
	}

	/** Fold the current signals into a tier, honouring hysteresis and dwell. */
	#applyTier(): void {
		const next = this.#wantedTier();
		if (next === this.tier) return;
		const now = performance.now();
		// A forced tier is a human asking to see one — it skips the dwell.
		if (this.forceTier === null && now - this.#tierSince < TIER_DWELL_MS) return;
		this.#tierSince = now;
		this.tier = next;
	}

	#wantedTier(): PerfTier {
		if (this.forceTier) return this.forceTier;
		if (this.prefersReducedMotion) return 'minimal';
		const draining = this.batteryLevel !== null && this.batteryCharging === false;
		if (draining && (this.batteryLevel as number) < 0.1) return 'minimal';
		if (draining && (this.batteryLevel as number) < 0.2 && this.tier === 'full') return 'reduced';
		// Leaving a tier costs more FPS than staying in it, so the way back up is
		// held to a higher bar than the way down: a scene sitting exactly on a
		// threshold keeps the tier it has instead of alternating across it.
		if (this.fps < MINIMAL_ENTER) return 'minimal';
		if (this.tier === 'minimal') return this.fps >= MINIMAL_LEAVE ? 'reduced' : 'minimal';
		if (this.tier === 'reduced') return this.fps >= REDUCED_LEAVE ? 'full' : 'reduced';
		return this.fps < REDUCED_ENTER ? 'reduced' : 'full';
	}

	/**
	 * Begin sampling. Returns a teardown; sampling stops when every holder has
	 * called theirs. Calling the same teardown twice is safe.
	 */
	start(): () => void {
		if (typeof window === 'undefined') return () => {};

		this.#refs++;
		if (this.#refs === 1) this.#begin();

		let released = false;
		return () => {
			if (released) return;
			released = true;
			this.#refs--;
			if (this.#refs === 0) this.#end();
		};
	}

	#begin(): void {
		this.#lastTs = 0;
		this.#frameBuf = [];
		this.#rafId = requestAnimationFrame(this.#loop);

		const mq = matchMedia('(prefers-reduced-motion: reduce)');
		this.prefersReducedMotion = mq.matches;
		this.#applyTier();
		const onMotion = (e: MediaQueryListEvent) => {
			this.prefersReducedMotion = e.matches;
			this.#applyTier();
		};
		mq.addEventListener('change', onMotion);
		this.#teardown.push(() => mq.removeEventListener('change', onMotion));

		// Battery API — absent in most browsers, so treat it as a bonus signal.
		if ('getBattery' in navigator) {
			(navigator as Navigator & { getBattery(): Promise<BatteryManager> })
				.getBattery()
				.then((b) => {
					this.batteryLevel = b.level;
					this.batteryCharging = b.charging;
					this.#applyTier();
					const onLevel = () => {
						this.batteryLevel = b.level;
						this.#applyTier();
					};
					const onCharging = () => {
						this.batteryCharging = b.charging;
						this.#applyTier();
					};
					b.addEventListener('levelchange', onLevel);
					b.addEventListener('chargingchange', onCharging);
					this.#teardown.push(() => {
						b.removeEventListener('levelchange', onLevel);
						b.removeEventListener('chargingchange', onCharging);
					});
				})
				.catch(() => {
					/* not supported */
				});
		}
	}

	#end(): void {
		cancelAnimationFrame(this.#rafId);
		this.#rafId = 0;
		for (const off of this.#teardown) off();
		this.#teardown = [];
	}

	#loop = (ts: number): void => {
		if (this.#lastTs > 0) {
			const delta = ts - this.#lastTs;
			// Ignore absurd deltas: a backgrounded tab is not a dropped frame.
			if (delta > 0 && delta < 500) {
				this.#frameBuf.push(delta);
				if (this.#frameBuf.length > FPS_WINDOW) this.#frameBuf.shift();

				const avgDelta = this.#frameBuf.reduce((a, b) => a + b, 0) / this.#frameBuf.length;
				this.fps = Math.min(Math.round(1000 / avgDelta), 144);
				this.#applyTier();

				if (ts - this.#lastHistoryTs >= HISTORY_MS) {
					this.#lastHistoryTs = ts;
					const next = [...this.fpsHistory, this.fps];
					if (next.length > FPS_HISTORY_MAX) next.shift();
					this.fpsHistory = next;
				}
			}
		}
		this.#lastTs = ts;
		this.#rafId = requestAnimationFrame(this.#loop);
	};
}

export const perfBudget = new PerfBudget();
