<script lang="ts">
	import { Panel, Chip } from 'showcase';
	import type { Erd } from './api';

	let { erd }: { erd: Erd } = $props();

	// Group tables by subject area — the same grouping the Go side derives, so
	// what you see here matches `dbmgr erd` output.
	const grouped = $derived.by(() => {
		const by = new Map<string, typeof erd.tables>();
		for (const t of erd.tables) {
			const key = t.group ?? 'other';
			const list = by.get(key) ?? [];
			list.push(t);
			by.set(key, list);
		}
		return [...by.entries()].sort((a, b) => a[0].localeCompare(b[0]));
	});

	const label = (key: string) => erd.groups?.[key]?.label ?? key;
</script>

{#each grouped as [key, tables] (key)}
	<Panel title={`${label(key)} · ${tables.length}`}>
		<ul>
			{#each tables as t (t.name)}
				<li>
					<span class="name">{t.name}</span>
					<span class="cols">{t.columns.length} cols</span>
					{#if t.approxRows}<Chip color="default" look="ghost">~{t.approxRows}</Chip>{/if}
				</li>
			{/each}
		</ul>
	</Panel>
{/each}

<style>
	ul {
		list-style: none;
		margin: 0;
		padding: 0;
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
		gap: 4px 16px;
	}

	li {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 3px 0;
		font-size: 0.82rem;
	}

	.name {
		font-family: var(--mono);
		color: var(--fg);
	}

	.cols {
		color: var(--fg-muted);
		font-size: 0.72rem;
		margin-left: auto;
	}
</style>
