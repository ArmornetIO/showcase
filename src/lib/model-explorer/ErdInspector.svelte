<script lang="ts">
	// ── ErdInspector — selected-table detail drawer ────────────────────────────
	// A decoupled panel: given a table, its group, and its inbound/outbound FKs,
	// it renders columns, references, and indexes. Emits jump/close; owns no data.
	import Icon from '../icons/Icon.svelte';
	import Chip from '../primitives/status/Chip.svelte';
	import IconButton from '../primitives/actions/IconButton.svelte';
	import type { ErdTable, ErdForeignKey, ErdGroup } from './types.js';

	let {
		table,
		group,
		refsOut = [],
		refsIn = [],
		onjump,
		onclose
	}: {
		table: ErdTable;
		group: ErdGroup;
		refsOut?: ErdForeignKey[];
		refsIn?: ErdForeignKey[];
		onjump: (name: string) => void;
		onclose: () => void;
	} = $props();
</script>

<aside class="erd-inspect">
	<div class="erd-in-head">
		<div>
			<div class="erd-in-title" style:color={group.color}>{table.name}</div>
			<div class="erd-in-sub">
				<span class="erd-in-group">
					<span class="erd-in-gdot" style:background={group.color}></span>{group.label}
				</span>
				<span>{table.columns.length} cols · ~{table.approxRows} rows</span>
			</div>
		</div>
		<IconButton icon="log-out" label="Close" size="sm" onclick={onclose} />
	</div>

	<div class="erd-in-sec">COLUMNS</div>
	<div class="erd-in-cols">
		{#each table.columns as c (c.name)}
			<div class="erd-in-col">
				<span class="erd-in-cname" class:pk={c.pk}>{c.pk ? '⚷ ' : ''}{c.name}</span>
				<span class="erd-in-ctype">{c.type}{c.nullable ? '?' : ''}</span>
				<span class="erd-in-cflags">
					{#if c.fk}<Chip look="ghost" color="accent">→ {c.fk}</Chip>{/if}
					{#if c.unique && !c.pk}<Chip look="ghost" color="warn">unique</Chip>{/if}
					{#if c.default}<span class="erd-in-def" title={c.default}>= {c.default}</span>{/if}
				</span>
			</div>
		{/each}
	</div>

	{#if refsOut.length > 0}
		<div class="erd-in-sec">REFERENCES →</div>
		{#each refsOut as f (f.id)}
			<button class="erd-in-ref" onclick={() => onjump(f.toTable)}>
				<span class="mono">{f.fromColumns.join(', ')}</span>
				<Icon name="arrow-right" size={11} />
				<span class="mono strong">{f.toTable}</span>
				<span class="erd-in-od">{f.onDelete}</span>
			</button>
		{/each}
	{/if}
	{#if refsIn.length > 0}
		<div class="erd-in-sec">← REFERENCED BY</div>
		{#each refsIn as f (f.id)}
			<button class="erd-in-ref" onclick={() => onjump(f.fromTable)}>
				<span class="mono strong">{f.fromTable}</span>
				<span class="mono dim">.{f.fromColumns.join(', ')}</span>
				<span class="erd-in-od">{f.onDelete}</span>
			</button>
		{/each}
	{/if}

	{#if table.indexes.length > 0}
		<div class="erd-in-sec">INDEXES</div>
		{#each table.indexes as ix (ix.name)}
			<div class="erd-in-ix">
				<span class="mono" title={ix.name}>{ix.name}</span>
				<span class="erd-in-ixm">{ix.unique ? 'unique · ' : ''}{ix.method}</span>
			</div>
		{/each}
	{/if}
</aside>

<style>
	.erd-inspect {
		position: absolute;
		top: 12px;
		right: 14px;
		bottom: 12px;
		width: 316px;
		overflow-y: auto;
		border: 1px solid var(--border);
		border-radius: var(--radius-surface);
		background: color-mix(in srgb, var(--bg-elev) 94%, transparent);
		backdrop-filter: blur(8px);
		padding: 14px;
		z-index: 6;
		box-shadow: var(--shadow-card);
	}
	.erd-in-head {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 8px;
	}
	.erd-in-title {
		font-family: var(--mono);
		font-size: 0.94rem;
		font-weight: 700;
	}
	.erd-in-sub {
		display: flex;
		align-items: center;
		gap: 10px;
		margin-top: 5px;
		font-size: 0.66rem;
		color: var(--fg-muted);
		flex-wrap: wrap;
	}
	.erd-in-group {
		display: inline-flex;
		align-items: center;
		gap: 5px;
		color: var(--fg-dim);
	}
	.erd-in-gdot {
		width: 7px;
		height: 7px;
		border-radius: 50%;
	}
	.erd-in-sec {
		margin: 14px 0 6px;
		font-family: var(--mono);
		font-size: 0.6rem;
		letter-spacing: 0.08em;
		color: var(--fg-muted);
		border-bottom: 1px solid var(--border);
		padding-bottom: 4px;
	}
	.erd-in-cols {
		display: flex;
		flex-direction: column;
	}
	.erd-in-col {
		display: flex;
		align-items: baseline;
		gap: 8px;
		padding: 2.5px 0;
		font-size: 0.7rem;
		flex-wrap: wrap;
	}
	.erd-in-cname {
		font-family: var(--mono);
		color: var(--fg-dim);
	}
	.erd-in-cname.pk {
		color: var(--fg);
		font-weight: 600;
	}
	.erd-in-ctype {
		font-family: var(--mono);
		font-size: 0.64rem;
		color: var(--fg-muted);
	}
	.erd-in-cflags {
		display: inline-flex;
		align-items: center;
		gap: 5px;
		margin-left: auto;
	}
	.erd-in-def {
		font-family: var(--mono);
		font-size: 0.6rem;
		color: var(--fg-muted);
		max-width: 110px;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.erd-in-ref {
		display: flex;
		align-items: center;
		gap: 6px;
		width: 100%;
		padding: 4px 6px;
		margin: 1px 0;
		border: none;
		border-radius: var(--radius-control);
		background: transparent;
		color: var(--fg-dim);
		font-size: 0.7rem;
		text-align: left;
		cursor: pointer;
	}
	.erd-in-ref:hover {
		background: var(--bg);
	}
	.erd-in-od {
		margin-left: auto;
		font-family: var(--mono);
		font-size: 0.58rem;
		color: var(--fg-muted);
	}
	.erd-in-ix {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: 8px;
		padding: 2.5px 0;
		font-size: 0.64rem;
		color: var(--fg-dim);
	}
	.erd-in-ix .mono {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.erd-in-ixm {
		flex-shrink: 0;
		color: var(--fg-muted);
	}
	.mono {
		font-family: var(--mono);
	}
	.mono.strong {
		color: var(--fg);
	}
	.mono.dim {
		color: var(--fg-muted);
	}
</style>
