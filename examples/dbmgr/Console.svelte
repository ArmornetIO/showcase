<script lang="ts">
	// ─────────────────────────────────────────────────────────────────────────
	// dbmgr console — the front end `dbmgr ui` embeds and serves.
	//
	// Every view here is a showcase component; this file only fetches and wires.
	// That split is the point: the model explorer is a library surface, and the
	// binary ships whatever showcase ships rather than a second, drifting copy.
	//
	// Views load lazily, one request each on first visit, and fail
	// independently — a missing shadow database breaks Drift and Compare while
	// the diagram, which needs only introspection, still works.
	// ─────────────────────────────────────────────────────────────────────────
	import {
		Panel,
		Tabs,
		Chip,
		EmptyState,
		ErdDiagram,
		ErdOverviewView,
		ErdLedgerView,
		ErdCompareView,
		ErdEnvironmentsView,
		ErdCapturesView,
		defaultErdDiff,
		defaultDriftReport,
		defaultEnvironmentsReport,
		type Tab
	} from 'showcase';
	import {
		api,
		type Capabilities,
		type Erd,
		type LedgerEntry,
		type CaptureMeta,
		type DriftReport,
		type ErdDiff,
		type EnvironmentsReport
	} from './api';

	type ViewId = 'overview' | 'diagram' | 'ledger' | 'compare' | 'environments' | 'captures';

	let active = $state<ViewId>('overview');
	const tabs: Tab[] = [
		{ id: 'overview', label: 'Overview' },
		{ id: 'diagram', label: 'Diagram' },
		{ id: 'ledger', label: 'Ledger' },
		{ id: 'compare', label: 'Compare' },
		{ id: 'environments', label: 'Environments' },
		{ id: 'captures', label: 'Captures' }
	];

	let caps = $state<Capabilities | null>(null);
	let erd = $state<Erd | null>(null);
	let drift = $state<DriftReport>(defaultDriftReport());
	let ledger = $state<LedgerEntry[]>([]);
	let captures = $state<CaptureMeta[]>([]);
	let environments = $state<EnvironmentsReport>(defaultEnvironmentsReport());
	let diff = $state<ErdDiff>(defaultErdDiff());

	let cmpSource = $state('live');
	let cmpTarget = $state('ledger');

	// Per-view load state, so one broken endpoint does not blank the console.
	let busy = $state<Record<string, boolean>>({});
	let errors = $state<Record<string, string>>({});

	// Deliberately not $state: this is a guard against re-requesting, and making
	// it reactive would feed the effect that reads it back into itself.
	const requested = new Set<string>();

	async function load(key: string, run: () => Promise<void>) {
		busy = { ...busy, [key]: true };
		errors = { ...errors, [key]: '' };
		try {
			await run();
		} catch (err) {
			errors = { ...errors, [key]: err instanceof Error ? err.message : String(err) };
		} finally {
			busy = { ...busy, [key]: false };
		}
	}

	function fetcher(key: string): () => Promise<void> {
		switch (key) {
			case 'overview':
				return async () => {
					drift = await api.drift();
				};
			case 'diagram':
				return async () => {
					erd = await api.erd();
				};
			case 'ledger':
				return async () => {
					ledger = await api.status();
				};
			case 'environments':
				return async () => {
					environments = await api.environments();
				};
			case 'captures':
				return async () => {
					captures = await api.captures();
				};
			case 'compare':
				return async () => {
					diff = await api.compare(cmpSource, cmpTarget);
				};
			default:
				return async () => {};
		}
	}

	function ensure(key: string) {
		if (requested.has(key)) return;
		requested.add(key);
		void load(key, fetcher(key));
	}

	function reload(key: string) {
		requested.add(key);
		void load(key, fetcher(key));
	}

	function reloadAll() {
		requested.clear();
		caps = null;
		void load('caps', async () => {
			caps = await api.capabilities();
		});
		ensure(active);
	}

	$effect(() => {
		// The header counts come from the diagram's payload, so the schema is
		// fetched whichever view opens first.
		ensure('diagram');
	});

	$effect(() => {
		ensure(active);
	});

	$effect(() => {
		if (requested.has('caps')) return;
		requested.add('caps');
		void load('caps', async () => {
			caps = await api.capabilities();
		});
	});

	const tableCount = $derived(erd?.tables?.length ?? 0);
	const fkCount = $derived(erd?.foreignKeys?.length ?? 0);
	const anyBusy = $derived(Object.values(busy).some(Boolean));

	// Compare refs use the CLI's vocabulary so a comparison set up here can be
	// re-run on the command line verbatim.
	const compareSources = $derived([
		{ value: 'live', label: 'live' },
		...(caps?.shadow ? [{ value: 'ledger', label: 'ledger' }] : []),
		...(caps?.environments ?? []).map((n) => ({ value: `env:${n}`, label: `env:${n}` })),
		...captures.map((c) => ({ value: `capture:${c.id}`, label: `capture:${c.label}` }))
	]);

	/** Why a view is empty, when the server was started without what it needs. */
	function unavailable(view: ViewId): string {
		if (!caps) return '';
		if (!caps.database) return 'No database configured — start with --db-url or DATABASE_URL.';
		if ((view === 'overview' || view === 'compare') && !caps.shadow) {
			return 'No shadow database configured — drift and ledger comparison replay the migration corpus into a throwaway database. Start with --shadow-url or DBMGR_SHADOW_URL.';
		}
		if ((view === 'overview' || view === 'ledger' || view === 'environments') && !caps.registry) {
			return 'No migration corpus loaded — start with --migrations or DBMGR_MIGRATIONS.';
		}
		if (view === 'environments' && (caps.environments?.length ?? 0) === 0) {
			return 'No environments configured — set DBMGR_ENV_<NAME>=<url> for each.';
		}
		return '';
	}

	const blocked = $derived(unavailable(active));
	const viewError = $derived(errors[active] ?? '');
</script>

<div class="console">
	<header>
		<h1>dbmgr</h1>
		<div class="meta">
			{#if caps?.schema}
				<Chip color="default" look="ghost">{caps.schema}</Chip>
			{/if}
			{#if erd}
				<Chip color="accent" look="ghost">{tableCount} tables</Chip>
				<Chip color="blue" look="ghost">{fkCount} foreign keys</Chip>
			{/if}
			<button class="reload" onclick={reloadAll} disabled={anyBusy}>
				{anyBusy ? 'loading…' : 'reload'}
			</button>
		</div>
	</header>

	<Tabs {tabs} bind:active />

	{#if blocked}
		<Panel title="Not available" tone="accent">
			<p class="hint">{blocked}</p>
		</Panel>
	{:else if viewError}
		<Panel title="Request failed" tone="accent">
			<p class="err">{viewError}</p>
			<button class="reload" onclick={() => reload(active)}>retry</button>
		</Panel>
	{:else if busy[active]}
		<EmptyState message="Loading…" />
	{:else if active === 'overview'}
		<ErdOverviewView report={drift} />
	{:else if active === 'diagram'}
		{#if erd}
			<div class="stage">
				<ErdDiagram tables={erd.tables} foreignKeys={erd.foreignKeys} groups={erd.groups} />
			</div>
		{:else}
			<EmptyState message="No schema introspected" />
		{/if}
	{:else if active === 'ledger'}
		<ErdLedgerView entries={ledger} />
	{:else if active === 'compare'}
		<ErdCompareView
			{diff}
			sources={compareSources}
			bind:source={cmpSource}
			bind:target={cmpTarget}
			loading={busy.compare ?? false}
			onCompare={() => reload('compare')}
		/>
	{:else if active === 'environments'}
		<ErdEnvironmentsView report={environments} />
	{:else}
		<ErdCapturesView {captures} />
	{/if}
</div>

<style>
	.console {
		max-width: 1400px;
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

	/* The diagram is a camera over a canvas: it needs a bounded box to pan
	   inside, and inherits no height from a flex column. */
	.stage {
		height: min(78vh, 900px);
		min-height: 420px;
		position: relative;
		border: 1px solid var(--border);
		border-radius: 4px;
		overflow: hidden;
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
		line-height: 1.5;
	}
</style>
