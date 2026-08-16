<script lang="ts">
	// The permanent hero: paid for on every visit, forever, and the work starts
	// below the fold.
	const rows = ['R-014 · Vendor key rotation'];
</script>

<div class="demo">
	<div class="switch">
		<span class="tab on">every visit</span>
	</div>

	<div class="page">
		<div class="eyebrow-row">
			<span class="demo-eyebrow">// risk · register</span>
			<span class="primary">+ Define risk</span>
		</div>

		<h3>Risk register.</h3>
		<p>
			Track inherent and residual exposure with NIST SP 800-30 scoring, route treatments against your
			risk appetite, and hold acceptances to an expiry.
		</p>

		<div class="rows">
			{#each rows as row}
				<div class="row"><span>{row}</span><span class="cell"></span></div>
			{/each}
		</div>

		<span class="fold" aria-hidden="true">fold</span>
	</div>
</div>

<p class="note">One row of the register above the fold, on visit four hundred.</p>

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
		border: 1px solid rgba(252, 165, 165, 0.4);
		background: rgba(252, 165, 165, 0.07);
		color: var(--palette-red);
	}

	.page {
		position: relative;
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
		gap: 0.6rem;
		min-height: 2.1rem;
		padding-block: 0.4rem;
		border-bottom: 1px solid var(--border);
	}
	.demo-eyebrow {
		font-family: var(--mono);
		font-size: 0.56rem;
		line-height: 1;
		letter-spacing: 0.2em;
		text-transform: uppercase;
		color: var(--accent);
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
		white-space: nowrap;
	}

	h3 {
		font-family: var(--sans-brand, 'Rajdhani', sans-serif);
		font-size: 1.3rem;
		font-weight: 700;
		color: var(--fg);
		margin: 0.6rem 0 0.25rem;
	}
	p {
		font-size: 0.6rem;
		line-height: 1.55;
		color: var(--fg-dim);
		margin: 0 0 0.7rem;
	}

	.rows {
		display: flex;
		flex-direction: column;
		gap: 0.22rem;
	}
	.row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.5rem;
		font-family: var(--mono);
		font-size: 0.56rem;
		color: var(--fg-muted);
		padding: 0.3rem 0.4rem;
		border: 1px solid var(--border);
		border-radius: 4px;
	}
	.cell {
		width: 34px;
		height: 5px;
		border-radius: 2px;
		background: var(--surface-strong);
		flex-shrink: 0;
	}

	.fold {
		position: absolute;
		left: 0;
		right: 0;
		bottom: 0;
		border-top: 1px dashed rgba(252, 165, 165, 0.5);
		font-family: var(--mono);
		font-size: 0.5rem;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		color: var(--palette-red);
		text-align: right;
		padding: 0.15rem 0.3rem;
		background: linear-gradient(to top, rgba(252, 165, 165, 0.06), transparent);
	}

	.note {
		margin: 0.7rem 0 0;
		font-family: var(--mono);
		font-size: 0.58rem;
		line-height: 1.6;
		color: var(--palette-red);
	}
</style>
