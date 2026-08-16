<script lang="ts">
	import { onMount, type Snippet } from 'svelte';
	import { docsLayout } from './docsLayout.svelte.js';
	import DocsTOC from './DocsTOC.svelte';
	import DocsMetadata from './DocsMetadata.svelte';
	import type { DocsMeta } from './DocsMetadata.svelte';
	import DocsLayoutDashboard from './DocsLayoutDashboard.svelte';

	interface DocsShellProps {
		children: Snippet;
		/**
		 * Frontmatter metadata block — rendered above or below content depending
		 * on the layout setting, hidden when layout.meta === 'hidden'.
		 */
		meta?: DocsMeta;
		/**
		 * Optional breadcrumbs snippet. Rendered at the top of the content area
		 * when layout.breadcrumbs is true. Pass <DocsBreadcrumbs items={...} />.
		 */
		breadcrumbs?: Snippet;
		/**
		 * CSS value for the top offset of the fixed TOC drawer — match your
		 * app's header height (e.g. '64px'). Default: '0px'.
		 */
		topOffset?: string;
	}

	let {
		children,
		meta,
		breadcrumbs,
		topOffset = '0px'
	}: DocsShellProps = $props();

	let tocOpen = $state(true);
	let contentEl = $state<HTMLElement | null>(null);

	// The shell is where the reader's saved arrangement comes back — the store
	// itself reads nothing at import time.
	onMount(() => docsLayout.hydrate());

	const showToc = $derived(docsLayout.toc !== 'hidden');
	const tocOnLeft = $derived(docsLayout.toc === 'left');

	const tocW = $derived(showToc && tocOpen ? 220 : 0);
	const leftPad = $derived(tocOnLeft ? tocW : 0);
	const rightPad = $derived(tocOnLeft ? 0 : tocW);
	const centerStyle = $derived(
		`padding-left: calc(${leftPad}px + 2.5rem); padding-right: calc(${rightPad}px + 2.5rem);`
	);
	const drawerStyle = $derived(`top: ${topOffset}; height: calc(100vh - ${topOffset});`);
</script>

<div class="docs-shell">
	<!-- TOC drawer -->
	{#if showToc}
		<aside
			class="ds-drawer ds-drawer-toc"
			class:open={tocOpen}
			class:left={tocOnLeft}
			style={drawerStyle}
			aria-label="On this page"
		>
			<div class="ds-drawer-scroll">
				<DocsTOC containerEl={contentEl} />
			</div>
		</aside>

		<button
			class="ds-drawer-toggle ds-toggle-toc"
			class:open={tocOpen}
			class:left={tocOnLeft}
			onclick={() => (tocOpen = !tocOpen)}
			aria-label={tocOpen ? 'Collapse contents' : 'Expand contents'}
			style="
				{tocOnLeft ? `left: ${tocOpen ? 220 : 0}px` : `right: ${tocOpen ? 220 : 0}px`};
				top: calc(${topOffset} + 50%);
				transform: translateY(-50%);
			"
		>
			<svg
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
				{#if tocOnLeft}
					{#if tocOpen}<polyline points="15 18 9 12 15 6" />{:else}<polyline
							points="9 18 15 12 9 6"
						/>{/if}
				{:else if tocOpen}
					<polyline points="9 18 15 12 9 6" />
				{:else}
					<polyline points="15 18 9 12 15 6" />
				{/if}
			</svg>
		</button>
	{/if}

	<!-- Main content -->
	<div class="ds-center" style={centerStyle} bind:this={contentEl}>
		{#if docsLayout.breadcrumbs && breadcrumbs}
			{@render breadcrumbs()}
		{/if}
		{#if meta && docsLayout.meta === 'above'}
			<DocsMetadata {meta} />
		{/if}
		{@render children()}
		{#if meta && docsLayout.meta === 'below'}
			<DocsMetadata {meta} />
		{/if}
	</div>

	<DocsLayoutDashboard />
</div>

<style>
	.docs-shell {
		position: relative;
		min-height: 100vh;
	}

	/* Fixed drawers */
	.ds-drawer {
		position: fixed;
		background: var(--bg-elev);
		z-index: 30;
		overflow: hidden;
		transition: transform 0.22s ease;
		width: 220px;
	}
	.ds-drawer-toc {
		right: 0;
		border-left: 1px solid var(--border);
		transform: translateX(100%);
	}
	.ds-drawer-toc.open {
		transform: translateX(0);
	}
	.ds-drawer-toc.left {
		right: auto;
		left: 0;
		border-left: none;
		border-right: 1px solid var(--border);
		transform: translateX(-100%);
	}
	.ds-drawer-toc.left.open {
		transform: translateX(0);
	}
	.ds-drawer-scroll {
		height: 100%;
		overflow-y: auto;
		padding: 1.25rem 0;
		scrollbar-width: thin;
		scrollbar-color: rgba(255, 255, 255, 0.08) transparent;
	}

	/* Drawer toggle tab */
	.ds-drawer-toggle {
		position: fixed;
		width: 20px;
		height: 52px;
		display: flex;
		align-items: center;
		justify-content: center;
		background: var(--bg-elev);
		border: 1px solid var(--border);
		color: var(--fg-dim);
		cursor: pointer;
		z-index: 31;
		padding: 0;
		transition:
			left 0.22s ease,
			right 0.22s ease,
			color 0.12s,
			background 0.12s;
	}
	.ds-drawer-toggle:hover {
		color: var(--fg);
		background: var(--surface-strong);
	}
	.ds-toggle-toc {
		border-right: none;
		border-radius: 6px 0 0 6px;
	}
	.ds-toggle-toc.left {
		border-right: 1px solid var(--border);
		border-left: none;
		border-radius: 0 6px 6px 0;
	}

	/* Center content */
	.ds-center {
		padding-top: 2rem;
		padding-bottom: 4rem;
		transition:
			padding-left 0.22s ease,
			padding-right 0.22s ease;
	}

	/* Mobile: hide drawers */
	@media (max-width: 768px) {
		.ds-drawer,
		.ds-drawer-toggle {
			display: none;
		}
		.ds-center {
			padding-left: 1.25rem !important;
			padding-right: 1.25rem !important;
		}
	}
</style>
