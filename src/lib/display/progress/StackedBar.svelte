<script lang="ts">
	import type { ProgressVariant } from './progress.types.js';

	export interface StackedSegment {
		label: string;
		value: number;
		variant?: ProgressVariant;
		/** Override color with any CSS color value */
		color?: string;
	}

	interface StackedBarProps {
		segments: StackedSegment[];
		/** Explicit total; defaults to sum of segment values */
		total?: number;
		size?: 'sm' | 'md' | 'lg';
		showLegend?: boolean;
		animate?: boolean;
		label?: string;
	}

	let {
		segments,
		total,
		size = 'md',
		showLegend = true,
		animate = true,
		label
	}: StackedBarProps = $props();

	const VARIANT_COLORS: Record<NonNullable<ProgressVariant>, string> = {
		default: 'var(--fg-dim)',
		accent: 'var(--accent)',
		success: '#34d399',
		warn: '#fcd34d',
		error: '#fca5a5'
	};

	const TRACK_HEIGHT: Record<'sm' | 'md' | 'lg', string> = {
		sm: 'h-[3px]',
		md: 'h-[8px]',
		lg: 'h-[14px]'
	};

	const computedTotal = $derived(total ?? segments.reduce((s, seg) => s + seg.value, 0));

	const enriched = $derived(
		segments.map((seg) => ({
			...seg,
			pct: computedTotal > 0 ? (seg.value / computedTotal) * 100 : 0,
			resolvedColor: seg.color ?? VARIANT_COLORS[seg.variant ?? 'accent']
		}))
	);

	let mounted = $state(false);
	$effect(() => {
		mounted = true;
	});

	const scale = $derived(animate ? (mounted ? 1 : 0) : 1);
</script>

<div class="w-full">
	{#if label}
		<div
			class="mb-[7px] font-[var(--mono)] text-[0.625rem] tracking-[0.12em] uppercase text-[var(--fg-muted)]"
		>
			{label}
		</div>
	{/if}

	<div
		class="flex w-full rounded-[3px] overflow-hidden border border-[var(--border)] bg-[rgba(15,23,42,0.5)] motion-reduce:transition-none! {TRACK_HEIGHT[size]}"
		style:transform-origin="left center"
		style:transform="scaleX({scale})"
		style:transition={animate ? 'transform 0.5s ease' : 'none'}
	>
		{#each enriched as seg, i}
			<div
				class="h-full shrink-0"
				style:width="{seg.pct}%"
				style:background={seg.resolvedColor}
				style:border-radius={i === 0
					? '3px 0 0 3px'
					: i === enriched.length - 1
						? '0 3px 3px 0'
						: '0'}
				title="{seg.label}: {seg.value}"
			></div>
		{/each}
	</div>

	{#if showLegend}
		<div class="flex flex-wrap gap-[12px] mt-[10px]">
			{#each enriched as seg}
				<div class="flex items-center gap-[6px] font-[var(--mono)] text-[0.625rem] tracking-[0.1em]">
					<span
						class="w-[8px] h-[8px] rounded-[1px] shrink-0"
						style:background={seg.resolvedColor}
					></span>
					<span class="text-[var(--fg-muted)] uppercase">{seg.label}</span>
					<span class="text-[var(--fg-dim)]">{Math.round(seg.pct)}%</span>
				</div>
			{/each}
		</div>
	{/if}
</div>
