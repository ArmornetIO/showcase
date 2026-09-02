<script lang="ts">
	// ── ErdEnvironmentsView — per-environment applied matrix ───────────────────
	// Pure: renders EnvironmentsReport from /environments. Rows are migrations,
	// columns are environments; a cell is filled when that migration is applied
	// in that environment. Unreachable environments are flagged in the header.
	import Icon from '../icons/Icon.svelte';
	import Chip from '../primitives/status/Chip.svelte';
	import type { EnvironmentsReport } from './types.js';

	let { report }: { report: EnvironmentsReport } = $props();

	const envs = $derived(report.environments ?? []);
	const rows = $derived(report.migrations ?? []);
</script>

<div class="envs">
	{#if envs.length === 0}
		<div class="empty">
			No environments configured. Add them under <code>model.environments</code> in the server config.
		</div>
	{:else}
		<div class="env-summaries">
			{#each envs as e (e.name)}
				<div class="env-sum" class:down={!e.reachable}>
					<span class="env-name mono">{e.name}</span>
					{#if e.reachable}
						<Chip look="ghost" color="success">head {String(e.headSequence).padStart(4, '0')}</Chip>
					{:else}
						<Chip look="ghost" color="error">unreachable</Chip>
					{/if}
				</div>
			{/each}
		</div>

		<div class="matrix" style:--env-cols={envs.length}>
			<div class="mx-head">
				<span class="mx-seq">seq</span>
				<span>name</span>
				{#each envs as e (e.name)}<span class="mx-env mono">{e.name}</span>{/each}
			</div>
			{#each rows as r (r.sequence)}
				<div class="mx-row">
					<span class="mx-seq mono accent">{String(r.sequence).padStart(4, '0')}</span>
					<span class="mono nm">{r.name}</span>
					{#each envs as e (e.name)}
						<span class="mx-cell">
							{#if r.applied[e.name]}
								<Icon name="check-circle-2" size={14} />
							{:else}
								<span class="dim">·</span>
							{/if}
						</span>
					{/each}
				</div>
			{/each}
		</div>
	{/if}
</div>

<style>
	.envs {
		padding: 20px 24px;
	}
	.env-summaries {
		display: flex;
		gap: 10px;
		flex-wrap: wrap;
		margin-bottom: 16px;
	}
	.env-sum {
		display: flex;
		align-items: center;
		gap: 8px;
		border: 1px solid var(--border);
		border-radius: var(--radius-surface);
		padding: 8px 12px;
		background: var(--bg-elev);
	}
	.env-sum.down {
		border-color: var(--palette-red);
	}
	.env-name {
		font-size: 0.8rem;
		color: var(--fg);
	}
	.matrix {
		border: 1px solid var(--border);
		border-radius: var(--radius-surface);
		overflow: hidden;
	}
	.mx-head,
	.mx-row {
		display: grid;
		grid-template-columns: 56px 1.7fr repeat(var(--env-cols), 88px);
		align-items: center;
		gap: 10px;
		padding: 9px 16px;
		border-bottom: 1px solid var(--border);
		font-size: 0.8rem;
	}
	.mx-row:last-child {
		border-bottom: none;
	}
	.mx-head {
		background: var(--bg-elev);
		color: var(--fg-muted);
		font-family: var(--mono);
		font-size: 0.62rem;
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}
	.mx-seq {
		text-align: left;
	}
	.mx-env,
	.mx-cell {
		text-align: center;
	}
	.mx-cell :global(svg) {
		color: var(--palette-emerald);
	}
	.nm {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.accent {
		color: var(--accent);
	}
	.mono {
		font-family: var(--mono);
	}
	.dim {
		color: var(--fg-muted);
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
