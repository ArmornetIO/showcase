<script lang="ts">
	import type { Snippet } from 'svelte';

	export type TileVariant = 'accent' | 'cyan' | 'emerald' | 'blue' | 'amber' | 'red';

	interface TileProps {
		tag?: string;
		title?: string;
		body?: string;
		href?: string;
		ctaLabel?: string;
		ctaHref?: string;
		variant?: TileVariant;
		/** Console-chip styling: cut-corner clip-path, sharp aesthetic. Default is rounded marketing tile. */
		chip?: boolean;
		class?: string;
		children?: Snippet;
	}

	let {
		tag,
		title,
		body,
		href,
		ctaLabel,
		ctaHref,
		variant = 'accent',
		chip = false,
		class: cls = '',
		children
	}: TileProps = $props();

	const TAG_COLOR: Record<TileVariant, string> = {
		accent: 'var(--accent)',
		cyan: 'var(--palette-cyan-l)',
		emerald: 'var(--palette-emerald-l)',
		blue: 'var(--palette-blue-l)',
		amber: 'var(--palette-amber)',
		red: 'var(--palette-red)'
	};

	const HOVER_BORDER: Record<TileVariant, string> = {
		accent: 'var(--accent)',
		cyan: 'var(--palette-cyan)',
		emerald: 'var(--palette-emerald)',
		blue: 'var(--palette-blue)',
		amber: 'var(--palette-amber)',
		red: 'var(--palette-red)'
	};

	const HOVER_BG: Record<TileVariant, string> = {
		accent: 'var(--accent-faint)',
		cyan: 'rgba(34, 211, 238, 0.06)',
		emerald: 'rgba(52, 211, 153, 0.06)',
		blue: 'rgba(56, 189, 248, 0.06)',
		amber: 'rgba(252, 211, 77, 0.06)',
		red: 'rgba(252, 165, 165, 0.06)'
	};

	const tagColor = $derived(TAG_COLOR[variant]);
	const hoverBorder = $derived(HOVER_BORDER[variant]);
	const hoverBg = $derived(HOVER_BG[variant]);
</script>

<svelte:element
	this={href ? 'a' : 'div'}
	href={href ?? null}
	class="tile {href ? 'tile-link' : ''} {chip ? 'tile-chip' : ''} {cls}"
	style:--tile-tag-color={tagColor}
	style:--tile-hover-border={hoverBorder}
	style:--tile-hover-bg={hoverBg}
>
	{#if tag}<span class="tile-tag">{tag}</span>{/if}
	{#if title}<h3 class="tile-title">{title}</h3>{/if}
	{#if body}<p class="tile-body">{body}</p>{/if}
	{#if children}{@render children()}{/if}
	{#if ctaLabel && ctaHref && !href}
		<a class="tile-cta" href={ctaHref}>{ctaLabel} <span class="tile-cta-arr" aria-hidden="true">→</span></a>
	{/if}
</svelte:element>

<style>
	.tile {
		display: block;
		padding: 1.5rem;
		border: 1px solid var(--border);
		border-radius: var(--radius-surface);
		background: var(--surface-raised);
		color: inherit;
		text-decoration: none;
		transition: border-color 0.2s, background 0.2s, transform 0.2s, box-shadow 0.2s;
	}
	.tile-link { cursor: pointer; }
	.tile-link:hover {
		border-color: var(--tile-hover-border);
		background: var(--tile-hover-bg);
		transform: translateY(-2px);
	}

	/* ── Chip variant — console-style cut corners ─────────────────────────── */
	.tile-chip {
		border-radius: 0;
		clip-path: polygon(14px 0, 100% 0, 100% calc(100% - 14px), calc(100% - 14px) 100%, 0 100%, 0 14px);
	}
	.tile-chip.tile-link:hover {
		transform: translateY(-2px);
		box-shadow: 0 8px 24px -8px var(--tile-hover-border);
	}

	.tile-tag {
		font-family: var(--mono);
		font-size: 0.7rem;
		color: var(--tile-tag-color);
		letter-spacing: 0.12em;
		text-transform: uppercase;
		display: block;
	}
	.tile-title {
		margin: 0.4rem 0 0.5rem;
		font-size: 1.05rem;
		font-weight: 600;
		color: var(--fg);
	}
	.tile-body {
		color: var(--fg-muted);
		font-size: 0.92rem;
		line-height: 1.55;
		margin: 0;
	}
	.tile-cta {
		display: inline-flex;
		gap: 0.35rem;
		align-items: center;
		margin-top: 0.85rem;
		font-family: var(--mono);
		font-size: 0.85rem;
		color: var(--tile-tag-color);
		text-decoration: none;
		transition: color 0.15s;
	}
	.tile-cta-arr { display: inline-block; transition: transform 0.15s; }
	.tile-cta:hover .tile-cta-arr { transform: translateX(2px); }
</style>