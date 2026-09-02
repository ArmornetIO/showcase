<script lang="ts">
	import { onMount, type Snippet } from 'svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { base } from '$app/paths';
	import { theme } from '$lib/theme/store.svelte.js';
	import { advancedSettings } from '$lib/settings/store.svelte.js';
	import DevCog from '$lib/devcog/DevCog.svelte';
	import FrameDevControls from '$lib/frames/FrameDevControls.svelte';
	import PanelShapeControls from '$lib/primitives/chrome/PanelShapeControls.svelte';
	import GlobeDevControls from '$lib/mesh-studio/globe/GlobeDevControls.svelte';
	import { createFlagStore, type FlagSnapshot } from '$lib/devcog/flags/engine.js';
	import ShowcaseToolbar from '$lib/dev/ShowcaseToolbar.svelte';
	import { projectSections } from '$lib/dev/projects.js';
	import ShowcaseSidebar from '$lib/dev/ShowcaseSidebar.svelte';
	import AppShell from '$lib/layout/AppShell.svelte';
	import SidebarNav from '$lib/navigation/SidebarNav.svelte';
	import type { NavSection } from '$lib/navigation/SidebarNav.svelte';
	import CommandPalette from '$lib/primitives/actions/CommandPalette.svelte';
	import type { CmdGroup, CmdItem } from '$lib/primitives/actions/CommandPalette.svelte';
	import Icon from '$lib/icons/Icon.svelte';
	import ThemePicker from '$lib/theme/ThemePicker.svelte';
	import '$lib/tokens.css';

	let { children }: { children: Snippet } = $props();

	onMount(() => {
		// Preferences are read here, not at module scope: the stores stay free to
		// import anywhere, and the only code that touches storage runs in a
		// mounted component. `theme.start()` hands back its own teardown.
		const stopTheme = theme.start();
		advancedSettings.hydrate();
		refreshSnap();
		return stopTheme;
	});

	// Painting the theme is the app's job — the store owns the preference, not the
	// document. A host embedding the library can apply it however it likes.
	$effect(() => {
		document.documentElement.setAttribute('data-theme', theme.resolved);
	});

	$effect(() => {
		document.documentElement.setAttribute('data-radius', advancedSettings.radius);
	});

	const isBuilder = $derived(page.url.pathname.endsWith('/builder'));
	// A game board is a HUD: every readout is pinned to an edge of the window, and
	// the action bar lives on the bottom one. Give it the shell's chrome to share
	// and the first thing off the screen is the button you press to take a turn.
	// `endsWith` and not `includes`, so `/examples/breach/rules` — a document,
	// not a HUD — keeps the shell it is meant to be read in.
	const isBreach = $derived(page.url.pathname.endsWith('/examples/breach'));
	// A local mockup that wants the whole window adds itself here. Mockups are
	// gitignored, so such a line is a local edit you keep out of your commits.
	const isFullScreen = $derived(
		isBuilder ||
			isBreach ||
			// `AuthSplit` is `position: fixed; inset: 0` — it covers the shell
			// whatever we do, so rendering one underneath only leaves a sidebar
			// nobody can see still sitting in the tab order.
			page.url.pathname.endsWith('/auth-split') ||
			// The board's chrome is pinned to the window's edges. Give it the
			// shell's and every reading moves inward by a sidebar.
			page.url.pathname.endsWith('/mockups/breach-hud') ||
			// A cinematic. It is a shot, not a screen — a sidebar beside it is a
			// sidebar in the frame.
			page.url.pathname.endsWith('/mockups/logo-nanotech')
	);

	// Flags are shared with the marketing SPA via same-origin localStorage.
	// This dogfoods the portable engine from `$lib/devcog` — the same one a
	// bootstrapped app would consume via `showcase/devcog`.
	const SERVE_MODE_KEY = 'armornet-serve-mode';

	const FLAG_LABELS: Record<string, string> = {
		product: 'Product, services & pricing',
		marketing: 'Marketing pages',
		docs: 'Documentation',
		auth: 'Login & signup',
		demo: 'Demo pages',
		console: 'Console',
		vendors: 'Vendors',
		runner: 'Agent Runner',
		structured_assessment: 'Structured Assessment'
	};

	const flags = createFlagStore({
		overridesKey: 'armornet-feature-flags',
		serveModeKey: SERVE_MODE_KEY,
		runtimeGlobal: '__ARMORNET__',
		defaultServeMode: 'marketing',
		keys: Object.keys(FLAG_LABELS)
	});

	const devMode = 'showcase';
	let devSnap = $state<FlagSnapshot[]>([]);

	function refreshSnap() {
		devSnap = flags.snapshot();
	}

	function handleToggle(key: string, enabled: boolean) {
		flags.setOverride(key, enabled);
		refreshSnap();
	}

	function handleModeChange(m: string) {
		// From the showcase app, switching mode hops back to the marketing SPA.
		if (m === 'showcase') return;
		if (typeof localStorage !== 'undefined') localStorage.setItem(SERVE_MODE_KEY, m);
		window.location.href = '/';
	}

	function isActive(path: string): boolean {
		const full = `${base}${path}`;
		return page.url.pathname === full || page.url.pathname.startsWith(full + '/');
	}

	// ── Mockup shift+click compare ────────────────────────────────────────────────
	let compareFirst = $state<string | null>(null);

	// Clear selection when navigating away from the mockups section
	$effect(() => {
		if (!page.url.pathname.includes('/mockups')) compareFirst = null;
	});

	// Add/remove the visual selection ring on the matching sidebar link
	$effect(() => {
		document.querySelectorAll('.compare-selected-nav').forEach((el) =>
			el.classList.remove('compare-selected-nav')
		);
		if (compareFirst) {
			document
				.querySelector(`a[href*="/mockups/${compareFirst}"]`)
				?.classList.add('compare-selected-nav');
		}
	});

	function slugFromHref(href: string): string {
		return href.split('/mockups/')[1]?.split('?')[0] ?? '';
	}

	function handleSidebarClick(e: MouseEvent) {
		if (!e.shiftKey) return;
		const anchor = (e.target as HTMLElement).closest('a');
		if (!anchor) return;
		const href = anchor.getAttribute('href') ?? '';
		if (!href.includes('/mockups/')) return;
		e.preventDefault();
		const slug = slugFromHref(href);
		if (!slug) return;
		if (compareFirst === null) {
			compareFirst = slug;
		} else if (compareFirst === slug) {
			compareFirst = null;
		} else {
			goto(`${base}/compare?a=${compareFirst}&b=${slug}`);
			compareFirst = null;
		}
	}

	const NAV_SECTIONS: NavSection[] = [
		{
			title: 'Foundations',
			items: [
				{ label: 'Design Patterns', href: `${base}/design-patterns`, icon: 'shapes' },
				{ label: 'Component index', href: `${base}/overview`, icon: 'layout-grid' }
			]
		},
		// The two builders used to be an `Apps` section here. They live in the
		// footer next to the theme picker now: they are tools you switch INTO
		// rather than pages you browse, which is the same thing the theme control
		// is, and a section listing two links was the widest part of the nav.
		{
			// Examples are full applications built ON the library rather than
			// exhibits of it — they live outside `src/lib` and consume the package
			// by name, so they are the first thing to break if the barrel is wrong.
			title: 'Examples',
			items: [
				{ label: 'BREACH', href: `${base}/examples/breach`, icon: 'flag' },
				{ label: 'BREACH rules', href: `${base}/examples/breach/rules`, icon: 'file-text' }
			]
		},
		{
			title: 'Atoms',
			items: [
				{ label: 'Primitives', href: `${base}/primitives`, icon: 'layout-grid' },
				{ label: 'Layout', href: `${base}/layout`, icon: 'layout-dashboard' },
				{ label: 'Navigation', href: `${base}/navigation`, icon: 'menu' }
			]
		},
		{
			title: 'Data & Display',
			items: [
				{ label: 'Display', href: `${base}/display`, icon: 'monitor' },
				{ label: 'Entity detail', href: `${base}/entity`, icon: 'user' },
				{ label: 'Progress', href: `${base}/progress`, icon: 'bar-chart-2' },
				{ label: 'ItemFrames', href: `${base}/frames`, icon: 'layout-grid' }
			]
		},
		{
			title: 'Engines',
			items: []
		},
		{
			title: 'Patterns',
			items: [
				{ label: 'NodeDrawer', href: `${base}/node-drawer`, icon: 'panel-right' },
				{ label: 'Modal', href: `${base}/modal`, icon: 'maximize' },
				{ label: 'AlertBlade', href: `${base}/alert-blade`, icon: 'bell' },
				{ label: 'Cards', href: `${base}/cards`, icon: 'credit-card' },
				{ label: 'Flourish', href: `${base}/flourish`, icon: 'zap' },
				{ label: 'Storyboard', href: `${base}/storyboard`, icon: 'layout-template' }
			]
		},
		{
			title: 'Utilities',
			items: [
				{ label: 'Docs', href: `${base}/docs`, icon: 'file-text' },
				{ label: 'Icons', href: `${base}/icons`, icon: 'star' },
				{ label: 'Theme', href: `${base}/theme`, icon: 'sun' },
				{ label: 'Dev', href: `${base}/dev`, icon: 'code' }
			]
		},
		{
			title: 'Architecture',
			items: [
				{ label: 'Charts', href: `${base}/charts`, icon: 'bar-chart-2' },
				{ label: 'Canvas', href: `${base}/canvas`, icon: 'layers' },
				{ label: 'Model Explorer', href: `${base}/model-explorer`, icon: 'table-2' }
			]
		}
	];

	// Projects first: the sketches in flight are what you open the showcase for
	// day to day, and the library sections below them are the reference you drop
	// into. `projectSections` reads what is actually on disk, because mockups are
	// gitignored and a hardcoded list would be dead links on a fresh clone.
	const navSections = $derived([...projectSections(base), ...NAV_SECTIONS]);

	// ── search ───────────────────────────────────────────────────────────────
	let paletteOpen = $state(false);

	// Built from the nav rather than a second hand-written list, so a section
	// added above is searchable without anyone remembering to register it twice.
	const commands = $derived<CmdGroup[]>(
		navSections
			.map((section) => ({
				group: section.title ?? 'Navigate',
				items: section.items.flatMap(function flatten(item): CmdItem[] {
					// A project row is a container with no page of its own; only its
					// leaves are destinations.
					const dest = item.href;
					const self: CmdItem[] = dest
						? [{ label: item.label, icon: item.icon, action: () => goto(dest) }]
						: [];
					return [...self, ...(item.children ?? []).flatMap(flatten)];
				})
			}))
			.filter((g) => g.items.length > 0)
	);

	// ⌘K / Ctrl-K from anywhere. Bound on the window rather than the sidebar so
	// it still opens from inside a full-screen mockup, which has no sidebar.
	function onKeydown(e: KeyboardEvent) {
		if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
			e.preventDefault();
			paletteOpen = true;
		}
	}
</script>

<svelte:window onkeydown={onKeydown} />

{#snippet sidebarContent()}
	<div style="display:contents" role="presentation" onclick={handleSidebarClick}>
		<SidebarNav
			sections={navSections}
			isActive={(path) => isActive(path.replace(base, ''))}
		>
			{#snippet brand()}
				<a class="flex items-center gap-[0.55rem] no-underline" href="{base}/">
					<span class="text-base text-[var(--accent,#5eead4)] leading-none">▣</span>
					<span class="[font-family:var(--sans,'Inter',sans-serif)] text-xs font-bold tracking-[0.2em] text-[var(--fg-muted)]">UI LIB</span>
				</a>
			{/snippet}
			{#snippet cluster()}
				<!-- Pinned above the scrolling nav, the way the app's own sidebar pins
				     Search: the one control you reach for from any page should not be
				     somewhere you have to scroll back up to find. -->
				<div class="flex flex-col gap-0.5">
					<button
						type="button"
						onclick={() => (paletteOpen = true)}
						class="nav-item w-full flex items-center gap-[0.6rem] px-3 py-2 rounded-md text-[var(--fg-muted)] hover:text-[var(--fg)] hover:bg-[var(--surface-raised)] transition-colors"
					>
						<span class="flex items-center justify-center shrink-0"><Icon name="search" size={16} /></span>
						<span class="nav-label font-mono text-xs tracking-[0.02em]">Search</span>
						<kbd class="nav-label ml-auto font-mono text-[0.56rem] text-[var(--fg-dim)]">⌘K</kbd>
					</button>
					<div class="mt-1 h-px bg-[var(--border)]" aria-hidden="true"></div>
				</div>
			{/snippet}
			{#snippet footer()}
				{#if compareFirst}
					<div class="compare-status">
						<span class="compare-status__dot"></span>
						<span class="compare-status__slug">{compareFirst}</span>
						<span class="compare-status__hint">· shift+click another</span>
						<button class="compare-status__cancel" onclick={() => compareFirst = null} aria-label="Cancel compare">✕</button>
					</div>
				{/if}
				<div class="flex flex-col gap-1 p-3 border-t border-[var(--border)]">
					<div class="flex items-center justify-between pt-1">
						<ThemePicker />
						<div class="flex items-center gap-1">
							<a
								href="{base}/builder"
								class="flex items-center justify-center w-7 h-7 rounded text-[var(--fg-dim)] hover:text-[var(--accent)] hover:bg-[var(--surface-raised)] transition-[color,background] duration-150"
								title="Layout Builder"
							>
								<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
									<rect x="2" y="2" width="20" height="20" rx="2.5"/>
									<rect x="5" y="5.5" width="14" height="4.5" rx="1"/>
									<rect x="5" y="12" width="5.5" height="6.5" rx="1"/>
									<rect x="13.5" y="12" width="5.5" height="6.5" rx="1"/>
								</svg>
							</a>
							<!-- Drawn to match its neighbour rather than pulled from the
							     icon set: the two sit side by side, and a lucide glyph
							     next to a bespoke one reads as one of them being wrong.
							     Same frame, a play mark instead of panes. -->
							<a
								href="{base}/scene"
								class="flex items-center justify-center w-7 h-7 rounded text-[var(--fg-dim)] hover:text-[var(--accent)] hover:bg-[var(--surface-raised)] transition-[color,background] duration-150"
								title="Scene Builder"
							>
								<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
									<rect x="2" y="2" width="20" height="20" rx="2.5"/>
									<path d="M10 8.5 15.5 12 10 15.5Z"/>
								</svg>
							</a>
						</div>
					</div>
				</div>
			{/snippet}
		</SidebarNav>
	</div>
{/snippet}

{#snippet mobileBrand()}
	<a class="flex items-center gap-[0.55rem] no-underline px-[0.4rem]" href="{base}/">
		<span class="text-base text-[var(--accent,#5eead4)] leading-none">▣</span>
		<span class="[font-family:var(--sans,'Inter',sans-serif)] text-xs font-bold tracking-[0.2em] text-[var(--fg-muted)]">UI LIB</span>
	</a>
{/snippet}

{#snippet showcaseToolbar()}
	<ShowcaseToolbar />
{/snippet}

{#if isFullScreen}
	<main class="min-h-screen bg-[var(--bg)]">
		{@render children()}
	</main>
{:else}
	<!-- eslint-disable-next-line @typescript-eslint/no-explicit-any -->
	<!--
		The backdrop setting is offered in showcase's own settings menu, so showcase's
		own shell has to honour it — otherwise the control is a preference that only
		takes effect in the other app, which is how a backdrop bug ships unseen.
	-->
	<!-- eslint-disable-next-line @typescript-eslint/no-explicit-any -->
	<AppShell
		sidebar={sidebarContent as any}
		mobileBrand={mobileBrand as any}
		toolbar={showcaseToolbar as any}
		backdrop={advancedSettings.backdrop}
		backdropStrength={advancedSettings.backdropStrength}
	>
		{@render children()}
	</AppShell>
	<ShowcaseSidebar />
{/if}

<!-- Outside the `isFullScreen` fork on purpose: ⌘K is bound to the window, so a
     full-screen mockup is exactly where you most need a way out. -->
<CommandPalette
	bind:open={paletteOpen}
	{commands}
	placeholder="Search projects, mockups and components…"
	onselect={() => (paletteOpen = false)}
/>

<!-- DevCog is position:fixed bottom-right. A mockup whose own chrome lives in that
     corner — a full-width timeline, say — wants to suppress it while it is open. -->
<DevCog
	snap={devSnap}
	mode={devMode}
	modes={['marketing', 'app', 'showcase']}
	flagLabel={(k) => FLAG_LABELS[k]}
	onToggle={handleToggle}
	onModeChange={handleModeChange}
>
	{#snippet qaContent(nits)}
		<PanelShapeControls {nits} />
		<FrameDevControls />
		<GlobeDevControls />
	{/snippet}
</DevCog>

<style>
	/* ── Global: selected mockup link ring ── */
	:global(.compare-selected-nav) {
		outline: 1.5px solid var(--accent) !important;
		outline-offset: 1px;
		background: rgba(94, 234, 212, 0.1) !important;
		color: var(--accent) !important;
		animation: compare-pulse 1.8s ease-in-out infinite;
		border-radius: 6px;
	}
	:global(.compare-selected-nav *) {
		color: var(--accent) !important;
	}
	@keyframes compare-pulse {
		0%, 100% { outline-color: rgba(94, 234, 212, 0.35); box-shadow: none; }
		50%       { outline-color: rgba(94, 234, 212, 0.9);  box-shadow: 0 0 8px rgba(94,234,212,0.25); }
	}

	.compare-status {
		display: flex;
		align-items: center;
		gap: 0.4rem;
		padding: 0.4rem 0.75rem;
		border-top: 1px solid var(--border);
		background: rgba(94, 234, 212, 0.06);
		font-family: var(--mono);
		font-size: 0.62rem;
	}
	.compare-status__dot {
		width: 6px;
		height: 6px;
		border-radius: 50%;
		background: var(--accent);
		box-shadow: 0 0 6px var(--accent);
		flex-shrink: 0;
	}
	.compare-status__slug {
		color: var(--accent);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		flex: 1;
		min-width: 0;
	}
	.compare-status__hint {
		color: var(--fg-muted);
		white-space: nowrap;
		flex-shrink: 0;
	}
	.compare-status__cancel {
		background: none;
		border: none;
		color: var(--fg-muted);
		cursor: pointer;
		font-size: 0.65rem;
		padding: 0 0.1rem;
		flex-shrink: 0;
		line-height: 1;
	}
	.compare-status__cancel:hover {
		color: var(--fg);
	}
</style>

