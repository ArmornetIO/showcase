<script lang="ts">
	// Dev-cog controls for the ItemFrames plugin. Drop into DevCog's `qaContent`
	// snippet. "Simulate slow loading" holds every GET so the real pre-load
	// scaffolds stay on screen; "Force frames" freezes them regardless of data.
	import { frameControl } from './control.svelte.js';

	const PRESETS = [
		{ label: 'Off', ms: 0 },
		{ label: '1s', ms: 1000 },
		{ label: '3s', ms: 3000 },
		{ label: '8s', ms: 8000 }
	];
</script>

<div class="fdc">
	<div class="fdc-row">
		<span class="fdc-label">ITEMFRAMES · SLOW LOADING</span>
		<div class="fdc-btns">
			{#each PRESETS as p}
				<button
					class="fdc-btn"
					class:fdc-active={frameControl.devLatencyMs === p.ms}
					onclick={() => (frameControl.devLatencyMs = p.ms)}
					title="Add {p.ms}ms to every GET">{p.label}</button
				>
			{/each}
		</div>
	</div>
	<label class="fdc-toggle">
		<input type="checkbox" bind:checked={frameControl.forceFrames} />
		<span>Force frames (freeze every scaffold on)</span>
	</label>
	<p class="fdc-hint">
		Latency delays real GETs so the shimmer holds; Force pins scaffolds regardless of data.
	</p>
</div>

<style>
	.fdc {
		display: flex;
		flex-direction: column;
		gap: 0.55rem;
		font-family: var(--mono);
	}
	.fdc-row {
		display: flex;
		flex-direction: column;
		gap: 0.35rem;
	}
	.fdc-label {
		font-size: 0.6rem;
		letter-spacing: 0.18em;
		color: var(--fg-dim);
	}
	.fdc-btns {
		display: flex;
		gap: 0.3rem;
	}
	.fdc-btn {
		flex: 1;
		padding: 0.3rem 0;
		font-size: 0.62rem;
		letter-spacing: 0.1em;
		border: 1px solid var(--border);
		border-radius: var(--radius-control);
		background: var(--bg-elev);
		color: var(--fg-dim);
		cursor: pointer;
		transition: border-color 0.15s ease, color 0.15s ease;
	}
	.fdc-btn:hover {
		border-color: var(--accent);
		color: var(--fg);
	}
	.fdc-active {
		border-color: var(--accent);
		color: var(--accent);
		box-shadow: 0 0 0 1px rgba(94, 234, 212, 0.25);
	}
	.fdc-toggle {
		display: flex;
		align-items: center;
		gap: 0.45rem;
		font-size: 0.66rem;
		color: var(--fg);
		cursor: pointer;
	}
	.fdc-hint {
		margin: 0;
		font-size: 0.58rem;
		line-height: 1.4;
		color: var(--fg-dim);
	}
</style>
