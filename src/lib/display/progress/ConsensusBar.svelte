<script lang="ts">
	interface ConsensusBarProps {
		pct: number;
		label?: string;
	}

	let { pct, label }: ConsensusBarProps = $props();

	const clamped = $derived(Math.min(100, Math.max(0, pct)));
</script>

<div class="consensus-bar">
	<div class="cb-header">
		{#if label}
			<span class="cb-label">{label}</span>
		{:else}
			<span></span>
		{/if}
		<span class="cb-pct">{clamped}% YES</span>
	</div>
	<div class="cb-track">
		<div class="cb-fill" style:width="{clamped}%"></div>
	</div>
</div>

<style>
	.consensus-bar {
		display: flex;
		flex-direction: column;
		gap: 5px;
		width: 100%;
	}

	.cb-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
	}

	.cb-label,
	.cb-pct {
		font-family: var(--mono);
		font-size: 10px;
		color: var(--fg-dim);
	}

	.cb-track {
		width: 100%;
		height: 6px;
		background: rgba(255, 255, 255, 0.08);
		border-radius: var(--radius-hairline);
		overflow: hidden;
	}

	.cb-fill {
		height: 100%;
		background: var(--palette-emerald);
		border-radius: var(--radius-hairline);
		transition: width 0.4s ease;
	}
</style>
