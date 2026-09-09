<script lang="ts">
	// A dense segmented control.
	//
	// `primitives/actions/SegmentGroup` exists and was tried first. At 0.78rem
	// with px-4 padding a four-option group wraps to two rows inside the
	// console's 376px content width and reads far heavier than the 0.58rem
	// chrome around it — so this is a density fork, not a duplicate.
	interface SegOption {
		value: string;
		label: string;
		title?: string;
	}

	interface SegProps {
		options: SegOption[];
		value: string;
		onchange: (v: string) => void;
	}

	let { options, value, onchange }: SegProps = $props();
</script>

<div class="dc-seg" role="group">
	{#each options as o (o.value)}
		<button
			type="button"
			class="dc-seg-btn"
			class:dc-seg-on={value === o.value}
			aria-pressed={value === o.value}
			title={o.title}
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
	.dc-seg-on {
		background: var(--accent-faint);
		border-color: var(--accent);
		color: var(--accent);
		position: relative;
		z-index: 1;
	}
</style>
