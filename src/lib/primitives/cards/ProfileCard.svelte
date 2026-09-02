<script lang="ts">
	import type { CardVariant } from './card.types.js';

	interface Props {
		initials: string;
		name: string;
		role: string;
		bio?: string;
		tags?: string[];
		variant?: CardVariant;
		layout?: 'horizontal' | 'vertical';
		class?: string;
	}

	let {
		initials,
		name,
		role,
		bio,
		tags = [],
		variant = 'emerald',
		layout = 'horizontal',
		class: cls = ''
	}: Props = $props();

	type ColorTokens = { border: string; corner: string; halo: string; avatar: string; role: string };

	const VARIANTS: Record<CardVariant, ColorTokens> = {
		accent: {
			border: 'rgba(94,234,212,0.2)',
			corner: 'rgba(94,234,212,0.6)',
			halo: '94,234,212',
			avatar: 'var(--accent)',
			role: 'var(--accent)'
		},
		cyan: {
			border: 'rgba(34,211,238,0.2)',
			corner: 'rgba(34,211,238,0.6)',
			halo: '34,211,238',
			avatar: 'var(--palette-cyan)',
			role: 'var(--palette-cyan-l)'
		},
		emerald: {
			border: 'rgba(52,211,153,0.2)',
			corner: 'rgba(52,211,153,0.6)',
			halo: '52,211,153',
			avatar: 'var(--palette-emerald)',
			role: 'var(--palette-emerald-l)'
		},
		blue: {
			border: 'rgba(56,189,248,0.2)',
			corner: 'rgba(56,189,248,0.6)',
			halo: '56,189,248',
			avatar: 'var(--palette-blue)',
			role: 'var(--palette-blue-l)'
		},
		amber: {
			border: 'rgba(252,211,77,0.2)',
			corner: 'rgba(252,211,77,0.6)',
			halo: '252,211,77',
			avatar: 'var(--palette-amber)',
			role: 'var(--palette-amber-l)'
		}
	};

	const v = $derived(VARIANTS[variant]);
	const isVertical = $derived(layout === 'vertical');
</script>

<div
	class="pc-card relative r-inset border p-4 transition-[border-color,box-shadow,transform] duration-[250ms] sm:p-6
		{isVertical ? 'flex flex-col items-center p-8 text-center sm:p-[2rem_1.5rem]' : 'flex gap-[1.125rem]'}
		{cls}"
	style:--pc-border={v.border}
	style:background="rgba(15, 23, 42, 0.4)"
	style:--halo={v.halo}
>
	<!-- Corners -->
	<span
		class="pointer-events-none absolute left-[6px] top-[6px] h-[9px] w-[9px] border-l border-t"
		style:border-color={v.corner}
		aria-hidden="true"
	></span>
	<span
		class="pointer-events-none absolute right-[6px] top-[6px] h-[9px] w-[9px] border-r border-t"
		style:border-color={v.corner}
		aria-hidden="true"
	></span>
	<span
		class="pointer-events-none absolute bottom-[6px] left-[6px] h-[9px] w-[9px] border-b border-l"
		style:border-color={v.corner}
		aria-hidden="true"
	></span>
	<span
		class="pointer-events-none absolute bottom-[6px] right-[6px] h-[9px] w-[9px] border-b border-r"
		style:border-color={v.corner}
		aria-hidden="true"
	></span>

	<!-- Avatar -->
	<div
		class="flex shrink-0 items-center justify-center border font-[var(--mono-display)] font-bold
			{isVertical ? 'mb-1 h-16 w-16 rounded-full text-[1.125rem]' : 'h-12 w-12 text-[0.875rem]'}"
		style:border-color={v.corner}
		style:background="rgba(15, 23, 42, 0.6)"
		style:color={v.avatar}
	>
		{initials}
	</div>

	<!-- Body -->
	<div
		class="flex min-w-0 flex-1 flex-col gap-1
			{isVertical ? 'items-center' : ''}"
	>
		<div class="font-[var(--sans-brand)] text-[1rem] font-bold leading-[1.2] text-[var(--fg)]">
			{name}
		</div>
		<div
			class="mb-[0.375rem] font-[var(--mono)] text-[0.5625rem] uppercase tracking-[0.25em]"
			style:color={v.role}
		>
			{role}
		</div>
		{#if bio}
			<p class="m-0 mb-2 text-[0.8125rem] leading-[1.55] text-[var(--fg-dim)]">{bio}</p>
		{/if}
		{#if tags.length}
			<div
				class="mt-1 flex flex-wrap gap-[0.375rem]
					{isVertical ? 'justify-center' : ''}"
			>
				{#each tags as tag}
					<span
						class="r-hairline border border-[var(--border)] bg-[rgba(255,255,255,0.03)] px-2 py-[0.2rem] font-[var(--mono)] text-[0.5rem] uppercase tracking-[0.15em] text-[var(--fg-dim)]"
					>
						{tag}
					</span>
				{/each}
			</div>
		{/if}
	</div>
</div>

<style>
	.pc-card {
		border-color: var(--pc-border);
	}
	.pc-card:hover {
		border-color: rgba(var(--halo), 0.4);
		box-shadow:
			0 0 0 1px rgba(var(--halo), 0.2),
			0 6px 20px -8px rgba(var(--halo), 0.3);
		transform: translateY(-1px);
	}
</style>
