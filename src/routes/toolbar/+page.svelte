<script lang="ts">
	import ShowcaseBlock from '$lib/dev/ShowcaseBlock.svelte';
	import IconToolbar from '$lib/layout/IconToolbar.svelte';
	import type { IconToolbarItem } from '$lib/layout/IconToolbar.svelte';

	let activePanel = $state<string | null>('assignees');

	function makePanel(id: string) {
		return () => (activePanel = activePanel === id ? null : id);
	}

	// Mimics the assessment right-rail panels collapsed into a toolbar
	const assessmentItems: IconToolbarItem[] = [
		{
			icon: 'users',
			label: 'Assignees',
			onclick: makePanel('assignees'),
			get active() {
				return activePanel === 'assignees';
			},
			badge: 2
		},
		{
			icon: 'layout-template',
			label: 'Template',
			onclick: makePanel('template'),
			get active() {
				return activePanel === 'template';
			}
		},
		{
			icon: 'shield-check',
			label: 'Frameworks',
			onclick: makePanel('frameworks'),
			get active() {
				return activePanel === 'frameworks';
			}
		},
		{ divider: true },
		{
			icon: 'share-2',
			label: 'Share externally',
			onclick: makePanel('share'),
			get active() {
				return activePanel === 'share';
			}
		},
		{
			icon: 'download',
			label: 'Export',
			onclick: makePanel('export'),
			get active() {
				return activePanel === 'export';
			}
		},
		{ divider: true },
		{
			icon: 'clock',
			label: 'Timeline',
			onclick: makePanel('timeline'),
			get active() {
				return activePanel === 'timeline';
			}
		}
	];

	// A toolbar button can open a dropdown instead of firing a single action —
	// items with `selected`/`color` render as a radio-style menu (used by the
	// assessment review-verdict control).
	let verdict = $state<string | null>('approved');
	const verdictItems: IconToolbarItem[] = [
		{
			icon: 'clipboard-check',
			label: 'Review verdict',
			get active() {
				return verdict !== null;
			},
			menu: [
				{
					label: 'Approve',
					icon: 'check',
					color: 'var(--palette-emerald)',
					get selected() {
						return verdict === 'approved';
					},
					onclick: () => (verdict = verdict === 'approved' ? null : 'approved')
				},
				{
					label: 'Flag',
					icon: 'flag',
					color: 'var(--palette-red)',
					get selected() {
						return verdict === 'flagged';
					},
					onclick: () => (verdict = verdict === 'flagged' ? null : 'flagged')
				},
				{
					label: 'Needs Info',
					icon: 'info',
					color: 'var(--palette-amber)',
					get selected() {
						return verdict === 'needs_info';
					},
					onclick: () => (verdict = verdict === 'needs_info' ? null : 'needs_info')
				}
			]
		},
		{ divider: true },
		{ icon: 'share-2', label: 'Share externally', onclick: makePanel('share2') }
	];

	const horizontalItems: IconToolbarItem[] = [
		{ icon: 'layout-grid', label: 'Grid view', onclick: () => {}, active: true },
		{ icon: 'table', label: 'Table view', onclick: () => {} },
		{ divider: true },
		{ icon: 'filter', label: 'Filter', onclick: () => {}, badge: 3 },
		{ icon: 'search', label: 'Search', onclick: () => {} },
		{ divider: true },
		{ icon: 'refresh-cw', label: 'Refresh', onclick: () => {} },
		{ icon: 'settings-2', label: 'Settings', onclick: () => {}, disabled: true }
	];
</script>

<svelte:head>
	<title>IconToolbar — UI Lib</title>
</svelte:head>

<div class="px-3 sm:px-6 py-4 sm:py-5">
	<ShowcaseBlock component="IconToolbar">
		<h3 class="component-name">IconToolbar</h3>
		<p class="component-desc">
			Compact icon strip modelled after the MS Office-style sidebar — each icon button shows a
			tooltip on hover and supports active, disabled, and badge states. Dividers split items into
			logical sections. Use <code class="demo-code">orientation="vertical"</code> for the
			assessment right-rail and <code class="demo-code">orientation="horizontal"</code> for top/bottom
			action bars.
		</p>

		<div class="demo-row demo-row--top">
			<span class="demo-label">vertical<br />(assessment rail)</span>
			<div class="demo-items demo-items--panel">
				<div class="panel-mockup">
					<div class="panel-rail">
						<IconToolbar items={assessmentItems} orientation="vertical" />
					</div>
					<div class="panel-content">
						{#if activePanel}
							<div class="panel-placeholder">
								<span class="panel-name">{activePanel}</span>
								<span class="panel-hint">Click icon again to collapse</span>
							</div>
						{:else}
							<span class="panel-hint">Click an icon to open a panel</span>
						{/if}
					</div>
				</div>
			</div>
		</div>

		<div class="demo-row">
			<span class="demo-label">dropdown item<br />(verdict menu)</span>
			<div class="demo-items">
				<IconToolbar items={verdictItems} orientation="vertical" />
				<span class="panel-hint">Current: {verdict ?? 'none'}</span>
			</div>
		</div>

		<div class="demo-row">
			<span class="demo-label">horizontal</span>
			<div class="demo-items">
				<IconToolbar items={horizontalItems} orientation="horizontal" />
			</div>
		</div>

		<div class="demo-row">
			<span class="demo-label">disabled</span>
			<div class="demo-items">
				<IconToolbar
					items={[
						{ icon: 'users', label: 'Assignees', onclick: () => {}, disabled: true },
						{ icon: 'share-2', label: 'Share', onclick: () => {}, disabled: true }
					]}
				/>
			</div>
		</div>
	</ShowcaseBlock>
</div>

<style>
	.demo-row {
		display: flex;
		align-items: center;
		gap: 1.25rem;
		min-height: 2.5rem;
		margin-bottom: 12px;
	}
	.demo-row--top {
		align-items: flex-start;
		padding-top: 4px;
	}
	.demo-label {
		font-family: var(--mono);
		font-size: 0.68rem;
		color: var(--fg-dim);
		letter-spacing: 0.08em;
		text-transform: uppercase;
		min-width: 100px;
		flex-shrink: 0;
	}
	.demo-items {
		display: flex;
		align-items: center;
		gap: 0.65rem;
	}
	.demo-items--panel {
		flex: 1;
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

	/* ── Panel mockup ────────────────────────────────────────────────────── */
	.panel-mockup {
		display: flex;
		gap: 0;
		width: 100%;
		max-width: 520px;
		height: 280px;
		border: 1px solid var(--border);
		border-radius: 6px;
		overflow: hidden;
		background: var(--bg);
	}
	.panel-rail {
		display: flex;
		flex-direction: column;
		align-items: center;
		padding: 8px 0;
		background: var(--bg-elev);
		border-right: 1px solid var(--border);
		flex-shrink: 0;
	}
	.panel-content {
		flex: 1;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 16px;
	}
	.panel-placeholder {
		display: flex;
		flex-direction: column;
		gap: 4px;
		text-align: center;
	}
	.panel-name {
		font-family: var(--mono);
		font-size: 0.78rem;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.1em;
		color: var(--accent);
	}
	.panel-hint {
		font-size: 0.75rem;
		color: var(--fg-muted);
	}
</style>
