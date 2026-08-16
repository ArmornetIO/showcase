<script lang="ts">
	import type { Snippet } from 'svelte';
	import NavDrawer from './NavDrawer.svelte';
	import IconButton from '../primitives/IconButton.svelte';
	import PagePanel from './PagePanel.svelte';

	interface AppShellProps {
		children: Snippet;
		/** Full sidebar content — rendered in the desktop aside and the mobile drawer.
		 *  Receives whether the desktop rail is collapsed to icons, so the sidebar can
		 *  swap its expandable tree for a flat icon rail. Always false in the mobile drawer. */
		sidebar: Snippet<[boolean]>;
		/** Brand/logo area shown in the mobile top bar (alongside the hamburger). */
		mobileBrand?: Snippet;
		/** Optional toolbar rendered at the top of the main content area (sticky). */
		toolbar?: Snippet;
		/** Width of the desktop sidebar column. Default: 220px. */
		sidebarWidth?: string;
		/**
		 * Make the desktop sidebar collapsible via an edge-carat toggle:
		 * - Expanded (default): the full `sidebarWidth` sidebar with each item's
		 *   label to the RIGHT of its icon.
		 * - Collapsed: a bare `railWidth` icon rail. Icons hold the exact position
		 *   they had when expanded (no shuffle), and each label reappears as a
		 *   hover tooltip just past the rail's right edge.
		 * The choice persists across reloads.
		 */
		iconRail?: boolean;
		/** Width of the collapsed (icon-only) rail. Default: 64px. */
		railWidth?: string;
		/**
		 * Skip the automatic PagePanel wrapper. Use for pages that own their
		 * own full-bleed layout (e.g. console, canvas pages).
		 */
		rawContent?: boolean;
		/**
		 * Optionally disable page-level scrolling on the main content area.
		 * - `'x'`  — clip horizontal overflow so nothing scrolls past the right
		 *            edge (e.g. a fixed toolbar rail); vertical page scroll stays.
		 * - `'y'`  — pin to the viewport height; the page won't scroll down.
		 * - `'both'` — full lock; inner regions must own their own scrolling.
		 * Defaults to no lock.
		 */
		lockScroll?: 'x' | 'y' | 'both' | false;
	}

	let {
		children,
		sidebar,
		mobileBrand,
		toolbar,
		sidebarWidth = '220px',
		iconRail = false,
		railWidth = '64px',
		rawContent = false,
		lockScroll = false
	}: AppShellProps = $props();

	let navOpen = $state(false);

	// Persisted collapse state for the icon rail — flipped by the edge-carat
	// toggle. Collapsed hides the labels, leaving a bare icon rail.
	const RAIL_COLLAPSE_KEY = 'appshell:rail-collapsed';
	let railCollapsed = $state(false);
	$effect(() => {
		try {
			railCollapsed = localStorage.getItem(RAIL_COLLAPSE_KEY) === '1';
		} catch {
			// localStorage unavailable (SSR/private mode) — default to expanded.
		}
	});
	function toggleRail() {
		railCollapsed = !railCollapsed;
		try {
			localStorage.setItem(RAIL_COLLAPSE_KEY, railCollapsed ? '1' : '0');
		} catch {
			// non-fatal — state still applies for this session.
		}
	}

	function closeNav() {
		navOpen = false;
	}

	function handleDrawerClick(e: MouseEvent) {
		if ((e.target as HTMLElement).closest('a')) closeNav();
	}

	// Viewport tracker. The aside is conditionally rendered (rather than
	// CSS-hidden) on mobile, so no specificity / scoped-CSS / Tailwind-JIT
	// quirks can leave it stacked above <main>. matchMedia is the cheapest
	// reactive viewport check; we subscribe once on mount.
	let isMobile = $state(false);
	$effect(() => {
		const mql = window.matchMedia('(max-width: 640px)');
		const update = () => (isMobile = mql.matches);
		update();
		mql.addEventListener('change', update);
		return () => mql.removeEventListener('change', update);
	});
</script>

<!-- Mobile top bar — hidden on desktop via CSS -->
<header
	class="hidden max-sm:flex max-sm:items-center max-sm:justify-between max-sm:px-4 max-sm:py-[0.75rem] max-sm:border-b max-sm:border-[var(--border)] max-sm:bg-[var(--bg-elev)] max-sm:sticky max-sm:top-0 max-sm:z-50"
>
	<div class="flex items-center">
		{#if mobileBrand}
			{@render mobileBrand()}
		{/if}
	</div>
	<IconButton
		icon={navOpen ? 'x' : 'menu'}
		label={navOpen ? 'Close navigation' : 'Open navigation'}
		onclick={() => (navOpen = !navOpen)}
	/>
</header>

<!-- Mobile nav drawer -->
<NavDrawer open={navOpen} onclose={closeNav}>
	<!-- Link-click delegation: any anchor in the drawer closes it -->
	<div class="flex flex-col flex-1 h-full" onclick={handleDrawerClick} role="none">
		{@render sidebar(false)}
	</div>
</NavDrawer>

<!-- Layout grid. Scoped CSS owns the column template so a real media query
     wins on mobile — Tailwind's `max-sm:grid-cols-[1fr]` was being shadowed
     and the sidebar's 220px column stayed reserved on phones, squeezing
     <main> into half the viewport. min-width: 0 on <main> is required to
     stop it from expanding past its grid column when a child has wider
     intrinsic content (tables, code blocks, long URLs). -->
<div
	class="app-shell-grid"
	style:--sidebar-w={sidebarWidth}
	style:--rail-w={railWidth}
	class:is-mobile={isMobile}
	data-rail={iconRail || null}
	data-rail-collapsed={iconRail && railCollapsed ? '' : null}
	data-lock-scroll={lockScroll || null}
>
	<!-- First Tab stop on every page: jump straight past the nav to the content.
	     Off-screen until focused, so it's keyboard-only. -->
	<a href="#app-main-content" class="skip-link">Skip to content</a>
	{#if !isMobile}
		<aside class="app-shell-aside">
			<div class="app-shell-aside-inner">
				{@render sidebar(iconRail && railCollapsed)}
			</div>
			{#if iconRail}
				<button
					type="button"
					class="rail-toggle"
					onclick={toggleRail}
					aria-expanded={!railCollapsed}
					aria-label={railCollapsed ? 'Expand sidebar labels' : 'Collapse sidebar to icons'}
					title={railCollapsed ? 'Expand' : 'Collapse'}
				>
					<svg
						class="rail-chevron"
						class:flipped={railCollapsed}
						width="13"
						height="13"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="2.4"
						stroke-linecap="round"
						stroke-linejoin="round"
						aria-hidden="true"
					>
						<polyline points="15 18 9 12 15 6" />
					</svg>
				</button>
			{/if}
		</aside>
	{/if}
	<main class="app-shell-main" id="app-main-content" tabindex="-1">
		{#if toolbar}
			{@render toolbar()}
		{/if}
		{#if rawContent}
			{@render children()}
		{:else}
			<PagePanel>{@render children()}</PagePanel>
		{/if}
	</main>
</div>

<style>
	.app-shell-grid {
		display: grid;
		grid-template-columns: var(--sidebar-w, 220px) 1fr;
		min-height: 100vh;
		background: var(--bg);
		color: var(--fg);
	}

	/* Skip link — off-screen until it takes keyboard focus, then it drops into the
	   top-left corner as a real, clickable control. main[tabindex=-1] lets focus
	   actually land on the content region when it's activated. */
	.skip-link {
		position: fixed;
		top: 0.5rem;
		left: 0.5rem;
		z-index: 200;
		transform: translateY(-160%);
		padding: 0.5rem 0.85rem;
		border-radius: 8px;
		border: 1px solid var(--accent);
		background: var(--bg-elev);
		color: var(--fg);
		font-size: 0.8rem;
		text-decoration: none;
		box-shadow: 0 6px 20px rgba(0, 0, 0, 0.35);
		transition: transform 0.16s ease;
	}
	.skip-link:focus-visible {
		transform: translateY(0);
		outline: 2px solid var(--accent);
		outline-offset: 2px;
	}
	:global(.app-shell-main:focus-visible) {
		outline: none;
	}
	.app-shell-aside {
		display: flex;
		flex-direction: column;
		border-right: 1px solid var(--border);
		background: var(--bg-elev);
		position: sticky;
		top: 0;
		height: 100vh;
		overflow-y: auto;
	}
	/* The inner wrapper carries the sidebar content and fills the aside so
	   SidebarNav's flex layout (footer pinned bottom, nav-scroll in between)
	   keeps working. */
	.app-shell-aside-inner {
		display: flex;
		flex-direction: column;
		flex: 1;
		min-height: 0;
		width: 100%;
	}

	/* ── Icon rail (opt-in via `iconRail`) ────────────────────────────────────
	   Each nav item stacks its icon over a small label, centered — a compact
	   labeled rail instead of a wide sidebar. The grid column is set to the rail
	   width. The edge-carat toggle collapses it to a bare icon rail (labels
	   hidden, narrower column); the grid width transitions so content reflows. */
	.app-shell-grid[data-rail]:not(.is-mobile) {
		transition: grid-template-columns 0.22s cubic-bezier(0.4, 0, 0.2, 1);
	}
	.app-shell-grid[data-rail][data-rail-collapsed]:not(.is-mobile) {
		grid-template-columns: var(--rail-w, 88px) 1fr;
	}
	/* overflow visible so the edge-carat toggle can stick out past the border;
	   SidebarNav owns its own internal vertical scroll (.nav-scroll). */
	.app-shell-grid[data-rail]:not(.is-mobile) .app-shell-aside {
		overflow: visible;
	}

	/* ── Collapsed layout: bare icon rail ────────────────────────────────────
	   Labels are lifted out of flow: section titles hide, and item labels reappear
	   as a hover/focus tooltip floating past the rail edge. With the labels gone,
	   each icon centres in the narrow rail (rather than left-hugging at the old
	   expanded padding) so an icon-only rail reads as deliberate, and hairline
	   dividers stand in for the hidden section titles. */
	.app-shell-grid[data-rail][data-rail-collapsed]:not(.is-mobile)
		.app-shell-aside
		:global(.nav-scroll) {
		/* Don't clip horizontally, so tooltips can escape past the rail border.
		   (The rail is short — icons only — so losing internal scroll is fine.) */
		overflow: visible;
		/* Tighten the airy expanded gap-6 into a rail-appropriate rhythm. */
		gap: 0.85rem;
	}
	/* Centre each icon in the collapsed rail — drop the expanded horizontal
	   padding so the glyph sits in the middle of the narrow column. */
	.app-shell-grid[data-rail][data-rail-collapsed]:not(.is-mobile)
		.app-shell-aside
		:global(.nav-item) {
		justify-content: center;
		padding-left: 0;
		padding-right: 0;
	}
	/* Hairline divider between groups, standing in for the hidden section titles. */
	.app-shell-grid[data-rail][data-rail-collapsed]:not(.is-mobile)
		.app-shell-aside
		:global(.nav-group + .nav-group) {
		border-top: 1px solid var(--border);
		margin-top: 0.5rem;
		padding-top: 0.5rem;
	}
	/* Hide every label in the collapsed rail... */
	.app-shell-grid[data-rail][data-rail-collapsed]:not(.is-mobile)
		.app-shell-aside
		:global(.nav-label) {
		display: none;
	}
	/* ...except item labels, which re-appear as a tooltip past the right edge
	   on hover / keyboard focus. `.nav-item` is already position: relative. */
	.app-shell-grid[data-rail][data-rail-collapsed]:not(.is-mobile)
		.app-shell-aside
		:global(.nav-item .nav-label) {
		display: block;
		position: absolute;
		left: calc(100% + 0.5rem);
		top: 50%;
		transform: translateY(-50%);
		z-index: 60;
		white-space: nowrap;
		padding: 0.3rem 0.55rem;
		border-radius: 6px;
		background: var(--bg-elev);
		border: 1px solid var(--border);
		color: var(--fg);
		box-shadow: 0 4px 14px rgba(0, 0, 0, 0.35);
		font-size: 0.7rem;
		letter-spacing: 0.02em;
		opacity: 0;
		pointer-events: none;
		transition: opacity 0.12s ease;
	}
	.app-shell-grid[data-rail][data-rail-collapsed]:not(.is-mobile)
		.app-shell-aside
		:global(.nav-item:hover .nav-label),
	.app-shell-grid[data-rail][data-rail-collapsed]:not(.is-mobile)
		.app-shell-aside
		:global(.nav-item:focus-visible .nav-label) {
		opacity: 1;
	}
	/* Opt-out marker: elements hidden in the collapsed rail (e.g. the brand
	   wordmark — the logo mark alone is shown instead). */
	.app-shell-grid[data-rail][data-rail-collapsed]:not(.is-mobile)
		.app-shell-aside
		:global(.rail-hidden) {
		display: none;
	}
	/* Footer control clusters wrap and center to fit the narrow collapsed rail. */
	.app-shell-grid[data-rail][data-rail-collapsed]:not(.is-mobile)
		.app-shell-aside
		:global(.sidebar-footer-controls) {
		flex-wrap: wrap;
		justify-content: center;
	}

	/* ── Edge-carat toggle ────────────────────────────────────────────────────
	   A small chevron that sticks out on the rail's right border, vertically
	   centered — collapses the rail to icons and expands it back. */
	.rail-toggle {
		position: absolute;
		top: 50%;
		right: -11px;
		transform: translateY(-50%);
		width: 22px;
		height: 22px;
		display: flex;
		align-items: center;
		justify-content: center;
		border-radius: 999px;
		border: 1px solid var(--border);
		background: var(--bg-elev);
		color: var(--fg-dim);
		cursor: pointer;
		padding: 0;
		z-index: 45;
		box-shadow: 0 1px 5px rgba(0, 0, 0, 0.25);
		transition:
			color 0.15s ease,
			border-color 0.15s ease,
			background 0.15s ease;
	}
	.rail-toggle:hover {
		color: var(--accent);
		border-color: var(--accent);
		background: var(--accent-faint);
	}
	.rail-chevron {
		transition: transform 0.22s cubic-bezier(0.4, 0, 0.2, 1);
	}
	/* Expanded: chevron points left (collapse). Collapsed: flip → points right. */
	.rail-chevron.flipped {
		transform: rotate(180deg);
	}
	.app-shell-main {
		min-width: 0;
		/* `clip` (not `hidden`) contains horizontal overflow without turning the
		   element into a scroll container — `hidden` forces overflow-y to compute
		   to `auto`, which silently captures descendant `position: sticky` and
		   breaks it app-wide (e.g. the assessment review sidebar and icon rail). */
		overflow-x: clip;
		min-height: 100vh;
		background: var(--bg);
	}
	/* When isMobile flips true the aside is removed from the DOM, so the
	   grid only renders one column — no template override needed for the
	   layout shift, only the min-height tweak to account for the 53px
	   sticky mobile top bar. */
	.app-shell-grid.is-mobile {
		grid-template-columns: 1fr;
		min-height: calc(100vh - 53px);
	}

	/* ── Optional scroll lock (opt-in via the `lockScroll` prop) ──────────────
	   Horizontal: clip at the shell root AND on <main> so no content can be
	   revealed by scrolling past the right edge (e.g. a fixed toolbar rail). */
	.app-shell-grid[data-lock-scroll='x'],
	.app-shell-grid[data-lock-scroll='both'] {
		overflow-x: clip;
	}
	/* Vertical / full lock: pin the shell to the viewport so the page itself
	   never scrolls — inner regions are expected to own their own scrolling. */
	.app-shell-grid[data-lock-scroll='y'],
	.app-shell-grid[data-lock-scroll='both'] {
		height: 100dvh;
		min-height: 0;
		overflow-y: hidden;
	}
	.app-shell-grid[data-lock-scroll='y'] .app-shell-main,
	.app-shell-grid[data-lock-scroll='both'] .app-shell-main {
		min-height: 0;
		height: 100%;
		overflow-y: hidden;
	}
</style>
