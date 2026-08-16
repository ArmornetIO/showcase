<script lang="ts">
	import { onMount, type Snippet } from 'svelte';
	import type { BreadcrumbItem } from '../navigation/Breadcrumbs.svelte';

	interface LayoutHeaderProps {
		/** Short label shown beside the chevron toggle (e.g. "// vendor management"). */
		eyebrow: string;
		/**
		 * Ancestors of this page, nearest-last, for a page reached by traversal
		 * (register → risk, vendors → vendor → assessment). Every entry is a link:
		 * the current page is the `eyebrow` beside the chevron, never a crumb, so a
		 * trail never repeats where you already are. Omit on destination pages —
		 * a trail of one is a decoration.
		 */
		crumbs?: BreadcrumbItem[];
		/** Optional badge rendered inline after the eyebrow text (e.g. EarlyAccessBadge). */
		badge?: Snippet;
		title?: Snippet;
		/** Glyph for an accent-bordered tile left of the title — identifies the subject. */
		icon?: Snippet;
		/** Mono line under the title, for the machine name of what the page configures. */
		sub?: string;
		/**
		 * Live status inline beside the title (e.g. "10 agents · 14 extensions").
		 * Hidden under 900px, where the title needs the width more than the count does.
		 */
		meta?: Snippet;
		lede?: Snippet;
		actions?: Snippet;
		/** Controls/actions pinned to the right of the eyebrow row (always visible). */
		eyebrowActions?: Snippet;
		/**
		 * Whether the hero (title + lede) starts expanded. Default true keeps every
		 * existing caller unchanged; pass false to open collapsed — just the eyebrow
		 * row (+ eyebrowActions) shows until the user expands it.
		 */
		startExpanded?: boolean;
		/**
		 * Storage key enabling first-visit reveal: the hero opens the first time a
		 * person lands on this page and stays collapsed on every visit after.
		 * Omit to keep `startExpanded` as the only control. The explanation is
		 * worth something once — this spends it then, not on visit two hundred.
		 */
		revealOnce?: string;
		/**
		 * Whether the hero can be opened at all. Pass false on a drill-down that
		 * has nothing to reveal — the chevron disappears with the disclosure it
		 * controlled, leaving the trail, the page name and the action strip. A
		 * caret that opens nothing is a promise the page cannot keep.
		 */
		collapsible?: boolean;
		/**
		 * The measure the header's content sits on, as a CSS length. Must match
		 * whatever the page body below it uses, or the trail and the first card
		 * start on different left edges.
		 *
		 * Defaults to the 1600px column. Pass `'none'` for a full-bleed page (the
		 * dashboards do this): above ~1600px of content area the capped column
		 * centres itself, which spends ~50px a side on nothing before the body's
		 * own gutter even starts.
		 */
		contentMax?: string;
		/**
		 * The header's own side gutter, as a CSS length. Must match the page body
		 * below it or the trail and the first card start on different left edges.
		 *
		 * Defaults to 1.5rem, which dates from the header living outside the
		 * shell's PagePanel. It renders inside PagePanel now, so that default is
		 * added to PagePanel's own 2rem — pass `'0'` (and drop the body's `px-6`)
		 * to let PagePanel be the single gutter instead of the third one.
		 */
		gutter?: string;
	}

	let {
		eyebrow,
		crumbs = [],
		badge,
		title,
		icon,
		sub,
		meta,
		lede,
		actions,
		eyebrowActions,
		startExpanded = true,
		revealOnce,
		collapsible = true,
		contentMax,
		gutter
	}: LayoutHeaderProps = $props();

	/** Only the vars the caller actually overrode — an empty style otherwise. */
	const headerVars = $derived(
		[
			contentMax ? `--header-content-max: ${contentMax}` : '',
			gutter ? `--header-gutter: ${gutter}` : ''
		]
			.filter(Boolean)
			.join('; ') || undefined
	);
	// Both props exist so a page that genuinely wants the old capped column (a
	// long-form reading page, say) can ask for it, rather than every page paying
	// for the one that does.

	let expanded = $state(startExpanded);

	// Runs client-side only, so the collapsed/expanded default still renders
	// server-side without reading storage. A blocked or full localStorage leaves
	// `startExpanded` in charge rather than throwing.
	onMount(() => {
		if (!revealOnce || !collapsible) return;
		const key = `armornet:header-seen:${revealOnce}`;
		try {
			if (localStorage.getItem(key)) {
				expanded = false;
			} else {
				expanded = true;
				localStorage.setItem(key, '1');
			}
		} catch {
			/* storage unavailable — keep startExpanded */
		}
	});
</script>

<header class="layout-header" style={headerVars}>
	<!-- Everything the header renders lives in the same column as the page body
	     below it. Without this the header sits in PagePanel's gutter while the
	     body adds its own `px-6 max-w-[1600px] mx-auto` on top — two different
	     measures, so the chevron and the primary action hang outside the content
	     column on both sides. -->
	<div class="header-inner">
		<div class="eyebrow-row">
		<!-- The trail sits on the eyebrow row, ahead of the toggle, in the same mono
		     vocabulary — one line that reads "where you came from // where you are".
		     It is deliberately outside the toggle button: a link inside a button is
		     both a navigation and a disclosure, and neither wins cleanly. -->
		{#if crumbs.length > 0}
			<nav class="crumbs" aria-label="Breadcrumb">
				{#each crumbs as c, i (c.href ?? c.label)}
					{#if i > 0}<span class="crumb-sep" aria-hidden="true">/</span>{/if}
					{#if c.href}
						<a class="crumb" class:crumb-far={i < crumbs.length - 1} href={c.href}>{c.label}</a>
					{:else}
						<span class="crumb" class:crumb-far={i < crumbs.length - 1}>{c.label}</span>
					{/if}
				{/each}
				<span class="crumb-sep" aria-hidden="true">/</span>
			</nav>
		{/if}
		{#if collapsible}
			<button
				class="header-toggle"
				type="button"
				onclick={() => (expanded = !expanded)}
				aria-expanded={expanded}
				aria-label={expanded ? 'Collapse header' : 'Expand header'}
			>
				<svg
					class="chevron"
					class:rotated={expanded}
					width="11"
					height="11"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2.5"
					stroke-linecap="round"
					stroke-linejoin="round"
					aria-hidden="true"
				>
					<polyline points="6 9 12 15 18 9" />
				</svg>
				<span class="header-eyebrow">{eyebrow}</span>
				{#if badge}{@render badge()}{/if}
			</button>
		{:else}
			<!-- Nothing to disclose: the page name is text, not a control. -->
			<span class="header-static">
				<span class="header-eyebrow">{eyebrow}</span>
				{#if badge}{@render badge()}{/if}
			</span>
		{/if}
		{#if eyebrowActions}
			<div class="eyebrow-right">{@render eyebrowActions()}</div>
		{/if}
	</div>

	{#if collapsible}
	<div class="hero-wrap" class:expanded>
		<div class="hero-inner">
			<div class="hero-head">
				{#if icon}
					<div class="hero-tile">{@render icon()}</div>
				{/if}
				<div class="hero-text">
					{#if title}
						<h1 class="hero-title">{@render title()}</h1>
					{/if}
					{#if sub}
						<div class="hero-sub">{sub}</div>
					{/if}
				</div>
				{#if meta}
					<div class="hero-meta">{@render meta()}</div>
				{/if}
			</div>
			{#if lede}
				<p class="hero-lede">{@render lede()}</p>
			{/if}
			{#if actions}
				<div class="hero-actions">{@render actions()}</div>
			{/if}
		</div>
	</div>
	{/if}
	</div>
</header>

<style>
	.layout-header {
		border-bottom: 1px solid rgba(255, 255, 255, 0.06);
		margin-bottom: 2rem;
	}

	/* Same measure and centring as the page body. Overridable per page for
	   layouts on a different column — set the vars on the header's container. */
	.header-inner {
		/* `none`, not 1600px: above ~1600px of content area the capped column
		   centres itself, spending ~50px a side on nothing before the gutter even
		   starts. The dashboards already run full-bleed; this makes that the rule
		   rather than the exception. Pass --header-content-max to opt back in. */
		max-width: var(--header-content-max, none);
		margin-inline: auto;
		padding-inline: var(--header-gutter, 1.5rem);
	}

	/* The row is the alignment axis: a fixed min-height plus symmetric block
	   padding means the eyebrow and the action strip centre on the same line no
	   matter how tall either side's content is, and the space above the row
	   equals the space below it down to the rule. Previously the header carried
	   padding-top only, so a collapsed header sat hard against its own border. */
	.eyebrow-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		min-height: 2.5rem;
		padding-block: 0.5rem;
	}

	/* A header with no icon/sub/meta collapses to just the title, so this row is
	   inert for every existing caller. */
	.hero-head {
		display: flex;
		align-items: center;
		gap: 0.85rem;
	}
	.hero-text {
		min-width: 0;
	}
	.hero-tile {
		display: grid;
		place-items: center;
		width: 36px;
		height: 36px;
		flex-shrink: 0;
		border: 1.5px solid color-mix(in srgb, var(--accent) 45%, transparent);
		border-radius: 6px;
		background: color-mix(in srgb, var(--accent) 10%, transparent);
		color: var(--accent);
	}
	.hero-sub {
		margin-top: 2px;
		font-family: var(--mono);
		font-size: 0.625rem;
		letter-spacing: 0.1em;
		color: var(--fg-dim);
	}
	.hero-meta {
		display: none;
		align-items: center;
		gap: 0.4rem;
		margin-left: 1rem;
		font-family: var(--mono);
		font-size: 0.625rem;
		color: var(--fg-muted);
	}
	@media (min-width: 900px) {
		.hero-meta {
			display: flex;
		}
	}

	/* Sized and tracked to sit with the eyebrow but read as subordinate to it:
	   same mono uppercase, dimmer, and tighter tracking so the eye lands on the
	   current page first and the trail second. */
	.crumbs {
		display: flex;
		align-items: center;
		gap: 0.45rem;
		min-width: 0;
		font-family: var(--mono);
		font-size: 0.7rem;
		line-height: 1;
		letter-spacing: 0.18em;
		text-transform: uppercase;
	}
	.crumb {
		color: var(--fg-dim);
		text-decoration: none;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		transition: color 0.15s;
	}
	a.crumb:hover {
		color: var(--accent);
	}
	.crumb-sep {
		color: var(--fg-dim);
		opacity: 0.5;
	}
	/* Narrow: keep only the nearest ancestor. A trail that wraps onto two lines
	   costs more room than the orientation it buys. */
	@media (max-width: 720px) {
		.crumb-far,
		.crumb-far + .crumb-sep {
			display: none;
		}
	}

	.eyebrow-right {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		margin-left: auto;
	}

	/* line-height: 1 collapses the text's leading, so the button's box is exactly
	   its glyph box. With inherited leading the box is taller than the text and
	   the optical centre drifts off the row's centre. */
	.header-toggle {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		background: none;
		border: none;
		padding: 0;
		line-height: 1;
		cursor: pointer;
		color: var(--accent);
		transition: color 0.15s;
	}
	.header-toggle:hover {
		color: var(--accent-bright);
	}

	/* Same box as the toggle minus the chevron and the affordances — so a page
	   that cannot expand sits on exactly the same baseline as one that can. */
	.header-static {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		line-height: 1;
		color: var(--accent);
	}

	.chevron {
		flex-shrink: 0;
		transition: transform 0.22s ease;
		transform: rotate(-90deg);
	}
	.chevron.rotated {
		transform: rotate(0deg);
	}

	/* Named `header-eyebrow`, not `eyebrow`: app-ui ships a global `.eyebrow` for
	   marketing section heads (app.css:708) carrying `margin-bottom: 1.5rem`.
	   Svelte scoping raises specificity but cannot remove a property this rule
	   never declared, so that 24px margin landed on this span — and because flex
	   centres the *margin box*, the text rendered 12px above the chevron and the
	   action strip. The explicit `margin` below is the second lock: geometry a
	   component depends on is declared here, never left to inherit.
	   The -0.3em right margin cancels the trailing letter-space, so the optical
	   gap to whatever follows matches the gap before it. */
	.header-eyebrow {
		font-family: var(--mono);
		font-size: 0.75rem;
		line-height: 1;
		letter-spacing: 0.3em;
		text-transform: uppercase;
		margin: 0 -0.3em 0 0;
	}

	.hero-wrap {
		display: grid;
		grid-template-rows: 0fr;
		transition: grid-template-rows 0.25s ease;
	}
	.hero-wrap.expanded {
		grid-template-rows: 1fr;
	}
	.hero-inner {
		overflow: hidden;
		padding-bottom: 0;
		transition: padding-bottom 0.25s ease;
	}
	.hero-wrap.expanded .hero-inner {
		padding-bottom: 1.75rem;
	}

	.hero-title {
		font-family: var(--sans-brand);
		font-size: clamp(2.4rem, 5vw, 3.5rem);
		font-weight: 700;
		line-height: 1.05;
		letter-spacing: -0.01em;
		color: var(--fg);
		margin: 0.9rem 0 0.6rem;
	}

	.hero-lede {
		font-size: 1.0625rem;
		line-height: 1.6;
		color: var(--fg-dim);
		max-width: 100%;
		margin: 0;
		font-weight: 300;
	}
	@media (min-width: 640px) {
		.hero-lede { max-width: 56ch; }
	}

	.hero-actions {
		display: flex;
		gap: 0.75rem;
		flex-wrap: wrap;
		margin-top: 1.25rem;
	}
</style>
