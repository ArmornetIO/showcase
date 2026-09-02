<script module lang="ts">
	export interface DocsAuthor {
		handle: string;
		name: string;
		commits: number;
	}

	export interface DocsApprover {
		handle: string;
		name: string;
		pr: number;
		date: string;
	}

	export interface DocsMeta {
		id?: string;
		title?: string;
		status?: string;
		updated?: string;
		authors?: DocsAuthor[];
		approvers?: DocsApprover[];
		[key: string]: unknown;
	}

	const STATUS_COLOR: Record<string, string> = {
		approved: 'var(--accent)',
		published: 'var(--accent)',
		draft: 'var(--fg-dim)',
		backlog: 'var(--fg-dim)',
		review: '#f0d59e',
		wip: '#f0d59e'
	};
</script>

<script lang="ts">
	let { meta }: { meta: DocsMeta } = $props();

	const statusColor = $derived(
		meta.status ? (STATUS_COLOR[meta.status] ?? 'var(--fg-muted)') : undefined
	);
</script>

<div class="doc-meta">
	<div class="doc-meta-row">
		{#if meta.id}
			<span class="doc-meta-id">{meta.id}</span>
		{/if}
		{#if meta.status}
			<span class="doc-meta-badge" style:color={statusColor}>
				{meta.status}
			</span>
		{/if}
		{#if meta.updated}
			<span class="doc-meta-updated">Updated {meta.updated}</span>
		{/if}
	</div>

	{#if meta.authors?.length}
		<div class="doc-meta-row doc-meta-people">
			<span class="doc-meta-label">Authors</span>
			{#each meta.authors as a}
				<span class="doc-meta-person" title={a.name}>@{a.handle}</span>
			{/each}
		</div>
	{/if}

	{#if meta.approvers?.length}
		<div class="doc-meta-row doc-meta-people">
			<span class="doc-meta-label">Approved by</span>
			{#each meta.approvers as a}
				<a
					href="https://github.com/{a.handle}/pull/{a.pr}"
					class="doc-meta-person doc-meta-approver"
					target="_blank"
					rel="noopener noreferrer"
					title="PR #{a.pr} · {a.date}"
				>@{a.handle}</a>
			{/each}
		</div>
	{/if}
</div>

<style>
	.doc-meta {
		display: flex;
		flex-direction: column;
		gap: 0.35rem;
		padding: 0.75rem 0 1.25rem;
		border-bottom: 1px solid var(--border);
		margin-bottom: 1.5rem;
	}
	.doc-meta-row {
		display: flex;
		align-items: center;
		gap: 0.6rem;
		flex-wrap: wrap;
	}
	.doc-meta-id {
		font-family: var(--mono);
		font-size: 0.72rem;
		color: var(--accent);
		letter-spacing: 0.08em;
	}
	.doc-meta-badge {
		font-family: var(--mono);
		font-size: 0.7rem;
		letter-spacing: 0.08em;
		text-transform: uppercase;
	}
	.doc-meta-updated {
		font-size: 0.8rem;
		color: var(--fg-dim);
		margin-left: auto;
	}
	.doc-meta-label {
		font-family: var(--mono);
		font-size: 0.68rem;
		color: var(--fg-dim);
		letter-spacing: 0.08em;
		text-transform: uppercase;
	}
	.doc-meta-person {
		font-family: var(--mono);
		font-size: 0.8rem;
		color: var(--fg-muted);
		text-decoration: none;
	}
	.doc-meta-approver {
		color: var(--accent);
	}
	.doc-meta-approver:hover {
		text-decoration: underline;
	}
</style>
