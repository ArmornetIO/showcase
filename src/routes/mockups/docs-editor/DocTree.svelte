<script lang="ts">
	// Left rail: the corpus binding, then its documents.
	//
	// The rows are `FileTree` rather than a hand-rolled list — it already owns
	// depth indentation, folder collapse and selection, and its `trailing`
	// snippet is exactly the hook this needs for the per-document state pips.
	// What is specific to us is only what hangs off the right edge of a row: how
	// many clauses claim a control and prove nothing, and how much of the proof
	// has aged past its cadence. Those two numbers are the whole reason a
	// compliance lead opens this tree rather than the repo.

	import { Icon, SearchInput, StatusDot, Tooltip } from 'showcase';
	// FileTree isn't re-exported from the library index, so it comes in by path.
	import FileTree from '$lib/display/content/FileTree.svelte';
	import type { FileTreeNode } from '$lib/display/content/FileTree.svelte';
	import type { Corpus, GitState, TreeNode } from './data.js';
	import { SYNC } from './looks.js';

	interface Props {
		corpus: Corpus;
		git: GitState;
		nodes: TreeNode[];
		selected_id: string;
		onselect: (id: string) => void;
	}

	let { corpus, git, nodes, selected_id, onselect }: Props = $props();

	let query = $state('');

	const by_id = $derived(new Map(nodes.map((n) => [n.id, n])));

	// Filter documents, but keep a folder only while it still has children.
	const visible = $derived.by(() => {
		const q = query.trim().toLowerCase();
		if (!q) return nodes;
		const kept: TreeNode[] = [];
		for (let i = 0; i < nodes.length; i++) {
			const n = nodes[i];
			if (n.kind !== 'folder') {
				if (`${n.title} ${n.filename}`.toLowerCase().includes(q)) kept.push(n);
				continue;
			}
			const rest = nodes.slice(i + 1);
			const stop = rest.findIndex((m) => m.kind === 'folder');
			const scope = stop === -1 ? rest : rest.slice(0, stop);
			if (scope.some((m) => `${m.title} ${m.filename}`.toLowerCase().includes(q))) kept.push(n);
		}
		return kept;
	});

	// A document is known by its TITLE in a compliance conversation and by its
	// FILENAME in a git one. The tree leads with the title and keeps the file
	// name as the second line, so neither audience has to translate.
	const ft_nodes = $derived<FileTreeNode[]>(
		visible.map((n) => ({
			name: n.kind === 'folder' ? n.title : n.title,
			path: n.id,
			depth: n.depth,
			is_dir: n.kind === 'folder',
			expanded: true
		}))
	);
</script>

<div class="flex h-full min-h-0 flex-col bg-[var(--bg-elev)]">
	<!-- Git state, above the documents it describes. Every row below is "as of"
	     this commit, so the branch and sha belong here rather than in a global
	     bar where they read as decoration. -->
	<div class="px-3 py-2.5 border-b border-[var(--border)]">
		<div class="flex items-center gap-2">
			<Icon name="git-branch" size={13} style="color: var(--accent)" />
			<span class="truncate font-mono text-[0.72rem] font-semibold text-[var(--fg)]">
				{git.branch}
			</span>
			<code class="font-mono text-[0.6rem] text-[var(--fg-muted)]">{git.head_sha}</code>
			<span class="flex-1"></span>
			<Tooltip content="Webhook {git.webhook_state} · synced {corpus.last_sync}" placement="bottom">
				<StatusDot status={corpus.sync_health} />
			</Tooltip>
		</div>
		<div class="mt-1 truncate font-mono text-[0.55rem] text-[var(--fg-dim)]">
			{git.message}
		</div>
		<div class="mt-0.5 truncate font-mono text-[0.55rem] text-[var(--fg-dim)]">
			{git.author_handle} · {git.committed_at}
		</div>
	</div>

	<div class="px-3 py-2 border-b border-[var(--border)]">
		<SearchInput bind:value={query} placeholder="Find a document…" />
	</div>

	<nav class="min-h-0 flex-1 overflow-y-auto py-1.5">
		<FileTree
			nodes={ft_nodes}
			selectedPath={selected_id}
			onselect={(path) => onselect(path)}
			rowstyle={(n) => {
				const d = by_id.get(n.path);
				return d?.sync_state ? `--row-mark: ${SYNC[d.sync_state].color}` : '';
			}}
		>
			{#snippet trailing(node)}
				{@const d = by_id.get(node.path)}
				{#if d && !node.is_dir}
					<span class="flex items-center gap-1.5">
						{#if d.gap_count}
							<Tooltip
								content="{d.gap_count} clause{d.gap_count === 1 ? '' : 's'} claim a control and cite nothing"
								placement="right"
							>
								<span
									class="flex items-center gap-0.5 px-1 rounded font-mono text-[0.55rem] font-semibold"
									style:color="#fbbf24"
									style:background="color-mix(in srgb, #fbbf24 14%, transparent)"
								>
									<Icon name="alert-triangle" size={9} />
									{d.gap_count}
								</span>
							</Tooltip>
						{/if}
						{#if d.stale_count}
							<Tooltip content="{d.stale_count} citations past cadence" placement="right">
								<span
									class="flex items-center gap-0.5 px-1 rounded font-mono text-[0.55rem] font-semibold"
									style:color="#fca5a5"
									style:background="color-mix(in srgb, #fca5a5 12%, transparent)"
								>
									<Icon name="clock" size={9} />
									{d.stale_count}
								</span>
							</Tooltip>
						{/if}
						{#if d.sync_state && !d.gap_count && !d.stale_count}
							<Tooltip content={SYNC[d.sync_state].label} placement="right">
								<span
									class="block w-1.5 h-1.5 rounded-full"
									style:background={SYNC[d.sync_state].color}
								></span>
							</Tooltip>
						{/if}
					</span>
				{/if}
			{/snippet}
		</FileTree>
	</nav>

	<div
		class="flex items-center justify-between gap-2 px-3 py-2 border-t border-[var(--border)]
		       font-mono text-[0.55rem] text-[var(--fg-dim)]"
	>
		<span>{corpus.doc_count} documents</span>
		<span class="truncate">{corpus.repo}{corpus.subtree}</span>
	</div>
</div>
