<script module lang="ts">
	export interface BreadcrumbItem {
		label: string;
		/** null or undefined = current page (no link rendered) */
		href?: string | null;
	}
</script>

<script lang="ts">
	let { items }: { items: BreadcrumbItem[] } = $props();
</script>

<nav class="doc-breadcrumbs" aria-label="Breadcrumb">
	{#each items as item, i}
		{#if i > 0}<span class="doc-bc-sep" aria-hidden="true">/</span>{/if}
		{#if item.href}
			<a href={item.href} class="doc-bc-item">{item.label}</a>
		{:else}
			<span class="doc-bc-item doc-bc-current" aria-current="page">{item.label}</span>
		{/if}
	{/each}
</nav>

<style>
	.doc-breadcrumbs {
		display: flex;
		align-items: center;
		gap: 0.35rem;
		margin-bottom: 1rem;
		font-family: var(--mono);
		font-size: 0.72rem;
		color: var(--fg-dim);
		letter-spacing: 0.05em;
	}
	.doc-bc-sep {
		opacity: 0.4;
	}
	.doc-bc-item {
		color: var(--fg-muted);
		text-decoration: none;
		transition: color 0.12s;
	}
	.doc-bc-item:hover {
		color: var(--accent);
	}
	.doc-bc-current {
		color: var(--fg);
	}
</style>
