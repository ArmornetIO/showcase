<script module lang="ts">
	export interface DocNavCard {
		tag: string;
		title: string;
		href: string;
		status?: string;
		updated?: string;
	}

	export interface DocNavGroup {
		heading: string;
		cards: DocNavCard[];
	}
</script>

<script lang="ts">
	const DRAWER_W = 240;

	interface DocsNavProps {
		groups: DocNavGroup[];
		/** Current pathname — used to mark the active link. */
		currentPath?: string;
		/** Href for the "All docs" home link. Default: '/docs'. */
		homeHref?: string;
		/** Label for the home link. Default: 'All docs'. */
		homeLabel?: string;
		/** Called when any nav link is clicked (e.g. to close a mobile drawer). */
		onNavigate?: () => void;
		/**
		 * Render as a fixed collapsible drawer instead of inline.
		 * 'right' | 'left' — the side it slides in from.
		 * When set, the component manages its own open state and renders the
		 * toggle tab. The adjacent content gets padding applied automatically.
		 */
		drawer?: 'right' | 'left';
		/** Initial open state when drawer mode is active. Default: false. */
		defaultOpen?: boolean;
	}

	let {
		groups,
		currentPath = '',
		homeHref = '/docs',
		homeLabel = 'All docs',
		onNavigate,
		drawer,
		defaultOpen = false
	}: DocsNavProps = $props();

	let collapsed = $state<Record<string, boolean>>({});
	let drawerOpen = $state(defaultOpen);

	function toggle(heading: string) {
		collapsed[heading] = !collapsed[heading];
	}

	function handleNavigate() {
		onNavigate?.();
	}

	const isDrawer = $derived(drawer === 'right' || drawer === 'left');
	const onRight = $derived(drawer === 'right');
</script>

{#if isDrawer}
	<!-- ── Fixed drawer mode ─────────────────────────────────────────────────── -->

	<!-- Toggle tab -->
	<button
		class="dn-toggle"
		class:on-right={onRight}
		class:open={drawerOpen}
		type="button"
		style:right={onRight ? `${drawerOpen ? DRAWER_W : 0}px` : undefined}
		style:left={!onRight ? `${drawerOpen ? DRAWER_W : 0}px` : undefined}
		onclick={() => (drawerOpen = !drawerOpen)}
		aria-label={drawerOpen ? 'Collapse navigation' : 'Expand all docs navigation'}
		aria-expanded={drawerOpen}
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
			{#if onRight}
				{#if drawerOpen}
					<polyline points="9 18 15 12 9 6" />
				{:else}
					<polyline points="15 18 9 12 15 6" />
				{/if}
			{:else if drawerOpen}
				<polyline points="15 18 9 12 15 6" />
			{:else}
				<polyline points="9 18 15 12 9 6" />
			{/if}
		</svg>
	</button>

	<!-- Drawer panel -->
	<aside
		class="dn-drawer"
		class:open={drawerOpen}
		class:on-right={onRight}
		aria-label="Documentation navigation"
		aria-hidden={!drawerOpen}
	>
		<div class="dn-drawer-scroll">
			<nav class="docs-nav-tree" aria-label="Documentation">
				{@render navContent()}
			</nav>
		</div>
	</aside>

{:else}
	<!-- ── Inline mode (default) ─────────────────────────────────────────────── -->
	<nav class="docs-nav-tree" aria-label="Documentation">
		{@render navContent()}
	</nav>
{/if}

{#snippet navContent()}
	<a
		href={homeHref}
		class="docs-nav-home"
		class:active={currentPath === homeHref}
		onclick={handleNavigate}
	>
		<svg
			width="14"
			height="14"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			stroke-width="2"
			stroke-linecap="round"
			stroke-linejoin="round"
			aria-hidden="true"
		>
			<path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
			<polyline points="9 22 9 12 15 12 15 22" />
		</svg>
		{homeLabel}
	</a>

	{#each groups as group (group.heading)}
		<div class="docs-nav-group">
			<button
				class="docs-nav-heading"
				onclick={() => toggle(group.heading)}
				aria-expanded={!collapsed[group.heading]}
			>
				<span>{group.heading}</span>
				<svg
					class="docs-nav-chevron"
					class:rotated={collapsed[group.heading]}
					width="12"
					height="12"
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
			</button>

			{#if !collapsed[group.heading]}
				<ul class="docs-nav-list" role="list">
					{#each group.cards as card (card.href)}
						{@const active = currentPath === card.href}
						<li>
							<a
								href={card.href}
								class="docs-nav-link"
								class:active
								aria-current={active ? 'page' : undefined}
								onclick={handleNavigate}
							>
								<span class="docs-nav-tag">{card.tag}</span>
								<span class="docs-nav-title">{card.title}</span>
							</a>
						</li>
					{/each}
				</ul>
			{/if}
		</div>
	{/each}
{/snippet}

<style>
	/* ── Drawer wrapper ───────────────────────────────────── */
	.dn-drawer {
		position: fixed;
		top: 0;
		right: 0;
		height: 100vh;
		width: 240px;
		background: var(--bg-elev);
		border-left: 1px solid var(--border);
		z-index: 30;
		transform: translateX(100%);
		transition: transform 0.22s ease;
		overflow: hidden;
	}
	.dn-drawer:not(.on-right) {
		right: auto;
		left: 0;
		border-left: none;
		border-right: 1px solid var(--border);
		transform: translateX(-100%);
	}
	.dn-drawer.open {
		transform: translateX(0);
	}

	.dn-drawer-scroll {
		height: 100%;
		overflow-y: auto;
		padding: 1.25rem 0;
		scrollbar-width: thin;
		scrollbar-color: rgba(255, 255, 255, 0.06) transparent;
	}

	/* ── Toggle tab ───────────────────────────────────────── */
	.dn-toggle {
		position: fixed;
		top: 50%;
		transform: translateY(-50%);
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
			right 0.22s ease,
			left 0.22s ease,
			color 0.12s,
			background 0.12s;
	}
	.dn-toggle:hover {
		color: var(--fg);
		background: var(--surface-strong);
	}
	/* Right side: tab hangs off the left edge of the drawer */
	.dn-toggle.on-right {
		border-right: none;
		border-radius: 6px 0 0 6px;
	}
	/* Left side: tab hangs off the right edge of the drawer */
	.dn-toggle:not(.on-right) {
		border-left: none;
		border-radius: 0 6px 6px 0;
	}

	/* ── Nav tree (shared between inline and drawer) ─────── */
	.docs-nav-tree {
		display: flex;
		flex-direction: column;
		gap: 0;
	}
	.docs-nav-home {
		display: flex;
		align-items: center;
		gap: 10px;
		padding: 11px 12px;
		color: var(--fg);
		font-size: 15px;
		border-radius: 7px;
		text-decoration: none;
		transition:
			color 0.15s,
			background 0.15s;
	}
	.docs-nav-home:hover,
	.docs-nav-home.active {
		background: var(--accent-faint);
	}
	.docs-nav-group {
		display: flex;
		flex-direction: column;
	}
	.docs-nav-heading {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.5rem;
		padding: 12px 12px 6px;
		font-family: var(--mono);
		font-size: 10px;
		letter-spacing: 0.25em;
		text-transform: uppercase;
		color: var(--fg-dim);
		background: none;
		border: none;
		cursor: pointer;
		width: 100%;
		text-align: left;
		transition: color 0.12s;
	}
	.docs-nav-heading:hover {
		color: var(--fg-muted);
	}
	.docs-nav-chevron {
		flex-shrink: 0;
		transition: transform 0.15s;
	}
	.docs-nav-chevron.rotated {
		transform: rotate(-90deg);
	}
	.docs-nav-list {
		list-style: none;
		padding: 0;
		margin: 0 0 0.25rem;
	}
	.docs-nav-link {
		display: flex;
		align-items: baseline;
		gap: 12px;
		padding: 9px 12px;
		color: var(--fg-muted);
		text-decoration: none;
		border-left: 2px solid transparent;
		border-radius: 7px;
		line-height: 1.3;
		transition: background 0.15s ease;
	}
	.docs-nav-link:hover {
		background: var(--accent-faint);
	}
	.docs-nav-link.active {
		color: var(--fg);
		border-left-color: var(--accent);
		background: var(--accent-faint);
	}
	.docs-nav-tag {
		font-family: var(--mono);
		font-size: 11px;
		color: var(--accent);
		flex-shrink: 0;
	}
	.docs-nav-title {
		font-size: 15px;
		color: var(--fg-muted);
		line-height: 1.3;
	}
	.docs-nav-link.active .docs-nav-title {
		color: var(--accent);
	}
</style>
