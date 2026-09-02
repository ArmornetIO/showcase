<script lang="ts">
	import { onMount } from 'svelte';
	import { theme } from './store.svelte.js';
	import { THEMES, type ThemeChoice, type ThemeKey } from './themes.js';
	import AdvancedSettingsPanel from '../settings/AdvancedSettingsPanel.svelte';

	// Move a node to <body> so its `position: fixed` is viewport-relative, not
	// trapped by an ancestor that establishes a containing block for fixed elements
	// (a transform/filter/backdrop-filter anywhere up the sidebar tree does this).
	// Without it the menu is clipped inside the sidebar's overflow and reads as
	// hidden behind the page content.
	function portal(node: HTMLElement) {
		document.body.appendChild(node);
		return {
			destroy() {
				node.remove();
			}
		};
	}

	interface ThemePickerProps {
		variant?: 'icon' | 'hud';
	}

	let { variant = 'icon' }: ThemePickerProps = $props();

	let open = $state(false);
	let containerEl: HTMLDivElement | undefined = $state();
	let btnEl: HTMLButtonElement | undefined = $state();
	let menuPos = $state({ top: 0, left: 0, openUp: false });

	// One shared popover; `mode` swaps its content between the theme picker (swatch
	// icon) and advanced config (cog icon), both anchored to the icon pair.
	let mode = $state<'theme' | 'advanced'>('theme');
	let cogEl: HTMLButtonElement | undefined = $state();
	let menuEl: HTMLDivElement | undefined = $state();

	// Open the shared popover in the requested mode (or close it if the same icon
	// is clicked again). Both icons anchor the popover to the icon-pair container.
	function showMenu(next: 'theme' | 'advanced') {
		if (open && mode === next) {
			open = false;
			return;
		}
		mode = next;
		const anchor = containerEl ?? btnEl;
		if (variant === 'icon' && anchor) {
			const r = anchor.getBoundingClientRect();
			const menuH = 320;
			const openUp = r.bottom + menuH > window.innerHeight;
			menuPos = { top: openUp ? r.top - 6 : r.bottom + 6, left: r.left, openUp };
		}
		open = true;
	}
	function openAdvanced() {
		showMenu('advanced');
	}

	// `theme.available`, not `THEMES`: a host can turn the light palettes off, and
	// a picker that still lists them offers a choice the store will not honour.
	// Derived rather than built once — the host declares the capability during
	// layout setup, which can land after this component is first constructed.
	const rows = $derived<Array<{ key: ThemeChoice; label: string; description: string }>>([
		{
			key: 'system',
			label: 'System',
			// It cannot follow an OS set to light if light is off, and a row that
			// promises something the store will not do is worse than no row.
			description: theme.allowLight ? 'Follows your OS setting.' : 'Dark while light is off.'
		},
		...theme.available.map((t) => ({ key: t.key, label: t.label, description: t.description }))
	]);

	// HUD variant: gradient diagonal swatches + sublabels per theme
	const hudMeta: Record<ThemeChoice, { label: string; sublabel: string; swatch: string }> = {
		system: {
			label: 'System',
			sublabel: 'Follow OS',
			swatch: 'linear-gradient(135deg, #0a0a0a 0%, #0a0a0a 49%, #FFFFFF 51%, #FFFFFF 100%)'
		},
		dark: {
			label: 'Dark',
			sublabel: 'Default · Mission HUD',
			swatch: 'linear-gradient(135deg, #0a0a0a 0%, #0a0a0a 50%, #5FEAD5 50%, #5FEAD5 100%)'
		},
		light: {
			label: 'Light',
			sublabel: 'Daylight · Brief',
			swatch: 'linear-gradient(135deg, #FFFFFF 0%, #FFFFFF 50%, #0E9F86 50%, #0E9F86 100%)'
		},
		paper: {
			label: 'Paper',
			sublabel: 'Warm · Long read',
			swatch: 'linear-gradient(135deg, #ECE5D6 0%, #ECE5D6 50%, #085C4D 50%, #085C4D 100%)'
		},
		daylight: {
			label: 'Daylight',
			sublabel: 'Cool · High legibility',
			swatch: 'linear-gradient(135deg, #E4E9EF 0%, #E4E9EF 50%, #0A6480 50%, #0A6480 100%)'
		},
		oled: {
			label: 'OLED',
			sublabel: 'True black · Field',
			swatch: 'linear-gradient(135deg, #000000 0%, #000000 50%, #7FFCE3 50%, #7FFCE3 100%)'
		},
		'high-contrast': {
			label: 'High contrast',
			sublabel: 'Accessibility',
			swatch: 'linear-gradient(135deg, #000000 0%, #000000 50%, #FFFFFF 50%, #FFFFFF 100%)'
		}
	};

	// Derived from the key rather than enumerated: a per-theme ternary chain has
	// to be extended for every palette added, and silently mislabels the one it
	// forgets (it fell through to 'AUTO · CONTRAST' for anything unlisted).
	const shortLabel = (key: ThemeKey) => (key === 'high-contrast' ? 'CONTRAST' : key.toUpperCase());

	const triggerLabel = $derived<string>(
		theme.choice === 'system'
			? `AUTO · ${shortLabel(theme.resolved)}`
			: shortLabel(theme.choice)
	);

	function toggle() {
		if (variant === 'icon') {
			showMenu('theme');
			return;
		}
		// HUD variant: no fixed positioning, just toggle the themes popover.
		mode = 'theme';
		open = !open;
	}

	function pick(key: ThemeChoice) {
		theme.set(key);
		open = false;
	}

	function onKeydown(e: KeyboardEvent) {
		if (e.key !== 'Escape' || !open) return;
		open = false;
		e.stopPropagation();
	}

	function onDocPointerDown(e: PointerEvent) {
		const target = e.target as Node;
		// Use pointerdown, not click: toggling a menu item (e.g. a flourish checkbox)
		// re-renders and detaches the clicked node, so a later `click` handler would
		// see contains(target)=false and wrongly close the popover. pointerdown fires
		// before that re-render, while the node is still inside the menu.
		//
		// The popover renders OUTSIDE containerEl (via portal), so check menuEl too;
		// the cog lives inside containerEl and is covered by that check.
		const inside = containerEl?.contains(target) || menuEl?.contains(target);
		if (inside) return;
		if (open) open = false;
	}

	onMount(() => {
		document.addEventListener('pointerdown', onDocPointerDown);
		document.addEventListener('keydown', onKeydown);
		return () => {
			document.removeEventListener('pointerdown', onDocPointerDown);
			document.removeEventListener('keydown', onKeydown);
		};
	});

	const activeKey = $derived<ThemeChoice>(theme.choice);
</script>

{#if variant === 'hud'}
	<!-- HUD variant: text trigger + absolute-anchored dropdown -->
	<div class="tp-hud-wrap" bind:this={containerEl}>
		<button
			type="button"
			class="tp-hud-btn"
			onclick={toggle}
			aria-haspopup="menu"
			aria-expanded={open}
			aria-label="Choose theme"
		>
			<!-- Sun/moon icon -->
			<svg
				class="tp-hud-icon"
				viewBox="0 0 16 16"
				fill="none"
				stroke="currentColor"
				stroke-width="1.6"
				aria-hidden="true"
			>
				<circle cx="8" cy="8" r="3.2"></circle>
				<path
					d="M8 1.5v1.6M8 12.9v1.6M1.5 8h1.6M12.9 8h1.6M3.4 3.4l1.1 1.1M11.5 11.5l1.1 1.1M3.4 12.6l1.1-1.1M11.5 4.5l1.1-1.1"
				></path>
			</svg>
			<span>{triggerLabel}</span>
			<!-- Chevron -->
			<svg
				width="9"
				height="9"
				viewBox="0 0 10 10"
				fill="none"
				stroke="currentColor"
				stroke-width="1.6"
				aria-hidden="true"
			>
				<path d="M2 4l3 3 3-3" />
			</svg>
		</button>

		{#if open}
			<div class="tp-hud-menu" role="menu" aria-label="Theme options">
				<div class="tp-hud-header">/ DISPLAY MODE</div>

				<button
					class="tp-hud-option"
					class:active={activeKey === 'system'}
					onclick={() => pick('system')}
					role="menuitemradio"
					aria-checked={activeKey === 'system'}
				>
					<span class="tp-hud-swatch" style="background: {hudMeta.system.swatch}"></span>
					<span class="tp-hud-label-wrap">
						{hudMeta.system.label}
						<span class="tp-hud-sublabel"
							>{hudMeta.system.sublabel} · {theme.resolved}</span
						>
					</span>
					<span class="tp-hud-check">✓</span>
				</button>

				<div class="tp-hud-divider"></div>

				{#each theme.available as t (t.key)}
					<button
						class="tp-hud-option"
						class:active={activeKey === t.key}
						onclick={() => pick(t.key)}
						role="menuitemradio"
						aria-checked={activeKey === t.key}
					>
						<span class="tp-hud-swatch" style="background: {hudMeta[t.key]?.swatch ?? ''}"></span>
						<span class="tp-hud-label-wrap">
							{hudMeta[t.key]?.label ?? t.label}
							<span class="tp-hud-sublabel">{hudMeta[t.key]?.sublabel ?? t.description}</span>
						</span>
						<span class="tp-hud-check">✓</span>
					</button>
				{/each}
			</div>
		{/if}
	</div>
{:else}
	<!-- Icon variant: palette icon + fixed-position dropdown -->
	<div class="theme-picker" bind:this={containerEl}>
		<button
			type="button"
			class="theme-toggle"
			bind:this={btnEl}
			onclick={toggle}
			aria-haspopup="menu"
			aria-expanded={open && mode === 'theme'}
			aria-label="Choose theme"
			title="Choose theme"
		>
			<!-- Palette icon (inline SVG; no Lucide dep) -->
			<svg
				width="14"
				height="14"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				stroke-width="1.75"
				stroke-linecap="round"
				stroke-linejoin="round"
				aria-hidden="true"
			>
				<circle cx="13.5" cy="6.5" r=".5" fill="currentColor" />
				<circle cx="17.5" cy="10.5" r=".5" fill="currentColor" />
				<circle cx="8.5" cy="7.5" r=".5" fill="currentColor" />
				<circle cx="6.5" cy="12.5" r=".5" fill="currentColor" />
				<path
					d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z"
				/>
			</svg>
		</button>
		<!-- Advanced config — same popover, cog swaps its content. -->
		<button
			type="button"
			class="theme-toggle"
			bind:this={cogEl}
			onclick={openAdvanced}
			aria-haspopup="menu"
			aria-expanded={open && mode === 'advanced'}
			aria-label="Advanced settings"
			title="Advanced settings"
		>
			<svg
				width="14"
				height="14"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				stroke-width="1.75"
				stroke-linecap="round"
				stroke-linejoin="round"
				aria-hidden="true"
			>
				<circle cx="12" cy="12" r="3" />
				<path
					d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"
				/>
			</svg>
		</button>
	</div>

	{#if open}
		<div
			class="theme-menu"
			role="menu"
			tabindex="-1"
			aria-label="Theme options"
			bind:this={menuEl}
			use:portal
			onpointerdown={(e) => e.stopPropagation()}
			class:theme-menu--panel={mode === 'advanced'}
			style="top:{menuPos.openUp ? 'auto' : menuPos.top + 'px'}; bottom:{menuPos.openUp
				? window.innerHeight - menuPos.top + 'px'
				: 'auto'}; left:{menuPos.left}px"
		>
			{#if mode === 'advanced'}
				<!-- The panel brings its own head, rail and footer; the popover only
				     provides the frame and the anchoring. -->
				<AdvancedSettingsPanel framed={false} />
			{:else}
				<div class="theme-menu-head">
					<span class="theme-menu-title">Appearance</span>
				</div>
				{#each rows as row (row.key)}
				{@const theme = row.key === 'system' ? null : THEMES.find((t) => t.key === row.key)}
				<button
					type="button"
					class="theme-row"
					role="menuitemradio"
					aria-checked={activeKey === row.key}
					onclick={() => pick(row.key)}
				>
					<span class="theme-swatch" aria-hidden="true">
						{#if theme}
							{#each theme.swatch as c}
								<span class="dot" style="background:{c}"></span>
							{/each}
						{:else}
							<span class="theme-system-icon">
								<svg
									width="14"
									height="14"
									viewBox="0 0 24 24"
									fill="none"
									stroke="currentColor"
									stroke-width="1.75"
									stroke-linecap="round"
									stroke-linejoin="round"
									aria-hidden="true"
								>
									<rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
									<line x1="8" y1="21" x2="16" y2="21" />
									<line x1="12" y1="17" x2="12" y2="21" />
								</svg>
							</span>
						{/if}
					</span>

					<span class="theme-meta">
						<span class="theme-name">{row.label}</span>
						<span class="theme-desc">{row.description}</span>
					</span>

					<span class="theme-check" aria-hidden="true">
						{#if activeKey === row.key}
							<svg
								width="14"
								height="14"
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								stroke-width="2.5"
								stroke-linecap="round"
								stroke-linejoin="round"
								aria-hidden="true"
							>
								<polyline points="20 6 9 17 4 12" />
							</svg>
						{/if}
					</span>
				</button>
			{/each}
			{/if}
		</div>
	{/if}
{/if}

<style>
	/* ── Icon variant ─────────────────────────────────────────────────────── */
	.theme-picker {
		display: inline-flex;
		gap: 4px;
	}

	.theme-toggle {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 28px;
		height: 28px;
		border-radius: var(--radius-control);
		border: 1px solid var(--border);
		background: transparent;
		color: var(--fg-muted);
		cursor: pointer;
		transition:
			color 0.15s,
			border-color 0.15s,
			background 0.15s;
	}
	.theme-toggle:hover,
	.theme-toggle[aria-expanded='true'] {
		color: var(--accent);
		border-color: var(--accent);
	}

	.theme-menu {
		position: fixed;
		min-width: 280px;
		padding: 6px;
		border: 1px solid var(--border-strong);
		border-radius: var(--radius-surface);
		background: var(--bg);
		box-shadow:
			0 12px 32px -8px rgba(0, 0, 0, 0.3),
			0 0 0 1px var(--border);
		z-index: 9999;
		display: flex;
		flex-direction: column;
		gap: 2px;
	}

	.theme-menu--panel {
		padding: 0;
		min-width: 0;
	}

	.theme-menu-head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 0.35rem 0.4rem 0.35rem 0.65rem;
		margin-bottom: 2px;
		border-bottom: 1px solid var(--border);
	}
	.theme-menu-title {
		font-family: var(--mono);
		font-size: 0.62rem;
		letter-spacing: 0.18em;
		text-transform: uppercase;
		color: var(--fg-muted);
	}
	.theme-row {
		display: grid;
		grid-template-columns: 64px 1fr 18px;
		align-items: center;
		gap: 0.7rem;
		padding: 0.55rem 0.65rem;
		border: 0;
		background: transparent;
		color: var(--fg);
		text-align: left;
		border-radius: var(--radius-control);
		cursor: pointer;
		transition:
			background 0.12s,
			color 0.12s;
	}
	.theme-row:hover,
	.theme-row[aria-checked='true'] {
		background: var(--accent-faint);
	}
	.theme-row[aria-checked='true'] {
		color: var(--accent);
	}

	.theme-swatch {
		display: inline-flex;
		align-items: center;
		gap: 2px;
		padding: 3px;
		border: 1px solid var(--border);
		border-radius: var(--radius-control);
		background: var(--surface-raised);
	}
	.dot {
		width: 12px;
		height: 12px;
		border-radius: var(--radius-hairline);
	}
	.theme-system-icon {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		color: var(--fg-muted);
		width: 100%;
	}

	.theme-meta {
		display: flex;
		flex-direction: column;
		gap: 1px;
		min-width: 0;
	}
	.theme-name {
		font-size: 0.9rem;
		font-weight: 500;
	}
	.theme-desc {
		font-size: 0.78rem;
		color: var(--fg-muted);
		line-height: 1.35;
	}

	.theme-check {
		display: inline-flex;
		justify-content: center;
		color: var(--accent);
	}

	/* ── HUD variant ──────────────────────────────────────────────────────── */
	.tp-hud-wrap {
		position: relative;
	}

	.tp-hud-btn {
		display: inline-flex;
		align-items: center;
		gap: 0.4rem;
		padding: 0.4rem 0.7rem;
		font-family: var(--mono);
		font-size: 0.62rem;
		letter-spacing: 0.15em;
		text-transform: uppercase;
		background: var(--surface-raised);
		border: 1px solid color-mix(in srgb, var(--accent) 25%, transparent);
		color: var(--fg-muted);
		cursor: pointer;
		transition: all 0.25s ease;
		white-space: nowrap;
	}
	.tp-hud-btn:hover,
	.tp-hud-btn[aria-expanded='true'] {
		border-color: color-mix(in srgb, var(--accent) 50%, transparent);
		color: var(--accent);
	}

	.tp-hud-icon {
		width: 12px;
		height: 12px;
	}

	.tp-hud-menu {
		position: absolute;
		top: calc(100% + 8px);
		right: 0;
		min-width: 220px;
		background: var(--surface-raised);
		backdrop-filter: blur(20px);
		border: 1px solid color-mix(in srgb, var(--accent) 30%, transparent);
		box-shadow: 0 10px 30px rgba(0, 0, 0, 0.45);
		padding: 8px;
		z-index: 60;
	}
	.tp-hud-menu::before {
		content: '';
		position: absolute;
		top: 0;
		left: 0;
		right: 0;
		height: 1px;
		background: linear-gradient(90deg, transparent, var(--accent), transparent);
		opacity: 0.7;
	}

	.tp-hud-header {
		font-family: var(--mono);
		font-size: 0.58rem;
		letter-spacing: 0.3em;
		text-transform: uppercase;
		color: var(--accent);
		padding: 8px 10px 6px;
	}

	.tp-hud-option {
		display: flex;
		align-items: center;
		gap: 10px;
		width: 100%;
		padding: 9px 10px;
		background: transparent;
		border: 1px solid transparent;
		color: var(--fg);
		font-size: 0.92rem;
		font-weight: 500;
		cursor: pointer;
		text-align: left;
		transition: all 0.18s ease;
	}
	.tp-hud-option:hover {
		background: color-mix(in srgb, var(--accent) 8%, transparent);
		border-color: color-mix(in srgb, var(--accent) 25%, transparent);
		color: var(--accent);
	}
	.tp-hud-option.active {
		background: color-mix(in srgb, var(--accent) 12%, transparent);
		border-color: color-mix(in srgb, var(--accent) 40%, transparent);
		color: var(--accent);
	}

	.tp-hud-swatch {
		width: 16px;
		height: 16px;
		border: 1px solid color-mix(in srgb, var(--accent) 40%, transparent);
		flex-shrink: 0;
	}

	.tp-hud-check {
		margin-left: auto;
		font-family: var(--mono);
		color: var(--accent);
		opacity: 0;
	}
	.tp-hud-option.active .tp-hud-check {
		opacity: 1;
	}

	.tp-hud-label-wrap {
		line-height: 1.1;
	}

	.tp-hud-sublabel {
		display: block;
		font-family: var(--mono);
		font-size: 0.55rem;
		letter-spacing: 0.2em;
		text-transform: uppercase;
		color: var(--fg-dim);
		margin-top: 2px;
	}

	.tp-hud-divider {
		height: 1px;
		background: color-mix(in srgb, var(--accent) 20%, transparent);
		margin: 6px 4px;
	}
</style>
