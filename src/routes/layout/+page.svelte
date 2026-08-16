<script lang="ts">
	import ShowcaseBlock from '$lib/dev/ShowcaseBlock.svelte';
	import Button from '$lib/primitives/Button.svelte';
	import Panel from '$lib/layout/Panel.svelte';
	import Collapsible from '$lib/layout/Collapsible.svelte';
	import Tabs from '$lib/layout/Tabs.svelte';
	import ActionBar from '$lib/layout/ActionBar.svelte';
	import type { ActionBarAction } from '$lib/layout/ActionBar.svelte';
	import TableWrap from '$lib/display/table/TableWrap.svelte';
	import ViewToggle from '$lib/primitives/ViewToggle.svelte';
	import IconToolbar from '$lib/layout/IconToolbar.svelte';
	import type { IconToolbarItem } from '$lib/layout/IconToolbar.svelte';
	import SelectionModal from '$lib/layout/SelectionModal.svelte';
	import type { SelectionItem } from '$lib/layout/SelectionModal.svelte';
	import RulePanel from '$lib/layout/RulePanel.svelte';
	import type { RulePanelRule, RulePanelTab } from '$lib/layout/RulePanel.svelte';

	let activePanel = $state<string | null>(null);
	let selOpen = $state(false);
	let selMultiOpen = $state(false);
	let selResult = $state<string>('');
	let selMultiResult = $state<string[]>([]);

	const frameworkItems: SelectionItem[] = [
		{ value: 'soc2', label: 'SOC 2 Type II', description: 'Trust service criteria' },
		{ value: 'iso27001', label: 'ISO 27001', description: 'Information security management' },
		{ value: 'nist-csf', label: 'NIST CSF', description: 'Cybersecurity framework' },
		{ value: 'pci-dss', label: 'PCI DSS', description: 'Payment card industry standard' },
		{ value: 'hipaa', label: 'HIPAA', description: 'Healthcare data security' }
	];

	const toolbarItems: IconToolbarItem[] = [
		{ icon: 'users', label: 'Assignees', onclick: () => (activePanel = activePanel === 'assignees' ? null : 'assignees'), get active() { return activePanel === 'assignees'; }, badge: 2 },
		{ icon: 'layout-template', label: 'Template', onclick: () => (activePanel = activePanel === 'template' ? null : 'template'), get active() { return activePanel === 'template'; } },
		{ icon: 'shield-check', label: 'Frameworks', onclick: () => (activePanel = activePanel === 'frameworks' ? null : 'frameworks'), get active() { return activePanel === 'frameworks'; } },
		{ divider: true },
		{ icon: 'share-2', label: 'Share', onclick: () => (activePanel = activePanel === 'share' ? null : 'share'), get active() { return activePanel === 'share'; } },
		{ icon: 'download', label: 'Export', onclick: () => (activePanel = activePanel === 'export' ? null : 'export'), get active() { return activePanel === 'export'; } },
		{ divider: true },
		{ icon: 'clock', label: 'Timeline', onclick: () => (activePanel = activePanel === 'timeline' ? null : 'timeline'), get active() { return activePanel === 'timeline'; } }
	];

	const horizontalItems: IconToolbarItem[] = [
		{ icon: 'layout-grid', label: 'Grid view', onclick: () => {}, active: true },
		{ icon: 'table-2', label: 'Table view', onclick: () => {} },
		{ divider: true },
		{ icon: 'filter', label: 'Filter', onclick: () => {}, badge: 3 },
		{ icon: 'search', label: 'Search', onclick: () => {} },
		{ divider: true },
		{ icon: 'refresh-cw', label: 'Refresh', onclick: () => {} },
		{ icon: 'settings-2', label: 'Settings', onclick: () => {}, disabled: true }
	];

	let activeTab = $state('overview');

	const rpTabs: RulePanelTab[] = [
		{ id: 'all', label: 'All' },
		{ id: 'licenses', label: 'Licenses' },
		{ id: 'publishers', label: 'Publishers' },
		{ id: 'packages', label: 'Packages' }
	];

	const rpRules: RulePanelRule[] = [
		{ id: '1', name: 'Block GPL-3.0 in production deps', category: 'licenses', meta: '4 ecosystems', action: 'block', icon: 'file-text' },
		{ id: '2', name: 'Require signed publisher identity', category: 'publishers', meta: 'all ecosystems', action: 'warn', icon: 'user' },
		{ id: '3', name: 'Allow internal scope @armornet/*', category: 'packages', meta: 'NPM', action: 'allow', icon: 'shield-check' },
		{ id: '4', name: 'Block event-stream < 3.3.6', category: 'packages', meta: 'NPM', action: 'block', icon: 'shield-check' },
		{ id: '5', name: 'Warn on missing license field', category: 'licenses', meta: 'PIP, Go', action: 'warn', icon: 'file-text' }
	];

	const tabs = [
		{ id: 'overview', label: 'Overview' },
		{ id: 'metrics', label: 'Metrics', disabled: true },
		{ id: 'logs', label: 'Logs', disabled: true },
		{ id: 'config', label: 'Config' }
	];

	const actionBarDemoActions: ActionBarAction[] = [
		{ label: 'Approve', onclick: () => {} },
		{ label: 'Reassign', onclick: () => {} },
		{ label: 'Delete', variant: 'danger', onclick: () => {} }
	];
</script>

<svelte:head>
	<title>Layout — UI Lib</title>
</svelte:head>

<div class="px-3 sm:px-6 py-4 sm:py-5">
	<!-- Panel -->
	<ShowcaseBlock component="Panel">
		<h3 class="component-name">Panel</h3>
		<p class="component-desc">Surface container with optional <code class="demo-code">header</code> and <code class="demo-code">footer</code> snippets. Use for any piece of UI that needs a bordered, contained area. Compose with <code class="demo-code">Tabs</code> in the header slot and <code class="demo-code">ActionBar</code> in the footer slot for the standard content-detail pattern.</p>
		<div class="demo-row">
			<span class="demo-label">default</span>
			<div class="demo-items demo-items--wide">
				<Panel>Just a body — no header or footer.</Panel>
			</div>
		</div>
		<div class="demo-row">
			<span class="demo-label">with header</span>
			<div class="demo-items demo-items--wide">
				<Panel>
					{#snippet header()}
						<span class="panel-header-label">Panel title</span>
					{/snippet}
					Panel body content goes here.
				</Panel>
			</div>
		</div>
		<div class="demo-row">
			<span class="demo-label">header + footer</span>
			<div class="demo-items demo-items--wide">
				<Panel>
					{#snippet header()}
						<span class="panel-header-label">Full panel</span>
					{/snippet}
					Body content.
					{#snippet footer()}
						<div class="panel-footer-row">
							<Button variant="ghost" size="sm">Cancel</Button>
							<Button variant="primary" size="sm">Save</Button>
						</div>
					{/snippet}
				</Panel>
			</div>
		</div>
	</ShowcaseBlock>

	<!-- Tabs -->
	<ShowcaseBlock component="Tabs">
		<h3 class="component-name">Tabs</h3>
		<p class="component-desc">Horizontal tab strip for switching content views within a surface. <code class="demo-code">disabled</code> prevents selection without hiding the tab (use for planned features). For switching display modes on data (table/grid), prefer <code class="demo-code">ViewToggle</code>.</p>
		<Tabs {tabs} bind:active={activeTab} />
		<div class="tab-content">
			{#if activeTab === 'overview'}
				<p class="tab-body">
					Overview content — <code class="demo-code">active: {activeTab}</code>
				</p>
			{:else if activeTab === 'metrics'}
				<p class="tab-body">Metrics panel.</p>
			{:else if activeTab === 'logs'}
				<p class="tab-body">Log output.</p>
			{/if}
		</div>
	</ShowcaseBlock>

	<!-- Collapsible -->
	<ShowcaseBlock component="Collapsible">
		<h3 class="component-name">Collapsible</h3>
		<p class="component-desc">Accordion-style show/hide that animates via <code class="demo-code">grid-template-rows</code>. The <code class="demo-code">trigger</code> slot accepts any element, giving you full control over the chevron and label. Use for advanced filter panels, optional config sections, or long policy text.</p>
		<Collapsible>
			{#snippet trigger({ open, toggle })}
				<button class="collapsible-trigger" onclick={toggle} aria-expanded={open}>
					<svg
						class="trigger-chevron"
						class:open
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
					{open ? 'Collapse' : 'Expand'} section
				</button>
			{/snippet}
			<div class="collapsible-body">
				Collapsible body — animates via <code class="demo-code">grid-template-rows</code>.
			</div>
		</Collapsible>
	</ShowcaseBlock>

	<!-- ActionBar -->
	<ShowcaseBlock component="ActionBar">
		<h3 class="component-name">ActionBar</h3>
		<p class="component-desc">Bulk action toolbar for table selection states. Render below a <code class="demo-code">DataTable</code> when one or more rows are checked. Actions receive <code class="demo-code">variant</code> to distinguish primary from destructive operations. The top border provides visual separation from the table body.</p>
		<div class="demo-row">
			<span class="demo-label">3 actions</span>
			<div class="demo-items demo-items--wide">
				<ActionBar actions={actionBarDemoActions} />
			</div>
		</div>
	</ShowcaseBlock>

	<!-- TableWrap -->
	<ShowcaseBlock component="TableWrap TableFoot">
		<h3 class="component-name">TableWrap</h3>
		<p class="component-desc">Styled scroll container for raw <code class="demo-code">&lt;table&gt;</code> elements. Use when you need full control over table markup and cell rendering. For data-driven tables with typed columns and custom cell Snippets, prefer <code class="demo-code">DataTable</code> — it is built on top of <code class="demo-code">TableWrap</code> internally.</p>
		<div class="demo-row">
			<span class="demo-label">raw table</span>
			<div class="demo-items demo-items--wide">
				<TableWrap>
					<table>
						<thead>
							<tr>
								<th>Node ID</th>
								<th>Type</th>
								<th>Region</th>
								<th>Status</th>
							</tr>
						</thead>
						<tbody>
							<tr><td>policy.01</td><td>Core</td><td>us-east-1</td><td>Healthy</td></tr>
							<tr><td>intel.02</td><td>Assess</td><td>eu-west-1</td><td>Degraded</td></tr>
							<tr><td>edge.03</td><td>Edge</td><td>ap-south-1</td><td>Offline</td></tr>
						</tbody>
					</table>
				</TableWrap>
			</div>
		</div>
	</ShowcaseBlock>

	<!-- IconToolbar -->
	<ShowcaseBlock component="IconToolbar">
		<h3 class="component-name">IconToolbar</h3>
		<p class="component-desc">Compact icon strip with tooltips — modelled after the MS Office sidebar. Items support active, disabled, and badge states. Dividers group sections. Use <code class="demo-code">orientation="vertical"</code> for the assessment right-rail, <code class="demo-code">"horizontal"</code> for top/bottom bars.</p>
		<div class="demo-row demo-row--top">
			<span class="demo-label">vertical</span>
			<div class="demo-items">
				<div style="display:flex;gap:0;border:1px solid var(--border);border-radius:6px;overflow:hidden;height:240px;background:var(--bg);">
					<div style="background:var(--bg-elev);border-right:1px solid var(--border);padding:8px 0;">
						<IconToolbar items={toolbarItems} orientation="vertical" />
					</div>
					<div style="flex:1;display:flex;align-items:center;justify-content:center;padding:16px;min-width:160px;">
						{#if activePanel}
							<span style="font-family:var(--mono);font-size:0.75rem;color:var(--accent);">{activePanel}</span>
						{:else}
							<span style="font-size:0.75rem;color:var(--fg-muted);">click an icon</span>
						{/if}
					</div>
				</div>
			</div>
		</div>
		<div class="demo-row">
			<span class="demo-label">horizontal</span>
			<div class="demo-items">
				<IconToolbar items={horizontalItems} orientation="horizontal" />
			</div>
		</div>
	</ShowcaseBlock>

	<!-- SelectionModal -->
	<ShowcaseBlock component="SelectionModal">
		<h3 class="component-name">SelectionModal</h3>
		<p class="component-desc">Item picker modal for single or multi-select. Reused by the framework picker, assignee manager, and template switcher. Add <code class="demo-code">searchable</code> for long lists.</p>
		<div class="demo-row">
			<span class="demo-label">single-select</span>
			<div class="demo-items">
				<Button size="sm" onclick={() => (selOpen = true)}>Pick framework</Button>
				{#if selResult}<span style="font-family:var(--mono);font-size:0.72rem;color:var(--accent);">→ {selResult}</span>{/if}
			</div>
		</div>
		<div class="demo-row">
			<span class="demo-label">multi + search</span>
			<div class="demo-items">
				<Button size="sm" onclick={() => (selMultiOpen = true)}>Pick frameworks</Button>
				{#if selMultiResult.length}<span style="font-family:var(--mono);font-size:0.72rem;color:var(--accent);">→ {selMultiResult.join(', ')}</span>{/if}
			</div>
		</div>
	</ShowcaseBlock>

	<!-- RulePanel -->
	<ShowcaseBlock component="RulePanel">
		<h3 class="component-name">RulePanel</h3>
		<p class="component-desc">Filterable list panel with a titled header, attached segment tabs, and typed rule rows (icon · name · category · action tag). Tabs filter rows by <code class="demo-code">category</code>. Pass <code class="demo-code">onAddRule</code> to show the footer with count and "New rule" button.</p>

		<div class="demo-row demo-row--top">
			<span class="demo-label">populated</span>
			<div class="demo-items--wide">
				<RulePanel title="All Rules" tabs={rpTabs} rules={rpRules} onAddRule={() => {}} />
			</div>
		</div>

		<div class="demo-row demo-row--top">
			<span class="demo-label">empty state</span>
			<div class="demo-items--wide">
				<RulePanel title="All Rules" tabs={rpTabs} rules={[]} onAddRule={() => {}} />
			</div>
		</div>

		<div class="demo-row demo-row--top">
			<span class="demo-label">no tabs</span>
			<div class="demo-items--wide">
				<RulePanel title="DNS Rules" rules={rpRules.slice(0, 2)} />
			</div>
		</div>
	</ShowcaseBlock>
</div>

<SelectionModal
	open={selOpen}
	title="Select framework"
	items={frameworkItems}
	selected={selResult ? [selResult] : []}
	onconfirm={(vals) => { selResult = vals[0] ?? ''; selOpen = false; }}
	onclose={() => (selOpen = false)}
/>

<SelectionModal
	open={selMultiOpen}
	title="Select frameworks"
	items={frameworkItems}
	selected={selMultiResult}
	multiselect
	searchable
	onconfirm={(vals) => { selMultiResult = vals; selMultiOpen = false; }}
	onclose={() => (selMultiOpen = false)}
/>

<style>
	.demo-row {
		display: flex;
		align-items: center;
		gap: 1.25rem;
		min-height: 2rem;
	}

	.demo-label {
		font-family: var(--mono);
		font-size: 0.68rem;
		color: var(--fg-dim);
		letter-spacing: 0.08em;
		text-transform: uppercase;
		min-width: 88px;
		flex-shrink: 0;
	}

	.demo-items {
		display: flex;
		align-items: center;
		gap: 0.65rem;
		flex-wrap: wrap;
	}

	.demo-items--wide {
		flex: 1;
		min-width: 0;
	}

	.demo-row--top {
		align-items: flex-start;
		padding-top: 4px;
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

	.panel-header-label {
		font-family: var(--mono);
		font-size: 0.72rem;
		font-weight: 600;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		color: var(--fg-dim);
	}

	.panel-footer-row {
		display: flex;
		justify-content: flex-end;
		gap: 0.5rem;
	}

	.tab-content {
		border: 1px solid var(--border);
		border-top: none;
		padding: 1rem 1.25rem;
		border-radius: 0 0 6px 6px;
	}

	.tab-body {
		margin: 0;
		color: var(--fg-muted);
		font-size: 0.9rem;
	}

	.collapsible-trigger {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		background: none;
		border: 1px solid var(--border);
		border-radius: 5px;
		padding: 0.45rem 0.75rem;
		color: var(--fg-muted);
		cursor: pointer;
		font-family: var(--mono);
		font-size: 0.82rem;
		transition:
			color 0.12s,
			border-color 0.12s;
	}
	.collapsible-trigger:hover {
		color: var(--accent);
		border-color: var(--accent);
	}

	.trigger-chevron {
		flex-shrink: 0;
		transition: transform 0.22s ease;
		transform: rotate(-90deg);
	}
	.trigger-chevron.open {
		transform: rotate(0deg);
	}

	.collapsible-body {
		padding: 0.85rem 0;
		color: var(--fg-muted);
		font-size: 0.88rem;
		border-bottom: 1px solid var(--border);
	}
</style>
