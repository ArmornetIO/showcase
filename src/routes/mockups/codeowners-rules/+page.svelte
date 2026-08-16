<script lang="ts">
	// CODEOWNERS Rules Pipeline — rule-first UX mockup
	//
	// Primary interaction: build an ordered list of CODEOWNERS rules (the pipeline).
	// The tree shows what the hovered/selected rule matches, live.
	// Click an owner chip to filter the pipeline + highlight tree coverage.
	//
	// Key semantic: last matching rule wins (GitHub CODEOWNERS). Rule order matters.
	//
	// API stubs (shapes):
	//   GET  /api/repos/:id/codeowners/rules  → Rule[]
	//   PUT  /api/repos/:id/codeowners/rules  → Rule[] (full replace, preserves order)
	//   GET  /api/orgs/:id/github/teams       → GitHubTeam[]
	//   POST /api/repos/:id/codeowners/preview → { matched_files: string[] } (dry-run)

	import FileTree, { type FileTreeNode } from '$lib/display/FileTree.svelte';
	import Button from '$lib/primitives/Button.svelte';
	import EmptyState from '$lib/primitives/EmptyState.svelte';
	import ActionsMenu, { type ActionMenuItem } from '$lib/primitives/ActionsMenu.svelte';

	type Owner = {
		id: string;
		handle: string;
		type: 'team' | 'user';
		color: string;
		initials: string;
	};

	type Rule = {
		id: string;
		pattern: string;
		owner_ids: string[];
		match_count: number;
	};

	type MatchNode = FileTreeNode & {
		matched_by_rule: string | null;
		all_rules: string[];
	};

	const OWNERS: Owner[] = [
		{ id: 'security', handle: '@org/security', type: 'team', color: '#ef4444', initials: 'SE' },
		{ id: 'frontend', handle: '@org/frontend', type: 'team', color: '#3b82f6', initials: 'FE' },
		{ id: 'backend', handle: '@org/backend', type: 'team', color: '#22c55e', initials: 'BE' },
		{ id: 'devops', handle: '@org/devops', type: 'team', color: '#a855f7', initials: 'DO' },
		{ id: 'alice', handle: '@alice', type: 'user', color: '#f59e0b', initials: 'AL' },
		{ id: 'bob', handle: '@bob', type: 'user', color: '#06b6d4', initials: 'BO' }
	];

	const ownerById = Object.fromEntries(OWNERS.map((o) => [o.id, o]));

	let rules = $state<Rule[]>([
		{ id: 'r1', pattern: '*', owner_ids: ['alice'], match_count: 16 },
		{ id: 'r2', pattern: '/.github/**', owner_ids: ['security', 'devops'], match_count: 4 },
		{ id: 'r3', pattern: '/infrastructure/**', owner_ids: ['devops', 'security'], match_count: 3 },
		{ id: 'r4', pattern: '/src/api/**', owner_ids: ['backend'], match_count: 3 },
		{ id: 'r5', pattern: '/src/components/**', owner_ids: ['frontend'], match_count: 3 },
		{ id: 'r6', pattern: '/src/routes/**', owner_ids: ['frontend'], match_count: 2 },
		{ id: 'r7', pattern: '/Makefile', owner_ids: ['devops'], match_count: 1 }
	]);

	let nodes = $state<MatchNode[]>([
		{ name: '.github', path: '/.github', depth: 0, is_dir: true, expanded: true, matched_by_rule: 'r2', all_rules: ['r1', 'r2'] },
		{ name: 'workflows', path: '/.github/workflows', depth: 1, is_dir: true, expanded: true, matched_by_rule: 'r2', all_rules: ['r1', 'r2'] },
		{ name: 'ci.yml', path: '/.github/workflows/ci.yml', depth: 2, is_dir: false, matched_by_rule: 'r2', all_rules: ['r1', 'r2'] },
		{ name: 'deploy.yml', path: '/.github/workflows/deploy.yml', depth: 2, is_dir: false, matched_by_rule: 'r2', all_rules: ['r1', 'r2'] },
		{ name: 'release.yml', path: '/.github/workflows/release.yml', depth: 2, is_dir: false, matched_by_rule: 'r2', all_rules: ['r1', 'r2'] },
		{ name: 'CODEOWNERS', path: '/.github/CODEOWNERS', depth: 1, is_dir: false, matched_by_rule: 'r2', all_rules: ['r1', 'r2'] },
		{ name: 'src', path: '/src', depth: 0, is_dir: true, expanded: true, matched_by_rule: 'r1', all_rules: ['r1'] },
		{ name: 'api', path: '/src/api', depth: 1, is_dir: true, expanded: true, matched_by_rule: 'r4', all_rules: ['r1', 'r4'] },
		{ name: 'auth.ts', path: '/src/api/auth.ts', depth: 2, is_dir: false, matched_by_rule: 'r4', all_rules: ['r1', 'r4'] },
		{ name: 'users.ts', path: '/src/api/users.ts', depth: 2, is_dir: false, matched_by_rule: 'r4', all_rules: ['r1', 'r4'] },
		{ name: 'middleware.ts', path: '/src/api/middleware.ts', depth: 2, is_dir: false, matched_by_rule: 'r4', all_rules: ['r1', 'r4'] },
		{ name: 'components', path: '/src/components', depth: 1, is_dir: true, expanded: true, matched_by_rule: 'r5', all_rules: ['r1', 'r5'] },
		{ name: 'Button.svelte', path: '/src/components/Button.svelte', depth: 2, is_dir: false, matched_by_rule: 'r5', all_rules: ['r1', 'r5'] },
		{ name: 'Modal.svelte', path: '/src/components/Modal.svelte', depth: 2, is_dir: false, matched_by_rule: 'r5', all_rules: ['r1', 'r5'] },
		{ name: 'DataTable.svelte', path: '/src/components/DataTable.svelte', depth: 2, is_dir: false, matched_by_rule: 'r5', all_rules: ['r1', 'r5'] },
		{ name: 'lib', path: '/src/lib', depth: 1, is_dir: true, expanded: false, matched_by_rule: 'r1', all_rules: ['r1'] },
		{ name: 'routes', path: '/src/routes', depth: 1, is_dir: true, expanded: true, matched_by_rule: 'r6', all_rules: ['r1', 'r6'] },
		{ name: 'dashboard', path: '/src/routes/dashboard', depth: 2, is_dir: true, expanded: false, matched_by_rule: 'r6', all_rules: ['r1', 'r6'] },
		{ name: 'settings', path: '/src/routes/settings', depth: 2, is_dir: true, expanded: false, matched_by_rule: 'r6', all_rules: ['r1', 'r6'] },
		{ name: 'infrastructure', path: '/infrastructure', depth: 0, is_dir: true, expanded: true, matched_by_rule: 'r3', all_rules: ['r1', 'r3'] },
		{ name: 'helm', path: '/infrastructure/helm', depth: 1, is_dir: true, expanded: false, matched_by_rule: 'r3', all_rules: ['r1', 'r3'] },
		{ name: 'terraform', path: '/infrastructure/terraform', depth: 1, is_dir: true, expanded: false, matched_by_rule: 'r3', all_rules: ['r1', 'r3'] },
		{ name: 'docs', path: '/docs', depth: 0, is_dir: true, expanded: false, matched_by_rule: 'r1', all_rules: ['r1'] },
		{ name: 'package.json', path: '/package.json', depth: 0, is_dir: false, matched_by_rule: 'r1', all_rules: ['r1'] },
		{ name: 'README.md', path: '/README.md', depth: 0, is_dir: false, matched_by_rule: 'r1', all_rules: ['r1'] },
		{ name: 'Makefile', path: '/Makefile', depth: 0, is_dir: false, matched_by_rule: 'r7', all_rules: ['r1', 'r7'] }
	]);

	let selectedRuleId = $state<string | null>('r2');
	let hoveredRuleId = $state<string | null>(null);
	let focusedOwner = $state<string | null>(null);
	let editingRuleId = $state<string | null>(null);

	const activeRuleId = $derived(hoveredRuleId ?? selectedRuleId);

	const visibleRules = $derived(
		focusedOwner ? rules.filter((r) => r.owner_ids.includes(focusedOwner!)) : rules
	);

	function ruleColor(rule: Rule): string {
		return ownerById[rule.owner_ids[0]]?.color ?? 'var(--accent)';
	}

	function ruleIndex(id: string): number {
		return rules.findIndex((r) => r.id === id);
	}

	function moveUp(id: string) {
		const idx = rules.findIndex((r) => r.id === id);
		if (idx <= 0) return;
		const copy = [...rules];
		[copy[idx - 1], copy[idx]] = [copy[idx], copy[idx - 1]];
		rules = copy;
	}

	function moveDown(id: string) {
		const idx = rules.findIndex((r) => r.id === id);
		if (idx < 0 || idx >= rules.length - 1) return;
		const copy = [...rules];
		[copy[idx], copy[idx + 1]] = [copy[idx + 1], copy[idx]];
		rules = copy;
	}

	function deleteRule(id: string) {
		rules = rules.filter((r) => r.id !== id);
		if (selectedRuleId === id) selectedRuleId = null;
	}

	function ruleActions(rule: Rule): ActionMenuItem[] {
		const idx = ruleIndex(rule.id);
		return [
			{ label: 'Move up', icon: 'chevron-up', disabled: idx === 0, onclick: () => moveUp(rule.id) },
			{ label: 'Move down', icon: 'chevron-down', disabled: idx === rules.length - 1, onclick: () => moveDown(rule.id) },
			{ label: 'Delete rule', icon: 'trash-2', destructive: true, onclick: () => deleteRule(rule.id) }
		];
	}

	function nodeState(node: MatchNode): 'match' | 'partial' | 'dim' | 'normal' {
		if (focusedOwner) {
			const winRule = rules.find((r) => r.id === node.matched_by_rule);
			if (winRule?.owner_ids.includes(focusedOwner)) return 'match';
			if (node.all_rules.some((rid) => rules.find((r) => r.id === rid)?.owner_ids.includes(focusedOwner!)))
				return 'partial';
			return 'dim';
		}
		if (activeRuleId) {
			if (node.matched_by_rule === activeRuleId) return 'match';
			if (node.all_rules.includes(activeRuleId)) return 'partial';
			return 'dim';
		}
		return 'normal';
	}

	function rowstyle(node: FileTreeNode): string {
		const mn = node as MatchNode;
		const state = nodeState(mn);
		const winRule = rules.find((r) => r.id === mn.matched_by_rule);
		if (state === 'match' && winRule) {
			return `border-left-width:3px;border-left-color:${ruleColor(winRule)};background:var(--surface)`;
		}
		if (state === 'partial') return 'opacity:0.45';
		if (state === 'dim') return 'opacity:0.18';
		return '';
	}

	function toggleNode(path: string) {
		const n = nodes.find((x) => x.path === path);
		if (n) n.expanded = !n.expanded;
	}

	const codeowners = $derived(
		[
			'# Generated by Armornet CODEOWNERS Builder',
			'# Rules are evaluated in order — last match wins.',
			'',
			...rules.map(
				(r) => `${r.pattern} ${r.owner_ids.map((id) => ownerById[id]?.handle ?? id).join(' ')}`
			)
		].join('\n')
	);

	function copyOutput() {
		navigator.clipboard?.writeText(codeowners);
	}

	const activeRule = $derived(rules.find((r) => r.id === activeRuleId) ?? null);
</script>

<div class="page">
	<header class="co-header">
		<div class="co-header-left">
			<span class="repo-badge">
				<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22"/></svg>
				armornet / armornet
			</span>
			<h1 class="co-title">CODEOWNERS Builder</h1>
			<span class="mode-badge">Pipeline view</span>
			<span class="semantics-note">last match wins</span>
		</div>
		<div class="co-header-right">
			<Button variant="ghost" size="sm">Import existing</Button>
			<Button variant="primary" size="sm">Export CODEOWNERS</Button>
		</div>
	</header>

	<div class="co-layout">
		<!-- LEFT: Rule pipeline -->
		<aside class="co-pipeline">
			<!-- Owner filter -->
			<div class="owner-filter-bar">
				<button
					class="filter-chip"
					class:filter-active={!focusedOwner}
					onclick={() => (focusedOwner = null)}
				>All</button>
				{#each OWNERS as owner}
					<button
						class="filter-chip"
						class:filter-active={focusedOwner === owner.id}
						style={focusedOwner === owner.id
							? `background:${owner.color}22;border-color:${owner.color};color:${owner.color}`
							: ''}
						onclick={() => (focusedOwner = focusedOwner === owner.id ? null : owner.id)}
						title={owner.handle}
					>
						<span class="filter-dot" style="background:{owner.color}"></span>
						{owner.initials}
					</button>
				{/each}
			</div>

			<!-- Rules -->
			<div class="rules-list">
				{#each visibleRules as rule}
					{@const idx = ruleIndex(rule.id)}
					{@const isSelected = selectedRuleId === rule.id}
					<div
						class="rule-card"
						class:rule-selected={isSelected}
						style={isSelected ? `border-left-color:${ruleColor(rule)}` : ''}
						role="button"
						tabindex="0"
						onmouseenter={() => (hoveredRuleId = rule.id)}
						onmouseleave={() => (hoveredRuleId = null)}
						onclick={() => (selectedRuleId = isSelected ? null : rule.id)}
						onkeydown={(e) => e.key === 'Enter' && (selectedRuleId = isSelected ? null : rule.id)}
					>
						<span class="rule-num">{idx + 1}</span>

						<div class="rule-body">
							{#if editingRuleId === rule.id}
								<input
									class="rule-pattern-input"
									value={rule.pattern}
									oninput={(e) => (rule.pattern = (e.target as HTMLInputElement).value)}
									onblur={() => (editingRuleId = null)}
									onclick={(e) => e.stopPropagation()}
								/>
							{:else}
								<button
									class="rule-pattern"
									onclick={(e) => { e.stopPropagation(); editingRuleId = rule.id; }}
									title="Click to edit pattern"
								>{rule.pattern}</button>
							{/if}

							<div class="rule-owner-chips">
								{#each rule.owner_ids as oid}
									{@const owner = ownerById[oid]}
									{#if owner}
										<span
											class="rule-owner-chip"
											style="background:{owner.color}20;color:{owner.color};border-color:{owner.color}50"
										>
											<span class="chip-dot" style="background:{owner.color}"></span>
											{owner.handle}
										</span>
									{/if}
								{/each}
							</div>
						</div>

						<div class="rule-meta">
							<span class="rule-match-count" style="color:{ruleColor(rule)}">{rule.match_count}</span>
							<span class="rule-match-label">files</span>
						</div>

						<div onclick={(e) => e.stopPropagation()} role="none">
							<ActionsMenu items={ruleActions(rule)} placement="bottom-end" />
						</div>

						{#if rule.id === 'r1'}
							<div class="catch-all-note">catch-all · applies to everything not matched below</div>
						{/if}
					</div>
				{/each}

				{#if focusedOwner && visibleRules.length === 0}
					<EmptyState
						message="No rules for {ownerById[focusedOwner]?.handle}"
						sub="Add a rule or clear the filter"
					/>
				{/if}
			</div>

			<button class="add-rule-btn">
				<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
					<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
				</svg>
				Add rule
			</button>
		</aside>

		<!-- RIGHT: Tree + output -->
		<div class="co-right">
			<div class="co-tree-panel">
				<div class="tree-hint-bar">
					{#if activeRule}
						<span class="hint-dot" style="background:{ruleColor(activeRule)}"></span>
						<span class="hint-pattern">{activeRule.pattern}</span>
						<span class="hint-sub">— {activeRule.match_count} files matched</span>
					{:else if focusedOwner}
						<span class="hint-dot" style="background:{ownerById[focusedOwner]?.color}"></span>
						<span class="hint-pattern">{ownerById[focusedOwner]?.handle}</span>
						<span class="hint-sub">— showing coverage</span>
					{:else}
						<span class="hint-idle">Hover a rule or click an owner to highlight coverage</span>
					{/if}
				</div>

				<div class="tree-scroll">
					<FileTree
						{nodes}
						ontoggle={toggleNode}
						{rowstyle}
					>
						{#snippet trailing(node)}
							{@const mn = node as MatchNode}
							{@const winRule = rules.find((r) => r.id === mn.matched_by_rule)}
							{#if winRule && nodeState(mn) === 'match'}
								<span class="tree-rule-badge" style="color:{ruleColor(winRule)};background:{ruleColor(winRule)}18">
									Rule {ruleIndex(winRule.id) + 1}
								</span>
							{/if}
							<span class="tree-owner-dots">
								{#each (winRule?.owner_ids ?? []).slice(0, 3) as oid}
									<span class="tree-owner-dot" style="background:{ownerById[oid]?.color}" title={ownerById[oid]?.handle}></span>
								{/each}
							</span>
						{/snippet}
					</FileTree>
				</div>
			</div>

			<div class="co-output-panel">
				<div class="output-header">
					<span class="output-label">CODEOWNERS</span>
					<div class="output-actions">
						<button class="copy-btn" onclick={copyOutput}>Copy</button>
						<Button variant="ghost" size="sm">Download</Button>
					</div>
				</div>
				<pre class="codeowners-output">{codeowners}</pre>
			</div>
		</div>
	</div>
</div>

<style>
	.page {
		display: flex;
		flex-direction: column;
		height: 100vh;
		background: var(--bg);
		color: var(--fg);
		font-size: 13px;
	}

	/* Header */
	.co-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 10px 16px;
		border-bottom: 1px solid var(--border);
		flex-shrink: 0;
		gap: 12px;
	}
	.co-header-left {
		display: flex;
		align-items: center;
		gap: 10px;
	}
	.co-header-right {
		display: flex;
		align-items: center;
		gap: 8px;
	}
	.repo-badge {
		display: flex;
		align-items: center;
		gap: 5px;
		color: var(--fg-3);
		font-size: 12px;
	}
	.co-title {
		font-size: 14px;
		font-weight: 600;
		margin: 0;
	}
	.mode-badge {
		font-size: 11px;
		padding: 2px 7px;
		background: var(--surface-2);
		border-radius: 99px;
		color: var(--fg-2);
		border: 1px solid var(--border);
	}
	.semantics-note {
		font-size: 11px;
		color: var(--fg-3);
		padding: 2px 7px;
		border: 1px dashed var(--border);
		border-radius: 4px;
	}

	/* Layout */
	.co-layout {
		display: flex;
		flex: 1;
		overflow: hidden;
	}

	/* Pipeline */
	.co-pipeline {
		width: 320px;
		border-right: 1px solid var(--border);
		display: flex;
		flex-direction: column;
		overflow: hidden;
		flex-shrink: 0;
	}

	.owner-filter-bar {
		display: flex;
		align-items: center;
		gap: 4px;
		padding: 8px 10px;
		border-bottom: 1px solid var(--border);
		overflow-x: auto;
		flex-shrink: 0;
	}
	.filter-chip {
		display: flex;
		align-items: center;
		gap: 4px;
		padding: 3px 8px;
		border-radius: 99px;
		border: 1px solid var(--border);
		background: transparent;
		color: var(--fg-2);
		cursor: pointer;
		font-size: 11px;
		white-space: nowrap;
		transition: all 0.12s;
	}
	.filter-chip:hover { background: var(--surface-2); }
	.filter-active {
		background: var(--surface-2);
		color: var(--fg);
		border-color: var(--fg-3);
	}
	.filter-dot {
		width: 7px;
		height: 7px;
		border-radius: 50%;
		flex-shrink: 0;
	}

	.rules-list {
		flex: 1;
		overflow-y: auto;
		padding: 8px 8px 4px;
		display: flex;
		flex-direction: column;
		gap: 4px;
	}

	.rule-card {
		position: relative;
		background: var(--surface);
		border: 1px solid var(--border);
		border-left: 3px solid transparent;
		border-radius: 8px;
		cursor: pointer;
		transition: border-color 0.12s, background 0.08s;
		display: flex;
		align-items: flex-start;
		gap: 8px;
		padding: 10px 8px 10px 10px;
		flex-wrap: wrap;
	}
	.rule-card:hover { background: var(--surface-2); }
	.rule-selected { background: var(--surface-2); }

	.rule-num {
		font-size: 10px;
		font-weight: 700;
		color: var(--fg-3);
		font-family: var(--mono, monospace);
		min-width: 16px;
		padding-top: 2px;
		flex-shrink: 0;
	}
	.rule-body {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
		gap: 7px;
	}
	.rule-pattern {
		font-family: var(--mono, monospace);
		font-size: 13px;
		font-weight: 500;
		background: none;
		border: none;
		color: var(--fg);
		cursor: text;
		padding: 0;
		text-align: left;
		width: 100%;
	}
	.rule-pattern-input {
		font-family: var(--mono, monospace);
		font-size: 13px;
		font-weight: 500;
		background: var(--bg);
		border: 1px solid var(--accent);
		border-radius: 4px;
		color: var(--fg);
		padding: 2px 6px;
		width: 100%;
		outline: none;
	}
	.rule-owner-chips {
		display: flex;
		flex-wrap: wrap;
		gap: 4px;
	}
	.rule-owner-chip {
		display: inline-flex;
		align-items: center;
		gap: 4px;
		font-size: 10px;
		font-family: var(--mono, monospace);
		padding: 2px 7px;
		border-radius: 99px;
		border: 1px solid;
	}
	.chip-dot {
		width: 6px;
		height: 6px;
		border-radius: 50%;
		flex-shrink: 0;
	}
	.rule-meta {
		display: flex;
		flex-direction: column;
		align-items: flex-end;
		gap: 1px;
		flex-shrink: 0;
	}
	.rule-match-count {
		font-size: 13px;
		font-weight: 700;
	}
	.rule-match-label {
		font-size: 9px;
		color: var(--fg-3);
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}
	.catch-all-note {
		width: 100%;
		font-size: 10px;
		color: var(--fg-3);
		padding: 6px 0 0 24px;
		border-top: 1px solid var(--border);
		margin-top: 2px;
	}

	.add-rule-btn {
		display: flex;
		align-items: center;
		gap: 6px;
		margin: 0 8px 10px;
		padding: 8px 12px;
		border: 1px dashed var(--border);
		border-radius: 8px;
		background: transparent;
		color: var(--accent);
		cursor: pointer;
		font-size: 12px;
		transition: background 0.1s;
		flex-shrink: 0;
	}
	.add-rule-btn:hover { background: var(--surface); }

	/* Right panel */
	.co-right {
		flex: 1;
		display: flex;
		flex-direction: column;
		overflow: hidden;
		min-width: 0;
	}

	.co-tree-panel {
		flex: 1;
		display: flex;
		flex-direction: column;
		overflow: hidden;
		border-bottom: 1px solid var(--border);
	}
	.tree-hint-bar {
		display: flex;
		align-items: center;
		gap: 7px;
		padding: 8px 14px;
		border-bottom: 1px solid var(--border);
		flex-shrink: 0;
		min-height: 37px;
		font-size: 12px;
	}
	.hint-dot {
		width: 8px;
		height: 8px;
		border-radius: 50%;
		flex-shrink: 0;
	}
	.hint-pattern {
		font-family: var(--mono, monospace);
		font-weight: 500;
		color: var(--fg);
	}
	.hint-sub { color: var(--fg-3); }
	.hint-idle { color: var(--fg-3); }

	.tree-scroll {
		flex: 1;
		overflow-y: auto;
		padding: 6px 0;
	}

	/* Tree trailing content */
	.tree-rule-badge {
		font-size: 10px;
		font-weight: 600;
		padding: 1px 6px;
		border-radius: 4px;
		white-space: nowrap;
	}
	.tree-owner-dots {
		display: flex;
		gap: 3px;
	}
	.tree-owner-dot {
		width: 9px;
		height: 9px;
		border-radius: 50%;
	}

	/* Output panel */
	.co-output-panel {
		height: 180px;
		flex-shrink: 0;
		display: flex;
		flex-direction: column;
		overflow: hidden;
	}
	.output-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 8px 14px;
		border-bottom: 1px solid var(--border);
		flex-shrink: 0;
	}
	.output-label {
		font-size: 11px;
		font-weight: 600;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		color: var(--fg-3);
	}
	.output-actions {
		display: flex;
		align-items: center;
		gap: 6px;
	}
	.copy-btn {
		font-size: 11px;
		color: var(--fg-3);
		background: var(--surface-2);
		border: 1px solid var(--border);
		border-radius: 4px;
		padding: 2px 8px;
		cursor: pointer;
	}
	.copy-btn:hover { color: var(--fg); }
	.codeowners-output {
		font-size: 11px;
		font-family: var(--mono, monospace);
		line-height: 1.6;
		color: var(--fg-2);
		background: var(--surface);
		padding: 10px 14px;
		overflow: auto;
		flex: 1;
		margin: 0;
		white-space: pre;
	}
</style>
