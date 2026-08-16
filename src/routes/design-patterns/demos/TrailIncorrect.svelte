<script lang="ts">
	import Icon from '$lib/icons/Icon.svelte';

	// The loose strip: a breadcrumb bar parked above the header, on its own line,
	// in its own measure — and repeating the page it already sits on.
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
		<!-- Own line, own gutter, own type scale. Nothing lines it up with anything. -->
		<div class="strip">
			<span class="crumb">Risk register</span>
			<span class="sep">/</span>
			<span class="crumb crumb-now">{deep ? 'RSK-014' : 'Register'}</span>
		</div>

		<div class="eyebrow-row">
			<button class="toggle" type="button">
				<Icon name="chevron-right" size={11} />
				<span class="demo-eyebrow">// {deep ? 'RSK-014' : 'risk · register'}</span>
			</button>
			<div class="ctx">
				<span class="ghost">Cancel</span>
				<span class="primary">{deep ? 'Save changes' : '+ Define risk'}</span>
			</div>
		</div>

		<div class="rows">
			{#each deep ? ['Statement', 'Blast radius'] : ['R-014 · Vendor key rotation', 'R-021 · Unscoped API token'] as row (row)}
				<div class="row"><span>{row}</span><span class="cell"></span></div>
			{/each}
		</div>
	</div>
</div>

<p class="note">
	Two rows saying the same name twice, and the trail is flush left while the header is not.
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
		border-color: rgba(248, 113, 113, 0.4);
		background: rgba(248, 113, 113, 0.08);
		color: var(--palette-red);
	}

	.page {
		border: 1px solid var(--border);
		border-radius: 6px;
		background: var(--bg);
		padding: 0 0.75rem;
		height: 150px;
		overflow: hidden;
	}

	/* Deliberately mismatched: sans, sentence case, no gutter, its own margin. */
	.strip {
		display: flex;
		align-items: center;
		gap: 0.3rem;
		margin: 0 -0.75rem 0.35rem;
		padding: 0.5rem 0.2rem 0;
	}
	.crumb {
		font-size: 0.6rem;
		color: var(--fg-dim);
	}
	.crumb-now {
		color: var(--fg-muted);
	}
	.sep {
		font-size: 0.6rem;
		color: var(--fg-dim);
		opacity: 0.6;
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
		color: var(--palette-red);
	}
</style>
