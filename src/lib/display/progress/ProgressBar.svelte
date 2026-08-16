<script module lang="ts">
	// Declared in ./progress.types.ts and re-exported here so `ProgressBar` stays
	// the public home of these names for the barrel and existing consumers.
	// Must live in the module block: Svelte only surfaces `<script module>`
	// exports to importers, and a re-export statement — unlike a type
	// declaration — is not hoisted out of the instance script.
	export type { ProgressType, ProgressVariant, ProgressSize } from './progress.types.js';
</script>

<script lang="ts">
	import type { ProgressType, ProgressVariant, ProgressSize } from './progress.types.js';
	import type { StepStyle } from './SteppedProgress.svelte';
	import type { StackedSegment } from './StackedBar.svelte';
	import RadialProgress from './RadialProgress.svelte';
	import SteppedProgress from './SteppedProgress.svelte';
	import StackedBar from './StackedBar.svelte';
	import Pips, { type PipShape } from './Pips.svelte';

	interface ProgressBarProps {
		/** Display style. Default: 'linear'. */
		type?: ProgressType;
		/** Semantic color. Applies to all types. */
		variant?: ProgressVariant;
		/**
		 * Explicit fill colour, beating `variant`. The escape hatch for hues the
		 * design system cannot enumerate — a per-tenant brand, a map region, a
		 * player. Honoured by `linear` and `pips`; the other renderings keep their
		 * semantic palette because they carry more than one colour at a time.
		 */
		color?: string;
		/** Fill-in/mount animation. Default: true. Applies to all types. */
		animate?: boolean;
		/** Accessible + visual label. Applies to all types. */
		label?: string;

		// ── linear + radial ────────────────────────────────────────────────────────
		value?: number;
		max?: number;
		indeterminate?: boolean;

		// ── linear ─────────────────────────────────────────────────────────────────
		size?: ProgressSize;
		showPercent?: boolean;
		showValue?: boolean;
		threshold?: number;
		thresholdLabel?: string;

		// ── radial ─────────────────────────────────────────────────────────────────
		/** Diameter in px (radial only). Default: 80. */
		diameter?: number;
		strokeWidth?: number;

		// ── pips ───────────────────────────────────────────────────────────────────
		/** How many pips are lit. `steps` sets how many there are. */
		filled?: number;
		pipShape?: PipShape;
		/** Pip edge length in px. Default: 10. */
		pipSize?: number;
		/** Unlit pips as hollow outlines rather than dim solids. */
		hollow?: boolean;
		/** Dim the whole row — a count you may see but not act on. */
		muted?: boolean;

		// ── stepped ────────────────────────────────────────────────────────────────
		steps?: number | string[];
		current?: number;
		stepStyle?: StepStyle;
		showCount?: boolean;

		// ── stacked ────────────────────────────────────────────────────────────────
		segments?: StackedSegment[];
		total?: number;
		showLegend?: boolean;
	}

	let {
		type = 'linear',
		variant = 'accent',
		color,
		animate = true,
		label,
		// linear + radial
		value = 0,
		max = 100,
		indeterminate = false,
		// linear
		size = 'md',
		showPercent = false,
		showValue = false,
		threshold,
		thresholdLabel,
		// radial
		diameter = 80,
		strokeWidth = 6,
		// stepped
		steps = 5,
		current = 0,
		stepStyle = 'blocks',
		showCount = false,
		// stacked
		segments = [],
		total,
		showLegend = true,
		// pips
		filled = 0,
		pipShape = 'dot',
		pipSize = 10,
		hollow = false,
		muted = false
	}: ProgressBarProps = $props();

	// ── Linear bar derived state ───────────────────────────────────────────────
	const pct = $derived(Math.min(100, Math.max(0, (value / max) * 100)));
	const thresholdPct = $derived(
		threshold != null ? Math.min(100, Math.max(0, (threshold / max) * 100)) : null
	);

	let mounted = $state(false);
	$effect(() => {
		mounted = true;
	});

	const fillWidth = $derived(animate && !indeterminate ? (mounted ? pct : 0) : pct);
</script>

{#if type === 'radial'}
	<RadialProgress
		{value}
		{max}
		{variant}
		size={diameter}
		{strokeWidth}
		{label}
		{showPercent}
		{animate}
		{indeterminate}
	/>
{:else if type === 'stepped'}
	<SteppedProgress
		{steps}
		{current}
		{stepStyle}
		{variant}
		{animate}
		{label}
		{showCount}
	/>
{:else if type === 'stacked'}
	<StackedBar {segments} {total} {size} {showLegend} {animate} {label} />
{:else if type === 'pips'}
	<Pips
		total={typeof steps === 'number' ? steps : steps.length}
		{filled}
		shape={pipShape}
		size={pipSize}
		{variant}
		{color}
		{hollow}
		{muted}
		{label}
	/>
{:else}
	<!-- ── Linear bar ──────────────────────────────────────────────────────── -->
	<div class="pb-root">
		{#if label || showPercent || showValue}
			<div class="pb-meta">
				{#if label}<span class="pb-label">{label}</span>{/if}
				<div class="pb-right">
					{#if showValue}<span class="pb-info">{value} / {max}</span>{/if}
					{#if showPercent}<span class="pb-info">{Math.round(pct)}%</span>{/if}
				</div>
			</div>
		{/if}

		<div class="pb-outer">
			<div
				class="pb-track pb-track-{size}"
				role="progressbar"
				aria-valuenow={indeterminate ? undefined : value}
				aria-valuemin={0}
				aria-valuemax={max}
				aria-label={label}
			>
				<div
					class="pb-fill pb-fill-{variant}"
					class:pb-indeterminate={indeterminate}
					style:width="{indeterminate ? '40%' : fillWidth + '%'}"
					style:background={color}
					style:transition={animate && !indeterminate ? 'width 0.5s ease' : 'none'}
				></div>
			</div>

			{#if thresholdPct != null}
				<div class="pb-threshold" style:left="{thresholdPct}%" title={thresholdLabel}>
					{#if thresholdLabel}
						<span class="pb-threshold-label">{thresholdLabel}</span>
					{/if}
				</div>
			{/if}
		</div>
	</div>
{/if}

<style>
	/* ── Linear bar ──────────────────────────────────────────────────────────── */
	.pb-root {
		width: 100%;
	}
	.pb-meta {
		display: flex;
		justify-content: space-between;
		align-items: baseline;
		margin-bottom: 7px;
		font-family: var(--mono);
		font-size: 0.625rem;
		letter-spacing: 0.12em;
		text-transform: uppercase;
	}
	.pb-label {
		color: var(--fg-muted);
	}
	.pb-right {
		display: flex;
		gap: 10px;
	}
	.pb-info {
		color: var(--fg-dim);
	}
	.pb-outer {
		position: relative;
	}
	.pb-track {
		width: 100%;
		background: rgba(15, 23, 42, 0.5);
		border: 1px solid var(--border);
		border-radius: 3px;
		overflow: hidden;
	}
	.pb-track-sm {
		height: 3px;
		border-radius: 2px;
	}
	.pb-track-md {
		height: 6px;
	}
	.pb-track-lg {
		height: 10px;
		border-radius: 5px;
	}
	.pb-fill {
		height: 100%;
	}
	.pb-fill-default {
		background: var(--fg-dim);
	}
	.pb-fill-accent {
		background: linear-gradient(90deg, rgba(94, 234, 212, 0.65) 0%, var(--accent) 100%);
	}
	.pb-fill-success {
		background: linear-gradient(90deg, #059669 0%, #34d399 100%);
	}
	.pb-fill-warn {
		background: linear-gradient(90deg, #d97706 0%, var(--palette-amber) 100%);
	}
	.pb-fill-error {
		background: linear-gradient(90deg, #dc2626 0%, #fca5a5 100%);
	}
	@keyframes pb-slide {
		0% {
			transform: translateX(-250%);
		}
		60% {
			transform: translateX(300%);
		}
		100% {
			transform: translateX(300%);
		}
	}
	.pb-indeterminate {
		animation: pb-slide 1.8s ease-in-out infinite;
		width: 40% !important;
	}
	.pb-threshold {
		position: absolute;
		top: -4px;
		bottom: -4px;
		width: 2px;
		background: rgba(252, 211, 77, 0.85);
		transform: translateX(-50%);
		pointer-events: none;
		border-radius: 1px;
	}
	.pb-threshold-label {
		position: absolute;
		top: calc(100% + 5px);
		left: 50%;
		transform: translateX(-50%);
		font-family: var(--mono);
		font-size: 0.5rem;
		letter-spacing: 0.1em;
		color: var(--palette-amber);
		white-space: nowrap;
	}
	@media (prefers-reduced-motion: reduce) {
		.pb-fill {
			transition: none !important;
		}
		.pb-indeterminate {
			animation: none;
			width: 100% !important;
			opacity: 0.5;
		}
	}
</style>
