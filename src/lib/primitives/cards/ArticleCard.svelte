<script lang="ts">
	import type { CardVariant, ArticleCardAuthor } from './card.types.js';

	interface Props {
		index: number;
		category: string;
		readTime: string;
		title: string;
		excerpt: string;
		author: ArticleCardAuthor;
		href?: string;
		thumbHeight?: string;
		variant?: CardVariant;
		class?: string;
	}

	let {
		index,
		category,
		readTime,
		title,
		excerpt,
		author,
		href,
		thumbHeight = '38%',
		variant = 'cyan',
		class: cls = ''
	}: Props = $props();

	type ColorTokens = { corner: string; mark: string; halo: string };

	const VARIANTS: Record<CardVariant, ColorTokens> = {
		accent: { corner: 'rgba(94,234,212,0.5)', mark: 'var(--accent)', halo: '94,234,212' },
		cyan: { corner: 'rgba(34,211,238,0.5)', mark: 'var(--palette-cyan)', halo: '34,211,238' },
		emerald: { corner: 'rgba(52,211,153,0.5)', mark: 'var(--palette-emerald)', halo: '52,211,153' },
		blue: { corner: 'rgba(56,189,248,0.5)', mark: 'var(--palette-blue)', halo: '56,189,248' },
		amber: { corner: 'rgba(252,211,77,0.5)', mark: 'var(--palette-amber)', halo: '252,211,77' }
	};

	const v = $derived(VARIANTS[variant]);
	const pad = $derived(String(index).padStart(2, '0'));
</script>

<svelte:element
	this={href ? 'a' : 'div'}
	href={href ?? null}
	class="ac-root {cls}"
	style:--c-corner={v.corner}
	style:--c-mark={v.mark}
	style:--halo={v.halo}
	style:--thumb-h={thumbHeight}
>
	<div class="ac-thumb">
		<div class="ac-thumb-mark">{pad}</div>
		<span class="ac-corner ac-tl" aria-hidden="true"></span>
		<span class="ac-corner ac-tr" aria-hidden="true"></span>
	</div>
	<div class="ac-body">
		<div class="ac-meta">
			<span class="ac-meta-cat">{category}</span>
			<span class="ac-meta-dot" aria-hidden="true"></span>
			<span>{readTime}</span>
		</div>
		<h3 class="ac-title">{title}</h3>
		<p class="ac-excerpt">{excerpt}</p>
		<div class="ac-author">
			<div class="ac-author-mark">{author.initials}</div>
			<span class="ac-author-name"
				>{author.name}{author.date ? ` · ${author.date}` : ''}</span
			>
		</div>
	</div>
</svelte:element>

<style>
	.ac-root {
		display: flex;
		flex-direction: column;
		border: 1px solid var(--border);
		border-radius: var(--radius-inset);
		overflow: hidden;
		background: rgba(15, 23, 42, 0.45);
		text-decoration: none;
		color: inherit;
		transition:
			border-color 0.25s,
			transform 0.25s,
			box-shadow 0.25s;
		cursor: pointer;
	}
	.ac-root:hover {
		border-color: var(--c-corner);
		transform: translateY(-2px);
		box-shadow:
			0 0 0 1px rgba(var(--halo), 0.2),
			0 8px 28px -8px rgba(var(--halo), 0.3);
	}
	.ac-thumb {
		position: relative;
		flex: 0 0 var(--thumb-h);
		min-height: 110px;
		background: linear-gradient(135deg, rgba(8, 12, 18, 0.9), rgba(15, 25, 35, 0.7));
		border-bottom: 1px solid var(--border);
		display: flex;
		align-items: center;
		justify-content: center;
	}
	.ac-thumb-mark {
		font-family: var(--mono-display);
		font-size: 3.5rem;
		font-weight: 900;
		color: var(--c-mark);
		opacity: 0.18;
		line-height: 1;
		user-select: none;
	}
	.ac-corner {
		position: absolute;
		width: 9px;
		height: 9px;
		border-color: var(--c-corner);
		border-style: solid;
		border-width: 0;
		pointer-events: none;
	}
	.ac-tl {
		top: 8px;
		left: 8px;
		border-top-width: 1px;
		border-left-width: 1px;
	}
	.ac-tr {
		top: 8px;
		right: 8px;
		border-top-width: 1px;
		border-right-width: 1px;
	}
	.ac-body {
		flex: 1;
		padding: 1rem;
		display: flex;
		flex-direction: column;
		gap: 0.625rem;
	}
	@media (min-width: 640px) {
		.ac-body { padding: 1.25rem; }
	}
	.ac-meta {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		font-family: var(--mono);
		font-size: 0.5625rem;
		letter-spacing: 0.2em;
		text-transform: uppercase;
		color: var(--fg-dim);
	}
	.ac-meta-cat {
		color: var(--fg-muted);
	}
	.ac-meta-dot {
		width: 3px;
		height: 3px;
		border-radius: 50%;
		background: var(--c-mark);
		flex-shrink: 0;
	}
	.ac-title {
		font-family: var(--sans-brand);
		font-size: 1rem;
		font-weight: 700;
		color: var(--fg);
		line-height: 1.35;
		margin: 0;
	}
	.ac-excerpt {
		font-size: 0.8125rem;
		color: var(--fg-dim);
		line-height: 1.6;
		margin: 0;
		flex: 1;
	}
	.ac-author {
		display: flex;
		align-items: center;
		gap: 0.625rem;
		margin-top: 0.25rem;
	}
	.ac-author-mark {
		width: 26px;
		height: 26px;
		border: 1px solid var(--c-corner);
		background: rgba(15, 23, 42, 0.6);
		display: flex;
		align-items: center;
		justify-content: center;
		font-family: var(--mono);
		font-size: 0.5625rem;
		font-weight: 700;
		color: var(--c-mark);
		flex-shrink: 0;
	}
	.ac-author-name {
		font-family: var(--mono);
		font-size: 0.5625rem;
		letter-spacing: 0.1em;
		color: var(--fg-dim);
	}
</style>
