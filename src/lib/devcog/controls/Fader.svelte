<script lang="ts">
	// One channel strip.
	//
	// Vertical because the point of a board is comparing several values across a
	// row of tracks at a glance; a column of horizontal sliders reads as a form.
	// The three globe values used to be 812px of stacked rows-plus-paragraphs —
	// as a bank they are one glance.
	//
	// It wraps a native range input rather than reimplementing drag: arrow,
	// shift+arrow, home and end are the browser's, which is most of the keyboard
	// requirement met without code.
	import InfoDot from './InfoDot.svelte';
	import type { AppliesWhen } from '../console/types.js';

	interface FaderProps {
		label: string;
		value: number;
		min: number;
		max: number;
		step?: number;
		format?: (v: number) => string;
		/** Default or measured sweet spot, drawn on the track. Omit it where the
		 *  "default" is just an end of the range — a mark there is noise. */
		reference?: number;
		applies?: AppliesWhen;
		detail?: string;
		oninput: (v: number) => void;
		/**
		 * Fires on release, not per pixel. Supply it when acting on the value is
		 * expensive — a fixture rebuild, a refetch — and let `oninput` move only
		 * the readout; otherwise a drag runs the expensive thing sixty times.
		 */
		onchange?: (v: number) => void;
	}

	let {
		label,
		value,
		min,
		max,
		step = 1,
		format = (v: number) => String(v),
		reference,
		applies = 'live',
		detail,
		oninput,
		onchange
	}: FaderProps = $props();

	const pct = $derived(reference === undefined ? null : ((reference - min) / (max - min)) * 100);
</script>

<div class="dc-fader">
	<div class="dc-fader-top">
		<span class="dc-fader-val">{format(value)}</span>
	</div>

	<div class="dc-track">
		{#if pct !== null}
			<span class="dc-tick" style="bottom:{pct}%"></span>
		{/if}
		<input
			type="range"
			{min}
			{max}
			{step}
			{value}
			aria-label={label}
			oninput={(e) => oninput(e.currentTarget.valueAsNumber)}
			onchange={(e) => onchange?.(e.currentTarget.valueAsNumber)}
		/>
	</div>

	<div class="dc-fader-foot">
		<span class="dc-fader-lab">{label}</span>
		{#if applies !== 'live'}<span class="dc-fader-badge">{applies}</span>{/if}
		{#if detail}<InfoDot {detail} />{/if}
	</div>
</div>

<style>
	.dc-fader {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 5px;
		min-width: 0;
		flex: 1;
	}
	.dc-fader-top {
		height: 14px;
	}
	.dc-fader-val {
		font-family: var(--mono, monospace);
		font-size: 0.62rem;
		color: var(--accent);
		font-variant-numeric: tabular-nums;
	}
	.dc-track {
		position: relative;
		height: 96px;
		display: flex;
		justify-content: center;
	}
	.dc-track input {
		writing-mode: vertical-lr;
		direction: rtl;
		width: 18px;
		height: 96px;
		accent-color: var(--accent);
		cursor: ns-resize;
	}
	/* The reference mark is the "where this should sit" the prose used to state. */
	.dc-tick {
		position: absolute;
		left: 50%;
		translate: -50% 0;
		width: 15px;
		height: 1px;
		background: var(--fg-dim);
		opacity: 0.75;
		pointer-events: none;
	}
	.dc-tick::after {
		content: '';
		position: absolute;
		right: -5px;
		top: -2px;
		border-left: 4px solid var(--fg-dim);
		border-top: 2.5px solid transparent;
		border-bottom: 2.5px solid transparent;
	}
	.dc-fader-foot {
		display: flex;
		align-items: center;
		gap: 3px;
		min-height: 14px;
	}
	.dc-fader-lab {
		font-family: var(--mono, monospace);
		font-size: 0.55rem;
		letter-spacing: 0.06em;
		color: var(--fg-dim);
		text-transform: uppercase;
	}
	.dc-fader-badge {
		font-family: var(--mono, monospace);
		font-size: 0.48rem;
		padding: 0 3px;
		border: 1px solid var(--border);
		border-radius: 3px;
		color: var(--fg-dim);
	}
</style>
