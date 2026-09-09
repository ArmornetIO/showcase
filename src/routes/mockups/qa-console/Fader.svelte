<script lang="ts">
	// One channel strip. Vertical because the point of a board is comparing
	// several values down a row of tracks — a column of horizontal sliders
	// reads as a form, not an instrument.
	//
	// Wraps a native range input: arrow / shift+arrow / home / end are the
	// browser's, not ours, which is most of the keyboard requirement met for
	// free.
	import InfoDot from './InfoDot.svelte';

	interface Props {
		label: string;
		value: number;
		min: number;
		max: number;
		step?: number;
		format?: (v: number) => string;
		/** Default or measured sweet spot, drawn on the track. */
		reference?: number;
		applies?: 'live' | 'reload' | 'resize';
		detail?: string;
		oninput: (v: number) => void;
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
		oninput
	}: Props = $props();

	const pct = $derived(reference === undefined ? null : ((reference - min) / (max - min)) * 100);
</script>

<div class="dc-fader">
	<div class="dc-fader-top">
		<span class="dc-val">{format(value)}</span>
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
		/>
	</div>

	<div class="dc-fader-foot">
		<span class="dc-lab">{label}</span>
		{#if applies !== 'live'}<span class="dc-badge">{applies}</span>{/if}
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
	.dc-val {
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
	/* The reference mark is the "where it should sit" the prose used to state. */
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
	.dc-lab {
		font-family: var(--mono, monospace);
		font-size: 0.55rem;
		letter-spacing: 0.06em;
		color: var(--fg-dim);
		text-transform: uppercase;
	}
	.dc-badge {
		font-family: var(--mono, monospace);
		font-size: 0.48rem;
		padding: 0 3px;
		border: 1px solid var(--border);
		border-radius: 3px;
		color: var(--fg-dim);
	}
</style>
