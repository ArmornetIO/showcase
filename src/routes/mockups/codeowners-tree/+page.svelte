<script lang="ts">
	// CODEOWNERS Tree Builder — tree-first UX mockup
	//
	// Interaction model: browse the repo tree → click a path → assign owners.
	// Click an owner in the left panel to highlight their full coverage across the tree.
	//
	// API stubs (shapes):
	//   GET  /api/repos/:id/tree              → TreeNode[]
	//   GET  /api/repos/:id/codeowners/rules  → Rule[]
	//   GET  /api/orgs/:id/github/teams       → GitHubTeam[]
	//   POST /api/repos/:id/codeowners        → { content: string }

	import Avatar from '$lib/display/Avatar.svelte';
	import FileTree, { type FileTreeNode } from '$lib/display/FileTree.svelte';
	import ProgressBar from '$lib/display/progress/ProgressBar.svelte';
	import Button from '$lib/primitives/Button.svelte';
	import Chip from '$lib/primitives/Chip.svelte';
	import Combobox from '$lib/primitives/Combobox.svelte';
	import EmptyState from '$lib/primitives/EmptyState.svelte';
	import SearchInput from '$lib/primitives/SearchInput.svelte';

	type Owner = {
		id: string;
		handle: string;
		type: 'team' | 'user';
		color: string;
		initials: string;
	};

	type TreeNode = FileTreeNode & {
		owners: string[];
		has_explicit_rule: boolean;
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
	const handleToId = Object.fromEntries(OWNERS.map((o) => [o.handle, o.id]));

	let nodes = $state<TreeNode[]>([
		{ name: '.github', path: '/.github', depth: 0, is_dir: true, expanded: true, owners: ['security', 'devops'], has_explicit_rule: true },
		{ name: 'workflows', path: '/.github/workflows', depth: 1, is_dir: true, expanded: true, owners: ['security', 'devops'], has_explicit_rule: false },
		{ name: 'ci.yml', path: '/.github/workflows/ci.yml', depth: 2, is_dir: false, owners: ['security', 'devops'], has_explicit_rule: false },
		{ name: 'deploy.yml', path: '/.github/workflows/deploy.yml', depth: 2, is_dir: false, owners: ['security', 'devops'], has_explicit_rule: false },
		{ name: 'release.yml', path: '/.github/workflows/release.yml', depth: 2, is_dir: false, owners: ['security', 'devops'], has_explicit_rule: false },
		{ name: 'CODEOWNERS', path: '/.github/CODEOWNERS', depth: 1, is_dir: false, owners: ['security', 'devops'], has_explicit_rule: false },
		{ name: 'src', path: '/src', depth: 0, is_dir: true, expanded: true, owners: ['alice'], has_explicit_rule: false },
		{ name: 'api', path: '/src/api', depth: 1, is_dir: true, expanded: true, owners: ['backend'], has_explicit_rule: true },
		{ name: 'auth.ts', path: '/src/api/auth.ts', depth: 2, is_dir: false, owners: ['backend'], has_explicit_rule: false },
		{ name: 'users.ts', path: '/src/api/users.ts', depth: 2, is_dir: false, owners: ['backend'], has_explicit_rule: false },
		{ name: 'middleware.ts', path: '/src/api/middleware.ts', depth: 2, is_dir: false, owners: ['backend'], has_explicit_rule: false },
		{ name: 'components', path: '/src/components', depth: 1, is_dir: true, expanded: true, owners: ['frontend'], has_explicit_rule: true },
		{ name: 'Button.svelte', path: '/src/components/Button.svelte', depth: 2, is_dir: false, owners: ['frontend'], has_explicit_rule: false },
		{ name: 'Modal.svelte', path: '/src/components/Modal.svelte', depth: 2, is_dir: false, owners: ['frontend'], has_explicit_rule: false },
		{ name: 'DataTable.svelte', path: '/src/components/DataTable.svelte', depth: 2, is_dir: false, owners: ['frontend'], has_explicit_rule: false },
		{ name: 'lib', path: '/src/lib', depth: 1, is_dir: true, expanded: false, owners: ['alice'], has_explicit_rule: false },
		{ name: 'routes', path: '/src/routes', depth: 1, is_dir: true, expanded: true, owners: ['frontend'], has_explicit_rule: true },
		{ name: 'dashboard', path: '/src/routes/dashboard', depth: 2, is_dir: true, expanded: false, owners: ['frontend'], has_explicit_rule: false },
		{ name: 'settings', path: '/src/routes/settings', depth: 2, is_dir: true, expanded: false, owners: ['frontend'], has_explicit_rule: false },
		{ name: 'infrastructure', path: '/infrastructure', depth: 0, is_dir: true, expanded: true, owners: ['devops', 'security'], has_explicit_rule: true },
		{ name: 'helm', path: '/infrastructure/helm', depth: 1, is_dir: true, expanded: false, owners: ['devops', 'security'], has_explicit_rule: false },
		{ name: 'terraform', path: '/infrastructure/terraform', depth: 1, is_dir: true, expanded: false, owners: ['devops', 'security'], has_explicit_rule: false },
		{ name: 'docs', path: '/docs', depth: 0, is_dir: true, expanded: false, owners: ['alice'], has_explicit_rule: false },
		{ name: 'package.json', path: '/package.json', depth: 0, is_dir: false, owners: ['alice'], has_explicit_rule: false },
		{ name: 'README.md', path: '/README.md', depth: 0, is_dir: false, owners: ['alice'], has_explicit_rule: false },
		{ name: 'Makefile', path: '/Makefile', depth: 0, is_dir: false, owners: ['devops'], has_explicit_rule: false }
	]);

	let focusedOwner = $state<string | null>(null);
	let selectedPath = $state<string | null>('/src/api');
	let search = $state('');

	const selectedNode = $derived(nodes.find((n) => n.path === selectedPath) ?? null);
	const fileNodes = $derived(nodes.filter((n) => !n.is_dir));
	const totalFiles = $derived(fileNodes.length);

	const ownerStats = $derived(
		OWNERS.map((owner) => ({
			...owner,
			count: fileNodes.filter((n) => n.owners.includes(owner.id)).length
		}))
	);

	const coveredCount = $derived(fileNodes.filter((n) => n.owners.length > 0).length);
	const coverage = $derived(Math.round((coveredCount / totalFiles) * 100));

	// Filter tree by search, then pass full list to FileTree (it handles collapse)
	const treeNodes = $derived(
		search
			? nodes.filter((n) => n.name.toLowerCase().includes(search.toLowerCase()))
			: nodes
	);

	const codeowners = $derived(
		[
			'# Generated by Armornet CODEOWNERS Builder',
			'',
			'* @alice',
			'/.github/** @org/security @org/devops',
			'/infrastructure/** @org/devops @org/security',
			'/Makefile @org/devops',
			'/src/api/** @org/backend',
			'/src/components/** @org/frontend',
			'/src/routes/** @org/frontend'
		].join('\n')
	);

	function nodeHighlight(node: TreeNode): 'highlight' | 'dim' | 'normal' {
		if (!focusedOwner) return 'normal';
		return node.owners.includes(focusedOwner) ? 'highlight' : 'dim';
	}

	function rowstyle(node: FileTreeNode): string {
		const tn = node as TreeNode;
		const state = nodeHighlight(tn);
		if (state === 'highlight' && focusedOwner) {
			return `border-left-width:3px;border-left-color:${ownerById[focusedOwner]?.color}`;
		}
		if (state === 'dim') return 'opacity:0.22';
		return '';
	}

	function toggleNode(path: string) {
		const n = nodes.find((x) => x.path === path);
		if (n) n.expanded = !n.expanded;
	}

	// Combobox binds to owner handles; derive back to IDs on change
	const selectedOwnerHandles = $derived(
		selectedNode?.owners.map((id) => ownerById[id]?.handle ?? id) ?? []
	);

	function onOwnersChange(handles: string[]) {
		if (!selectedNode) return;
		selectedNode.owners = handles.map((h) => handleToId[h] ?? h);
	}

	function copyOutput() {
		navigator.clipboard?.writeText(codeowners);
	}

	const teams = $derived(ownerStats.filter((o) => o.type === 'team'));
	const individuals = $derived(ownerStats.filter((o) => o.type === 'user'));
</script>

<div class="page">
	<header class="co-header">
		<div class="co-header-left">
			<span class="repo-badge">
				<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22"/></svg>
				armornet / armornet
			</span>
			<h1 class="co-title">CODEOWNERS Builder</h1>
			<span class="mode-badge">Tree view</span>
		</div>
		<div class="co-header-right">
			<Button variant="ghost" size="sm">Import existing</Button>
			<Button variant="primary" size="sm">Export CODEOWNERS</Button>
		</div>
	</header>

	<div class="co-layout">
		<!-- LEFT: Owner roster -->
		<aside class="co-sidebar">
			<div class="sidebar-section">
				<p class="sidebar-label">Teams</p>
				{#each teams as owner}
					<button
						class="owner-row"
						class:owner-focused={focusedOwner === owner.id}
						onclick={() => (focusedOwner = focusedOwner === owner.id ? null : owner.id)}
					>
						<span class="owner-dot" style="background:{owner.color}"></span>
						<span class="owner-name">{owner.handle}</span>
						<span class="owner-count" style="color:{owner.color}">{owner.count}</span>
					</button>
				{/each}
			</div>

			<div class="sidebar-section">
				<p class="sidebar-label">Individuals</p>
				{#each individuals as owner}
					<button
						class="owner-row"
						class:owner-focused={focusedOwner === owner.id}
						onclick={() => (focusedOwner = focusedOwner === owner.id ? null : owner.id)}
					>
						<span class="owner-dot" style="background:{owner.color}"></span>
						<span class="owner-name">{owner.handle}</span>
						<span class="owner-count" style="color:{owner.color}">{owner.count}</span>
					</button>
				{/each}
			</div>

			{#if focusedOwner}
				<div
					class="focus-banner"
					style="border-color:{ownerById[focusedOwner]?.color};background:{ownerById[focusedOwner]?.color}18"
				>
					<span class="focus-dot" style="background:{ownerById[focusedOwner]?.color}"></span>
					<span class="focus-text">
						{ownerById[focusedOwner]?.handle}<br />
						<small>{ownerStats.find((o) => o.id === focusedOwner)?.count} files</small>
					</span>
					<button class="focus-clear" onclick={() => (focusedOwner = null)}>×</button>
				</div>
			{/if}

			<div class="coverage-block">
				<div class="coverage-row">
					<span class="coverage-label">Coverage</span>
					<span class="coverage-pct" class:ok={coverage >= 80} class:warn={coverage < 80}>
						{coverage}%
					</span>
				</div>
				<ProgressBar
					value={coveredCount}
					max={totalFiles}
					variant={coverage >= 80 ? 'success' : 'warn'}
					size="sm"
					animate
				/>
				<p class="coverage-sub">{coveredCount} / {totalFiles} files covered</p>
			</div>
		</aside>

		<!-- MIDDLE: File tree -->
		<main class="co-tree-panel">
			<div class="tree-toolbar">
				<SearchInput bind:value={search} placeholder="Filter paths…" />
				<button class="expand-all" onclick={() => nodes.forEach((n) => { if (n.is_dir) n.expanded = true; })}>
					Expand all
				</button>
			</div>

			<div class="tree-scroll">
				<FileTree
					nodes={treeNodes}
					{selectedPath}
					onselect={(path) => (selectedPath = path)}
					ontoggle={toggleNode}
					{rowstyle}
				>
					{#snippet trailing(node)}
						{@const tn = node as TreeNode}
						{#if tn.has_explicit_rule}
							<span class="rule-pip" title="Has explicit CODEOWNERS rule">●</span>
						{/if}
						<span class="owner-dots">
							{#each tn.owners.slice(0, 4) as oid}
								<span
									class="owner-pip"
									style="background:{ownerById[oid]?.color}"
									class:pip-focused={focusedOwner === oid}
									title={ownerById[oid]?.handle}
								></span>
							{/each}
							{#if tn.owners.length === 0}
								<span class="unowned-pip" title="No owner assigned">!</span>
							{/if}
						</span>
					{/snippet}
				</FileTree>
			</div>
		</main>

		<!-- RIGHT: Assignment + output -->
		<aside class="co-assign-panel">
			{#if selectedNode}
				<div class="assign-section">
					<p class="assign-label">Selected path</p>
					<p class="assign-path">{selectedNode.path}{selectedNode.is_dir ? '/**' : ''}</p>
					{#if selectedNode.has_explicit_rule}
						<Chip look="filled" color="accent">explicit rule</Chip>
					{:else}
						<Chip color="default">inherited</Chip>
					{/if}
				</div>

				<div class="assign-section">
					<p class="assign-label">Owners</p>
					{#if selectedNode.owners.length > 0}
						<div class="assign-owner-list">
							{#each selectedNode.owners as oid}
								{@const owner = ownerById[oid]}
								{#if owner}
									<div class="assign-owner-row">
										<Avatar initials={owner.initials} size={22} />
										<span class="assign-owner-name">{owner.handle}</span>
										<span class="assign-owner-type">{owner.type}</span>
									</div>
								{/if}
							{/each}
						</div>
					{/if}
					<Combobox
						value={selectedOwnerHandles}
						suggestions={OWNERS.map((o) => o.handle)}
						placeholder="Add owner…"
						onchange={onOwnersChange}
					/>
				</div>
			{:else}
				<EmptyState message="Click a path in the tree to assign owners." />
			{/if}

			<div class="output-section">
				<div class="output-header">
					<p class="assign-label">CODEOWNERS output</p>
					<button class="copy-btn" onclick={copyOutput}>Copy</button>
				</div>
				<pre class="codeowners-output">{codeowners}</pre>
			</div>
		</aside>
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

	/* Layout */
	.co-layout {
		display: flex;
		flex: 1;
		overflow: hidden;
	}

	/* Owner roster sidebar */
	.co-sidebar {
		width: 210px;
		border-right: 1px solid var(--border);
		overflow-y: auto;
		padding: 12px 10px;
		display: flex;
		flex-direction: column;
		gap: 4px;
		flex-shrink: 0;
	}
	.sidebar-section {
		margin-bottom: 12px;
	}
	.sidebar-label {
		font-size: 10px;
		font-weight: 600;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--fg-3);
		margin: 0 0 6px 0;
		padding: 0 4px;
	}
	.owner-row {
		display: flex;
		align-items: center;
		gap: 7px;
		width: 100%;
		padding: 5px 6px;
		border-radius: 6px;
		border: none;
		background: transparent;
		color: var(--fg);
		cursor: pointer;
		text-align: left;
		transition: background 0.1s;
	}
	.owner-row:hover {
		background: var(--surface-2);
	}
	.owner-focused {
		background: var(--surface-2);
	}
	.owner-dot {
		width: 9px;
		height: 9px;
		border-radius: 50%;
		flex-shrink: 0;
	}
	.owner-name {
		flex: 1;
		font-size: 12px;
		font-family: monospace;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.owner-count {
		font-size: 11px;
		font-weight: 600;
		min-width: 16px;
		text-align: right;
	}
	.focus-banner {
		display: flex;
		align-items: flex-start;
		gap: 8px;
		padding: 8px 10px;
		border-radius: 6px;
		border: 1px solid;
		margin: 4px 0 8px;
	}
	.focus-dot {
		width: 8px;
		height: 8px;
		border-radius: 50%;
		margin-top: 3px;
		flex-shrink: 0;
	}
	.focus-text {
		flex: 1;
		font-size: 11px;
		font-family: monospace;
		line-height: 1.5;
	}
	.focus-text small {
		color: var(--fg-3);
	}
	.focus-clear {
		background: none;
		border: none;
		color: var(--fg-3);
		cursor: pointer;
		font-size: 14px;
		line-height: 1;
		padding: 0;
	}
	.coverage-block {
		margin-top: auto;
		padding: 10px;
		border: 1px solid var(--border);
		border-radius: 8px;
		background: var(--surface);
	}
	.coverage-row {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 8px;
	}
	.coverage-label {
		font-size: 11px;
		color: var(--fg-2);
	}
	.coverage-pct {
		font-size: 14px;
		font-weight: 700;
	}
	.ok { color: #22c55e; }
	.warn { color: #f59e0b; }
	.coverage-sub {
		font-size: 11px;
		color: var(--fg-3);
		margin: 6px 0 0;
	}

	/* Tree panel */
	.co-tree-panel {
		flex: 1;
		display: flex;
		flex-direction: column;
		overflow: hidden;
	}
	.tree-toolbar {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 10px 12px;
		border-bottom: 1px solid var(--border);
		flex-shrink: 0;
	}
	.expand-all {
		font-size: 11px;
		color: var(--fg-3);
		background: none;
		border: none;
		cursor: pointer;
		white-space: nowrap;
		padding: 4px 8px;
		border-radius: 4px;
	}
	.expand-all:hover {
		background: var(--surface-2);
		color: var(--fg);
	}
	.tree-scroll {
		flex: 1;
		overflow-y: auto;
		padding: 6px 0;
	}

	/* Tree trailing content */
	.rule-pip {
		font-size: 8px;
		color: var(--accent);
	}
	.owner-dots {
		display: flex;
		gap: 3px;
		align-items: center;
	}
	.owner-pip {
		width: 10px;
		height: 10px;
		border-radius: 50%;
		display: block;
		transition: transform 0.15s, box-shadow 0.15s;
	}
	.pip-focused {
		transform: scale(1.5);
		box-shadow: 0 0 0 2px var(--bg);
	}
	.unowned-pip {
		font-size: 10px;
		color: #f59e0b;
		font-weight: 700;
	}

	/* Assignment panel */
	.co-assign-panel {
		width: 270px;
		border-left: 1px solid var(--border);
		overflow-y: auto;
		display: flex;
		flex-direction: column;
		flex-shrink: 0;
	}
	.assign-section {
		padding: 14px;
		border-bottom: 1px solid var(--border);
		display: flex;
		flex-direction: column;
		gap: 8px;
	}
	.assign-label {
		font-size: 10px;
		font-weight: 600;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--fg-3);
		margin: 0;
	}
	.assign-path {
		font-size: 12px;
		font-family: monospace;
		color: var(--fg);
		margin: 0;
		word-break: break-all;
	}
	.assign-owner-list {
		display: flex;
		flex-direction: column;
		gap: 6px;
	}
	.assign-owner-row {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 5px 8px;
		background: var(--surface);
		border-radius: 6px;
		border: 1px solid var(--border);
	}
	.assign-owner-name {
		flex: 1;
		font-size: 12px;
		font-family: monospace;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.assign-owner-type {
		font-size: 10px;
		color: var(--fg-3);
	}

	/* Output */
	.output-section {
		flex: 1;
		display: flex;
		flex-direction: column;
		padding: 14px;
		min-height: 0;
	}
	.output-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-bottom: 8px;
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
		font-family: monospace;
		line-height: 1.6;
		color: var(--fg-2);
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: 6px;
		padding: 10px 12px;
		overflow: auto;
		flex: 1;
		margin: 0;
		white-space: pre;
	}
</style>
