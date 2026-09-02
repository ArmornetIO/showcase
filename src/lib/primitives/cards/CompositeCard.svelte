<script lang="ts">
	import type { CardVariant, CompositeCardItem } from './card.types.js';

	interface Props {
		eyebrow: string;
		title: string;
		description: string;
		body?: string;
		items: CompositeCardItem[];
		variant?: CardVariant;
		split?: [number, number];
		class?: string;
	}

	let {
		eyebrow,
		title,
		description,
		body,
		items,
		variant = 'cyan',
		split = [7, 5],
		class: cls = ''
	}: Props = $props();

	type CardTokens = { border: string; bg: string; topLine: string; eyebrow: string; title: string };
	type ItemTokens = { border: string; borderHover: string; eyebrow: string; headline: string };

	const CARD: Record<CardVariant, CardTokens> = {
		accent: {
			border: 'rgba(94,234,212,0.35)',
			bg: 'linear-gradient(135deg,rgba(15,23,42,0.85),rgba(15,42,36,0.55),rgba(15,23,42,0.85))',
			topLine: 'linear-gradient(to right,transparent,rgba(94,234,212,0.8),transparent)',
			eyebrow: 'var(--accent)',
			title: 'var(--accent-bright)'
		},
		cyan: {
			border: 'rgba(34,211,238,0.35)',
			bg: 'linear-gradient(135deg,rgba(15,23,42,0.85),rgba(15,35,42,0.55),rgba(15,23,42,0.85))',
			topLine: 'linear-gradient(to right,transparent,rgba(34,211,238,0.8),transparent)',
			eyebrow: 'var(--palette-cyan)',
			title: 'var(--palette-cyan-l)'
		},
		emerald: {
			border: 'rgba(52,211,153,0.35)',
			bg: 'linear-gradient(135deg,rgba(15,23,42,0.85),rgba(15,42,25,0.55),rgba(15,23,42,0.85))',
			topLine: 'linear-gradient(to right,transparent,rgba(52,211,153,0.8),transparent)',
			eyebrow: 'var(--palette-emerald)',
			title: 'var(--palette-emerald-l)'
		},
		blue: {
			border: 'rgba(56,189,248,0.35)',
			bg: 'linear-gradient(135deg,rgba(15,23,42,0.85),rgba(15,25,42,0.55),rgba(15,23,42,0.85))',
			topLine: 'linear-gradient(to right,transparent,rgba(56,189,248,0.8),transparent)',
			eyebrow: 'var(--palette-blue)',
			title: 'var(--palette-blue-l)'
		},
		amber: {
			border: 'rgba(252,211,77,0.35)',
			bg: 'linear-gradient(135deg,rgba(15,23,42,0.85),rgba(42,34,15,0.55),rgba(15,23,42,0.85))',
			topLine: 'linear-gradient(to right,transparent,rgba(252,211,77,0.8),transparent)',
			eyebrow: 'var(--palette-amber)',
			title: 'var(--palette-amber-l)'
		}
	};

	const ITEM: Record<CardVariant, ItemTokens> = {
		accent: {
			border: 'rgba(94,234,212,0.25)',
			borderHover: 'rgba(94,234,212,0.55)',
			eyebrow: 'var(--accent-bright)',
			headline: 'var(--accent)'
		},
		cyan: {
			border: 'rgba(34,211,238,0.25)',
			borderHover: 'rgba(34,211,238,0.55)',
			eyebrow: 'var(--palette-cyan-l)',
			headline: 'var(--palette-cyan)'
		},
		emerald: {
			border: 'rgba(52,211,153,0.25)',
			borderHover: 'rgba(52,211,153,0.55)',
			eyebrow: 'var(--palette-emerald-l)',
			headline: 'var(--palette-emerald)'
		},
		blue: {
			border: 'rgba(56,189,248,0.25)',
			borderHover: 'rgba(56,189,248,0.55)',
			eyebrow: 'var(--palette-blue-l)',
			headline: 'var(--palette-blue)'
		},
		amber: {
			border: 'rgba(252,211,77,0.25)',
			borderHover: 'rgba(252,211,77,0.55)',
			eyebrow: 'var(--palette-amber-l)',
			headline: 'var(--palette-amber)'
		}
	};

	const c = $derived(CARD[variant]);
	const [main, side] = $derived(split);
</script>

<div
	class="glass cc-root {cls}"
	style:--border={c.border}
	style:--bg={c.bg}
	style:--top-line={c.topLine}
	style:--c-eyebrow={c.eyebrow}
	style:--c-title={c.title}
>
	<span class="cc-top-line" aria-hidden="true"></span>
	<div class="cc-grid" style:grid-template-columns="{main}fr {side}fr">
		<div class="cc-main">
			<div class="cc-eyebrow">/ {eyebrow}</div>
			<h2 class="cc-title">{title}</h2>
			<p class="cc-desc">{description}</p>
			{#if body}<p class="cc-body">{body}</p>{/if}
		</div>
		<div class="cc-sidebar">
			{#each items as item}
				{@const iv = ITEM[item.variant ?? variant]}
				<svelte:element
					this={item.href ? 'a' : 'div'}
					href={item.href ?? null}
					class="cc-item"
					style:--item-border={iv.border}
					style:--item-border-hover={iv.borderHover}
					style:--item-eyebrow={iv.eyebrow}
					style:--item-headline={iv.headline}
				>
					<div class="cc-item-label">{item.label}</div>
					<div class="cc-item-headline">{item.headline}</div>
				</svelte:element>
			{/each}
		</div>
	</div>
</div>

<style>
	/* The surface is glass; the variant supplies only the tint. `--border` and
	   `--bg` are still set per-variant by the script above, so a variant keeps
	   its identity — but the material (blur, bevel, float) comes from the theme
	   rather than being re-authored in every card. */
	.cc-root {
		position: relative;
		overflow: hidden;
		padding: 2rem 2.5rem;
		/* Surface, rim, sheen and bloom all come from the shared `.glass` in
		   tokens.css (see the markup). The variant's own `--bg` gradient is
		   deliberately NOT layered back in: at 0.85 alpha it is nearly opaque,
		   and frost with nothing showing through is just a grey slab. Variant
		   identity lives in the top line and the type instead — which is how the
		   source mockup told its cyan and rose cards apart too. */
	}
	.cc-top-line {
		position: absolute;
		top: 0;
		left: 0;
		right: 0;
		height: 1px;
		background: var(--top-line);
		pointer-events: none;
	}
	.cc-grid {
		display: grid;
		gap: 2rem;
		align-items: center;
	}
	@media (max-width: 639px) {
		.cc-grid { grid-template-columns: 1fr !important; }
	}
	.cc-eyebrow {
		font-family: var(--mono);
		font-size: 0.625rem;
		letter-spacing: 0.3em;
		text-transform: uppercase;
		color: var(--c-eyebrow);
		margin-bottom: 0.75rem;
	}
	.cc-title {
		font-family: var(--mono-display);
		font-size: 1.5rem;
		font-weight: 700;
		color: var(--c-title);
		line-height: 1.2;
		margin: 0 0 1rem;
	}
	.cc-desc {
		color: var(--fg-muted);
		line-height: 1.6;
		margin: 0 0 0.5rem;
		font-size: 0.9375rem;
	}
	.cc-body {
		color: var(--fg-dim);
		font-size: 0.875rem;
		line-height: 1.6;
		margin: 0;
	}
	.cc-sidebar {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}
	.cc-item {
		display: block;
		padding: 0.875rem 1.125rem;
		border: 1px solid var(--item-border);
		border-radius: var(--radius-inset);
		/* Token-driven, not a fixed navy: the card surface now follows the theme,
		   so a hardcoded dark fill renders as a grey slab on light glass. */
		background: var(--surface-raised);
		text-decoration: none;
		cursor: pointer;
		transition:
			border-color 0.2s,
			background 0.2s,
			transform 0.2s;
	}
	.cc-item:hover {
		border-color: var(--item-border-hover);
		background: var(--surface-strong);
		transform: translateY(-1px);
	}
	.cc-item-label {
		font-family: var(--mono);
		font-size: 0.625rem;
		letter-spacing: 0.3em;
		text-transform: uppercase;
		color: var(--item-eyebrow);
		margin-bottom: 0.25rem;
	}
	.cc-item-headline {
		font-family: var(--mono-display);
		font-size: 0.875rem;
		font-weight: 700;
		color: var(--item-headline);
	}
</style>
