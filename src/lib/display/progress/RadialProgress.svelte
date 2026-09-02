<script lang="ts">
	import type { ProgressVariant } from './progress.types.js';
	import { getFrameState } from '../../frames/context.js';

	interface RadialProgressProps {
		value: number;
		max?: number;
		/** Diameter in px */
		size?: number;
		strokeWidth?: number;
		variant?: ProgressVariant;
		/** Text rendered below the percentage in the center */
		label?: string;
		showPercent?: boolean;
		indeterminate?: boolean;
		animate?: boolean;
	}

	let {
		value,
		max = 100,
		size = 80,
		strokeWidth = 6,
		variant = 'accent',
		label,
		showPercent = true,
		indeterminate = false,
		animate = true
	}: RadialProgressProps = $props();

	const VARIANT_STROKES: Record<NonNullable<ProgressVariant>, string> = {
		default: 'var(--fg-dim)',
		accent:  'var(--accent)',
		success: '#34d399',
		warn:    '#fcd34d',
		error:   '#fca5a5'
	};

	// While inside a pre-load Frame, the radial becomes an indeterminate
	// rgb-cycling spinner instead of showing a real value.
	const framed = getFrameState();
	const indet = $derived(indeterminate || framed());

	const pct = $derived(Math.min(100, Math.max(0, (value / max) * 100)));
	const r = $derived((size - strokeWidth) / 2);
	const cx = $derived(size / 2);
	const circumference = $derived(2 * Math.PI * r);

	let mounted = $state(false);
	$effect(() => { mounted = true; });

	const effectivePct = $derived(animate && !indeterminate ? (mounted ? pct : 0) : pct);
	const dashOffset = $derived(circumference * (1 - effectivePct / 100));
	const indeterminateDashOffset = $derived(circumference * 0.25);

	const stroke = $derived(framed() ? '#22d3ee' : VARIANT_STROKES[variant]);

	const pctFontSize = $derived(Math.round(size * 0.2));
	const labelFontSize = $derived(Math.round(size * 0.11));
	const pctY = $derived(label ? cx - labelFontSize * 0.6 : cx + pctFontSize * 0.35);
	const labelY = $derived(cx + pctFontSize * 0.5 + labelFontSize);
</script>

<div class="inline-flex shrink-0" style:width="{size}px" style:height="{size}px">
	<svg
		width={size}
		height={size}
		viewBox="0 0 {size} {size}"
		class="block {indet ? 'rp-indeterminate' : ''} {framed() ? 'rp-rgb' : ''}"
		role="progressbar"
		aria-valuenow={indet ? undefined : value}
		aria-valuemin={0}
		aria-valuemax={max}
		aria-label={label}
	>
		<!-- Track ring -->
		<circle
			{cx}
			cy={cx}
			{r}
			fill="none"
			stroke="currentColor"
			stroke-width={strokeWidth}
			opacity="0.15"
		/>
		{#if !indet}
			<circle
				{cx}
				cy={cx}
				{r}
				fill="none"
				stroke={stroke}
				stroke-width={strokeWidth}
				stroke-linecap="round"
				stroke-dasharray={circumference}
				stroke-dashoffset={dashOffset}
				transform="rotate(-90 {cx} {cx})"
				style:transition={animate ? 'stroke-dashoffset 0.55s ease' : 'none'}
			/>
		{:else}
			<circle
				{cx}
				cy={cx}
				{r}
				fill="none"
				stroke={stroke}
				stroke-width={strokeWidth}
				stroke-linecap="round"
				stroke-dasharray={circumference}
				stroke-dashoffset={indeterminateDashOffset}
			/>
		{/if}

		{#if showPercent && !indet}
			<text
				x={cx}
				y={pctY}
				text-anchor="middle"
				dominant-baseline="middle"
				font-family="var(--mono)"
				font-size={pctFontSize}
				font-weight="600"
				fill="var(--fg)"
				letter-spacing="-0.02em"
				>{Math.round(pct)}%</text
			>
		{/if}

		{#if label && !indet}
			<text
				x={cx}
				y={labelY}
				text-anchor="middle"
				dominant-baseline="middle"
				font-family="var(--mono)"
				font-size={labelFontSize}
				fill="var(--fg-dim)"
				letter-spacing="0.06em"
				>{label?.toUpperCase()}</text
			>
		{/if}
	</svg>
</div>

<style>
	@keyframes rp-spin {
		from { transform: rotate(0deg); }
		to   { transform: rotate(360deg); }
	}
	.rp-indeterminate {
		animation: rp-spin 1.4s linear infinite;
		transform-origin: center;
	}
	/* Pre-load frame: spin + cycle the arc through the rgb spectrum. */
	@keyframes rp-hue {
		from { filter: hue-rotate(0deg) saturate(1.4); }
		to   { filter: hue-rotate(360deg) saturate(1.4); }
	}
	.rp-rgb {
		animation:
			rp-spin 1.1s linear infinite,
			rp-hue 3s linear infinite;
	}
	@media (prefers-reduced-motion: reduce) {
		.rp-indeterminate, .rp-rgb { animation: none; }
	}
</style>
