<script lang="ts">
	import DocsNav from '$lib/docs/DocsNav.svelte';
	import type { DocNavGroup } from '$lib/docs/DocsNav.svelte';
	import DocsTOC from '$lib/docs/DocsTOC.svelte';
	import DocsMetadata from '$lib/docs/DocsMetadata.svelte';
	import DocsBreadcrumbs from '$lib/docs/DocsBreadcrumbs.svelte';
	import DocsLayoutDashboard from '$lib/docs/DocsLayoutDashboard.svelte';
	import Prose from '$lib/docs/Prose.svelte';
	import Icon from '$lib/icons/Icon.svelte';
	import ShowcaseBlock from '$lib/dev/ShowcaseBlock.svelte';

	type DocsSubject = 'nav' | 'toc' | 'metadata' | 'breadcrumbs' | 'prose' | 'dashboard';
	let docsSubject = $state<DocsSubject>('nav');

	const demoNavGroups: DocNavGroup[] = [
		{
			heading: 'Development',
			cards: [
				{ tag: 'ENG·001', title: 'Agent Mesh', href: '/docs/development/agent-mesh' },
				{ tag: 'ENG·002', title: 'Identity Broker', href: '/docs/development/identity-broker' },
				{ tag: 'ENG·003', title: 'Web Application Firewall', href: '/docs/development/waf' }
			]
		},
		{
			heading: 'Security',
			cards: [
				{ tag: 'SEC·001', title: 'Incident Response', href: '/docs/corporate/plans/incident_response', status: 'approved' },
				{ tag: 'SEC·002', title: 'Information Security Policy', href: '/docs/corporate/policies/information-security', status: 'draft' }
			]
		}
	];
	const demoCurrentPath = '/docs/development/agent-mesh';

	const demoMeta = {
		id: 'ENG-001',
		status: 'draft',
		updated: '2026-05-17',
		authors: [{ handle: 'itonyr', name: 'Tony Ramos', commits: 9 }],
		approvers: []
	};

	const demoMetaApproved = {
		id: 'SEC-001',
		status: 'approved',
		updated: '2026-03-10',
		authors: [{ handle: 'itonyr', name: 'Tony Ramos', commits: 4 }],
		approvers: [{ handle: 'alice', name: 'Alice Chen', pr: 142, date: '2026-03-10' }]
	};

	let proseTocEl = $state<HTMLElement | null>(null);

	const demoProseHtml = `
<h2 id="overview">Overview</h2>
<p>The Agent Mesh is a peer-to-peer overlay network that lets autonomous agents discover each other and exchange signals without a central broker. Each node maintains a local view of its neighbors and propagates state changes via the <strong>OpAMP</strong> control plane.</p>

<h2 id="getting-started">Getting started</h2>
<p>Deploy a mesh node with the default configuration:</p>

<div class="terminal">
  <div class="terminal-bar">
    <span class="dot red"></span>
    <span class="dot amber"></span>
    <span class="dot green"></span>
    <span class="terminal-title">bash</span>
  </div>
  <pre class="terminal-body"><code>armornet agent start --mesh --id risk.01</code></pre>
</div>

<h3 id="configuration">Configuration</h3>
<p>Nodes are configured via <code>agent.yaml</code>. The <code>mesh</code> block controls peer discovery and heartbeat intervals.</p>

<blockquote>
<p><strong>Note</strong> Changing <code>heartbeat_interval</code> below 5 s in production increases control-plane load significantly.</p>
</blockquote>

<h2 id="topology">Topology</h2>
<p>The mesh supports three node roles:</p>
<ul>
  <li><strong>Core</strong> — policy engine, always present</li>
  <li><strong>Edge</strong> — relay node at the network perimeter</li>
  <li><strong>Peer</strong> — ephemeral classification agent</li>
</ul>

<table>
  <thead><tr><th>Role</th><th>Max peers</th><th>Replicated state</th></tr></thead>
  <tbody>
    <tr><td>Core</td><td>Unlimited</td><td>Full</td></tr>
    <tr><td>Edge</td><td>32</td><td>Partial</td></tr>
    <tr><td>Peer</td><td>8</td><td>Local only</td></tr>
  </tbody>
</table>
`;
</script>

<svelte:head>
	<title>Docs — UI Lib</title>
</svelte:head>

<div class="px-3 sm:px-6 py-4 sm:py-5">
	<ShowcaseBlock>
		<p class="component-desc" style="margin-bottom: 16px;">Documentation system components. Use <code class="demo-code">DocsShell</code> as the page wrapper — it wires together the nav, TOC, metadata, and prose into the standard three-column layout. The individual components can be used standalone when the full shell is too heavy.</p>
		<p class="component-desc" style="margin-bottom: 0;">
			<strong>Nav</strong> — sidebar card-grid linking to doc sections ·
			<strong>TOC</strong> — IntersectionObserver-driven heading tracker ·
			<strong>Metadata</strong> — author, approval status, and last-updated badge ·
			<strong>Breadcrumbs</strong> — docs-specific path trail ·
			<strong>Prose</strong> — styled HTML content with terminal blocks and tables ·
			<strong>Dashboard</strong> — dev-only layout control panel
		</p>
		<div class="blade-ctrl">
			<div class="bc-group">
				<span class="bc-label">Component</span>
				<div class="bc-btns">
					{#each ([['nav', 'menu'], ['toc', 'clipboard-list'], ['metadata', 'user'], ['breadcrumbs', 'chevron-right'], ['prose', 'external-link'], ['dashboard', 'settings-2']] as const) as [id, icon]}
						<button
							class="bc-btn"
							class:bc-active={docsSubject === id}
							onclick={() => (docsSubject = id)}
							title={id}
						>
							<Icon name={icon} size={14} />
						</button>
					{/each}
				</div>
			</div>
		</div>

		<div class="component-preview">
			{#if docsSubject === 'nav'}
				<div class="docs-demo-nav-wrap">
					<DocsNav groups={demoNavGroups} currentPath={demoCurrentPath} />
				</div>
			{:else if docsSubject === 'toc'}
				<div class="docs-demo-toc-wrap">
					<div class="docs-demo-toc-content" bind:this={proseTocEl}>
						<h2 id="toc-overview">Overview</h2>
						<p>Dummy section to demonstrate the table of contents scanning. The TOC component observes this container for heading elements and builds navigation automatically.</p>
						<h2 id="toc-getting-started">Getting Started</h2>
						<p>A second heading to show active-state tracking. The IntersectionObserver watches all headings and highlights the one currently in view.</p>
						<h3 id="toc-configuration">Configuration</h3>
						<p>A third-level heading appears indented in the TOC panel.</p>
						<h2 id="toc-topology">Topology</h2>
						<p>Another top-level section. The TOC updates instantly when this heading enters the viewport.</p>
					</div>
					<div class="docs-demo-toc-panel">
						<DocsTOC containerEl={proseTocEl} />
					</div>
				</div>
			{:else if docsSubject === 'metadata'}
				<div style="display: flex; flex-direction: column; gap: 2rem; padding: 1.5rem;">
					<div>
						<p class="docs-demo-label">Draft</p>
						<DocsMetadata meta={demoMeta} />
					</div>
					<div>
						<p class="docs-demo-label">Approved</p>
						<DocsMetadata meta={demoMetaApproved} />
					</div>
				</div>
			{:else if docsSubject === 'breadcrumbs'}
				<div style="display: flex; flex-direction: column; gap: 1.5rem; padding: 1.5rem;">
					<div>
						<p class="docs-demo-label">Two levels</p>
						<DocsBreadcrumbs items={[{ label: 'Docs', href: '/docs' }, { label: 'Agent Mesh' }]} />
					</div>
					<div>
						<p class="docs-demo-label">Three levels</p>
						<DocsBreadcrumbs items={[{ label: 'Docs', href: '/docs' }, { label: 'Development', href: '/docs/development' }, { label: 'Identity Broker' }]} />
					</div>
				</div>
			{:else if docsSubject === 'prose'}
				<div class="docs-demo-prose-wrap">
					<Prose html={demoProseHtml} />
				</div>
			{:else if docsSubject === 'dashboard'}
				<div class="docs-demo-dashboard-wrap">
					<p class="docs-demo-hint">The layout dashboard trigger appears fixed in the bottom-right corner. Click the grid icon to open the layout panel.</p>
					<DocsLayoutDashboard />
				</div>
			{/if}
		</div>
	</ShowcaseBlock>
</div>

<style>
	.component-desc {
		margin: 0;
		font-size: 0.85rem;
		color: var(--fg-muted);
		line-height: 1.55;
	}

	.demo-code {
		font-family: var(--mono);
		font-size: 0.78em;
		background: var(--surface-strong);
		border: 1px solid var(--border);
		padding: 0.1rem 0.35rem;
		border-radius: 3px;
		color: var(--fg-muted);
	}

	.blade-ctrl {
		display: flex;
		align-items: center;
		flex-wrap: wrap;
		gap: 12px;
		padding: 12px 16px;
		background: rgba(0, 0, 0, 0.25);
		border: 1px solid rgba(255, 255, 255, 0.06);
		border-radius: 3px;
	}
	.bc-group {
		display: flex;
		flex-direction: column;
		gap: 6px;
	}
	.bc-label {
		font-family: var(--mono);
		font-size: 0.5rem;
		letter-spacing: 0.2em;
		color: var(--fg-muted, rgba(156, 163, 175, 0.45));
	}
	.bc-btns {
		display: flex;
		gap: 4px;
	}
	.bc-btn {
		width: 30px;
		height: 30px;
		display: flex;
		align-items: center;
		justify-content: center;
		border: 1px solid rgba(255, 255, 255, 0.1);
		border-radius: 2px;
		background: transparent;
		color: var(--fg-dim);
		cursor: pointer;
		padding: 0;
		transition:
			color 0.15s,
			border-color 0.15s,
			background 0.15s;
	}
	.bc-btn:hover {
		color: var(--accent);
		border-color: rgba(94, 234, 212, 0.4);
		background: rgba(94, 234, 212, 0.06);
	}
	.bc-btn.bc-active {
		color: var(--accent);
		border-color: rgba(94, 234, 212, 0.5);
		background: rgba(94, 234, 212, 0.1);
	}

	.component-preview {
		border: 1px solid var(--border);
		border-radius: 6px;
		overflow: hidden;
	}

	.docs-demo-nav-wrap {
		width: 280px;
		border: 1px solid var(--border);
		border-radius: 10px;
		background: var(--bg-elev);
		padding: 8px;
	}

	.docs-demo-toc-wrap {
		display: grid;
		grid-template-columns: 1fr 220px;
		gap: 1.5rem;
		min-height: 300px;
	}
	.docs-demo-toc-content {
		padding: 1rem 1.25rem;
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		overflow-y: auto;
	}
	.docs-demo-toc-content h2,
	.docs-demo-toc-content h3 {
		margin: 0;
		font-size: 1rem;
		font-weight: 600;
		color: var(--fg);
	}
	.docs-demo-toc-content h3 {
		font-size: 0.9rem;
		padding-left: 1rem;
	}
	.docs-demo-toc-content p {
		margin: 0;
		font-size: 0.85rem;
		color: var(--fg-muted);
		line-height: 1.5;
	}
	.docs-demo-toc-panel {
		border-left: 1px solid var(--border);
		padding: 0.75rem 0;
	}

	.docs-demo-label {
		font-family: var(--mono);
		font-size: 0.68rem;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--fg-dim);
		margin: 0 0 0.5rem;
	}

	.docs-demo-prose-wrap {
		padding: 1.5rem;
		max-height: 480px;
		overflow-y: auto;
	}

	.docs-demo-dashboard-wrap {
		padding: 2rem 1.5rem;
		display: flex;
		flex-direction: column;
		gap: 1rem;
		align-items: flex-start;
	}
	.docs-demo-hint {
		font-size: 0.85rem;
		color: var(--fg-muted);
		margin: 0;
		max-width: 420px;
		line-height: 1.55;
	}
</style>
