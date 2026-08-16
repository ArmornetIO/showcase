<script lang="ts">
	import Button from '$lib/primitives/actions/Button.svelte';
	import LayoutHeader from '$lib/primitives/chrome/LayoutHeader.svelte';
	import { base } from '$app/paths';

	const sections = [
		{ href: '/primitives', label: 'Primitives', desc: 'Buttons, chips, inputs, toggles, tooltips' },
		{ href: '/layout', label: 'Layout', desc: 'Panel, Tabs, Collapsible, ActionBar, TableWrap' },
		{ href: '/navigation', label: 'Navigation', desc: 'Breadcrumbs' },
		{ href: '/display', label: 'Display', desc: 'DataTable, Ticker, Avatar, StatTile, Sparkline, PeerCard, ConfigBlock, ConsensusBar, LogRow, Timeline' },
		{ href: '/progress', label: 'Progress', desc: 'ProgressBar (linear, stepped, stacked, radial)' },
		{ href: '/node-drawer', label: 'NodeDrawer', desc: 'Slide-up mesh node detail panel' },
		{ href: '/modal', label: 'Modal', desc: 'Modal — confirmations and short forms; SelectionModal — item picker with single/multi-select' },
		{ href: '/alert-blade', label: 'AlertBlade', desc: 'Non-blocking toast notification system' },
		{ href: '/cards', label: 'Cards', desc: 'Card + CardStack — composite, article, data-input, profile, stat, doc, summary' },
		{ href: '/docs', label: 'Docs', desc: 'DocsNav, DocsTOC, DocsMetadata, DocsBreadcrumbs, Prose, DocsLayoutDashboard' },
		{ href: '/icons', label: 'Icons', desc: 'Lucide icon set, inlined SVG' },
		{ href: '/svg-fx', label: 'SvgFx', desc: 'Chrome, emboss, outline, glow, engrave — applied to any vector art; plus BreakoutStack' },
		{ href: '/roadmap', label: 'Roadmap', desc: 'RoadmapStudio — product roadmap template on the shared canvas; timeline, board, dependency and horizon views, framed PNG export' },
		{ href: '/theme', label: 'Theme', desc: 'ThemePicker + design token swatches' },
		{ href: '/dev', label: 'Dev', desc: 'DevCog feature-flag panel' },
		{ href: '/edges', label: 'Edges', desc: 'EdgeStyle — energy, pulse, dashed, degraded, blocked, latent, scanning, encrypted' },
		{ href: '/actions', label: 'Actions', desc: 'ActionsMenu (kebab ⋮ dropdown), ExportMenu (format picker)' },
		{ href: '/toolbar', label: 'IconToolbar', desc: 'Compact icon strip with tooltips, badges, dividers — vertical and horizontal' },
		{ href: '/builder', label: 'Builder', desc: 'Drag-and-drop canvas builder with live AI generation via Canvas Mode driver' },
		{ href: '/compare', label: 'Compare', desc: 'Side-by-side mockup comparison with preference voting' },
	];
</script>

<svelte:head>
	<title>Armornet UI — Component Library</title>
</svelte:head>

<LayoutHeader eyebrow="// showcase · demo">
	{#snippet title()}Armornet <span class="accent">components.</span>{/snippet}
	{#snippet lede()}
		Every component in every configuration. Use the theme picker in the sidebar to verify tokens
		across all four themes.
	{/snippet}
	{#snippet actions()}
		<Button variant="primary" size="sm" href="{base}/design-patterns">Design patterns</Button>
		<Button variant="ghost" size="sm" href="{base}/primitives">Browse components</Button>
		<Button variant="ghost" size="sm" href="{base}/theme">Theme picker</Button>
	{/snippet}
</LayoutHeader>

<div class="px-3 sm:px-6 py-4 sm:py-5">
	<a href="{base}/design-patterns" class="lead-card">
		<span class="lead-eyebrow">Start here</span>
		<span class="lead-title">Design patterns</span>
		<span class="lead-desc">
			The rules this interface is built on. Each pattern carries its intent, the checkable rules, and
			the same thing built correctly and built wrong — rendered live, side by side, with the code for
			both.
		</span>
	</a>

	<p class="intro">
		Select a section to explore components. Each page shows all variants and interactive demos.
	</p>
	<div class="section-grid">
		{#each sections as s}
			<a href="{base}{s.href}" class="section-card">
				<span class="section-label">{s.label}</span>
				<span class="section-desc">{s.desc}</span>
			</a>
		{/each}
	</div>
</div>

<style>
	:global(.accent) {
		color: var(--accent);
	}

	.lead-card {
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
		padding: 1.35rem 1.5rem;
		margin-bottom: 1.75rem;
		border: 1px solid var(--border-accent);
		border-radius: 10px;
		background: var(--accent-faint);
		text-decoration: none;
		transition:
			border-color 0.15s,
			background 0.15s;
	}
	.lead-card:hover {
		border-color: var(--accent);
		background: var(--accent-faint-strong);
	}

	.lead-eyebrow {
		font-family: var(--mono);
		font-size: 0.66rem;
		letter-spacing: 0.12em;
		text-transform: uppercase;
		color: var(--accent);
	}
	.lead-title {
		font-size: 1.05rem;
		font-weight: 600;
		color: var(--fg);
		letter-spacing: -0.01em;
	}
	.lead-desc {
		font-size: 0.82rem;
		color: var(--fg-muted);
		line-height: 1.65;
		max-width: 76ch;
	}

	.intro {
		font-size: 0.9rem;
		color: var(--fg-muted);
		margin: 0 0 1.5rem;
		line-height: 1.6;
	}

	.section-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
		gap: 0.75rem;
	}

	.section-card {
		display: flex;
		flex-direction: column;
		gap: 0.35rem;
		padding: 1rem 1.25rem;
		border: 1px solid var(--border);
		border-radius: 8px;
		background: var(--bg-elev);
		text-decoration: none;
		transition:
			border-color 0.15s,
			background 0.15s;
	}
	.section-card:hover {
		border-color: var(--accent);
		background: var(--accent-faint);
	}

	.section-label {
		font-family: var(--mono);
		font-size: 0.82rem;
		font-weight: 600;
		color: var(--accent);
		letter-spacing: 0.04em;
	}

	.section-desc {
		font-size: 0.78rem;
		color: var(--fg-dim);
		line-height: 1.5;
	}
</style>
