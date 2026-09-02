<script lang="ts">
	export type StatCardVariant = 'default' | 'accent' | 'success' | 'warn' | 'critical' | 'error' | 'dim';
	export type StatCardSize = 'sm' | 'md' | 'md-long' | 'lg' | 'xl';
	export type StatCardShape = 'bracket' | 'cut-corner';

	interface StatCardProps {
		label: string;
		value: string | number;
		variant?: StatCardVariant;
		size?: StatCardSize;
		/** `'bracket'` (default) — L-bracket corners. `'cut-corner'` — diagonal clip + accent bars. */
		shape?: StatCardShape;
		bracketColor?: string;
		valueColor?: string;
		labelColor?: string;
		borderColor?: string;
		glowColor?: string;
		class?: string;
		/** When set, renders as `<button>` so the whole card is interactive. */
		onclick?: (e: MouseEvent) => void;
	}

	let {
		label,
		value,
		variant = 'default',
		size = 'md',
		shape = 'bracket',
		bracketColor,
		valueColor,
		labelColor,
		borderColor,
		glowColor,
		class: cls = '',
		onclick
	}: StatCardProps = $props();

	type VariantTokens = {
		border: string;
		borderHover: string;
		bg: string;
		shadow: string;
		shadowHover: string;
		bracket: string;
		value: string;
		label: string;
	};

	const VARIANTS: Record<StatCardVariant, VariantTokens> = {
		default: {
			border:      'rgba(94, 234, 212, 0.18)',
			borderHover: 'rgba(94, 234, 212, 0.4)',
			bg:          'linear-gradient(135deg, rgba(15, 23, 42, 0.45), rgba(15, 42, 36, 0.2))',
			shadow:      'none',
			shadowHover: '0 0 0 1px rgba(94, 234, 212, 0.2), 0 6px 20px -8px rgba(94, 234, 212, 0.3)',
			bracket:     'rgba(94, 234, 212, 0.55)',
			value:       'var(--fg)',
			label:       'var(--fg-dim)'
		},
		accent: {
			border:      'rgba(94, 234, 212, 0.6)',
			borderHover: 'rgba(94, 234, 212, 0.85)',
			bg:          'linear-gradient(135deg, rgba(94, 234, 212, 0.10), rgba(15, 42, 36, 0.3))',
			shadow:      '0 0 18px -4px rgba(94, 234, 212, 0.45), inset 0 0 12px -6px rgba(94, 234, 212, 0.08)',
			shadowHover: '0 0 28px -4px rgba(94, 234, 212, 0.6), 0 0 0 1px rgba(94, 234, 212, 0.4)',
			bracket:     'rgba(94, 234, 212, 0.8)',
			value:       'var(--fg)',
			label:       'var(--fg-dim)'
		},
		success: {
			border:      'rgba(52, 211, 153, 0.45)',
			borderHover: 'rgba(52, 211, 153, 0.75)',
			bg:          'linear-gradient(135deg, rgba(5, 46, 22, 0.5), rgba(5, 46, 22, 0.15))',
			shadow:      '0 0 18px -4px rgba(52, 211, 153, 0.35), inset 0 0 12px -6px rgba(52, 211, 153, 0.06)',
			shadowHover: '0 0 28px -4px rgba(52, 211, 153, 0.5), 0 0 0 1px rgba(52, 211, 153, 0.35)',
			bracket:     'rgba(52, 211, 153, 0.75)',
			value:       '#34d399',
			label:       'rgba(52, 211, 153, 0.75)'
		},
		warn: {
			border:      'rgba(252, 211, 77, 0.35)',
			borderHover: 'rgba(252, 211, 77, 0.65)',
			bg:          'linear-gradient(135deg, rgba(40, 30, 5, 0.55), rgba(40, 30, 5, 0.2))',
			shadow:      '0 0 18px -4px rgba(252, 211, 77, 0.3), inset 0 0 12px -6px rgba(252, 211, 77, 0.05)',
			shadowHover: '0 0 28px -4px rgba(252, 211, 77, 0.45), 0 0 0 1px rgba(252, 211, 77, 0.3)',
			bracket:     'rgba(252, 211, 77, 0.75)',
			value:       '#FCD34D',
			label:       'rgba(252, 211, 77, 0.7)'
		},
		critical: {
			border:      'rgba(251, 146, 60, 0.45)',
			borderHover: 'rgba(251, 146, 60, 0.75)',
			bg:          'linear-gradient(135deg, rgba(45, 20, 5, 0.6), rgba(45, 20, 5, 0.2))',
			shadow:      '0 0 18px -4px rgba(251, 146, 60, 0.4), inset 0 0 12px -6px rgba(251, 146, 60, 0.07)',
			shadowHover: '0 0 28px -4px rgba(251, 146, 60, 0.55), 0 0 0 1px rgba(251, 146, 60, 0.4)',
			bracket:     'rgba(251, 146, 60, 0.8)',
			value:       '#fb923c',
			label:       'rgba(251, 146, 60, 0.75)'
		},
		error: {
			border:      'rgba(252, 165, 165, 0.4)',
			borderHover: 'rgba(252, 165, 165, 0.7)',
			bg:          'linear-gradient(135deg, rgba(45, 10, 10, 0.6), rgba(45, 10, 10, 0.2))',
			shadow:      '0 0 18px -4px rgba(252, 165, 165, 0.35), inset 0 0 12px -6px rgba(252, 165, 165, 0.06)',
			shadowHover: '0 0 28px -4px rgba(252, 165, 165, 0.5), 0 0 0 1px rgba(252, 165, 165, 0.35)',
			bracket:     'rgba(252, 165, 165, 0.8)',
			value:       '#FCA5A5',
			label:       'rgba(252, 165, 165, 0.7)'
		},
		dim: {
			border:      'rgba(255, 255, 255, 0.07)',
			borderHover: 'rgba(94, 234, 212, 0.3)',
			bg:          'linear-gradient(135deg, rgba(15, 23, 42, 0.3), rgba(3, 7, 18, 0.2))',
			shadow:      'none',
			shadowHover: '0 0 0 1px rgba(94, 234, 212, 0.15), 0 6px 20px -8px rgba(94, 234, 212, 0.2)',
			bracket:     'rgba(255, 255, 255, 0.12)',
			value:       'var(--fg-muted)',
			label:       'var(--fg-dim)'
		}
	};

	const SIZE_ROOT: Record<StatCardSize, string> = {
		'sm':      'min-w-[100px] p-[14px_18px]',
		'md':      'min-w-[118px] p-[18px_22px]',
		'md-long': 'min-w-[200px] p-[18px_22px] inline-flex! items-center gap-[1.1rem]',
		'lg':      'min-w-[150px] p-[22px_28px]',
		'xl':      'min-w-[200px] p-[28px_36px]'
	};

	const SIZE_VALUE: Record<StatCardSize, string> = {
		'sm':      'text-[1.5rem]',
		'md':      'text-[1.875rem]',
		'md-long': 'text-[1.875rem]',
		'lg':      'text-[2.5rem]',
		'xl':      'text-[clamp(2.25rem,5vw,3.5rem)]'
	};

	const SIZE_LABEL: Record<StatCardSize, string> = {
		'sm':      'mt-[10px] tracking-[0.25em]',
		'md':      'mt-[10px] tracking-[0.25em]',
		'md-long': 'mt-0 tracking-[0.18em]',
		'lg':      'mt-[10px] tracking-[0.25em]',
		'xl':      'mt-[10px] tracking-[0.25em]'
	};

	const v = $derived(VARIANTS[variant]);
	const cBracket  = $derived(bracketColor ?? v.bracket);
	const cValue    = $derived(valueColor   ?? v.value);
	const cLabel    = $derived(labelColor   ?? v.label);
	const cBorder   = $derived(borderColor  ?? v.border);
	const cBorderH  = $derived(borderColor  ?? v.borderHover);
	const cShadow   = $derived(glowColor    ?? v.shadow);
	const cShadowH  = $derived(glowColor    ?? v.shadowHover);

	const isCutCorner = $derived(shape === 'cut-corner');

	// Shared Tailwind class string
	const rootCls = $derived(
		`relative inline-block border border-[var(--sc-border)] bg-[var(--bg-elev)] shadow-[var(--sc-shadow)] transition-[border-color,box-shadow,transform] duration-[400ms] ease-in-out select-none hover:-translate-y-1 hover:border-[var(--sc-border-hover)] hover:shadow-[var(--sc-shadow-hover)] max-sm:block max-sm:w-full max-sm:min-w-0 ${SIZE_ROOT[size]} ${isCutCorner ? '[clip-path:polygon(0_0,calc(100%_-_14px)_0,100%_14px,100%_100%,14px_100%,0_calc(100%_-_14px))]' : 'r-surface'} ${onclick ? 'cursor-pointer text-left focus-visible:outline-2 focus-visible:outline-[var(--accent)] focus-visible:outline-offset-2' : ''} ${cls}`
	);
</script>

{#snippet inner()}
	<!-- Corner accents — bracket or cut-corner horizontal bars -->
	{#if isCutCorner}
		<!-- Horizontal accent bar at top-left (aligns with uncut corner) -->
		<span
			class="absolute top-0 left-0 w-[22px] h-px bg-[var(--c-bracket)] pointer-events-none"
			aria-hidden="true"
		></span>
		<!-- Horizontal accent bar at bottom-right (aligns with uncut corner) -->
		<span
			class="absolute bottom-0 right-0 w-[22px] h-px bg-[var(--c-bracket)] pointer-events-none"
			aria-hidden="true"
		></span>
	{:else}
		<span
			class="absolute top-[6px] left-[6px] w-[9px] h-[9px] border-t border-l border-[var(--c-bracket)] pointer-events-none transition-colors duration-200"
			aria-hidden="true"
		></span>
		<span
			class="absolute bottom-[6px] right-[6px] w-[9px] h-[9px] border-b border-r border-[var(--c-bracket)] pointer-events-none transition-colors duration-200"
			aria-hidden="true"
		></span>
	{/if}

	<div
		class="font-[var(--mono-display)] font-black leading-none text-[var(--c-value)] transition-colors duration-200 {SIZE_VALUE[size]}"
	>
		{value}
	</div>
	<div
		class="font-[var(--mono)] text-[0.625rem] uppercase text-[var(--c-label)] whitespace-nowrap transition-colors duration-200 {SIZE_LABEL[size]}"
	>
		{label}
	</div>
{/snippet}

{#if onclick}
	<button
		type="button"
		{onclick}
		class={rootCls}
		style:--sc-border={cBorder}
		style:--sc-border-hover={cBorderH}
		style:--sc-bg={v.bg}
		style:--sc-shadow={cShadow}
		style:--sc-shadow-hover={cShadowH}
		style:--c-bracket={cBracket}
		style:--c-value={cValue}
		style:--c-label={cLabel}
	>
		{@render inner()}
	</button>
{:else}
	<div
		class={rootCls}
		style:--sc-border={cBorder}
		style:--sc-border-hover={cBorderH}
		style:--sc-bg={v.bg}
		style:--sc-shadow={cShadow}
		style:--sc-shadow-hover={cShadowH}
		style:--c-bracket={cBracket}
		style:--c-value={cValue}
		style:--c-label={cLabel}
	>
		{@render inner()}
	</div>
{/if}
