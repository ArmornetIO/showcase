<script lang="ts">
	// Showcase for the decoupled Flourish primitive. Every effect is demonstrated
	// explicitly — plus the two consumers it was built for: the advanced-settings
	// checkbox choice and the live SidebarNav integration.
	import ShowcaseBlock from '$lib/dev/ShowcaseBlock.svelte';
	import Flourish from '$lib/motion/Flourish.svelte';
	import { FLOURISHES, type FlourishKind } from '$lib/motion/effects.js';
	import Icon from '$lib/icons/Icon.svelte';
	import SidebarNav from '$lib/navigation/SidebarNav.svelte';
	import type { NavSection } from '$lib/navigation/SidebarNav.svelte';
	import { advancedSettings } from '$lib/settings/store.svelte.js';

	// Per-target replay counters — one namespace per demo so nothing collides.
	let triggers = $state<Record<string, number>>({});
	function fire(id: string) {
		triggers[id] = (triggers[id] ?? 0) + 1;
	}
	function replayAll(ids: string[]) {
		for (const id of ids) fire(id);
	}

	// Section 2 — "attach to anything" picks one effect to try across surfaces.
	let anyKind = $state<FlourishKind>('sparkle');

	// Section 3 — a live SidebarNav bound to the real cached setting.
	const NAV: NavSection[] = [
		{
			title: 'Organization',
			items: [
				{ label: 'Exposure', href: '#nav-exposure', icon: 'bar-chart-2' },
				{ label: 'Agent Mesh', href: '#nav-mesh', icon: 'mesh' },
				{ label: 'Relays', href: '#nav-relays', icon: 'shield' }
			]
		},
		{
			title: 'Risk',
			items: [
				{ label: 'Instrument', href: '#nav-instrument', icon: 'radar' },
				{ label: 'Docs', href: '#nav-docs', icon: 'file-text' }
			]
		}
	];
	let navActive = $state('#nav-mesh');
	let navCollapsed = $state(false);

	// Keep the demo on-page: swallow the anchor navigation but let the item's own
	// onclick (which fires the flourish) still run, and track the active href here.
	function onNavClick(e: MouseEvent) {
		const a = (e.target as HTMLElement).closest('a');
		if (!a) return;
		e.preventDefault();
		navActive = a.getAttribute('href') ?? navActive;
	}
</script>

<svelte:head>
	<title>Flourish — UI Lib</title>
</svelte:head>

<div class="px-3 sm:px-6 py-4 sm:py-5">
	<!-- ── 1 · Every effect ─────────────────────────────────────────────── -->
	<ShowcaseBlock component="Flourish">
		<h3 class="component-name">Flourish</h3>
		<p class="component-desc">
			A decoupled click-flourish overlay. Drop it inside any
			<code class="demo-code">position: relative</code> element and bump its
			<code class="demo-code">trigger</code> prop to replay. It knows nothing about the side nav — the
			nav is just one consumer. Point bursts emanate from
			<code class="demo-code">anchorX/Y</code>; sweeps span the whole box.
		</p>

		<div class="demo-row">
			<span class="demo-label">effects</span>
			<div class="fx-gallery">
				{#each FLOURISHES as f (f.value)}
					<button class="fx-tile" onclick={() => fire(f.value)}>
						<Icon name="mesh" size={20} strokeWidth={1.75} />
						<Flourish kind={f.value} trigger={triggers[f.value] ?? 0} anchorX="50%" anchorY="50%" />
						<span class="fx-name">{f.label}</span>
					</button>
				{/each}
			</div>
		</div>
		<div class="demo-row">
			<span class="demo-label"></span>
			<button class="demo-btn" onclick={() => replayAll(FLOURISHES.map((f) => f.value))}>
				Replay all
			</button>
		</div>
	</ShowcaseBlock>

	<!-- ── 2 · Attach to anything ───────────────────────────────────────── -->
	<ShowcaseBlock>
		<h3 class="component-name">Attach to anything</h3>
		<p class="component-desc">
			The same primitive over different surfaces — a button, a collapsed icon tile, a stat card, an
			avatar. Pick an effect, then click a surface.
		</p>

		<div class="demo-row">
			<span class="demo-label">effect</span>
			<div class="seg">
				{#each FLOURISHES as f (f.value)}
					<button class="seg-btn" class:on={anyKind === f.value} onclick={() => (anyKind = f.value)}>
						{f.label}
					</button>
				{/each}
				<button class="seg-btn" class:on={anyKind === 'none'} onclick={() => (anyKind = 'none')}>
					None
				</button>
			</div>
		</div>

		<div class="demo-row">
			<span class="demo-label">surfaces</span>
			<div class="hosts">
				<button class="host btn" onclick={() => fire('h-btn')}>
					<Icon name="shield-check" size={16} strokeWidth={1.75} />
					<span>Save changes</span>
					<Flourish kind={anyKind} trigger={triggers['h-btn'] ?? 0} anchorX="1.4rem" />
				</button>

				<button class="host tile" onclick={() => fire('h-tile')} aria-label="Mesh">
					<Icon name="mesh" size={18} strokeWidth={1.75} />
					<Flourish kind={anyKind} trigger={triggers['h-tile'] ?? 0} anchorX="50%" anchorY="50%" />
				</button>

				<button class="host card" onclick={() => fire('h-card')}>
					<span class="card-k">Coverage</span>
					<span class="card-v">98.2%</span>
					<Flourish kind={anyKind} trigger={triggers['h-card'] ?? 0} anchorX="50%" anchorY="42%" />
				</button>

				<button class="host avatar" onclick={() => fire('h-avatar')} aria-label="Profile">
					TR
					<Flourish kind={anyKind} trigger={triggers['h-avatar'] ?? 0} anchorX="50%" anchorY="50%" />
				</button>
			</div>
		</div>
	</ShowcaseBlock>

	<!-- ── 3 · Live in the side nav ─────────────────────────────────────── -->
	<ShowcaseBlock component="SidebarNav">
		<h3 class="component-name">In the side nav</h3>
		<p class="component-desc">
			The real <code class="demo-code">SidebarNav</code>, wired to the cached
			<code class="demo-code">advancedSettings.navFlourish</code>. In the app this is set from the theme
			menu's advanced-settings cog; here the same setter drives it. Works in both the expanded rail
			and the collapsed icon rail, and the sleek left active-line is kept.
		</p>

		<div class="demo-row">
			<span class="demo-label">effect</span>
			<div class="seg">
				{#each FLOURISHES as f (f.value)}
					<button
						class="seg-btn"
						class:on={advancedSettings.navFlourish === f.value}
						onclick={() => advancedSettings.setNavFlourish(f.value)}
					>
						{f.label}
					</button>
				{/each}
				<button
					class="seg-btn"
					class:on={advancedSettings.navFlourish === 'none'}
					onclick={() => advancedSettings.setNavFlourish('none')}
				>
					None
				</button>
			</div>
		</div>

		<div class="demo-row">
			<span class="demo-label">rail</span>
			<div class="seg">
				<button class="seg-btn" class:on={!navCollapsed} onclick={() => (navCollapsed = false)}>
					Expanded
				</button>
				<button class="seg-btn" class:on={navCollapsed} onclick={() => (navCollapsed = true)}>
					Collapsed
				</button>
			</div>
		</div>

		<div class="demo-row">
			<span class="demo-label">nav</span>
			<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
			<div class="nav-frame" class:collapsed={navCollapsed} onclickcapture={onNavClick}>
				<SidebarNav
					sections={NAV}
					isActive={(href) => href === navActive}
					collapsed={navCollapsed}
				/>
			</div>
		</div>
	</ShowcaseBlock>
</div>

<style>
	.demo-row {
		display: flex;
		align-items: flex-start;
		gap: 1.25rem;
		min-height: 2rem;
		margin-bottom: 0.4rem;
	}
	.demo-label {
		flex-shrink: 0;
		width: 4.5rem;
		padding-top: 0.4rem;
		font-family: var(--mono);
		font-size: 0.68rem;
		color: var(--fg-dim);
	}
	.demo-code {
		font-family: var(--mono);
		font-size: 0.85em;
		color: var(--accent);
	}
	.demo-btn {
		padding: 0.4rem 0.8rem;
		border-radius: 7px;
		border: 1px solid var(--border);
		background: var(--surface-raised);
		color: var(--fg);
		font-size: 0.8rem;
		cursor: pointer;
	}
	.demo-btn:hover {
		border-color: var(--accent);
		color: var(--accent);
	}

	/* Effect gallery — one tile per effect, each fires its own */
	.fx-gallery {
		display: flex;
		flex-wrap: wrap;
		gap: 0.75rem;
	}
	.fx-tile {
		position: relative;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 0.5rem;
		width: 96px;
		height: 84px;
		border-radius: 12px;
		border: 1px solid var(--border);
		background: var(--surface-raised);
		color: var(--accent);
		cursor: pointer;
		transition: border-color 0.15s;
	}
	.fx-tile:hover {
		border-color: var(--accent);
	}
	.fx-name {
		font-family: var(--mono);
		font-size: 0.62rem;
		letter-spacing: 0.04em;
		color: var(--fg-muted);
	}

	/* Segmented control */
	.seg {
		display: inline-flex;
		flex-wrap: wrap;
		gap: 0.3rem;
	}
	.seg-btn {
		padding: 0.32rem 0.7rem;
		border-radius: 999px;
		border: 1px solid var(--border);
		background: transparent;
		color: var(--fg-muted);
		font-size: 0.76rem;
		cursor: pointer;
		transition:
			color 0.15s,
			border-color 0.15s,
			background 0.15s;
	}
	.seg-btn:hover {
		color: var(--fg);
	}
	.seg-btn.on {
		color: var(--accent);
		border-color: var(--accent);
		background: var(--accent-faint);
	}

	/* Hosts */
	.hosts {
		display: flex;
		align-items: center;
		flex-wrap: wrap;
		gap: 1.25rem;
	}
	.host {
		position: relative;
		border: 1px solid var(--border);
		background: var(--surface-raised);
		color: var(--fg);
		cursor: pointer;
	}
	.btn {
		display: inline-flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.7rem 1.1rem;
		border-radius: 8px;
		font-size: 0.85rem;
		color: var(--accent);
	}
	.tile {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 48px;
		height: 48px;
		border-radius: 12px;
		color: var(--accent);
	}
	.card {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: 0.2rem;
		padding: 1rem 1.2rem;
		border-radius: 12px;
	}
	.card-k {
		font-size: 0.7rem;
		text-transform: uppercase;
		letter-spacing: 0.1em;
		color: var(--fg-muted);
	}
	.card-v {
		font-size: 1.5rem;
		font-weight: 600;
	}
	.avatar {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 44px;
		height: 44px;
		border-radius: 50%;
		font-family: var(--mono);
		font-size: 0.8rem;
	}

	/* Live nav frame */
	.nav-frame {
		width: 230px;
		border: 1px solid var(--border);
		border-radius: 12px;
		background: var(--bg);
		overflow: hidden;
	}
	.nav-frame.collapsed {
		width: 68px;
	}
	.nav-frame.collapsed :global(.nav-label) {
		display: none;
	}
	.nav-frame.collapsed :global(.nav-item) {
		justify-content: center;
		padding-left: 0;
		padding-right: 0;
	}
	.nav-frame.collapsed :global(.nav-group + .nav-group) {
		border-top: 1px solid var(--border);
		margin-top: 0.5rem;
		padding-top: 0.5rem;
	}
</style>
