<script lang="ts">
	import { Panel, Tabs, Chip, EmptyState, type Tab } from 'showcase';
	import TableList from './TableList.svelte';
	import Ledger from './Ledger.svelte';
	import Captures from './Captures.svelte';
	import { api, type Erd, type EventRow, type Capture } from './api';

	// One fetch per view, on first visit. The console is a read-only window onto
	// a live database — everything that mutates schema is a CLI verb, because a
	// browser is the wrong place to trigger an apply.
	let active = $state('schema');
	const tabs: Tab[] = [
		{ id: 'schema', label: 'Schema' },
		{ id: 'ledger', label: 'Ledger' },
		{ id: 'captures', label: 'Captures' }
	];

	let erd = $state<Erd | null>(null);
	let events = $state<EventRow[]>([]);
	let captures = $state<Capture[]>([]);
	let error = $state('');
	let loading = $state(true);

	async function load() {
		loading = true;
		error = '';
		try {
			const [e, ev, c] = await Promise.all([
				api.erd(),
				api.events(),
				api.captures()
			]);
			erd = e;
			events = ev;
			captures = c;
		} catch (err) {
			error = err instanceof Error ? err.message : String(err);
		} finally {
			loading = false;
		}
	}

	$effect(() => {
		void load();
	});

	const tableCount = $derived(erd?.tables?.length ?? 0);
	const fkCount = $derived(erd?.foreignKeys?.length ?? 0);
</script>

<div class="console">
	<header>
		<h1>dbmgr</h1>
		<div class="meta">
			{#if erd}
				<Chip color="accent" look="ghost">{tableCount} tables</Chip>
				<Chip color="blue" look="ghost">{fkCount} foreign keys</Chip>
			{/if}
			<button class="reload" onclick={() => void load()} disabled={loading}>
				{loading ? 'loading…' : 'reload'}
			</button>
		</div>
	</header>

	{#if error}
		<Panel title="Not connected" tone="accent">
			<p class="err">{error}</p>
			<p class="hint">
				Start the console with a database: <code>dbmgr ui --db-url postgres://…</code>
			</p>
		</Panel>
	{:else}
		<Tabs {tabs} bind:active />

		{#if active === 'schema'}
			{#if erd}
				<TableList {erd} />
			{:else if !loading}
				<EmptyState message="No schema introspected" />
			{/if}
		{:else if active === 'ledger'}
			<Ledger {events} {loading} />
		{:else}
			<Captures {captures} {loading} />
		{/if}
	{/if}
</div>

<style>
	.console {
		max-width: 1100px;
		margin: 0 auto;
		padding: 24px 20px 48px;
		display: flex;
		flex-direction: column;
		gap: 16px;
	}

	header {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: 16px;
		flex-wrap: wrap;
	}

	h1 {
		margin: 0;
		font-family: var(--mono);
		font-size: 1.1rem;
		letter-spacing: 0.14em;
		text-transform: uppercase;
		color: var(--accent);
	}

	.meta {
		display: flex;
		align-items: center;
		gap: 8px;
	}

	.reload {
		font-family: var(--mono);
		font-size: 0.7rem;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		padding: 4px 10px;
		border: 1px solid var(--border);
		border-radius: 3px;
		background: transparent;
		color: var(--fg-muted);
		cursor: pointer;
	}

	.reload:hover:not(:disabled) {
		border-color: var(--border-accent);
		color: var(--accent);
	}

	.reload:disabled {
		opacity: 0.5;
		cursor: default;
	}

	.err {
		font-family: var(--mono);
		font-size: 0.8rem;
		margin: 0 0 8px;
	}

	.hint {
		font-size: 0.8rem;
		color: var(--fg-muted);
		margin: 0;
	}

	code {
		font-family: var(--mono);
		background: var(--bg-elev);
		padding: 1px 5px;
		border-radius: 3px;
	}
</style>
