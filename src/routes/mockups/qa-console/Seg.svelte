<script lang="ts">
	// A dense segmented control. `primitives/actions/SegmentGroup` exists, but
	// at 0.78rem with px-4 padding it wraps to two rows inside a 376px panel —
	// too coarse for an instrument this tight.
	interface Props {
		options: { value: string; label: string }[];
		value: string;
		onchange: (v: string) => void;
	}
	let { options, value, onchange }: Props = $props();
</script>

<div class="dc-seg" role="group">
	{#each options as o (o.value)}
		<button
			type="button"
			class="dc-seg-btn"
			class:dc-on={value === o.value}
			aria-pressed={value === o.value}
			onclick={() => onchange(o.value)}>{o.label}</button
		>
	{/each}
</div>

<style>
	.dc-seg {
		display: flex;
		min-width: 0;
	}
	.dc-seg-btn {
		flex: 1;
		min-width: 0;
		font-family: var(--mono, monospace);
		font-size: 0.58rem;
		padding: 3px 6px;
		border: 1px solid var(--border);
		background: transparent;
		color: var(--fg-muted);
		cursor: pointer;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.dc-seg-btn + .dc-seg-btn {
		margin-left: -1px;
	}
	.dc-seg-btn:first-child {
		border-radius: 4px 0 0 4px;
	}
	.dc-seg-btn:last-child {
		border-radius: 0 4px 4px 0;
	}
	.dc-seg-btn:hover {
		color: var(--fg);
	}
	.dc-on {
		background: var(--accent-faint);
		border-color: var(--accent);
		color: var(--accent);
		position: relative;
		z-index: 1;
	}
</style>
