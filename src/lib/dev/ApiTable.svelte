<script lang="ts">
	import apiDict from '$lib/generated/api.json' with { type: 'json' };

	interface PropEntry {
		name: string;
		type: string;
		optional: boolean;
		default?: string;
		description?: string;
	}

	interface FieldEntry {
		name: string;
		type: string;
		optional: boolean;
		description?: string;
	}

	interface InterfaceEntry {
		name: string;
		fields: FieldEntry[];
	}

	export interface ApiMeta {
		component: string;
		props: PropEntry[];
		interfaces: InterfaceEntry[];
	}

	let { component, meta: metaProp }: { component?: string; meta?: ApiMeta } = $props();

	const meta = $derived(
		metaProp ?? (component ? (apiDict as Record<string, ApiMeta>)[component] : undefined)
	);
</script>

{#if meta}
	{#if meta.props.length}
		<div class="api-section">{meta.component} props</div>
		<table class="api-table">
			<thead><tr><th>Prop</th><th>Type</th><th>Default</th><th>Description</th></tr></thead>
			<tbody>
				{#each meta.props as prop}
					<tr>
						<td class="col-name">{prop.name}</td>
						<td class="col-type">{prop.type}</td>
						<td class="col-default">{prop.default ?? (prop.optional ? '—' : '(required)')}</td>
						<td class="col-desc">{prop.description ?? ''}</td>
					</tr>
				{/each}
			</tbody>
		</table>
	{/if}

	{#each meta.interfaces as iface}
		<div class="api-section">{iface.name}</div>
		<table class="api-table">
			<thead><tr><th>Field</th><th>Type</th><th>Description</th></tr></thead>
			<tbody>
				{#each iface.fields as field}
					<tr>
						<td class="col-name">{field.name}{field.optional ? '?' : ''}</td>
						<td class="col-type">{field.type}</td>
						<td class="col-desc">{field.description ?? ''}</td>
					</tr>
				{/each}
			</tbody>
		</table>
	{/each}
{/if}

<style>
	.api-section {
		font-family: var(--mono);
		font-size: 0.65rem;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		color: var(--fg-dim);
		padding-top: 0.5rem;
		border-top: 1px solid var(--border);
	}

	.api-table {
		width: 100%;
		border-collapse: collapse;
		font-family: var(--mono);
		font-size: 0.72rem;
	}

	.api-table th {
		text-align: left;
		padding: 5px 8px;
		color: var(--fg-dim);
		border-bottom: 1px solid var(--border);
		font-weight: 600;
		font-size: 0.65rem;
		letter-spacing: 0.06em;
	}

	.api-table td {
		padding: 5px 8px;
		color: var(--fg-muted);
		border-bottom: 1px solid var(--border);
		vertical-align: top;
	}

	.api-table tr:last-child td { border-bottom: none; }

	.col-name    { color: var(--accent); }
	.col-type    { color: var(--fg-muted); white-space: nowrap; }
	.col-default { color: var(--fg-dim); }
</style>
