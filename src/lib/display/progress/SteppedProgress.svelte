<script lang="ts">
	import type { ProgressVariant } from './progress.types.js';

	export type StepStyle = 'blocks' | 'ticks' | 'dots';
	export type StepLabelTone = 'dim' | 'bright';
	export type StepLabelSize = 'xs' | 'sm' | 'md';

	interface SteppedProgressProps {
		/** Number of steps, or an array of step labels */
		steps: number | string[];
		/** Number of completed steps (1-based: 0 = none, steps.length = all done) */
		current: number;
		stepStyle?: StepStyle;
		/** Single variant for all steps */
		variant?: ProgressVariant;
		/** Per-step variant overrides — index maps to step position */
		stepVariants?: ProgressVariant[];
		animate?: boolean;
		label?: string;
		showCount?: boolean;
		/**
		 * Makes each step a button. Receives the 0-based step index. When set,
		 * the whole column (bar + label) becomes the hit target.
		 */
		onstep?: (index: number) => void;
		/**
		 * 0-based index of the step the user is currently on. Distinct from
		 * `current`, which counts completed steps — a stepper you can navigate
		 * needs to show "where you are" independently of "what's done".
		 */
		active?: number;
		labelTone?: StepLabelTone;
		labelSize?: StepLabelSize;
	}

	let {
		steps,
		current,
		stepStyle = 'blocks',
		variant = 'accent',
		stepVariants,
		animate = true,
		label,
		showCount = false,
		onstep,
		active,
		labelTone = 'dim',
		labelSize = 'xs'
	}: SteppedProgressProps = $props();

	const interactive = $derived(!!onstep);

	const LABEL_SIZE: Record<StepLabelSize, string> = {
		xs: 'text-[0.5rem]',
		sm: 'text-[0.68rem]',
		md: 'text-[0.8rem]'
	};
	const LABEL_TONE: Record<StepLabelTone, string> = {
		dim: 'text-[var(--fg-dim)]',
		bright: 'text-[var(--fg)]'
	};

	function variantAt(i: number): NonNullable<ProgressVariant> {
		return stepVariants?.[i] ?? variant ?? 'accent';
	}

	const stepArray = $derived(
		Array.isArray(steps)
			? (steps as string[]).map((lbl, i) => ({ label: lbl, index: i }))
			: Array.from({ length: steps as number }, (_, i) => ({ label: String(i + 1), index: i }))
	);

	const total = $derived(stepArray.length);
	const pct = $derived(total > 0 ? (current / total) * 100 : 0);

	let mounted = $state(false);
	$effect(() => { mounted = true; });

	const fillWidth = $derived(animate ? (mounted ? pct : 0) : pct);

	// Variant color maps — inline styles handle the dynamic coloring
	const FILL_GRADIENT: Record<NonNullable<ProgressVariant>, string> = {
		default: 'var(--fg-dim)',
		accent:  'linear-gradient(90deg, rgba(94, 234, 212, 0.65) 0%, var(--accent) 100%)',
		success: 'linear-gradient(90deg, #059669 0%, #34d399 100%)',
		warn:    'linear-gradient(90deg, #d97706 0%, #fcd34d 100%)',
		error:   'linear-gradient(90deg, #dc2626 0%, #fca5a5 100%)'
	};

	const BLOCK_BG: Record<NonNullable<ProgressVariant>, string> = {
		default: 'var(--fg-dim)',
		accent:  'var(--accent)',
		success: '#34d399',
		warn:    '#fcd34d',
		error:   '#fca5a5'
	};
	const BLOCK_BORDER: Record<NonNullable<ProgressVariant>, string> = {
		default: 'var(--border-strong)',
		accent:  'rgba(94, 234, 212, 0.4)',
		success: 'rgba(52, 211, 153, 0.4)',
		warn:    'rgba(252, 211, 77, 0.4)',
		error:   'rgba(252, 165, 165, 0.4)'
	};
	const DOT_BG: Record<NonNullable<ProgressVariant>, string> = {
		default: 'var(--fg-dim)',
		accent:  'var(--accent)',
		success: '#34d399',
		warn:    '#fcd34d',
		error:   '#fca5a5'
	};
	const DOT_BORDER: Record<NonNullable<ProgressVariant>, string> = {
		default: 'var(--border-strong)',
		accent:  'rgba(94, 234, 212, 0.5)',
		success: 'rgba(52, 211, 153, 0.5)',
		warn:    'rgba(252, 211, 77, 0.5)',
		error:   'rgba(252, 165, 165, 0.5)'
	};
</script>

<div class="w-full">
	{#if label || showCount}
		<div
			class="flex justify-between mb-[7px] font-[var(--mono)] text-[0.625rem] tracking-[0.12em] uppercase"
		>
			{#if label}<span class="text-[var(--fg-muted)]">{label}</span>{/if}
			{#if showCount}<span class="text-[var(--fg-dim)]">{current} / {total}</span>{/if}
		</div>
	{/if}

	{#if stepStyle === 'blocks'}
		{@const hasLabels = stepArray.some((s) => s.label && isNaN(Number(s.label)))}
		<div class="flex gap-[3px] w-full">
			{#each stepArray as step, i}
				<!-- One column per step so the bar and its label share a hit target. -->
				<svelte:element
					this={interactive ? 'button' : 'div'}
					role={interactive ? 'button' : undefined}
					tabindex={interactive ? 0 : undefined}
					type={interactive ? 'button' : undefined}
					aria-label={interactive ? step.label : undefined}
					aria-current={active === i ? 'step' : undefined}
					class="flex-1 min-w-0 flex flex-col gap-[6px] bg-transparent border-0 p-0 {interactive
						? 'cursor-pointer'
						: ''}"
					onclick={interactive ? () => onstep?.(i) : undefined}
				>
					<span
						class="block w-full h-[6px] r-hairline border border-[var(--border)] motion-reduce:transition-none!"
						style:background={i < current ? BLOCK_BG[variantAt(i)] : 'rgba(15, 23, 42, 0.5)'}
						style:border-color={i < current ? BLOCK_BORDER[variantAt(i)] : undefined}
						style:box-shadow={active === i
							? `0 0 0 1px ${DOT_BG[variantAt(i)]}, 0 0 8px ${DOT_BG[variantAt(i)]}99`
							: i === current - 1
								? `0 0 6px ${DOT_BG[variantAt(i)]}66`
								: undefined}
						style:transition={animate ? 'background 0.25s ease, border-color 0.25s ease' : 'none'}
						style:transition-delay={animate && mounted ? `${i * 40}ms` : '0ms'}
					></span>
					{#if hasLabels}
						<span
							class="text-center font-[var(--mono)] {LABEL_SIZE[labelSize]} tracking-[0.08em] uppercase {active ===
							i
								? 'text-[var(--fg)]'
								: LABEL_TONE[labelTone]}"
							style:opacity={active !== undefined && active !== i ? 0.75 : 1}>{step.label}</span
						>
					{/if}
				</svelte:element>
			{/each}
		</div>
	{:else if stepStyle === 'ticks'}
		<div
			class="relative w-full h-[6px] bg-[rgba(15,23,42,0.5)] border border-[var(--border)] r-inset overflow-hidden"
		>
			<div
				class="h-full motion-reduce:transition-none!"
				style:background={FILL_GRADIENT[variant ?? 'accent']}
				style:width="{fillWidth}%"
				style:transition={animate ? 'width 0.5s ease' : 'none'}
			></div>
			{#each stepArray.slice(0, -1) as _step, i}
				<div
					class="absolute top-0 bottom-0 w-px bg-[var(--bg)] -translate-x-1/2 opacity-70"
					style:left="{((i + 1) / total) * 100}%"
				></div>
			{/each}
		</div>
		{#if stepArray.some((s) => s.label && isNaN(Number(s.label)))}
			<div class="relative h-[16px] mt-[5px]">
				{#each stepArray as step, i}
					<!-- The end labels are pinned to the edges rather than centred on their
					     tick. Centred, the first hangs half its width off the left of the
					     bar and the last off the right, so both were clipped by any
					     container no wider than the bar — which is every container. The
					     ticks they name ARE the end ticks, so an edge still reads right. -->
					{@const first = i === 0}
					{@const end = i === total - 1}
					<!-- The centring shift rides the class string rather than a `class:`
					     directive: the utility's name contains a `/`, which that
					     directive's syntax cannot carry. -->
					<span
						class="absolute font-[var(--mono)] text-[0.5rem] tracking-[0.08em] text-[var(--fg-dim)] uppercase whitespace-nowrap {first ||
						end
							? ''
							: '-translate-x-1/2'}"
						style:left={end ? undefined : first ? '0' : `${(i / (total - 1)) * 100}%`}
						style:right={end ? '0' : undefined}>{step.label}</span
					>
				{/each}
			</div>
		{/if}

	{:else}
		<div
			class="w-full h-[4px] bg-[rgba(15,23,42,0.5)] border border-[var(--border)] r-hairline overflow-hidden mb-[8px]"
		>
			<div
				class="h-full motion-reduce:transition-none!"
				style:background={FILL_GRADIENT[variant ?? 'accent']}
				style:width="{fillWidth}%"
				style:transition={animate ? 'width 0.5s ease' : 'none'}
			></div>
		</div>
		<div class="flex justify-between">
			{#each stepArray as step, i}
				<div class="flex flex-col items-center gap-[5px]">
					<div
						class="w-[8px] h-[8px] rounded-full border border-[var(--border)] motion-reduce:transition-none!"
						style:background={i < current ? DOT_BG[variant ?? 'accent'] : 'rgba(15, 23, 42, 0.5)'}
						style:border-color={i < current ? DOT_BORDER[variant ?? 'accent'] : undefined}
						style:box-shadow={i === current - 1 ? '0 0 5px rgba(94, 234, 212, 0.4)' : undefined}
						style:transition={animate ? 'background 0.25s ease, border-color 0.25s ease, box-shadow 0.25s ease' : 'none'}
						style:transition-delay={animate && mounted ? `${i * 60}ms` : '0ms'}
					></div>
					{#if step.label && isNaN(Number(step.label))}
						<span
							class="font-[var(--mono)] text-[0.5rem] tracking-[0.08em] text-[var(--fg-dim)] uppercase whitespace-nowrap"
							>{step.label}</span
						>
					{/if}
				</div>
			{/each}
		</div>
	{/if}
</div>
