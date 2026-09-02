<script lang="ts">
	// ── ErdLedgerView — migration ledger table ─────────────────────────────────
	// Pure: renders the state of every migration. Data comes from the god-admin
	// /status endpoint (LedgerEntry[]); this component owns no fetch logic.
	import Chip from '../primitives/status/Chip.svelte';
	import Icon from '../icons/Icon.svelte';
	import type { LedgerEntry } from './types.js';

	let { entries = [] }: { entries?: LedgerEntry[] } = $props();

	const STATE_COLOR: Record<string, 'success' | 'accent' | 'warn' | 'error' | 'default'> = {
		applied: 'success',
		pending: 'accent',
		reverted: 'error',
		checksum_drift: 'warn',
		orphan_applied: 'warn'
	};

	function shortSum(s: string): string {
		return s ? s.slice(0, 6) : '—';
	}
</script>

<div class="ledger">
	<div class="ledger-head">
		<span class="lh seq">seq</span>
		<span class="lh">name</span>
		<span class="lh">state</span>
		<span class="lh">checksum</span>
		<span class="lh ctr">↺</span>
		<span class="lh">by</span>
	</div>
	{#each entries as e (e.sequence + e.name)}
		<div class="ledger-row" class:muted={e.state === 'pending'}>
			<span class="seq mono">{String(e.sequence).padStart(4, '0')}</span>
			<span class="nm mono">{e.name}</span>
			<span><Chip look="filled" color={STATE_COLOR[e.state] ?? 'default'}>{e.state}</Chip></span>
			<span class="mono dim">{shortSum(e.checksum)}</span>
			<span class="ctr">
				{#if e.has_rollback}<Icon name="rotate-ccw" size={13} />{:else}<span class="dim">—</span>{/if}
			</span>
			<span class="mono dim sm">{e.applied_by || '—'}</span>
		</div>
	{/each}
	{#if entries.length === 0}
		<div class="empty">No migrations in the ledger.</div>
	{/if}
</div>

<style>
	.ledger {
		border: 1px solid var(--border);
		border-radius: var(--radius-surface);
		overflow: hidden;
		margin: 20px 24px;
	}
	.ledger-head,
	.ledger-row {
		display: grid;
		grid-template-columns: 56px 1.7fr 110px 90px 34px 1fr;
		align-items: center;
		gap: 10px;
		padding: 9px 16px;
		border-bottom: 1px solid var(--border);
		font-size: 0.8rem;
	}
	.ledger-row:last-child {
		border-bottom: none;
	}
	.ledger-head {
		background: var(--bg-elev);
		color: var(--fg-muted);
		font-family: var(--mono);
		font-size: 0.62rem;
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}
	.ledger-row.muted {
		opacity: 0.6;
	}
	.nm {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.seq {
		color: var(--accent);
	}
	.ctr {
		text-align: center;
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
	.empty {
		padding: 22px 16px;
		text-align: center;
		font-size: 0.8rem;
		color: var(--fg-muted);
	}
</style>
