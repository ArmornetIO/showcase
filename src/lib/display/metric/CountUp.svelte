<script lang="ts">
	import { untrack } from 'svelte';

	/**
	 * CountUp — animates a number from `start` to `value` with a requestAnimationFrame
	 * tween. Purpose-built for hero telemetry readouts (SEEN / BLOCKED / ALLOWED) where
	 * the number should "boot up" and settle on load. Reduced-motion aware: jumps to the
	 * final value instantly when the user prefers reduced motion.
	 *
	 * There is no native count-up in the chart/canvas engines — this is the buildable
	 * substitute flagged in the motion spec.
	 */
	interface CountUpProps {
		/** Target value the number settles on. */
		value: number;
		/** Value the tween starts from. Default 0. */
		start?: number;
		/** Tween duration in ms. Default 900. */
		duration?: number;
		/** Delay before the tween begins, in ms. Default 0. */
		delay?: number;
		/** Fixed decimal places. Default 0. */
		decimals?: number;
		/** Group digits with a thousands separator. Default true. */
		separator?: boolean;
		/** Text before the number (e.g. "$"). */
		prefix?: string;
		/** Text after the number (e.g. "%", "k"). */
		suffix?: string;
		/** Monospace tabular figures. Default true. */
		mono?: boolean;
		/** When false, render the final value with no tween. Default true. */
		animate?: boolean;
	}

	let {
		value,
		start = 0,
		duration = 900,
		delay = 0,
		decimals = 0,
		separator = true,
		prefix = '',
		suffix = '',
		mono = true,
		animate = true
	}: CountUpProps = $props();

	let display = $state(0);
	let started = false;

	const fmt = $derived.by(() => {
		const opts: Intl.NumberFormatOptions = {
			minimumFractionDigits: decimals,
			maximumFractionDigits: decimals,
			useGrouping: separator
		};
		return new Intl.NumberFormat('en-US', opts);
	});

	// easeOutQuint — fast then a long gentle settle (cubic-bezier(0.22,1,0.36,1) feel)
	function ease(t: number): number {
		return 1 - Math.pow(1 - t, 5);
	}

	function prefersReducedMotion(): boolean {
		return (
			typeof window !== 'undefined' &&
			typeof window.matchMedia === 'function' &&
			window.matchMedia('(prefers-reduced-motion: reduce)').matches
		);
	}

	$effect(() => {
		// Re-run whenever the target value (or tween settings) change.
		const target = value;

		if (!animate || prefersReducedMotion()) {
			display = target;
			started = true;
			return;
		}

		// Tween origin: `start` on first run, otherwise the current displayed value.
		// `untrack` keeps `display` out of this effect's dependencies so the per-frame
		// writes below don't re-trigger (and restart) the tween.
		const from = started ? untrack(() => display) : start;
		started = true;
		const span = target - from;
		let raf = 0;
		let startTs = 0;

		const step = (ts: number) => {
			if (!startTs) startTs = ts;
			const elapsed = ts - startTs - delay;
			if (elapsed < 0) {
				raf = requestAnimationFrame(step);
				return;
			}
			const t = Math.min(1, elapsed / duration);
			display = from + span * ease(t);
			if (t < 1) raf = requestAnimationFrame(step);
			else display = target;
		};

		raf = requestAnimationFrame(step);
		return () => cancelAnimationFrame(raf);
	});
</script>

<span class="count-up" class:count-up--mono={mono}>{prefix}{fmt.format(display)}{suffix}</span>

<style>
	.count-up {
		font-variant-numeric: tabular-nums;
		font-feature-settings: 'tnum' 1;
	}
	.count-up--mono {
		font-family: var(--mono);
	}
</style>
