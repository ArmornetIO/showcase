<script lang="ts">
	import { Panel, EmptyState } from 'showcase';
	import type { Capture } from './api';

	let { captures, loading }: { captures: Capture[]; loading: boolean } = $props();
</script>

<Panel title="Schema captures">
	{#if captures.length === 0 && !loading}
		<EmptyState message="No captures taken" sub="Run `dbmgr capture create` to record one" />
	{:else}
		<table>
			<thead>
				<tr><th>id</th><th>label</th><th>schema</th><th>tables</th><th>by</th></tr>
			</thead>
			<tbody>
				{#each captures as c (c.id)}
					<tr>
						<td class="mono">{c.id}</td>
						<td>{c.label || '—'}</td>
						<td class="mono">{c.schemaName}</td>
						<td class="mono">{c.tableCount}</td>
						<td class="muted">{c.capturedBy || '—'}</td>
					</tr>
				{/each}
			</tbody>
		</table>
	{/if}
</Panel>

<style>
	table {
		width: 100%;
		border-collapse: collapse;
		font-size: 0.8rem;
	}

	th {
		text-align: left;
		font-family: var(--mono);
		font-size: 0.66rem;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		color: var(--fg-muted);
		padding-bottom: 6px;
		border-bottom: 1px solid var(--border);
	}

	td {
		padding: 5px 8px 5px 0;
		border-bottom: 1px solid var(--border-faint, rgba(148, 163, 184, 0.12));
	}

	.mono {
		font-family: var(--mono);
	}

	.muted {
		color: var(--fg-muted);
	}
</style>
