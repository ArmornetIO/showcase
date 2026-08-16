<script lang="ts">
	import Icon from '$lib/icons/Icon.svelte';

	// Two depths of the same journey, so what the trail is *for* is visible: at
	// depth 1 there is nothing to say and the row is the eyebrow alone; at depth 2
	// the ancestor appears in front of it, on the same line, in the same voice.
	let deep = $state(true);
</script>

<div class="demo">
	<div class="switch">
		<button class="tab" class:on={!deep} type="button" onclick={() => (deep = false)}>
			destination
		</button>
		<button class="tab" class:on={deep} type="button" onclick={() => (deep = true)}>
			traversed to
		</button>
	</div>

	<div class="page">
		<div class="eyebrow-row">
			<div class="left">
				{#if deep}
					<nav class="crumbs" aria-label="Breadcrumb">
						<span class="crumb">Risk register</span>
						<span class="sep">/</span>
					</nav>
				{/if}
				<button class="toggle" type="button">
					<Icon name="chevron-right" size={11} />
					<span class="demo-eyebrow">// {deep ? 'RSK-014' : 'risk · register'}</span>
				</button>
			</div>
			<div class="ctx">
				<span class="ghost">Cancel</span>
				<span class="primary">{deep ? 'Save changes' : '+ Define risk'}</span>
			</div>
		</div>

		<div class="rows">
			{#each deep ? ['Statement', 'Blast radius', 'Assessment'] : ['R-014 · Vendor key rotation', 'R-021 · Unscoped API token', 'R-033 · Backup restore untested'] as row (row)}
				<div class="row"><span>{row}</span><span class="cell"></span></div>
			{/each}
		</div>
	</div>
</div>

<p class="note">
	One row, one voice. The trail carries only ancestors — the page you are on is the eyebrow.
</p>

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
		height: 150px;
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
	.left {
		display: flex;
		align-items: center;
		gap: 0.4rem;
		min-width: 0;
	}

	.crumbs {
		display: flex;
		align-items: center;
		gap: 0.35rem;
	}
	.crumb {
		font-family: var(--mono);
		font-size: 0.54rem;
		letter-spacing: 0.14em;
		text-transform: uppercase;
		color: var(--fg-dim);
	}
	.sep {
		font-family: var(--mono);
		font-size: 0.54rem;
		color: var(--fg-dim);
		opacity: 0.5;
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
