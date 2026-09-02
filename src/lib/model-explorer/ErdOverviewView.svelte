<script lang="ts">
	// ── ErdOverviewView — live-vs-ledger drift dashboard ───────────────────────
	// Pure: renders a DriftReport from /drift — the "scream about 0050 before it
	// breaks" surface. Structural drift (live schema ≠ ledger) and ledger-integrity
	// issues (checksum drift, reverted, orphaned) are both shown.
	import Icon from '../icons/Icon.svelte';
	import Chip from '../primitives/status/Chip.svelte';
	import type { DriftReport, ObjectDiff, LedgerEntry } from './types.js';

	let { report }: { report: DriftReport } = $props();

	const objects = $derived((report.diff?.objects ?? []).filter((o) => o.class !== 'identical'));
	const ledger = $derived(report.ledger ?? []);
	const pending = $derived(ledger.filter((e) => e.state === 'pending').length);
	const ledgerIssues = $derived(
		ledger.filter((e) => ['checksum_drift', 'orphan_applied', 'reverted'].includes(e.state))
	);

	function kindLabel(o: ObjectDiff): string {
		if (o.class === 'source_only') return 'LIVE-ONLY';
		if (o.class === 'target_only') return 'LEDGER-ONLY';
		return 'MODIFIED';
	}
	function kindColor(o: ObjectDiff): 'warn' | 'error' | 'accent' {
		if (o.dataLoss) return 'error';
		return o.class === 'different' ? 'accent' : 'warn';
	}
	function issueDetail(e: LedgerEntry): string {
		if (e.state === 'reverted') {
			const ev = (e.events ?? []).find((x) => x.event === 'mark_reverted');
			return ev ? `reverted by ${ev.actor} — “${ev.reason}”` : 'marked reverted';
		}
		if (e.state === 'checksum_drift') return 'applied checksum ≠ registry';
		return 'applied but not in the registry';
	}
</script>

<div class="ov">
	<div class="tiles">
		<div class="tile" class:alert={report.hasDrift}>
			<div class="tile-val">
				{objects.length}{#if report.hasDrift}<Icon name="alert-triangle" size={15} />{/if}
			</div>
			<div class="tile-lbl">Structural drift</div>
			<div class="tile-sub">live ≠ ledger</div>
		</div>
		<div class="tile">
			<div class="tile-val">{pending}</div>
			<div class="tile-lbl">Pending</div>
			<div class="tile-sub">not yet applied</div>
		</div>
		<div class="tile" class:alert={ledgerIssues.length > 0}>
			<div class="tile-val">{ledgerIssues.length}</div>
			<div class="tile-lbl">Ledger issues</div>
			<div class="tile-sub">checksum · revert · orphan</div>
		</div>
		<div class="tile">
			<div class="tile-val">{report.hasDrift ? 'DRIFT' : 'OK'}</div>
			<div class="tile-lbl">Status</div>
			<div class="tile-sub">live vs ledger</div>
		</div>
	</div>

	<div class="sec">LIVE <Icon name="arrow-right" size={12} /> LEDGER · object drift</div>
	<div class="findings">
		{#each objects as o (o.name)}
			<div class="finding" class:block={o.dataLoss}>
				<div class="f-ico"><Icon name={o.dataLoss ? 'x-circle' : 'alert-triangle'} size={16} /></div>
				<div class="f-main">
					<div class="f-top">
						<span class="mono">table {o.name}</span>
						<Chip look="filled" color={kindColor(o)}>{kindLabel(o)}</Chip>
						{#if o.dataLoss}<span class="dim sm">data-loss on reconcile</span>{/if}
					</div>
					{#if (o.columnsAdded ?? []).length || (o.columnsRemoved ?? []).length || (o.columnsChanged ?? []).length}
						<div class="f-cols">
							{#each o.columnsAdded ?? [] as c}<span class="add">+{c}</span>{/each}
							{#each o.columnsRemoved ?? [] as c}<span class="del">−{c}</span>{/each}
							{#each o.columnsChanged ?? [] as c}<span class="chg">~{c}</span>{/each}
						</div>
					{/if}
				</div>
			</div>
		{/each}

		{#each ledgerIssues as e (e.sequence)}
			<div class="finding block">
				<div class="f-ico"><Icon name="x-circle" size={16} /></div>
				<div class="f-main">
					<div class="f-top">
						<span class="mono">migration {String(e.sequence).padStart(4, '0')} · {e.name}</span>
						<Chip look="filled" color="error">{e.state}</Chip>
					</div>
					<div class="f-note"><Icon name="chevron-right" size={11} /> {issueDetail(e)}</div>
				</div>
			</div>
		{/each}

		{#if objects.length === 0 && ledgerIssues.length === 0}
			<div class="ok"><Icon name="check-circle-2" size={14} /> No drift — the live schema matches the ledger.</div>
		{/if}
	</div>
</div>

<style>
	.ov {
		padding: 22px 26px;
		overflow-y: auto;
		height: 100%;
	}
	.tiles {
		display: grid;
		grid-template-columns: repeat(4, 1fr);
		gap: 14px;
		margin-bottom: 22px;
	}
	.tile {
		border: 1px solid var(--border);
		border-radius: var(--radius-surface);
		padding: 15px 18px;
		background: var(--bg-elev);
	}
	.tile.alert {
		border-color: var(--palette-amber);
	}
	.tile-val {
		display: flex;
		align-items: center;
		gap: 8px;
		font-size: 1.7rem;
		font-weight: 700;
		font-family: var(--mono);
	}
	.tile.alert .tile-val {
		color: var(--palette-amber);
	}
	.tile-lbl {
		font-size: 0.82rem;
		margin-top: 2px;
	}
	.tile-sub {
		font-size: 0.66rem;
		color: var(--fg-muted);
		margin-top: 2px;
	}
	.sec {
		display: flex;
		align-items: center;
		gap: 6px;
		font-family: var(--mono);
		font-size: 0.72rem;
		letter-spacing: 0.04em;
		color: var(--fg-muted);
		padding-bottom: 10px;
		margin-bottom: 12px;
		border-bottom: 1px solid var(--border);
	}
	.findings {
		display: flex;
		flex-direction: column;
		gap: 10px;
	}
	.finding {
		display: flex;
		gap: 12px;
		align-items: flex-start;
		border: 1px solid var(--palette-amber);
		border-left-width: 3px;
		border-radius: var(--radius-surface);
		padding: 13px 15px;
		background: var(--bg-elev);
	}
	.finding.block {
		border-color: var(--palette-red);
	}
	.f-ico {
		color: var(--palette-amber);
		margin-top: 1px;
	}
	.finding.block .f-ico {
		color: var(--palette-red);
	}
	.f-main {
		flex: 1;
		min-width: 0;
	}
	.f-top {
		display: flex;
		align-items: center;
		gap: 8px;
		flex-wrap: wrap;
	}
	.f-cols,
	.f-note {
		display: flex;
		gap: 8px;
		flex-wrap: wrap;
		margin-top: 6px;
		font-family: var(--mono);
		font-size: 0.72rem;
	}
	.f-note {
		align-items: center;
		color: var(--fg-dim);
	}
	.f-cols .add {
		color: var(--palette-emerald);
	}
	.f-cols .del {
		color: var(--palette-red);
	}
	.f-cols .chg {
		color: var(--palette-amber);
	}
	.ok {
		display: flex;
		align-items: center;
		gap: 6px;
		font-size: 0.8rem;
		color: var(--fg-muted);
	}
	.ok :global(svg) {
		color: var(--palette-emerald);
	}
	.mono {
		font-family: var(--mono);
	}
	.dim {
		color: var(--fg-muted);
	}
	.sm {
		font-size: 0.72rem;
	}
</style>
