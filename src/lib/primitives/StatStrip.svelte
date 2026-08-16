<script lang="ts" module>
	export type StatStripColor = 'default' | 'red' | 'warn';

	export interface StatStripItem {
		value: string;
		label: string;
		color?: StatStripColor;
	}
</script>

<script lang="ts">
	import FrameNumber from '../frames/FrameNumber.svelte';

	interface Props {
		items: StatStripItem[];
		class?: string;
	}

	let { items, class: cls = '' }: Props = $props();
</script>

<div class="stat-strip {cls}">
	{#each items as item, i (i)}
		{#if i > 0}
			<div class="ss-sep" aria-hidden="true"></div>
		{/if}
		<div class="ss-item {item.color ?? ''}">
			<!-- Inside a pre-load Frame each value rolls (fixed width); labels stay. -->
			<span class="v"><FrameNumber value={item.value} /></span>
			{item.label}
		</div>
	{/each}
</div>

<style>
	.stat-strip {
		display: flex;
		align-items: center;
		gap: 8px;
		border: 1px solid var(--border);
		border-radius: 8px;
		padding: 16px 20px;
		background: var(--bg-elev);
		flex-wrap: wrap;
	}
	.ss-item {
		display: flex;
		align-items: center;
		gap: 9px;
		font-family: var(--mono);
		font-size: 12px;
		letter-spacing: 0.12em;
		text-transform: uppercase;
		color: var(--fg-dim);
		padding-right: 24px;
	}
	.ss-item .v {
		font-family: var(--mono-display);
		font-weight: 900;
		font-size: 18px;
		color: var(--fg);
	}
	.ss-item.red .v { color: var(--palette-red); }
	.ss-item.warn .v { color: var(--palette-amber); }
	.ss-sep {
		width: 1px;
		height: 22px;
		background: var(--border);
		margin-right: 24px;
		flex-shrink: 0;
	}
</style>
