export type PerfTier = 'full' | 'reduced' | 'minimal';

interface BatteryManager extends EventTarget {
	level: number;
	charging: boolean;
}

/** Rolling window of frame deltas, and how much FPS history the sparkline keeps. */
const FPS_WINDOW = 60;
const FPS_HISTORY_MAX = 120;

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

	readonly tier: PerfTier = $derived.by(() => {
		if (this.forceTier) return this.forceTier;
		if (this.prefersReducedMotion) return 'minimal';
		const draining = this.batteryLevel !== null && this.batteryCharging === false;
		if (draining && (this.batteryLevel as number) < 0.1) return 'minimal';
		if (this.fps < 30) return 'minimal';
		if (draining && (this.batteryLevel as number) < 0.2) return 'reduced';
		if (this.fps < 50) return 'reduced';
		return 'full';
	});

	#refs = 0;
	#rafId = 0;
	#lastTs = 0;
	#frameBuf: number[] = [];
	#teardown: Array<() => void> = [];

	setForceTier(t: PerfTier | null): void {
		this.forceTier = t;
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
		const onMotion = (e: MediaQueryListEvent) => {
			this.prefersReducedMotion = e.matches;
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
					const onLevel = () => (this.batteryLevel = b.level);
					const onCharging = () => (this.batteryCharging = b.charging);
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

				const next = [...this.fpsHistory, this.fps];
				if (next.length > FPS_HISTORY_MAX) next.shift();
				this.fpsHistory = next;
			}
		}
		this.#lastTs = ts;
		this.#rafId = requestAnimationFrame(this.#loop);
	};
}

export const perfBudget = new PerfBudget();
