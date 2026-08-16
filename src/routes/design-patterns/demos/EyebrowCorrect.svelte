<script lang="ts">
	import Icon from '$lib/icons/Icon.svelte';

	// Both states of the same page, so the cost of the explanation is visible.
	// Expanded is what a first arrival gets; collapsed is every visit after, and
	// the eyebrow row is byte-identical between them — only the hero moves.
	let expanded = $state(false);
</script>

<div class="demo">
	<div class="switch">
		<button class="tab" class:on={expanded} type="button" onclick={() => (expanded = true)}>
			first visit
		</button>
		<button class="tab" class:on={!expanded} type="button" onclick={() => (expanded = false)}>
			every visit after
		</button>
	</div>

	<div class="page">
		<div class="eyebrow-row">
			<button class="toggle" type="button" onclick={() => (expanded = !expanded)}>
				<Icon name={expanded ? 'chevron-down' : 'chevron-right'} size={11} />
				<span class="demo-eyebrow">// risk · register</span>
			</button>
			<div class="ctx">
				<span class="ghost">Filter</span>
				<span class="rule" aria-hidden="true"></span>
				<span class="ghost">Import</span>
				<span class="primary">+ Define risk</span>
			</div>
		</div>

		<div class="hero" class:open={expanded}>
			<div class="hero-inner">
				<h3>Risk register.</h3>
				<p>
					Track inherent and residual exposure with NIST SP 800-30 scoring, route treatments against
					your risk appetite, and hold acceptances to an expiry.
				</p>
			</div>
		</div>

		<div class="rows">
			{#each ['R-014 · Vendor key rotation', 'R-021 · Unscoped API token', 'R-033 · Backup restore untested', 'R-047 · Shadow SaaS in finance'] as row}
				<div class="row"><span>{row}</span><span class="cell"></span></div>
			{/each}
		</div>
	</div>
</div>

<p class="note">Row holds still. The explanation is one click away, not gone.</p>

<style>
	.demo {
		width: 100%;
		min-width: 0;
	}

	.switch {
		display: flex;
		gap: 0.3rem;
		margin-bottom: 0.5rem;
	}
	.tab {
		font-family: var(--mono);
		font-size: 0.56rem;
		letter-spacing: 0.06em;
		padding: 0.26rem 0.5rem;
		border-radius: 4px;
		border: 1px solid var(--border);
		background: transparent;
		color: var(--fg-dim);
		cursor: pointer;
	}
	.tab.on {
		border-color: rgba(52, 211, 153, 0.4);
		background: rgba(52, 211, 153, 0.08);
		color: var(--palette-emerald);
	}

	.page {
		border: 1px solid var(--border);
		border-radius: 6px;
		background: var(--bg);
		padding: 0 0.75rem;
		height: 190px;
		overflow: hidden;
	}

	.eyebrow-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		min-height: 2.1rem;
		padding-block: 0.4rem;
		border-bottom: 1px solid var(--border);
	}

	.toggle {
		display: flex;
		align-items: center;
		gap: 0.4rem;
		background: none;
		border: none;
		padding: 0;
		line-height: 1;
		color: var(--accent);
		cursor: pointer;
	}
	.demo-eyebrow {
		font-family: var(--mono);
		font-size: 0.56rem;
		line-height: 1;
		letter-spacing: 0.22em;
		text-transform: uppercase;
		margin: 0 -0.22em 0 0;
	}

	.ctx {
		display: flex;
		align-items: center;
		gap: 0.25rem;
	}
	.ghost {
		font-family: var(--mono);
		font-size: 0.54rem;
		color: var(--fg-muted);
		padding: 0 0.3rem;
	}
	.rule {
		width: 1px;
		height: 11px;
		background: var(--border);
		margin: 0 0.15rem;
	}
	.primary {
		font-family: var(--mono);
		font-size: 0.54rem;
		font-weight: 600;
		color: var(--accent);
		border: 1px solid rgba(94, 234, 212, 0.45);
		background: var(--accent-faint-strong);
		border-radius: 4px;
		padding: 0.16rem 0.36rem;
	}

	.hero {
		display: grid;
		grid-template-rows: 0fr;
		transition: grid-template-rows 0.25s ease;
	}
	.hero.open {
		grid-template-rows: 1fr;
	}
	.hero-inner {
		overflow: hidden;
	}
	.hero h3 {
		font-family: var(--sans-brand, 'Rajdhani', sans-serif);
		font-size: 1.3rem;
		font-weight: 700;
		color: var(--fg);
		margin: 0.6rem 0 0.25rem;
	}
	.hero p {
		font-size: 0.6rem;
		line-height: 1.55;
		color: var(--fg-dim);
		margin: 0 0 0.7rem;
		max-width: 52ch;
	}

	.rows {
		display: flex;
		flex-direction: column;
		gap: 0.22rem;
		padding-top: 0.6rem;
	}
	.row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.6rem;
		font-family: var(--mono);
		font-size: 0.56rem;
		color: var(--fg-muted);
		padding: 0.3rem 0.4rem;
		border: 1px solid var(--border);
		border-radius: 4px;
	}
	.cell {
		width: 42px;
		height: 5px;
		border-radius: 2px;
		background: var(--surface-strong);
	}

	.note {
		margin: 0.7rem 0 0;
		font-family: var(--mono);
		font-size: 0.58rem;
		line-height: 1.6;
		color: var(--palette-emerald);
	}
</style>
