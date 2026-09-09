<script lang="ts">
	// The redesigned console — spec 018. Same max state as `qa-panel-max`, which
	// is the point of comparison: that one is 407 words and 2,352px of scroll,
	// this one has to hold the same 63 controls without either.
	//
	// `position: fixed` inside `.stage` resolves against the stage because the
	// stage is transformed, which keeps this off the showcase layout's own cog.
	import Console from './Console.svelte';

	let open = $state(true);
	let armed = $state(false);
	let gated = $state(false);
</script>

<div class="qa-page">
	<header class="qa-page-head">
		<h1>QA console · redesign</h1>
		<p>
			Six groups behind a rail instead of one 2,352px scroll. Every explanation moved behind an
			info dot. Dense numbers as fader banks. The inspector arms from the cluster, so the panel
			never has to be open to pick an element.
		</p>
		<label class="qa-toggle">
			<input type="checkbox" bind:checked={gated} />
			simulate a route with no globe and no mesh
		</label>
	</header>

	<div class="stage">
		<div class="cluster">
			<button
				class="cog"
				class:cog-armed={armed}
				aria-pressed={armed}
				title="Arm inspector"
				onclick={() => (armed = !armed)}>◎</button
			>
			<button class="cog" title="Console" onclick={() => (open = !open)}>⚙</button>
			{#if armed}<span class="armed-tag">armed</span>{/if}
		</div>

		{#if open}
			<Console {gated} onClose={() => (open = false)} />
		{/if}
	</div>
</div>

<style>
	.qa-page {
		padding: 1.5rem 1.75rem 3rem;
		max-width: 1400px;
	}
	.qa-page-head h1 {
		margin: 0 0 0.35rem;
		font-family: var(--mono, monospace);
		font-size: 0.95rem;
		letter-spacing: 0.06em;
		color: var(--fg);
	}
	.qa-page-head p {
		margin: 0 0 0.75rem;
		max-width: 64ch;
		font-size: 0.78rem;
		line-height: 1.55;
		color: var(--fg-dim);
	}
	.qa-toggle {
		display: inline-flex;
		align-items: center;
		gap: 0.4rem;
		margin-bottom: 1.25rem;
		font-family: var(--mono, monospace);
		font-size: 0.62rem;
		color: var(--fg-dim);
		cursor: pointer;
	}

	.stage {
		position: relative;
		transform: translateZ(0);
		height: 760px;
		border: 1px solid var(--border);
		border-radius: var(--radius-panel, 8px);
		background: var(--bg);
		overflow: hidden;
	}

	.cluster {
		position: absolute;
		right: 436px;
		bottom: 16px;
		display: flex;
		align-items: center;
		gap: 8px;
	}
	.cog {
		width: 34px;
		height: 34px;
		border-radius: 50%;
		border: 1px solid color-mix(in srgb, var(--accent) 45%, transparent);
		background: var(--bg-elev);
		color: var(--accent);
		font-size: 0.85rem;
		cursor: pointer;
	}
	.cog-armed {
		box-shadow: 0 0 12px var(--accent-glow);
		background: var(--accent-faint);
	}
	.armed-tag {
		font-family: var(--mono, monospace);
		font-size: 0.55rem;
		letter-spacing: 0.14em;
		text-transform: uppercase;
		color: var(--accent);
	}
</style>
