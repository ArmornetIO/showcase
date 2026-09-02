<script lang="ts">
	// ── ErdCapturesView — stored schema captures list ──────────────────────────
	// Pure: renders CaptureMeta[] from the /captures endpoint.
	import Chip from '../primitives/status/Chip.svelte';
	import Icon from '../icons/Icon.svelte';
	import type { CaptureMeta } from './types.js';

	let { captures = [] }: { captures?: CaptureMeta[] } = $props();

	function when(iso: string): string {
		if (!iso) return '—';
		return iso.replace('T', ' ').slice(0, 16);
	}
</script>

<div class="caps">
	{#each captures as c (c.id)}
		<div class="cap">
			<div class="cap-l">
				<Icon name="clipboard-list" size={15} />
				<div>
					<div class="cap-label">{c.label}</div>
					<div class="cap-id mono dim">{c.id}</div>
				</div>
			</div>
			<Chip look="ghost" color="default">{c.source}{c.sourceDetail ? `:${c.sourceDetail}` : ''}</Chip>
			<span class="dim sm">{c.schemaVersion || '—'}</span>
			<span class="dim sm">{c.tableCount} tables · {c.fkCount} fks</span>
			<span class="dim sm">{when(c.capturedAt)}</span>
			<span class="dim sm mono">{c.capturedBy || '—'}</span>
		</div>
	{/each}
	{#if captures.length === 0}
		<div class="empty">No captures stored. Create one with <code>armornet model capture create</code>.</div>
	{/if}
</div>

<style>
	.caps {
		display: flex;
		flex-direction: column;
		gap: 8px;
		padding: 20px 24px;
	}
	.cap {
		display: grid;
		grid-template-columns: 1.6fr 120px 1fr 1.2fr 1fr 1fr;
		align-items: center;
		gap: 14px;
		border: 1px solid var(--border);
		border-radius: var(--radius-surface);
		padding: 11px 15px;
		background: var(--bg-elev);
	}
	.cap-l {
		display: flex;
		align-items: center;
		gap: 10px;
		color: var(--fg-muted);
	}
	.cap-label {
		font-size: 0.82rem;
		color: var(--fg);
	}
	.cap-id {
		font-size: 0.66rem;
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
	.empty code {
		font-family: var(--mono);
		color: var(--fg-dim);
	}
</style>
