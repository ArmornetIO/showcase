<script lang="ts">
	// Docked API panel for the showcase pages: what component you're looking at,
	// how to call it, and its props.
	//
	// The shell (the rail handle and the slide) is the only bespoke part left —
	// it is a *docked* panel, so SheetDrawer would be a regression: a scrim would
	// stop you scrolling the page you're reading the props for. Everything inside
	// it is library components, so this file styles a container and nothing else.
	import { showcaseState } from './showcaseState.svelte.js';
	import ApiTable from '$lib/dev/ApiTable.svelte';
	import CodeBlock from '$lib/display/code/CodeBlock.svelte';
	import EmptyState from '$lib/primitives/EmptyState.svelte';
	import SectionBar from '$lib/primitives/SectionBar.svelte';
	import Icon from '$lib/icons/Icon.svelte';

	function toggle() {
		showcaseState.sidebarOpen = !showcaseState.sidebarOpen;
	}
</script>

<div class="sidebar" class:open={showcaseState.sidebarOpen} aria-label="Component reference panel">
	<!-- ── Handle (always visible) ────────────────────────────────────── -->
	<button
		class="handle"
		onclick={toggle}
		aria-label={showcaseState.sidebarOpen ? 'Collapse panel' : 'Expand props panel'}
	>
		<span class="handle-chevron" class:flipped={showcaseState.sidebarOpen}>
			<Icon name="chevron-left" size={12} />
		</span>
		{#if !showcaseState.sidebarOpen}
			<span class="handle-label">API</span>
		{/if}
	</button>

	<!-- ── Body ───────────────────────────────────────────────────────── -->
	<div class="body">
		{#if showcaseState.activeComponent}
			<div class="panel-header">
				<span class="panel-component">{showcaseState.activeComponent}</span>
				<span class="panel-eyebrow">component</span>
			</div>

			{#if showcaseState.selectedCode}
				<div class="section">
					<div class="section-head"><SectionBar label="USAGE" /></div>
					<CodeBlock code={showcaseState.selectedCode} copy wrap dedent={false} class="snippet" />
				</div>
			{:else}
				<p class="variant-hint">
					Hover a variant and click
					<span class="hint-icon"><Icon name="code" size={10} /></span>
					to see its snippet.
				</p>
			{/if}

			<div class="section">
				<div class="section-head"><SectionBar label="PROPS" /></div>
				<div class="api-wrap">
					<ApiTable component={showcaseState.activeComponent} />
				</div>
			</div>
		{:else}
			<div class="empty">
				<EmptyState variant="card" message="Scroll to a component to see its props.">
					{#snippet icon()}
						<Icon name="layout-grid" size={20} />
					{/snippet}
				</EmptyState>
			</div>
		{/if}
	</div>
</div>

<style>
	/* ── Shell ─────────────────────────────────────────────────────────── */

	.sidebar {
		position: fixed;
		top: 48px;
		right: 0;
		bottom: 0;
		width: 304px; /* 24px handle + 280px body */
		display: flex;
		transform: translateX(280px); /* closed: only handle visible */
		transition: transform 0.24s cubic-bezier(0.4, 0, 0.2, 1);
		z-index: 35;
	}

	.sidebar.open {
		transform: translateX(0);
	}

	/* Hide entirely on narrow viewports */
	@media (max-width: 900px) {
		.sidebar {
			display: none;
		}
	}

	/* ── Handle ────────────────────────────────────────────────────────── */

	.handle {
		width: 24px;
		flex-shrink: 0;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 8px;
		background: var(--bg-elev);
		border: none;
		border-left: 1px solid var(--border);
		color: var(--fg-dim);
		cursor: pointer;
		padding: 0;
		transition:
			color 0.15s,
			background 0.15s;
	}

	.handle:hover {
		color: var(--accent);
		background: var(--accent-faint);
	}

	.handle-chevron {
		display: flex;
		flex-shrink: 0;
		transition: transform 0.22s ease;
	}

	.handle-chevron.flipped {
		transform: rotate(180deg);
	}

	.handle-label {
		font-family: var(--mono);
		font-size: 0.52rem;
		letter-spacing: 0.18em;
		writing-mode: vertical-lr;
		text-orientation: mixed;
		transform: rotate(180deg);
		color: var(--fg-dim);
	}

	/* ── Body ──────────────────────────────────────────────────────────── */

	.body {
		width: 280px;
		flex-shrink: 0;
		overflow-y: auto;
		overflow-x: hidden;
		background: var(--bg-elev);
		border-left: 1px solid var(--border);
		display: flex;
		flex-direction: column;
		scrollbar-width: thin;
		scrollbar-color: var(--border) transparent;
	}

	/* ── Panel header ──────────────────────────────────────────────────── */

	.panel-header {
		padding: 0.85rem 1rem 0.7rem;
		border-bottom: 1px solid var(--border);
		display: flex;
		flex-direction: column;
		gap: 0.15rem;
		background: var(--bg-elev);
		position: sticky;
		top: 0;
		z-index: 1;
	}

	.panel-eyebrow {
		font-family: var(--mono);
		font-size: 0.55rem;
		letter-spacing: 0.18em;
		text-transform: uppercase;
		color: var(--fg-dim);
	}

	.panel-component {
		font-family: var(--mono);
		font-size: 0.88rem;
		font-weight: 600;
		color: var(--accent);
		letter-spacing: 0.03em;
	}

	/* ── Sections ──────────────────────────────────────────────────────── */

	.section {
		border-bottom: 1px solid var(--border);
	}

	/* SectionBar is a label and a rule — the panel supplies the strip it sits in. */
	.section-head {
		padding: 0.5rem 1rem;
		background: var(--bg-elev);
		position: sticky;
		top: 61px; /* panel-header height */
		z-index: 1;
		border-bottom: 1px solid var(--border);
	}

	/* The snippet is flush with the panel — the panel is already the frame. */
	.section :global(.snippet) {
		border: none;
		border-radius: 0;
		background: var(--bg);
	}

	.api-wrap {
		overflow-x: auto;
	}

	/* ── Variant hint ──────────────────────────────────────────────────── */

	.variant-hint {
		margin: 0;
		padding: 0.75rem 1rem;
		font-size: 0.75rem;
		color: var(--fg-dim);
		line-height: 1.55;
		border-bottom: 1px solid var(--border);
		display: flex;
		align-items: center;
		gap: 0.3rem;
		flex-wrap: wrap;
	}

	/* Centre the empty card in the panel rather than pinning it to the top. */
	.empty {
		flex: 1;
		display: flex;
		align-items: center;
		padding: 1.5rem 1rem;
	}

	.empty :global(> *) {
		flex: 1;
	}

	.hint-icon {
		display: inline-flex;
		align-items: center;
		background: var(--bg);
		border: 1px solid var(--border);
		border-radius: 3px;
		padding: 1px 3px;
		color: var(--fg-muted);
	}
</style>
