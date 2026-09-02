<script lang="ts">
	interface Props {
		visible: boolean;
		locked: boolean;
		onToggleVisible: () => void;
		onToggleLocked: () => void;
	}

	let { visible, locked, onToggleVisible, onToggleLocked }: Props = $props();
</script>

<div class="layer-controls">
	<!-- svelte-ignore a11y_consider_explicit_label -->
	<button
		class="lc-btn"
		class:lc-btn--off={!visible}
		onclick={onToggleVisible}
		title={visible ? 'Hide' : 'Show'}
	>
		{visible ? '●' : '○'}
	</button>
	<!-- svelte-ignore a11y_consider_explicit_label -->
	<button
		class="lc-btn"
		class:lc-btn--active={locked}
		onclick={onToggleLocked}
		title={locked ? 'Unlock' : 'Lock'}
	>
		{locked ? '⚿' : '○'}
	</button>
</div>

<style>
	.layer-controls {
		display: flex;
		align-items: center;
		gap: 1px;
		flex-shrink: 0;
	}

	.lc-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 20px;
		height: 20px;
		border: none;
		background: none;
		cursor: pointer;
		border-radius: 2px;
		padding: 0;
		opacity: 0.3;
		transition:
			opacity 0.12s,
			background 0.12s;
		font-size: 10px;
		line-height: 1;
		color: var(--fg-muted);
	}

	.lc-btn:hover {
		opacity: 1;
		background: rgba(94, 234, 212, 0.08);
	}

	.lc-btn--off {
		opacity: 0.2;
		color: var(--fg-dim);
	}

	.lc-btn--active {
		opacity: 0.85;
		color: rgba(250, 204, 21, 0.85);
	}

	.lc-btn--active:hover {
		opacity: 1;
		color: rgb(250, 204, 21);
	}
</style>
