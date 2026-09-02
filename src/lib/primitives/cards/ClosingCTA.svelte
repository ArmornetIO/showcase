<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		kicker?: string;
		headline: string;
		lede?: string;
		primaryLabel?: string;
		primaryHref?: string;
		secondaryLabel?: string;
		secondaryHref?: string;
		overlay?: boolean;
		actions?: Snippet;
		class?: string;
	}

	let {
		kicker,
		headline,
		lede,
		primaryLabel,
		primaryHref,
		secondaryLabel,
		secondaryHref,
		overlay = true,
		actions,
		class: cls = ''
	}: Props = $props();
</script>

<section class="relative overflow-hidden py-[5rem] px-6 text-center {cls}">
	{#if overlay}
		<div class="cc-grid absolute inset-0 pointer-events-none" aria-hidden="true"></div>
	{/if}

	<div class="relative max-w-[44rem] mx-auto flex flex-col items-center gap-[1.25rem]">
		{#if kicker}
			<div class="font-[var(--mono)] text-[0.625rem] tracking-[0.35em] uppercase text-[var(--fg-dim)]">
				{kicker}
			</div>
		{/if}
		<h2 class="cc-headline font-[var(--sans-brand)] font-bold leading-[1.1] text-[var(--fg)] m-0">
			{headline}
		</h2>
		{#if lede}
			<p class="text-[1.0625rem] text-[var(--fg-dim)] leading-[1.65] m-0 max-w-[32rem]">{lede}</p>
		{/if}
		<div class="flex flex-wrap gap-[0.875rem] items-center justify-center mt-2">
			{#if actions}
				{@render actions()}
			{:else}
				{#if primaryLabel && primaryHref}
					<a
						class="inline-flex items-center px-8 py-3 r-inset font-[var(--mono-display)] text-sm font-bold tracking-[0.1em] uppercase no-underline transition-[opacity,transform] duration-200 bg-[var(--accent)] text-[var(--bg)] hover:opacity-[0.88] hover:-translate-y-px"
						href={primaryHref}
					>{primaryLabel}</a>
				{/if}
				{#if secondaryLabel && secondaryHref}
					<a
						class="inline-flex items-center px-8 py-3 r-inset font-[var(--mono-display)] text-sm font-bold tracking-[0.1em] uppercase no-underline transition-[opacity,transform] duration-200 bg-transparent border border-[rgba(94,234,212,0.35)] text-[var(--accent)] hover:opacity-[0.88] hover:-translate-y-px"
						href={secondaryHref}
					>{secondaryLabel}</a>
				{/if}
			{/if}
		</div>
	</div>
</section>

<style>
	/* Grid overlay uses complex multi-value background-image pattern */
	.cc-grid {
		background-image:
			linear-gradient(rgba(94, 234, 212, 0.04) 1px, transparent 1px),
			linear-gradient(90deg, rgba(94, 234, 212, 0.04) 1px, transparent 1px);
		background-size: 40px 40px;
	}

	/* clamp() fluid font size */
	.cc-headline {
		font-size: clamp(2rem, 4vw, 3.5rem);
	}
</style>
