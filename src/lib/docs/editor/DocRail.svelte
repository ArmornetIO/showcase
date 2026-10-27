<script lang="ts">
	// Left rail of a repo-backed document editor: the git state, then the documents
	// it describes. Every row is "as of" that commit, so branch and sha sit above the
	// tree rather than in a global bar where they read as decoration.
	import type { Snippet } from 'svelte';
	import Icon from '../../icons/Icon.svelte';
	import type { IconName } from '../../icons/Icon.svelte';
	import StatusDot from '../../primitives/status/StatusDot.svelte';
	import type { StatusLevel } from '../../primitives/status/StatusDot.svelte';
	import Tooltip from '../../primitives/status/Tooltip.svelte';
	import SearchInput from '../../primitives/forms/SearchInput.svelte';
	import FileTree from '../../display/content/FileTree.svelte';
	import type { FileTreeNode } from '../../display/content/FileTree.svelte';

	interface Props {
		nodes: FileTreeNode[];
		selectedPath?: string | null;
		onselect: (path: string) => void;
		ontoggle?: (path: string) => void;
		query?: string;
		/**
		 * Branch or ref the tree is read at — or, for a source that is not git, its
		 * name. Omit when the host's page header already states it.
		 */
		ref?: string;
		icon?: IconName;
		sha?: string;
		/** Links the sha to its commit on the upstream forge. */
		shaHref?: string;
		status?: StatusLevel;
		statusTip?: string;
		/** Quiet lines under the ref — last commit message, author, sync time. */
		lines?: string[];
		/** Beside the status dot — a sync button, say. */
		action?: Snippet;
		/** Above the git state — a repository picker, when there is more than one. */
		header?: Snippet;
		/** Right edge of each document row. */
		trailing?: Snippet<[FileTreeNode]>;
		/** False when the host's page header owns search. */
		searchable?: boolean;
		footer?: [string, string?];
		placeholder?: string;
	}

	let {
		nodes,
		selectedPath = null,
		onselect,
		ontoggle,
		query = $bindable(''),
		ref,
		icon = 'git-branch',
		sha,
		shaHref,
		status,
		statusTip,
		lines = [],
		action,
		header,
		trailing,
		searchable = true,
		footer,
		placeholder = 'Find a document…'
	}: Props = $props();

	const META = 'line-clamp-2 font-(family-name:--mono) text-[0.55rem] text-[var(--fg-dim)]';
</script>

<div class="flex h-full min-h-0 flex-col bg-[var(--bg-elev)]">
	{#if ref || header}
	<div class="border-b border-[var(--border)] px-3 py-2.5">
		{#if header}<div class={ref || sha || status || action ? 'mb-2' : ''}>{@render header()}</div>{/if}
		{#if ref || sha || status || action}
		<div class="flex items-center gap-2" class:px-1={!ref}>
			{#if ref}
				<Icon name={icon} size={13} style="color: var(--accent)" />
				<span
					class="truncate font-(family-name:--mono) text-[0.72rem] font-semibold text-[var(--fg)]"
					>{ref}</span
				>
			{/if}
			{#if sha}
				{#if shaHref}
					<a
						href={shaHref}
						target="_blank"
						rel="noopener noreferrer"
						class="font-(family-name:--mono) text-[0.6rem] text-[var(--fg-muted)] hover:text-[var(--accent)] hover:underline"
						>{sha}</a
					>
				{:else}
					<code class="font-(family-name:--mono) text-[0.6rem] text-[var(--fg-muted)]">{sha}</code>
				{/if}
			{/if}
			{#if !ref}
				<!-- The picker above already names the repo; the quiet lines ride
				     inline so the whole git state is one row. -->
				{#each lines as l, i (i)}
					<span class="truncate font-(family-name:--mono) text-[0.55rem] text-[var(--fg-dim)]"
						>{l}{i < lines.length - 1 ? ' ·' : ''}</span
					>
				{/each}
			{/if}
			<span class="flex-1"></span>
			{#if action}{@render action()}{/if}
			{#if status}
				<Tooltip content={statusTip ?? status} placement="bottom">
					<StatusDot {status} />
				</Tooltip>
			{/if}
		</div>
		{/if}
		{#if ref}
			{#each lines as l, i (i)}
				<div class="{i === 0 ? 'mt-1' : 'mt-0.5'} {META} leading-[1.5]">{l}</div>
			{/each}
		{/if}
	</div>
	{/if}

	{#if searchable}
		<div class="border-b border-[var(--border)] px-3 py-2">
			<SearchInput bind:value={query} {placeholder} />
		</div>
	{/if}

	<nav class="min-h-0 flex-1 overflow-y-auto py-1.5">
		<FileTree {nodes} {selectedPath} {onselect} {ontoggle} {trailing} />
	</nav>

	{#if footer}
		<div
			class="flex items-center justify-between gap-2 border-t border-[var(--border)] px-3 py-2 font-(family-name:--mono) text-[0.55rem] text-[var(--fg-dim)]"
		>
			<span>{footer[0]}</span>
			{#if footer[1]}<span class="truncate">{footer[1]}</span>{/if}
		</div>
	{/if}
</div>
