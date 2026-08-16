<script lang="ts">
	import { Panel, EmptyState, Chip, type ChipColor } from 'showcase';
	import type { EventRow } from './api';

	let { events, loading }: { events: EventRow[]; loading: boolean } = $props();

	// The ledger is append-only, so the interesting end is the most recent.
	const rows = $derived([...events].reverse());

	const tone = (event: string): ChipColor =>
		event.includes('fail') ? 'error' : event.includes('revert') ? 'warn' : 'accent';
</script>

<Panel title="Migration events">
	{#if rows.length === 0 && !loading}
		<EmptyState message="No migration events recorded" />
	{:else}
		<table>
			<thead>
				<tr><th>seq</th><th>event</th><th>migration</th><th>actor</th></tr>
			</thead>
			<tbody>
				{#each rows as e (e.sequence + e.event + (e.at ?? ''))}
					<tr>
						<td class="seq">{String(e.sequence).padStart(4, '0')}</td>
						<td><Chip color={tone(e.event)} look="ghost">{e.event}</Chip></td>
						<td class="name">{e.name}</td>
						<td class="actor">{e.actor}</td>
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

	.seq,
	.name {
		font-family: var(--mono);
	}

	.actor {
		color: var(--fg-muted);
	}
</style>
