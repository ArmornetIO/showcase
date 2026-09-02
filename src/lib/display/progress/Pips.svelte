<script lang="ts">
	// ── Pips — "n of m", as countable objects ────────────────────────────────────
	// The smallest member of the progress family, and the one a game reaches for
	// constantly: action points, charges, lives, round counters. It is NOT a
	// stepped bar with the bar turned off — there is no track, no labels and no
	// fill animation, because the whole point is that you read the QUANTITY at a
	// glance without counting. Three dots is three; a bar at 60% is arithmetic.
	//
	// `color` is the escape hatch the semantic variants cannot cover: a pip row
	// that belongs to a player is drawn in THAT player's hue, and there is no
	// finite palette of players.
	import type { ProgressVariant } from './progress.types.js';

	/** The pip's outline. `diamond` reads as a resource you spend, `dot` as a
	 *  count you have — the difference is worth having in one glance. */
	export type PipShape = 'dot' | 'diamond' | 'bar';

	interface Props {
		/** How many pips to draw. */
		total: number;
		/** How many are filled, from the left. */
		filled: number;
		shape?: PipShape;
		/** Pip edge length in px. */
		size?: number;
		gap?: number;
		variant?: ProgressVariant;
		/** Explicit fill colour. Beats `variant` — for hues the design system
		 *  cannot know about, like a player's colour. */
		color?: string;
		/** Draw unfilled pips as hollow outlines rather than dim solids. */
		hollow?: boolean;
		/** Dim every pip and drop the glow — for a row you may see but not act on
		 *  (an opponent's remaining actions under fog, say). */
		muted?: boolean;
		/** Accessible label; also the tooltip. */
		label?: string;
		class?: string;
	}

	let {
		total,
		filled,
		shape = 'dot',
		size = 10,
		gap = 4,
		variant = 'accent',
		color,
		hollow = false,
		muted = false,
		label,
		class: cls = ''
	}: Props = $props();

	const VARIANT_FILL: Record<NonNullable<ProgressVariant>, string> = {
		default: 'var(--fg-dim)',
		accent: 'var(--accent)',
		success: '#34d399',
		warn: '#fcd34d',
		error: '#fca5a5'
	};

	const hue = $derived(color ?? VARIANT_FILL[variant ?? 'accent']);
	const empty = $derived(
		muted ? 'color-mix(in srgb, var(--fg) 10%, transparent)' : 'var(--border)'
	);
	const on = $derived(muted ? 'color-mix(in srgb, var(--fg) 30%, transparent)' : hue);
	const radius = $derived(shape === 'dot' ? '9999px' : shape === 'bar' ? '1px' : '2px');
	const text = $derived(label ?? `${filled} of ${total}`);
</script>

<span
	class="inline-flex items-center {cls}"
	style:gap="{gap}px"
	role="img"
	aria-label={text}
	title={text}
>
	{#each { length: total } as _, i (i)}
		{@const lit = i < filled}
		<span
			class="shrink-0 border transition-[background-color,border-color,box-shadow] duration-200 motion-reduce:transition-none!"
			style:width="{shape === 'bar' ? Math.max(2, Math.round(size / 2)) : size}px"
			style:height="{size}px"
			style:border-radius={radius}
			style:transform={shape === 'diamond' ? 'rotate(45deg)' : undefined}
			style:background={lit ? on : hollow ? 'transparent' : empty}
			style:border-color={lit ? on : empty}
			style:box-shadow={lit && !muted
				? `0 0 ${Math.round(size * 0.7)}px color-mix(in srgb, ${on} 50%, transparent)`
				: 'none'}
		></span>
	{/each}
</span>
