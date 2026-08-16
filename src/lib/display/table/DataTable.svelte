<script module lang="ts">
	import type { Snippet } from 'svelte';

	export type KvRow = [key: string, value: string | number];

	export interface TableColumn<R = Record<string, unknown>> {
		key: string;
		header: string;
		/** Per-column cell renderer. Used when no component-level `cell` snippet is provided. */
		cell?: Snippet<[R]>;
		align?: 'left' | 'right';
		width?: string;
	}

	// ── Compare variant types ────────────────────────────────────────────────────

	export interface CompareColumn {
		/** Unique key — used to look up values in CompareFeatureRow.values. The first column is
		 *  always rendered as the feature-name column (left-aligned, Rajdhani font). */
		key: string;
		header: string;
		/** Accent tint applied to the header cell. 'mint' also adds a stronger background. */
		color?: 'blue' | 'mint' | 'emerald';
		width?: string;
	}

	export type CompareCell =
		| { type: 'check'; on: boolean }
		| { type: 'qual'; text: string; strong?: boolean }
		| string;

	export type CompareRow =
		| { type: 'category'; label: string }
		| { type: 'feature'; feature: string; values: Record<string, CompareCell> };
</script>

<script lang="ts" generics="Row extends Record<string, unknown>">
	import TableWrap from './TableWrap.svelte';

	interface DataTableProps {
		variant?: 'table' | 'kv' | 'compare';
		// ── table mode ──────────────────────────────────────────────────────────
		columns?: TableColumn<Row>[];
		rows?: Row[];
		onRowClick?: (row: Row) => void;
		/**
		 * Component-level cell renderer — receives (colKey, row).
		 * Takes priority over per-column `col.cell` when provided.
		 */
		cell?: Snippet<[string, Row]>;
		footer?: Snippet;
		empty?: string;
		// ── kv mode ─────────────────────────────────────────────────────────────
		kvRows?: KvRow[];
		kvTitle?: string;
		/** Width of the key column. Defaults to 140px. */
		kvKeyWidth?: string;
		// ── compare mode ─────────────────────────────────────────────────────────
		compareColumns?: CompareColumn[];
		compareRows?: CompareRow[];
	}

	let {
		variant = 'table',
		columns = [],
		rows = [],
		onRowClick,
		cell,
		footer,
		empty = 'No records.',
		kvRows = [],
		kvTitle,
		kvKeyWidth = '140px',
		compareColumns = [],
		compareRows = []
	}: DataTableProps = $props();
</script>

{#if variant === 'kv'}
	<div class="kv-panel">
		{#if kvTitle}
			<div class="kv-header">{kvTitle}</div>
		{/if}
		<dl class="kv-list">
			{#each kvRows as [k, v] (k)}
				<div class="kv-row" style:grid-template-columns="{kvKeyWidth} 1fr">
					<dt class="kv-key">{k}</dt>
					<dd class="kv-val">{String(v)}</dd>
				</div>
			{/each}
		</dl>
	</div>

{:else if variant === 'compare'}
	<div class="ct-wrap">
		<table class="ct">
			<thead>
				<tr>
					{#each compareColumns as col, i}
						<th
							class="ct-th"
							class:ct-th-feature={i === 0}
							class:ct-th-blue={col.color === 'blue'}
							class:ct-th-mint={col.color === 'mint'}
							class:ct-th-emerald={col.color === 'emerald'}
							style:width={col.width}
						>{col.header}</th>
					{/each}
				</tr>
			</thead>
			<tbody>
				{#each compareRows as row}
					{#if row.type === 'category'}
						<tr>
							<td colspan={compareColumns.length} class="ct-category">{row.label}</td>
						</tr>
					{:else}
						<tr class="ct-row">
							{#each compareColumns as col, i}
								{#if i === 0}
									<td class="ct-feature">{row.feature}</td>
								{:else}
									{@const val = row.values[col.key]}
									<td class="ct-cell">
										{#if typeof val === 'object' && val.type === 'check'}
											<span class="ct-check" class:ct-check-on={val.on} class:ct-check-off={!val.on}>
												{val.on ? '✓' : '—'}
											</span>
										{:else if typeof val === 'object' && val.type === 'qual'}
											<span class="ct-qual" class:ct-qual-strong={val.strong}>{val.text}</span>
										{:else if typeof val === 'string'}
											<span class="ct-qual">{val}</span>
										{:else}
											<span class="ct-check ct-check-off">—</span>
										{/if}
									</td>
								{/if}
							{/each}
						</tr>
					{/if}
				{/each}
			</tbody>
		</table>
	</div>

{:else}
	<TableWrap>
		<table>
			<thead>
				<tr>
					{#each columns as col}
						<th style:text-align={col.align ?? 'left'} style:width={col.width}>{col.header}</th>
					{/each}
				</tr>
			</thead>
			<tbody>
				{#if rows.length === 0}
					<tr>
						<td colspan={columns.length} class="dt-empty">{empty}</td>
					</tr>
				{:else}
					{#each rows as row}
						<tr
							class:dt-clickable={!!onRowClick}
							onclick={onRowClick ? () => onRowClick(row) : undefined}
						>
							{#each columns as col}
								<td style:text-align={col.align ?? 'left'} style:width={col.width}>
									{#if cell}
										{@render cell(col.key, row)}
									{:else if col.cell}
										{@render col.cell(row)}
									{:else}
										{String(row[col.key] ?? '')}
									{/if}
								</td>
							{/each}
						</tr>
					{/each}
				{/if}
			</tbody>
		</table>
	</TableWrap>
	{#if footer}
		{@render footer()}
	{/if}
{/if}

<style>
	/* ── KV variant ──────────────────────────────────────────────────────────── */
	.kv-panel {
		border: 1px solid var(--border);
		background: var(--bg-elev);
	}
	.kv-header {
		padding: 6px 12px;
		border-bottom: 1px solid var(--border);
		font-family: var(--mono);
		font-size: 0.625rem;
		letter-spacing: 0.18em;
		text-transform: uppercase;
		color: var(--fg-dim);
	}
	.kv-list {
		margin: 0;
		display: flex;
		flex-direction: column;
	}
	.kv-row {
		display: grid;
		padding: 6px 12px;
		font-size: 0.75rem;
		gap: 12px;
		border-bottom: 1px solid var(--border);
	}
	.kv-row:last-child {
		border-bottom: none;
	}
	.kv-key {
		font-family: var(--mono);
		color: var(--fg-dim);
		align-self: center;
	}
	.kv-val {
		font-family: var(--mono);
		color: var(--fg);
		margin: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		align-self: center;
	}

	/* ── Compare variant ─────────────────────────────────────────────────────── */
	.ct-wrap {
		position: relative;
		overflow-x: auto;
		scrollbar-width: thin;
		scrollbar-color: rgba(95, 234, 212, 0.3) rgba(95, 234, 212, 0.05);
	}
	.ct-wrap::-webkit-scrollbar { height: 8px; }
	.ct-wrap::-webkit-scrollbar-track { background: rgba(95, 234, 212, 0.05); }
	.ct-wrap::-webkit-scrollbar-thumb { background: rgba(95, 234, 212, 0.3); border-radius: 4px; }

	.ct {
		width: 100%;
		border-collapse: separate;
		border-spacing: 0;
		background: linear-gradient(135deg, var(--bg-elev) 0%, var(--bg) 100%);
		border: 1px solid rgba(95, 234, 212, 0.25);
		min-width: 520px;
	}
	.ct th,
	.ct td {
		padding: 12px 16px;
		vertical-align: middle;
		border-bottom: 1px solid rgba(95, 234, 212, 0.10);
	}
	.ct tbody tr:last-child td {
		border-bottom: none;
	}
	.ct-row:hover td {
		background: rgba(95, 234, 212, 0.04);
	}

	/* Header cells */
	.ct-th {
		font-family: var(--mono);
		font-size: 0.5625rem;
		letter-spacing: 0.25em;
		text-transform: uppercase;
		text-align: center;
		color: var(--fg-dim);
		background: rgba(95, 234, 212, 0.06);
		border-bottom: 1.5px solid rgba(95, 234, 212, 0.35) !important;
	}
	.ct-th-feature { text-align: left; }

	/* Column accent tints */
	.ct-th-blue   { color: var(--palette-blue-l); }
	.ct-th-mint   { color: var(--palette-emerald-l); background: rgba(95, 234, 212, 0.11); }
	.ct-th-emerald { color: var(--palette-emerald-l); }

	/* Category separator */
	.ct-category {
		font-family: var(--mono);
		font-size: 0.5625rem;
		letter-spacing: 0.3em;
		text-transform: uppercase;
		color: var(--accent) !important;
		background: rgba(95, 234, 212, 0.08) !important;
		padding: 10px 16px !important;
	}

	/* Feature name (first column) */
	.ct-feature {
		font-family: var(--sans-brand);
		font-weight: 500;
		font-size: 0.9375rem;
		color: var(--fg);
		text-align: left;
	}

	/* Value cells */
	.ct-cell { text-align: center; }

	/* Check circle */
	.ct-check {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 22px;
		height: 22px;
		border-radius: 50%;
		font-size: 0.75rem;
		line-height: 1;
	}
	.ct-check-on {
		background: rgba(95, 234, 212, 0.18);
		color: var(--accent);
		box-shadow: 0 0 8px rgba(95, 234, 212, 0.3);
	}
	.ct-check-off {
		color: var(--fg-dim);
		opacity: 0.35;
	}

	/* Qual text */
	.ct-qual {
		font-family: var(--mono);
		font-size: 0.5625rem;
		letter-spacing: 0.15em;
		color: var(--fg-muted);
	}
	.ct-qual-strong {
		color: var(--accent);
	}

	/* ── Table variant ───────────────────────────────────────────────────────── */
	.dt-empty {
		text-align: center !important;
		padding: 24px !important;
		color: var(--fg-dim) !important;
		font-style: italic;
		opacity: 0.6;
	}
	.dt-clickable {
		cursor: pointer;
	}
</style>
