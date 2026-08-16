<script lang="ts" module>
	export interface RulePanelTab {
		id: string;
		label: string;
		/** Optional count badge shown on the tab button. */
		count?: number;
	}

	export interface RulePanelRule {
		id: string;
		name: string;
		/** Matches a tab id for filtering; also used as the accent label in the meta line. */
		category: string;
		/** Secondary meta text shown after the category, e.g. "4 ecosystems". */
		meta?: string;
		action: 'block' | 'warn' | 'allow';
		/** Icon name from the shared Icon component. Defaults to shield-check. */
		icon?: string;
	}
</script>

<script lang="ts">
	import type { Snippet } from 'svelte';
	import Icon from '../icons/Icon.svelte';
	import type { IconName } from '../icons/Icon.svelte';

	interface RulePanelProps {
		title?: string;
		tabs?: RulePanelTab[];
		rules?: RulePanelRule[];
		emptyText?: string;
		/** Overrides the auto-generated footer. */
		footer?: Snippet;
		onAddRule?: () => void;
		/** Bindable — lets the parent read/write the active tab id. */
		activeTab?: string;
		onTabChange?: (id: string) => void;
		/** Custom body — replaces the auto-rendered rule list. */
		children?: Snippet;
	}

	let {
		title = 'Rules',
		tabs = [],
		rules = [],
		emptyText = 'No rules configured.',
		footer,
		onAddRule,
		activeTab = $bindable(tabs[0]?.id ?? 'all'),
		onTabChange,
		children
	}: RulePanelProps = $props();

	const visibleRules = $derived(
		!tabs.length || activeTab === 'all' ? rules : rules.filter((r) => r.category === activeTab)
	);

	const blockingCount = $derived(rules.filter((r) => r.action === 'block').length);

	function tabCount(tab: RulePanelTab): number | undefined {
		if (tab.count !== undefined) return tab.count;
		return rules.length ? rules.filter((r) => r.category === tab.id).length : undefined;
	}
</script>

<div class="rulepanel">
	<div class="rp-head">
		<span class="rp-title">{title}</span>
		{#if blockingCount > 0}
			<span class="rp-blocking-pill">{blockingCount} Blocking</span>
		{/if}
		{#if tabs.length}
			<div class="rp-seg">
				{#each tabs as tab (tab.id)}
					<button
						type="button"
						class="rp-seg-btn"
						class:active={activeTab === tab.id}
						onclick={() => { activeTab = tab.id; onTabChange?.(tab.id); }}
					>
						{tab.label}
						{#if tabCount(tab) !== undefined}
							<span class="rp-cnt">{tabCount(tab)}</span>
						{/if}
					</button>
				{/each}
			</div>
		{/if}
	</div>

	<div class="rp-body">
		{#if children}
			{@render children()}
		{:else if visibleRules.length === 0}
			<div class="rp-empty">{emptyText}</div>
		{:else}
			<div class="rp-list">
				{#each visibleRules as rule (rule.id)}
					<div class="rp-row">
						<span class="rp-ico">
							<Icon name={(rule.icon ?? 'shield-check') as IconName} size={16} />
						</span>
						<div class="rp-info">
							<div class="rp-name">{rule.name}</div>
							<div class="rp-meta">
								<span class="rp-cat">{rule.category}</span>
								{#if rule.meta}
									<span> · {rule.meta}</span>
								{/if}
							</div>
						</div>
						<span class="rp-tag {rule.action}">{rule.action}</span>
					</div>
				{/each}
			</div>
		{/if}
	</div>

	{#if footer}
		<div class="rp-foot">
			{@render footer()}
		</div>
	{:else if onAddRule !== undefined}
		<div class="rp-foot">
			<span>{visibleRules.length} rule{visibleRules.length === 1 ? '' : 's'}</span>
			<button type="button" class="rp-add-btn" onclick={onAddRule}>
				<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
					<path d="M12 5v14M5 12h14" />
				</svg>
				New rule
			</button>
		</div>
	{/if}
</div>

<style>
	.rulepanel {
		border: 1px solid var(--border);
		border-radius: 12px;
		background: var(--bg-elev);
		overflow: hidden;
		width: 100%;
	}

	.rp-head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 16px;
		padding: 15px 20px;
		border-bottom: 1px solid var(--border);
		flex-wrap: wrap;
	}

	.rp-title {
		font-family: var(--mono);
		font-size: 12px;
		letter-spacing: 0.25em;
		text-transform: uppercase;
		color: var(--fg-muted);
	}

	.rp-blocking-pill {
		font-family: var(--mono);
		font-size: 10px;
		letter-spacing: 0.1em;
		color: var(--palette-red);
		border: 1px solid rgba(251, 113, 133, 0.4);
		border-radius: 20px;
		padding: 3px 10px;
	}

	/* Attached segment filter tabs */
	.rp-seg {
		display: inline-flex;
		border: 1px solid var(--border);
		border-radius: 5px;
		overflow: hidden;
	}

	.rp-seg-btn {
		all: unset;
		display: inline-flex;
		align-items: center;
		gap: 6px;
		padding: 4px 11px;
		font-family: var(--mono);
		font-size: 0.65rem;
		font-weight: 600;
		letter-spacing: 0.08em;
		color: var(--fg-dim);
		cursor: pointer;
		border-right: 1px solid var(--border);
		transition: background 0.12s ease, color 0.12s ease;
	}

	.rp-seg-btn:last-child {
		border-right: none;
	}

	.rp-seg-btn:hover:not(.active) {
		background: rgba(255, 255, 255, 0.05);
		color: var(--fg-muted);
	}

	.rp-seg-btn.active {
		background: var(--accent-faint);
		color: var(--accent);
	}

	.rp-cnt {
		font-size: 10px;
		background: var(--surface-raised);
		padding: 1px 6px;
		border-radius: 10px;
		color: var(--fg-dim);
	}

	/* Body */
	.rp-body {
		min-height: 130px;
	}

	.rp-empty {
		display: flex;
		align-items: center;
		justify-content: center;
		min-height: 130px;
		padding: 28px 16px;
		font-family: var(--mono);
		font-size: 13px;
		letter-spacing: 0.04em;
		color: var(--fg-dim);
		text-align: center;
	}

	.rp-list {
		display: flex;
		flex-direction: column;
	}

	.rp-row {
		display: flex;
		align-items: center;
		gap: 14px;
		padding: 14px 20px;
		border-top: 1px solid var(--border);
		transition: background 0.12s ease;
	}

	.rp-row:first-child {
		border-top: none;
	}

	.rp-row:hover {
		background: var(--surface-raised);
	}

	.rp-ico {
		width: 32px;
		height: 32px;
		border-radius: 7px;
		display: flex;
		align-items: center;
		justify-content: center;
		border: 1px solid var(--border-strong);
		background: var(--accent-faint);
		color: var(--accent);
		flex-shrink: 0;
	}

	.rp-info {
		flex: 1;
		min-width: 0;
	}

	.rp-name {
		font-family: var(--mono);
		font-size: 13px;
		color: var(--fg);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.rp-meta {
		font-family: var(--mono);
		font-size: 10px;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		color: var(--fg-dim);
		margin-top: 3px;
	}

	.rp-cat {
		color: var(--accent);
	}

	/* Action tags */
	.rp-tag {
		font-family: var(--mono);
		font-size: 9px;
		letter-spacing: 0.14em;
		text-transform: uppercase;
		padding: 4px 9px;
		border-radius: 5px;
		border: 1px solid;
		flex-shrink: 0;
	}

	.rp-tag.allow {
		color: var(--palette-emerald);
		border-color: rgba(52, 211, 153, 0.4);
	}

	.rp-tag.block {
		color: var(--palette-red);
		border-color: rgba(251, 113, 133, 0.4);
	}

	.rp-tag.warn {
		color: var(--palette-amber);
		border-color: rgba(252, 211, 77, 0.4);
	}

	/* Footer */
	.rp-foot {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 12px 20px;
		border-top: 1px solid var(--border);
		font-family: var(--mono);
		font-size: 11px;
		letter-spacing: 0.08em;
		color: var(--fg-dim);
	}

	.rp-add-btn {
		all: unset;
		display: inline-flex;
		align-items: center;
		gap: 5px;
		font-family: var(--mono);
		font-size: 10px;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		color: var(--fg-dim);
		cursor: pointer;
		padding: 4px 10px;
		border: 1px solid var(--border);
		border-radius: 5px;
		transition: color 0.12s ease, border-color 0.12s ease, background 0.12s ease;
	}

	.rp-add-btn:hover {
		color: var(--accent);
		border-color: var(--accent);
		background: var(--accent-faint);
	}
</style>
