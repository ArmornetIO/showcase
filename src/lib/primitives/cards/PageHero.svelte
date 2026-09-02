<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		kicker?: string;
		headline: string;
		lede?: string;
		/** Tailwind gradient classes for the headline, e.g. 'from-[var(--accent)] to-[var(--palette-cyan)]' */
		gradFrom?: string;
		gradTo?: string;
		overlay?: boolean;
		cta?: Snippet;
		viz?: Snippet;
		class?: string;
	}

	let {
		kicker,
		headline,
		lede,
		gradFrom = 'var(--accent)',
		gradTo = 'var(--palette-cyan)',
		overlay = true,
		cta,
		viz,
		class: cls = ''
	}: Props = $props();
</script>

<section
	class="relative overflow-hidden py-[5rem] px-6 md:py-[7rem] {cls}"
	style:--grad-from={gradFrom}
	style:--grad-to={gradTo}
>
	{#if overlay}
		<div class="ph-grid-overlay absolute inset-0 pointer-events-none" aria-hidden="true"></div>
		<div class="ph-scanline absolute inset-0 pointer-events-none" aria-hidden="true"></div>
	{/if}

	<div
		class="relative max-w-[72rem] mx-auto flex flex-col gap-12 items-start lg:flex-row lg:items-center lg:justify-between"
	>
		<div class="flex-1 max-w-[44rem] flex flex-col gap-[1.25rem]">
			{#if kicker}
				<div
					class="font-[var(--mono)] text-[0.625rem] tracking-[0.35em] uppercase text-[var(--fg-dim)]"
				>
					{kicker}
				</div>
			{/if}
			<h1
				class="ph-headline font-[var(--sans-brand)] font-bold leading-[1.05] m-0"
			>
				<span class="ph-grad">{headline}</span>
			</h1>
			{#if lede}
				<p class="ph-lede text-[var(--fg-dim)] leading-[1.65] m-0 max-w-[36rem]">{lede}</p>
			{/if}
			{#if cta}
				<div class="flex flex-wrap gap-[0.875rem] items-center mt-2">{@render cta()}</div>
			{/if}
		</div>
		{#if viz}
			<div class="shrink-0">{@render viz()}</div>
		{/if}
	</div>
</section>

<style>
	/* Grid overlay and scanline use complex multi-value background-image patterns */
	.ph-grid-overlay {
		background-image:
			linear-gradient(rgba(94, 234, 212, 0.04) 1px, transparent 1px),
			linear-gradient(90deg, rgba(94, 234, 212, 0.04) 1px, transparent 1px);
		background-size: 40px 40px;
	}

	.ph-scanline {
		background: repeating-linear-gradient(
			0deg,
			transparent,
			transparent 2px,
			rgba(0, 0, 0, 0.03) 2px,
			rgba(0, 0, 0, 0.03) 4px
		);
	}

	/* clamp() fluid font sizes */
	.ph-headline {
		font-size: clamp(2.5rem, 5vw, 4.5rem);
	}

	.ph-lede {
		font-size: clamp(1rem, 1.5vw, 1.25rem);
	}

	/* Gradient text requires -webkit-text-fill-color + background-clip */
	.ph-grad {
		background: linear-gradient(135deg, var(--grad-from), var(--grad-to));
		-webkit-background-clip: text;
		background-clip: text;
		-webkit-text-fill-color: transparent;
		color: transparent;
	}
</style>
