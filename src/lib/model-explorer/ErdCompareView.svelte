<script lang="ts">
	// ── ErdCompareView — diff two schema sources ───────────────────────────────
	// Source/target pickers (live | ledger | env:<name> | capture:<id>) and the
	// grouped object diff. Bindable source/target; `onCompare` asks the host to
	// fetch — this component owns no fetch logic.
	import Icon from '../icons/Icon.svelte';
	import Chip from '../primitives/status/Chip.svelte';
	import Button from '../primitives/actions/Button.svelte';
	import type { ErdDiff, ObjectDiff } from './types.js';

	let {
		diff,
		sources = [],
		source = $bindable('live'),
		target = $bindable('ledger'),
		loading = false,
		onCompare
	}: {
		diff: ErdDiff;
		sources?: { value: string; label: string }[];
		source?: string;
		target?: string;
		loading?: boolean;
		onCompare: () => void;
	} = $props();

	const GROUPS: { key: ObjectDiff['class']; label: string; color: 'accent' | 'warn' | 'default' }[] = [
		{ key: 'different', label: 'different', color: 'accent' },
		{ key: 'source_only', label: 'source-only', color: 'warn' },
		{ key: 'target_only', label: 'target-only', color: 'default' }
	];

	const objects = $derived(diff.objects ?? []);
	function inClass(c: ObjectDiff['class']): ObjectDiff[] {
		return objects.filter((o) => o.class === c);
	}
	const identical = $derived(diff.summary?.identical ?? 0);
</script>

<div class="cmp">
	<div class="cmp-head">
		<div class="pick">
			<span class="pick-lbl">source</span>
			<select bind:value={source}>
				{#each sources as s (s.value)}<option value={s.value}>{s.label}</option>{/each}
			</select>
		</div>
		<Icon name="arrow-right" size={15} />
		<div class="pick">
			<span class="pick-lbl">target</span>
			<select bind:value={target}>
				{#each sources as s (s.value)}<option value={s.value}>{s.label}</option>{/each}
			</select>
		</div>
		<Button variant="primary" size="sm" onclick={onCompare} disabled={loading}>
			<Icon name="git-fork" size={13} /> {loading ? 'Comparing…' : 'Compare'}
		</Button>
	</div>

	<div class="cmp-body">
		{#each GROUPS as g (g.key)}
			{@const items = inClass(g.key)}
			<div class="grp">
				<div class="grp-head">
					<Chip look="ghost" color={g.color}>{g.label}</Chip>
					<span class="grp-n">{items.length}</span>
				</div>
				{#each items as o (o.name)}
					<div class="obj">
						<span class="mono">{o.name}</span>
						{#if o.dataLoss}<Chip look="filled" color="error">data-loss</Chip>{/if}
						{#if (o.columnsAdded ?? []).length}<span class="add">+{(o.columnsAdded ?? []).length}</span>{/if}
						{#if (o.columnsRemoved ?? []).length}<span class="del">−{(o.columnsRemoved ?? []).length}</span>{/if}
						{#if (o.columnsChanged ?? []).length}<span class="chg">~{(o.columnsChanged ?? []).length}</span>{/if}
					</div>
				{/each}
				{#if items.length === 0}<div class="grp-empty">none</div>{/if}
			</div>
		{/each}
		<div class="identical"><Icon name="check-circle-2" size={13} /> {identical} identical</div>
	</div>
</div>

<style>
	.cmp {
		padding: 20px 24px;
		height: 100%;
		overflow-y: auto;
	}
	.cmp-head {
		display: flex;
		align-items: center;
		gap: 14px;
		flex-wrap: wrap;
		padding-bottom: 14px;
		margin-bottom: 14px;
		border-bottom: 1px solid var(--border);
	}
	.cmp-head > :global(svg) {
		color: var(--fg-muted);
	}
	.pick {
		display: flex;
		align-items: center;
		gap: 8px;
	}
	.pick-lbl {
		font-family: var(--mono);
		font-size: 0.7rem;
		color: var(--fg-muted);
	}
	.pick select {
		border: 1px solid var(--border);
		border-radius: var(--radius-control);
		background: var(--input-bg);
		color: var(--fg);
		padding: 5px 8px;
		font-family: var(--mono);
		font-size: 0.76rem;
		outline: none;
	}
	.pick select:focus {
		border-color: var(--accent);
	}
	.cmp-body {
		display: flex;
		flex-direction: column;
		gap: 14px;
	}
	.grp {
		border: 1px solid var(--border);
		border-radius: var(--radius-surface);
		overflow: hidden;
	}
	.grp-head {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 8px 12px;
		background: var(--bg-elev);
		border-bottom: 1px solid var(--border);
	}
	.grp-n {
		margin-left: auto;
		font-family: var(--mono);
		font-size: 0.72rem;
		color: var(--fg-muted);
	}
	.obj {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 6px 12px;
		border-bottom: 1px solid var(--border);
		font-size: 0.78rem;
	}
	.obj:last-child {
		border-bottom: none;
	}
	.obj .add {
		color: var(--palette-emerald);
		font-family: var(--mono);
		font-size: 0.72rem;
	}
	.obj .del {
		color: var(--palette-red);
		font-family: var(--mono);
		font-size: 0.72rem;
	}
	.obj .chg {
		color: var(--palette-amber);
		font-family: var(--mono);
		font-size: 0.72rem;
	}
	.grp-empty {
		padding: 8px 12px;
		font-size: 0.72rem;
		color: var(--fg-muted);
		font-style: italic;
	}
	.identical {
		display: flex;
		align-items: center;
		gap: 6px;
		font-size: 0.76rem;
		color: var(--fg-muted);
	}
	.identical :global(svg) {
		color: var(--palette-emerald);
	}
	.mono {
		font-family: var(--mono);
	}
</style>
