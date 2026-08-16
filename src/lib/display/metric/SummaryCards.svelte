<script lang="ts">
	export type SummaryVariant = 'default' | 'accent' | 'success' | 'warn' | 'error';

	export interface SummaryItem {
		label: string;
		value: number | string;
		variant?: SummaryVariant;
		/** Bumps the card into the accent (active) visual state. */
		highlight?: boolean;
	}

	interface SummaryCardsProps {
		items: SummaryItem[];
		/** Number of columns in the grid. Defaults to the item count (max 6). */
		columns?: number;
		/** Number of columns on mobile viewports. Defaults to 2. */
		mobileCols?: number;
	}

	let { items, columns, mobileCols = 2 }: SummaryCardsProps = $props();

	const cols = $derived(columns ?? Math.min(items.length, 6));

	type VariantStyle = {
		border: string;
		borderHover: string;
		bg: string;
		shadowActive: string;
		bracket: string;
		value: string;
		label: string;
	};

	const VARIANTS: Record<SummaryVariant, VariantStyle> = {
		default: {
			border:       'rgba(94, 234, 212, 0.18)',
			borderHover:  'rgba(94, 234, 212, 0.4)',
			bg:           'linear-gradient(135deg, rgba(15, 23, 42, 0.45), rgba(15, 42, 36, 0.2))',
			shadowActive: 'none',
			bracket:      'rgba(94, 234, 212, 0.55)',
			value:        'var(--fg)',
			label:        'var(--fg-dim)'
		},
		accent: {
			border:       'rgba(94, 234, 212, 0.6)',
			borderHover:  'rgba(94, 234, 212, 0.75)',
			bg:           'linear-gradient(135deg, rgba(94, 234, 212, 0.10), rgba(15, 42, 36, 0.3))',
			shadowActive: '0 0 24px -6px rgba(94, 234, 212, 0.4)',
			bracket:      'rgba(94, 234, 212, 0.55)',
			value:        'var(--fg)',
			label:        'var(--fg-dim)'
		},
		success: {
			border:       'rgba(52, 211, 153, 0.3)',
			borderHover:  'rgba(52, 211, 153, 0.5)',
			bg:           'linear-gradient(135deg, rgba(10, 30, 20, 0.5), rgba(10, 30, 20, 0.2))',
			shadowActive: 'none',
			bracket:      'rgba(52, 211, 153, 0.55)',
			value:        'var(--palette-emerald-l)',
			label:        'rgba(52, 211, 153, 0.75)'
		},
		warn: {
			border:       'rgba(252, 211, 77, 0.3)',
			borderHover:  'rgba(252, 211, 77, 0.5)',
			bg:           'linear-gradient(135deg, rgba(40, 30, 10, 0.5), rgba(40, 30, 10, 0.2))',
			shadowActive: 'none',
			bracket:      'rgba(252, 211, 77, 0.6)',
			value:        'var(--palette-amber)',
			label:        'rgba(252, 211, 77, 0.75)'
		},
		error: {
			border:       'rgba(252, 165, 165, 0.35)',
			borderHover:  'rgba(252, 165, 165, 0.55)',
			bg:           'linear-gradient(135deg, rgba(40, 15, 15, 0.5), rgba(40, 15, 15, 0.2))',
			shadowActive: 'none',
			bracket:      'rgba(252, 165, 165, 0.6)',
			value:        'var(--palette-red)',
			label:        'rgba(252, 165, 165, 0.75)'
		}
	};
</script>

<div
	class="grid gap-[14px] [grid-template-columns:repeat(var(--cols),1fr)] max-sm:[grid-template-columns:repeat(var(--mobile-cols,2),1fr)]"
	style:--cols={cols}
	style:--mobile-cols={mobileCols}
>
	{#each items as item (item.label)}
		{@const v = VARIANTS[item.variant ?? 'default']}
		{@const border = item.highlight ? v.borderHover : v.border}
		{@const shadow = item.highlight ? v.shadowActive : 'none'}
		<div
			class="relative p-[18px_22px] border border-[var(--sc-border)] rounded-[3px] bg-[var(--sc-bg)] shadow-[var(--sc-shadow)] transition-[border-color,box-shadow] duration-[250ms] ease-in-out select-none hover:border-[var(--sc-border-hover)] hover:shadow-[var(--sc-shadow-hover)]"
			style:--sc-border={border}
			style:--sc-bg={v.bg}
			style:--sc-shadow={shadow}
			style:--sc-border-hover={v.borderHover}
			style:--sc-shadow-hover="0 0 0 1px {v.borderHover}, 0 6px 20px -8px {v.borderHover}"
			style:--sc-bracket={v.bracket}
			style:--c-value={v.value}
			style:--c-label={v.label}
		>
			<!-- TL corner bracket -->
			<span
				class="absolute top-[6px] left-[6px] w-[9px] h-[9px] border-t border-l border-[var(--sc-bracket)] pointer-events-none"
				aria-hidden="true"
			></span>
			<!-- BR corner bracket -->
			<span
				class="absolute bottom-[6px] right-[6px] w-[9px] h-[9px] border-b border-r border-[var(--sc-bracket)] pointer-events-none"
				aria-hidden="true"
			></span>

			<div
				class="font-[var(--mono-display)] text-[1.875rem] font-black leading-none text-[var(--c-value)]"
			>
				{item.value}
			</div>
			<div
				class="font-[var(--mono)] text-[0.625rem] tracking-[0.25em] uppercase text-[var(--c-label)] mt-[10px] whitespace-nowrap"
			>
				{item.label}
			</div>
		</div>
	{/each}
</div>
