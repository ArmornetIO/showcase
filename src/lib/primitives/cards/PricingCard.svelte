<script lang="ts">
	import type { CardVariant } from './card.types.js';

	interface Props {
		tier: string;
		tagline?: string;
		price?: string;
		priceUnit?: string;
		priceSub?: string;
		items?: string[];
		ctaLabel?: string;
		ctaHref?: string;
		onCta?: () => void;
		pending?: boolean;
		badge?: string;
		featured?: boolean;
		variant?: CardVariant;
		class?: string;
	}

	let {
		tier,
		tagline,
		price,
		priceUnit = '/mo',
		priceSub,
		items = [],
		ctaLabel = 'Get started',
		ctaHref,
		onCta,
		pending = false,
		badge,
		featured = false,
		variant = 'accent',
		class: cls = ''
	}: Props = $props();

	type PricingTokens = {
		border: string;
		borderFeatured: string;
		bg: string;
		shadowFeatured: string;
		corner: string;
		tier: string;
		price: string;
		check: string;
		cta: string;
		ctaBg: string;
		badge: string;
	};

	const VARIANTS: Record<CardVariant, PricingTokens> = {
		accent: {
			border: 'rgba(94,234,212,0.18)',
			borderFeatured: 'rgba(94,234,212,0.5)',
			bg: 'linear-gradient(135deg,rgba(8,12,18,0.9),rgba(8,18,14,0.8))',
			shadowFeatured: '0 0 0 1px rgba(94,234,212,0.2),0 20px 50px -15px rgba(94,234,212,0.4)',
			corner: 'rgba(94,234,212,0.6)',
			tier: 'var(--accent)',
			price: 'var(--fg)',
			check: 'var(--accent)',
			cta: 'var(--bg)',
			ctaBg: 'var(--accent)',
			badge: 'var(--accent)'
		},
		cyan: {
			border: 'rgba(34,211,238,0.18)',
			borderFeatured: 'rgba(34,211,238,0.5)',
			bg: 'linear-gradient(135deg,rgba(8,12,18,0.9),rgba(8,16,20,0.8))',
			shadowFeatured: '0 0 0 1px rgba(34,211,238,0.2),0 20px 50px -15px rgba(34,211,238,0.4)',
			corner: 'rgba(34,211,238,0.6)',
			tier: 'var(--palette-cyan-l)',
			price: 'var(--fg)',
			check: 'var(--palette-cyan)',
			cta: 'var(--bg)',
			ctaBg: 'var(--palette-cyan)',
			badge: 'var(--palette-cyan-l)'
		},
		emerald: {
			border: 'rgba(52,211,153,0.18)',
			borderFeatured: 'rgba(52,211,153,0.5)',
			bg: 'linear-gradient(135deg,rgba(8,12,18,0.9),rgba(8,18,12,0.8))',
			shadowFeatured: '0 0 0 1px rgba(52,211,153,0.2),0 20px 50px -15px rgba(52,211,153,0.4)',
			corner: 'rgba(52,211,153,0.6)',
			tier: 'var(--palette-emerald-l)',
			price: 'var(--fg)',
			check: 'var(--palette-emerald)',
			cta: 'var(--bg)',
			ctaBg: 'var(--palette-emerald)',
			badge: 'var(--palette-emerald-l)'
		},
		blue: {
			border: 'rgba(56,189,248,0.18)',
			borderFeatured: 'rgba(56,189,248,0.5)',
			bg: 'linear-gradient(135deg,rgba(8,12,18,0.9),rgba(8,12,20,0.8))',
			shadowFeatured: '0 0 0 1px rgba(56,189,248,0.2),0 20px 50px -15px rgba(56,189,248,0.4)',
			corner: 'rgba(56,189,248,0.6)',
			tier: 'var(--palette-blue-l)',
			price: 'var(--fg)',
			check: 'var(--palette-blue)',
			cta: 'var(--bg)',
			ctaBg: 'var(--palette-blue)',
			badge: 'var(--palette-blue-l)'
		},
		amber: {
			border: 'rgba(252,211,77,0.18)',
			borderFeatured: 'rgba(252,211,77,0.5)',
			bg: 'linear-gradient(135deg,rgba(8,12,18,0.9),rgba(20,16,8,0.8))',
			shadowFeatured: '0 0 0 1px rgba(252,211,77,0.2),0 20px 50px -15px rgba(252,211,77,0.4)',
			corner: 'rgba(252,211,77,0.6)',
			tier: 'var(--palette-amber-l)',
			price: 'var(--fg)',
			check: 'var(--palette-amber)',
			cta: 'var(--bg)',
			ctaBg: 'var(--palette-amber)',
			badge: 'var(--palette-amber-l)'
		}
	};

	const v = $derived(VARIANTS[variant]);
</script>

<div
	class="relative flex flex-col gap-6 rounded-[3px] border p-8 transition-[border-color,box-shadow] duration-[250ms] {featured ? 'border-[var(--border-feat)] shadow-[var(--shadow-feat)]' : 'border-[var(--border)]'} {pending ? 'opacity-60' : ''} {cls}"
	style:background={v.bg}
	style:--border={v.border}
	style:--border-feat={v.borderFeatured}
	style:--shadow-feat={v.shadowFeatured}
	style:--corner={v.corner}
	style:--c-tier={v.tier}
	style:--c-price={v.price}
	style:--c-check={v.check}
	style:--c-cta={v.cta}
	style:--c-cta-bg={v.ctaBg}
	style:--c-badge={v.badge}
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

	{#if badge}
		<div
			class="absolute right-6 top-[-1px] rounded-b-[3px] bg-[var(--c-badge)] px-[0.625rem] py-[0.2rem] font-[var(--mono)] text-[0.5rem] uppercase tracking-[0.2em] text-[var(--bg)]"
		>
			{badge}
		</div>
	{/if}

	<div class="flex flex-col gap-[0.375rem]">
		<div
			class="font-[var(--mono-display)] text-[0.75rem] font-bold uppercase tracking-[0.25em] text-[var(--c-tier)]"
		>
			{tier}
		</div>
		{#if tagline}
			<p class="m-0 text-[0.9375rem] leading-[1.55] text-[var(--fg-dim)]">{tagline}</p>
		{/if}
	</div>

	{#if price}
		<div>
			<div class="flex items-baseline gap-1">
				<span
					class="font-[var(--mono-display)] text-[2.5rem] font-bold leading-none text-[var(--c-price)]"
					>{price}</span
				>
				<span class="font-[var(--mono)] text-[0.75rem] text-[var(--fg-dim)]">{priceUnit}</span>
			</div>
			{#if priceSub}
				<div
					class="-mt-3 font-[var(--mono)] text-[0.5625rem] tracking-[0.1em] text-[var(--fg-dim)]"
				>
					{priceSub}
				</div>
			{/if}
		</div>
	{/if}

	{#if items.length}
		<ul class="m-0 flex flex-1 flex-col gap-[0.625rem] p-0 [list-style:none]">
			{#each items as item}
				<li class="flex items-baseline gap-[0.625rem] text-[0.875rem] leading-[1.5] text-[var(--fg-muted)]">
					<span class="shrink-0 font-[var(--mono)] text-[0.75rem] text-[var(--c-check)]" aria-hidden="true">✓</span>
					{item}
				</li>
			{/each}
		</ul>
	{/if}

	{#if !pending}
		{#if ctaHref}
			<a
				class="mt-auto block w-full rounded-[3px] px-6 py-3 text-center font-[var(--mono-display)] text-[0.8125rem] font-bold uppercase tracking-[0.1em] no-underline transition-[opacity,transform] duration-200 hover:-translate-y-px hover:opacity-[0.88]"
				style:background={v.ctaBg}
				style:color={v.cta}
				href={ctaHref}>{ctaLabel}</a
			>
		{:else}
			<button
				class="mt-auto block w-full cursor-pointer rounded-[3px] border-none px-6 py-3 font-[var(--mono-display)] text-[0.8125rem] font-bold uppercase tracking-[0.1em] transition-[opacity,transform] duration-200 hover:-translate-y-px hover:opacity-[0.88]"
				style:background={v.ctaBg}
				style:color={v.cta}
				type="button"
				onclick={onCta}>{ctaLabel}</button
			>
		{/if}
	{:else}
		<div
			class="mt-auto block w-full cursor-default rounded-[3px] px-6 py-3 text-center font-[var(--mono-display)] text-[0.8125rem] font-bold uppercase tracking-[0.1em] text-[var(--fg-dim)]"
			style:background="rgba(255,255,255,0.06)"
		>
			Coming soon
		</div>
	{/if}
</div>
