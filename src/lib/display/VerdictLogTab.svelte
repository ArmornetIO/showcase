<script lang="ts">
	// A log of binary verdicts — each entry records that something was either
	// permitted or denied, and why. Presentational: the caller supplies the
	// tallies, the filter chips plus the active one, and the ALREADY-filtered
	// entry list. Filtering is the host's job because only it knows whether a
	// filter means a client-side predicate or a fresh query.

	export interface VerdictStats {
		total: number;
		denied: number;
		permitted: number;
	}

	export interface LogFilter {
		id: string;
		label: string;
	}

	export interface VerdictEntryVM {
		id: string;
		verdict: 'denied' | 'permitted';
		/** What produced the entry — rendered as a compact tag. */
		source: string;
		/** What the verdict was about. */
		target: string;
		/** Why it was denied. Shown only on denied entries in practice. */
		reason?: string;
		/** Pre-formatted display timestamp. */
		ts: string;
	}

	let {
		stats = { total: 0, denied: 0, permitted: 0 },
		filters = [],
		activeFilter = 'all',
		entries = [],
		totalLabel = 'total / 24h',
		deniedLabel = 'denied',
		permittedLabel = 'permitted',
		title = 'Recent entries',
		emptyText = 'Nothing recorded.',
		onfilter
	}: {
		stats?: VerdictStats;
		filters?: LogFilter[];
		activeFilter?: string;
		entries?: VerdictEntryVM[];
		/** Captions under each tally, so a host can say "blocked" if that is its word. */
		totalLabel?: string;
		deniedLabel?: string;
		permittedLabel?: string;
		title?: string;
		emptyText?: string;
		onfilter?: (id: string) => void;
	} = $props();
</script>

<div class="tab-content">
	<!-- Tallies -->
	<div class="stats">
		<div class="stat">
			<span class="stat-val">{stats.total.toLocaleString()}</span>
			<span class="stat-lbl">{totalLabel}</span>
		</div>
		<div class="stat-sep"></div>
		<div class="stat">
			<span class="stat-val stat-val--denied">{stats.denied.toLocaleString()}</span>
			<span class="stat-lbl">{deniedLabel}</span>
		</div>
		<div class="stat-sep"></div>
		<div class="stat">
			<span class="stat-val stat-val--dim">{stats.permitted.toLocaleString()}</span>
			<span class="stat-lbl">{permittedLabel}</span>
		</div>
	</div>

	<!-- Filter chips -->
	{#if filters.length}
		<div class="filters">
			{#each filters as chip (chip.id)}
				<button
					class="filter-chip"
					class:filter-chip--on={activeFilter === chip.id}
					aria-pressed={activeFilter === chip.id}
					onclick={() => onfilter?.(chip.id)}>{chip.label}</button
				>
			{/each}
		</div>
	{/if}

	<!-- Entries -->
	<div class="section-label" style="margin-top:0.25rem">{title}</div>
	{#if entries.length === 0}
		<p class="empty">{emptyText}</p>
	{:else}
		<div class="entry-list">
			{#each entries as e (e.id)}
				<div class="entry-row" class:entry-row--denied={e.verdict === 'denied'}>
					<span
						class="entry-verdict"
						class:entry-verdict--denied={e.verdict === 'denied'}
						class:entry-verdict--permitted={e.verdict === 'permitted'}
						>{e.verdict === 'denied' ? '⊘' : '✓'}</span
					>
					<span class="entry-source">{e.source}</span>
					<span class="entry-target">{e.target}</span>
					{#if e.reason}
						<span class="entry-reason">{e.reason}</span>
					{:else}
						<span></span>
					{/if}
					<span class="entry-ts">{e.ts}</span>
				</div>
			{/each}
		</div>
	{/if}
</div>

<style>
	.tab-content {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.section-label {
		font-family: var(--mono);
		font-size: 0.58rem;
		font-weight: 700;
		letter-spacing: 0.18em;
		text-transform: uppercase;
		color: var(--fg-dim);
		padding-bottom: 0.4rem;
		border-bottom: 1px solid var(--border);
		margin-bottom: 0.25rem;
		margin-top: 0.25rem;
	}

	.empty {
		margin: 0;
		font-family: var(--mono);
		font-size: 0.68rem;
		color: var(--fg-dim);
	}

	.stats {
		display: flex;
		align-items: center;
		gap: 0;
		padding: 0.85rem 1rem;
		border: 1px solid var(--border);
		border-radius: 5px;
		background: var(--input-bg);
	}

	.stat {
		flex: 1;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.2rem;
	}

	.stat-sep {
		width: 1px;
		height: 28px;
		background: var(--border);
		flex-shrink: 0;
	}

	.stat-val {
		font-family: var(--mono);
		font-size: 1.35rem;
		font-weight: 700;
		color: var(--fg);
		line-height: 1;
	}

	.stat-val--denied {
		color: var(--palette-red);
	}
	.stat-val--dim {
		color: var(--fg-muted);
	}

	.stat-lbl {
		font-family: var(--mono);
		font-size: 0.55rem;
		text-transform: uppercase;
		letter-spacing: 0.14em;
		color: var(--fg-dim);
	}

	.filters {
		display: flex;
		gap: 0.3rem;
		margin: 0.6rem 0 0.35rem;
		flex-wrap: wrap;
	}

	.filter-chip {
		font-family: var(--mono);
		font-size: 0.58rem;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.08em;
		padding: 0.18rem 0.55rem;
		border: 1px solid var(--border);
		border-radius: 10px;
		background: transparent;
		color: var(--fg-dim);
		cursor: pointer;
		transition:
			color 0.15s,
			border-color 0.15s,
			background 0.15s;
		white-space: nowrap;
	}

	.filter-chip:hover {
		color: var(--fg-muted);
		border-color: var(--border-strong);
	}

	.filter-chip--on {
		color: var(--accent);
		border-color: var(--border-accent);
		background: var(--accent-faint);
	}

	.entry-list {
		display: flex;
		flex-direction: column;
		border: 1px solid var(--border);
		border-radius: 4px;
		overflow: hidden;
	}

	.entry-row {
		display: grid;
		grid-template-columns: 16px 28px 1fr auto auto;
		align-items: center;
		gap: 0.5rem;
		padding: 0.45rem 0.7rem;
		border-bottom: 1px solid var(--border);
		transition: background 0.1s;
	}

	.entry-row:last-child {
		border-bottom: none;
	}
	.entry-row:hover {
		background: var(--surface-raised);
	}
	.entry-row--denied {
		background: color-mix(in srgb, var(--palette-red) 4%, transparent);
	}

	.entry-verdict {
		font-family: var(--mono);
		font-size: 0.7rem;
		font-weight: 700;
		text-align: center;
	}

	.entry-verdict--denied {
		color: var(--palette-red);
	}
	.entry-verdict--permitted {
		color: var(--accent-emerald);
	}

	.entry-source {
		font-family: var(--mono);
		font-size: 0.58rem;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.08em;
		color: var(--fg-dim);
		background: var(--surface-strong);
		border: 1px solid var(--border);
		border-radius: 2px;
		padding: 0.1em 0.35em;
		white-space: nowrap;
	}

	.entry-target {
		font-family: var(--mono);
		font-size: 0.65rem;
		color: var(--fg-muted);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		min-width: 0;
	}

	.entry-reason {
		font-family: var(--mono);
		font-size: 0.58rem;
		color: color-mix(in srgb, var(--palette-red) 70%, transparent);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		max-width: 110px;
	}

	.entry-ts {
		font-family: var(--mono);
		font-size: 0.58rem;
		color: var(--fg-dim);
		white-space: nowrap;
		flex-shrink: 0;
	}
</style>
