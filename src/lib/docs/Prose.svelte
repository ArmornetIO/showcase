<script lang="ts">
	import type { Snippet } from 'svelte';
	import { hydrateEmbeds } from './embeds.js';

	interface ProseProps {
		/**
		 * Raw HTML string — typically from docgen's goldmark renderer, a customer's
		 * rendered policy, or a legal agreement.
		 *
		 * Note what an HTML string CANNOT carry: a component. Prose reached this way
		 * gets code blocks styled by the rules below, never a real `CodeBlock` with
		 * a copy button — `{@html}` cannot instantiate one. A generated document is
		 * a compiled `.svelte` file and does get the real components; that asymmetry
		 * is why the code-block styling here still has to exist.
		 */
		html?: string;
		/** Authored markup instead of an HTML string, for a page writing its own prose. */
		children?: Snippet;
		/** Maximum content width. Default: '720px'. */
		maxWidth?: string;
		/** Override the element wrapping the content. Default: 'article'. */
		as?: 'article' | 'div' | 'section';
		/**
		 * `serif` is for an essay read once, start to finish. It is not a theme
		 * switch — the mono and sans faces still carry every label, chip and code
		 * span; only the body measure changes.
		 */
		face?: 'sans' | 'serif';
		/**
		 * `compact` is prose inside something else — a clause in a panel, an evidence
		 * excerpt, a preview. Same rules at a smaller scale and tighter rhythm, so a
		 * quoted paragraph does not out-weigh the UI holding it.
		 *
		 * It exists because the alternative kept being a second prose component with
		 * its own copy of these rules, which then drifted on table borders and list
		 * markers.
		 */
		density?: 'page' | 'compact';
		/** Utilities for the wrapper — a scroll height, padding. */
		class?: string;
	}

	let {
		html,
		children,
		maxWidth = '720px',
		as: Tag = 'article',
		face = 'sans',
		density = 'page',
		class: cls = ''
	}: ProseProps = $props();
</script>

<svelte:element
	this={Tag}
	class="prose {cls}"
	data-face={face}
	data-density={density}
	style:max-width={maxWidth}
	{@attach (node: HTMLElement) => {
		// Reading `html` re-runs the attachment after each {@html} swap, so
		// embeds mounted into the old markup are torn down with it.
		void html;
		return hydrateEmbeds(node);
	}}
>
	{#if children}{@render children()}{:else}{@html html ?? ''}{/if}
</svelte:element>

<style>
	/* ── Wrapper ─────────────────────────────────────────────────────────────── */
	.prose {
		color: var(--fg);
		font-size: 0.98rem;
		line-height: 1.65;
	}

	/* Body copy only. Headings keep the system's face so an essay still reads as
	   the same product, and the looser measure comes with the face because a serif
	   at sans leading reads cramped. */
	.prose[data-face='serif'] :global(p),
	.prose[data-face='serif'] :global(li),
	.prose[data-face='serif'] :global(blockquote) {
		font-family: var(--serif, Georgia, 'Times New Roman', serif);
		font-size: 1.08rem;
		line-height: 1.75;
	}

	/* ── Headings ────────────────────────────────────────────────────────────── */
	.prose :global(h1) {
		font-size: clamp(1.6rem, 4vw, 2.4rem);
		font-weight: 600;
		letter-spacing: -0.02em;
		line-height: 1.15;
		margin: 0 0 1rem;
		color: var(--fg);
	}
	.prose :global(h2) {
		font-size: 1.4rem;
		font-weight: 600;
		letter-spacing: -0.01em;
		margin: 2.5rem 0 0.75rem;
		color: var(--fg);
	}
	.prose :global(h3) {
		font-size: 1.05rem;
		font-weight: 600;
		margin: 1.75rem 0 0.5rem;
		color: var(--fg);
	}
	.prose :global(h4) {
		font-size: 0.9rem;
		font-weight: 600;
		font-family: var(--mono);
		letter-spacing: 0.06em;
		text-transform: uppercase;
		margin: 1.5rem 0 0.4rem;
		color: var(--fg-muted);
	}

	/* Anchor links on headings (auto-linked by goldmark) */
	.prose :global(h1 a),
	.prose :global(h2 a),
	.prose :global(h3 a),
	.prose :global(h4 a) {
		color: inherit;
		text-decoration: none;
	}
	.prose :global(h2 a:hover),
	.prose :global(h3 a:hover) {
		color: var(--accent);
	}

	/* ── Body text ───────────────────────────────────────────────────────────── */
	.prose :global(p) {
		color: var(--fg-muted);
		margin: 0 0 1rem;
	}
	.prose :global(strong) {
		color: var(--fg);
		font-weight: 600;
	}
	.prose :global(em) {
		color: var(--fg-muted);
	}
	.prose :global(s) {
		color: var(--fg-dim);
	}

	/* ── Links ───────────────────────────────────────────────────────────────── */
	.prose :global(a) {
		color: var(--accent);
		text-decoration: none;
		border-bottom: 1px solid var(--accent-link-underline);
		transition: border-color 0.12s;
	}
	.prose :global(a:hover) {
		border-bottom-color: var(--accent);
	}

	/* ── Lists ───────────────────────────────────────────────────────────────── */
	.prose :global(ul),
	.prose :global(ol) {
		padding-left: 1.35rem;
		margin: 0 0 1rem;
	}
	.prose :global(li) {
		color: var(--fg-muted);
		margin-bottom: 0.3rem;
	}
	.prose :global(li > ul),
	.prose :global(li > ol) {
		margin-top: 0.3rem;
		margin-bottom: 0;
	}

	/* ── Inline code ─────────────────────────────────────────────────────────── */
	.prose :global(code) {
		font-family: var(--mono);
		font-size: 0.87em;
		background: var(--accent-faint-strong);
		border: 1px solid var(--border);
		padding: 0.1rem 0.35rem;
		border-radius: var(--radius-control);
		color: var(--fg);
	}

	/* ── Fenced code blocks (non-terminal languages) ─────────────────────────── */
	.prose :global(pre) {
		margin: 1.25rem 0;
		padding: 1rem 1.25rem;
		background: var(--terminal-bg);
		border: 1px solid var(--border);
		border-radius: var(--radius-surface);
		overflow-x: auto;
		scrollbar-width: thin;
		scrollbar-color: rgba(255, 255, 255, 0.1) transparent;
	}
	.prose :global(pre code) {
		background: none;
		border: none;
		padding: 0;
		font-size: 0.84rem;
		line-height: 1.6;
		color: var(--terminal-fg);
		border-radius: 0;
	}

	/* ── Terminal blocks (bash/sh/yaml/go/ts from docgen renderer) ───────────── */
	.prose :global(.terminal) {
		margin: 1.25rem 0;
		border: 1px solid var(--border);
		border-radius: var(--radius-surface);
		overflow: hidden;
		background: var(--terminal-bg);
		backdrop-filter: blur(8px);
		box-shadow: var(--shadow-card);
	}
	.prose :global(.terminal-bar) {
		display: flex;
		align-items: center;
		gap: 0.4rem;
		padding: 0.55rem 0.85rem;
		background: var(--surface-strong);
		border-bottom: 1px solid var(--border);
	}
	.prose :global(.dot) {
		width: 10px;
		height: 10px;
		border-radius: 50%;
		flex-shrink: 0;
	}
	.prose :global(.dot.red) {
		background: #ff5f56;
	}
	.prose :global(.dot.amber) {
		background: #ffbd2e;
	}
	.prose :global(.dot.green) {
		background: #27c93f;
	}
	.prose :global(.terminal-title) {
		margin-left: auto;
		margin-right: auto;
		font-family: var(--mono);
		font-size: 0.78rem;
		color: var(--fg-dim);
	}
	.prose :global(.terminal-body) {
		margin: 0;
		padding: 1rem 1.25rem;
		font-family: var(--mono);
		font-size: 0.84rem;
		line-height: 1.6;
		color: var(--terminal-fg);
		white-space: pre;
		overflow-x: auto;
		scrollbar-width: thin;
		scrollbar-color: rgba(255, 255, 255, 0.1) transparent;
	}
	.prose :global(.terminal-body .prompt),
	.prose :global(.terminal-body .ok),
	.prose :global(.terminal-body .keyword) {
		color: var(--terminal-accent);
	}
	.prose :global(.terminal-body .dim),
	.prose :global(.terminal-body .comment) {
		color: var(--terminal-dim);
	}
	.prose :global(.terminal-body .string) {
		color: var(--terminal-string);
	}

	/* ── Callouts (Note / Warning / Tip / Important / Caution) ──────────────── */
	.prose :global(.callout) {
		margin: 1.5rem 0;
		padding: 1rem 1.25rem;
		border: 1px solid var(--border);
		border-left: 3px solid var(--accent);
		border-radius: var(--radius-control);
		background: var(--accent-faint);
		font-size: 0.93rem;
		color: var(--fg);
		line-height: 1.55;
	}
	.prose :global(.callout strong) {
		font-family: var(--mono);
		font-size: 0.75rem;
		color: var(--accent);
		letter-spacing: 0.08em;
		text-transform: uppercase;
		display: block;
		margin-bottom: 0.4rem;
		background: none;
		border: none;
		padding: 0;
		border-radius: 0;
	}
	/* Warning / Caution tint */
	.prose :global(.callout:has(strong:first-child:is([class~='warning'], [class~='caution']))) {
		border-left-color: var(--palette-amber);
		background: rgba(252, 211, 77, 0.06);
	}

	/* ── Tables ──────────────────────────────────────────────────────────────── */
	.prose :global(table) {
		width: 100%;
		border-collapse: separate;
		border-spacing: 0;
		margin: 1.25rem 0;
		font-size: 0.9rem;
		border: 1px solid var(--border);
		border-radius: var(--radius-surface);
		overflow: hidden;
	}
	.prose :global(thead) {
		background: var(--surface-raised);
	}
	.prose :global(th) {
		font-family: var(--mono);
		font-size: 0.7rem;
		font-weight: 600;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		color: var(--fg-dim);
		text-align: left;
		padding: 0.6rem 1rem;
		border-bottom: 1px solid var(--border-strong);
	}
	.prose :global(td) {
		padding: 0.6rem 1rem;
		color: var(--fg-muted);
		border-bottom: 1px solid var(--border);
		vertical-align: top;
	}
	.prose :global(tbody tr:last-child td) {
		border-bottom: none;
	}
	.prose :global(tbody tr:hover td) {
		background: var(--surface-raised);
	}

	/* ── Component embeds ────────────────────────────────────────────────────────
	   Block rhythm like any other figure. Unhydrated (no registry, or a name the
	   allowlist refused), the inner <pre> fallback picks up the code-block rules
	   above — nothing here may fight them. */
	.prose :global(.doc-component) {
		margin: 1.25rem 0;
	}

	/* ── Blockquotes (non-callout) ───────────────────────────────────────────── */
	.prose :global(blockquote) {
		margin: 1.25rem 0;
		padding: 0.75rem 1.25rem;
		border-left: 3px solid var(--border-strong);
		color: var(--fg-muted);
		font-style: italic;
	}

	/* ── Horizontal rule ─────────────────────────────────────────────────────── */
	.prose :global(hr) {
		border: none;
		border-top: 1px solid var(--border);
		margin: 2rem 0;
	}

	/* ── compact ─────────────────────────────────────────────────────────────────
	   Absorbed from what used to be a second prose component for policy clauses.
	   Only scale and rhythm change; every rule above still decides what a table, a
	   list marker or a code span looks like, which is the point of folding it in. */
	.prose[data-density='compact'] {
		font-size: 0.875rem;
		line-height: 1.6;
	}
	.prose[data-density='compact'] :global(h1),
	.prose[data-density='compact'] :global(h2),
	.prose[data-density='compact'] :global(h3) {
		margin: 1.2em 0 0.4em;
		line-height: 1.3;
	}
	.prose[data-density='compact'] :global(h1) {
		font-size: 1.4rem;
	}
	.prose[data-density='compact'] :global(h2) {
		font-size: 1.15rem;
	}
	.prose[data-density='compact'] :global(h3) {
		font-size: 1rem;
	}
	.prose[data-density='compact'] :global(p),
	.prose[data-density='compact'] :global(li) {
		margin: 0.5em 0;
	}
	.prose[data-density='compact'] :global(ul),
	.prose[data-density='compact'] :global(ol) {
		margin: 0.5em 0;
	}
	.prose[data-density='compact'] :global(pre),
	.prose[data-density='compact'] :global(.terminal),
	.prose[data-density='compact'] :global(table) {
		margin: 0.8em 0;
	}

	/* ── Reduced motion ──────────────────────────────────────────────────────── */
	@media (prefers-reduced-motion: reduce) {
		.prose :global(*) {
			transition-duration: 0.001ms !important;
		}
	}
</style>
