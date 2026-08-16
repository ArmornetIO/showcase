<script lang="ts" module>
	export type FileTreeNode = {
		name: string;
		path: string;
		depth: number;
		is_dir: boolean;
		expanded?: boolean;
	};
</script>

<script lang="ts">
	import type { Snippet } from 'svelte';

	interface FileTreeProps {
		nodes: FileTreeNode[];
		/** Currently selected path — highlights the row with the accent left border. */
		selectedPath?: string | null;
		/** Called when the user clicks a row. */
		onselect?: (path: string) => void;
		/** Called when the user clicks a directory expand/collapse toggle. */
		ontoggle?: (path: string) => void;
		/** Optional snippet rendered on the right side of each row. Receives the node. */
		trailing?: Snippet<[FileTreeNode]>;
		/** Per-node CSS class string (applied alongside internal row classes). */
		rowclass?: (node: FileTreeNode) => string;
		/** Per-node inline style string (replaces default style). */
		rowstyle?: (node: FileTreeNode) => string;
	}

	let {
		nodes,
		selectedPath = null,
		onselect,
		ontoggle,
		trailing,
		rowclass,
		rowstyle
	}: FileTreeProps = $props();

	const collapsedDirs = $derived(
		new Set(nodes.filter((n) => n.is_dir && !n.expanded).map((n) => n.path))
	);

	const visible = $derived(
		nodes.filter((node) => {
			for (const dir of collapsedDirs) {
				if (node.path !== dir && node.path.startsWith(dir + '/')) return false;
			}
			return true;
		})
	);
</script>

<div class="ft-root" role="tree">
	{#each visible as node (node.path)}
		<div
			class="ft-row {rowclass?.(node) ?? ''}"
			class:ft-selected={selectedPath === node.path}
			style={rowstyle?.(node)}
			role="treeitem"
			tabindex="0"
			aria-selected={selectedPath === node.path}
			aria-expanded={node.is_dir ? node.expanded : undefined}
			onclick={() => onselect?.(node.path)}
			onkeydown={(e) => e.key === 'Enter' && onselect?.(node.path)}
		>
			<span class="ft-indent" style:width="{node.depth * 18}px" aria-hidden="true"></span>

			{#if node.is_dir}
				<button
					class="ft-toggle"
					tabindex="-1"
					aria-label={node.expanded ? 'Collapse directory' : 'Expand directory'}
					onclick={(e) => {
						e.stopPropagation();
						ontoggle?.(node.path);
					}}
				>
					{node.expanded ? '▾' : '▸'}
				</button>
				<span class="ft-icon ft-icon-dir" aria-hidden="true">
					<svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
						<path
							d="M10 4H4c-1.11 0-2 .89-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z"
						/>
					</svg>
				</span>
			{:else}
				<span class="ft-toggle-gap" aria-hidden="true"></span>
				<span class="ft-icon ft-icon-file" aria-hidden="true">
					<svg width="11" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
						<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
						<polyline points="14 2 14 8 20 8" />
					</svg>
				</span>
			{/if}

			<span class="ft-name" class:ft-name-dir={node.is_dir}>{node.name}</span>

			{#if trailing}
				<span class="ft-trailing" aria-hidden="true">
					{@render trailing(node)}
				</span>
			{/if}
		</div>
	{/each}
</div>

<style>
	.ft-root {
		display: flex;
		flex-direction: column;
	}

	.ft-row {
		display: flex;
		align-items: center;
		gap: 4px;
		padding: 3px 12px 3px 8px;
		border: none;
		border-left: 2px solid transparent;
		background: transparent;
		color: var(--fg);
		cursor: pointer;
		text-align: left;
		transition:
			background 0.08s,
			border-left-color 0.15s,
			opacity 0.15s;
		min-width: 0;
		width: 100%;
	}

	.ft-row:hover {
		background: var(--surface-raised);
	}

	.ft-selected {
		background: var(--surface-strong) !important;
		border-left-color: var(--accent) !important;
	}

	.ft-indent {
		flex-shrink: 0;
		display: block;
	}

	.ft-toggle {
		width: 14px;
		flex-shrink: 0;
		background: none;
		border: none;
		color: var(--fg-dim);
		cursor: pointer;
		font-size: 10px;
		padding: 0;
		line-height: 1;
	}

	.ft-toggle-gap {
		width: 14px;
		flex-shrink: 0;
	}

	.ft-icon {
		flex-shrink: 0;
		display: flex;
		align-items: center;
	}

	.ft-icon-dir {
		color: #f59e0b;
	}

	.ft-icon-file {
		color: var(--fg-dim);
	}

	.ft-name {
		font-size: 12px;
		font-family: var(--mono);
		flex: 1;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		min-width: 0;
	}

	.ft-name-dir {
		font-weight: 500;
	}

	.ft-trailing {
		display: flex;
		align-items: center;
		gap: 4px;
		flex-shrink: 0;
		margin-left: auto;
	}
</style>
