<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { CardVariant } from './card.types.js';

	interface Props {
		eyebrow?: string;
		title: string;
		body?: string;
		num?: string | number;
		windowLabel?: string;
		ctaLabel?: string;
		ctaHref?: string;
		featured?: boolean;
		variant?: CardVariant;
		icon?: Snippet;
		children?: Snippet;
		class?: string;
	}

	let {
		eyebrow,
		title,
		body,
		num,
		windowLabel,
		ctaLabel,
		ctaHref,
		featured = false,
		variant = 'accent',
		icon,
		children,
		class: cls = ''
	}: Props = $props();

	type HudTokens = {
		border: string;
		borderFeatured: string;
		bg: string;
		shadowFeatured: string;
		corner: string;
		eyebrow: string;
		num: string;
		cta: string;
	};

	const VARIANTS: Record<CardVariant, HudTokens> = {
		accent: {
			border: 'rgba(94,234,212,0.18)',
			borderFeatured: 'rgba(94,234,212,0.5)',
			bg: 'linear-gradient(135deg,rgba(15,23,42,0.4),rgba(8,12,18,0.3))',
			shadowFeatured: '0 0 0 1px rgba(94,234,212,0.15),0 16px 40px -12px rgba(94,234,212,0.35)',
			corner: 'rgba(94,234,212,0.6)',
			eyebrow: 'var(--accent)',
			num: 'rgba(94,234,212,0.1)',
			cta: 'var(--accent)'
		},
		cyan: {
			border: 'rgba(34,211,238,0.18)',
			borderFeatured: 'rgba(34,211,238,0.5)',
			bg: 'linear-gradient(135deg,rgba(15,23,42,0.4),rgba(8,16,20,0.3))',
			shadowFeatured: '0 0 0 1px rgba(34,211,238,0.15),0 16px 40px -12px rgba(34,211,238,0.35)',
			corner: 'rgba(34,211,238,0.6)',
			eyebrow: 'var(--palette-cyan-l)',
			num: 'rgba(34,211,238,0.1)',
			cta: 'var(--palette-cyan)'
		},
		emerald: {
			border: 'rgba(52,211,153,0.18)',
			borderFeatured: 'rgba(52,211,153,0.5)',
			bg: 'linear-gradient(135deg,rgba(15,23,42,0.4),rgba(8,18,12,0.3))',
			shadowFeatured: '0 0 0 1px rgba(52,211,153,0.15),0 16px 40px -12px rgba(52,211,153,0.35)',
			corner: 'rgba(52,211,153,0.6)',
			eyebrow: 'var(--palette-emerald-l)',
			num: 'rgba(52,211,153,0.1)',
			cta: 'var(--palette-emerald)'
		},
		blue: {
			border: 'rgba(56,189,248,0.18)',
			borderFeatured: 'rgba(56,189,248,0.5)',
			bg: 'linear-gradient(135deg,rgba(15,23,42,0.4),rgba(8,12,20,0.3))',
			shadowFeatured: '0 0 0 1px rgba(56,189,248,0.15),0 16px 40px -12px rgba(56,189,248,0.35)',
			corner: 'rgba(56,189,248,0.6)',
			eyebrow: 'var(--palette-blue-l)',
			num: 'rgba(56,189,248,0.1)',
			cta: 'var(--palette-blue)'
		},
		amber: {
			border: 'rgba(252,211,77,0.18)',
			borderFeatured: 'rgba(252,211,77,0.5)',
			bg: 'linear-gradient(135deg,rgba(15,23,42,0.4),rgba(20,16,8,0.3))',
			shadowFeatured: '0 0 0 1px rgba(252,211,77,0.15),0 16px 40px -12px rgba(252,211,77,0.35)',
			corner: 'rgba(252,211,77,0.6)',
			eyebrow: 'var(--palette-amber-l)',
			num: 'rgba(252,211,77,0.1)',
			cta: 'var(--palette-amber)'
		}
	};

	const v = $derived(VARIANTS[variant]);
</script>

<div
	class="relative overflow-hidden r-inset border p-7 pr-8 transition-[border-color,box-shadow] duration-[250ms] {featured ? 'border-[var(--border-feat)] shadow-[var(--shadow-feat)]' : 'border-[var(--border)]'} {cls}"
	style:background={v.bg}
	style:--border={v.border}
	style:--border-feat={v.borderFeatured}
	style:--shadow-feat={v.shadowFeatured}
	style:--corner={v.corner}
	style:--c-eyebrow={v.eyebrow}
	style:--c-num={v.num}
	style:--c-cta={v.cta}
>
	<!-- Corners -->
	<span
		class="pointer-events-none absolute left-[6px] top-[6px] h-[9px] w-[9px] border-l border-t border-[var(--corner)]"
		aria-hidden="true"
	></span>
	<span
		class="pointer-events-none absolute right-[6px] top-[6px] h-[9px] w-[9px] border-r border-t border-[var(--corner)]"
		aria-hidden="true"
	></span>
	<span
		class="pointer-events-none absolute bottom-[6px] left-[6px] h-[9px] w-[9px] border-b border-l border-[var(--corner)]"
		aria-hidden="true"
	></span>
	<span
		class="pointer-events-none absolute bottom-[6px] right-[6px] h-[9px] w-[9px] border-b border-r border-[var(--corner)]"
		aria-hidden="true"
	></span>

	{#if num != null}
		<span
			class="pointer-events-none absolute bottom-[-0.25rem] right-4 select-none font-[var(--mono-display)] text-[5rem] font-bold leading-none text-transparent [webkit-text-stroke:1px_var(--c-num)] [text-stroke:1px_var(--c-num)]"
			aria-hidden="true"
			style="-webkit-text-stroke: 1px var(--c-num)">{num}</span
		>
	{/if}

	{#if windowLabel}
		<div
			class="absolute right-6 top-[0.625rem] font-[var(--mono)] text-[0.5rem] uppercase tracking-[0.25em] text-[var(--fg-dim)]"
		>
			{windowLabel}
		</div>
	{/if}

	<div class="relative flex flex-col gap-[0.625rem]">
		{#if icon}
			<div class="mb-1 text-2xl leading-none">{@render icon()}</div>
		{/if}
		{#if eyebrow}
			<div
				class="font-[var(--mono)] text-[0.625rem] uppercase tracking-[0.3em] text-[var(--c-eyebrow)]"
			>
				/ {eyebrow}
			</div>
		{/if}
		<h3
			class="m-0 font-[var(--mono-display)] text-[1.125rem] font-bold leading-[1.25] text-[var(--fg)]"
		>
			{title}
		</h3>
		{#if body}
			<p class="m-0 text-[0.9375rem] leading-[1.65] text-[var(--fg-muted)]">{body}</p>
		{/if}
		{#if children}
			{@render children()}
		{/if}
		{#if ctaLabel}
			{#if ctaHref}
				<a
					class="mt-1 inline-block font-[var(--mono)] text-[0.6875rem] uppercase tracking-[0.15em] text-[var(--c-cta)] no-underline transition-opacity duration-200 hover:opacity-75"
					href={ctaHref}>{ctaLabel} →</a
				>
			{:else}
				<span
					class="mt-1 inline-block font-[var(--mono)] text-[0.6875rem] uppercase tracking-[0.15em] text-[var(--c-cta)] transition-opacity duration-200 hover:opacity-75"
					>{ctaLabel} →</span
				>
			{/if}
		{/if}
	</div>
</div>
