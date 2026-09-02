<script lang="ts">
	// Radius slider + the two terminal actions. Presentational: state arrives as
	// props, intent leaves as callbacks.
	import { RADIUS_DEFAULT } from './specs.js';

	interface Props {
		showRadius: boolean;
		borderRadius: number | null;
		hasChanges: boolean;
		canAdd: boolean;
		copied: boolean;
		onradius: (px: number | null) => void;
		oncopy: () => void;
		onadd: () => void;
	}
	let {
		showRadius,
		borderRadius,
		hasChanges,
		canAdd,
		copied,
		onradius,
		oncopy,
		onadd
	}: Props = $props();
</script>

<div class="row">
	{#if showRadius}
		<span class="label" id="ts-radius-label">RADIUS</span>
		<input
			type="range"
			class="range"
			min="0"
			max="16"
			step="2"
			aria-labelledby="ts-radius-label"
			value={borderRadius ?? RADIUS_DEFAULT}
			oninput={(e) => onradius(Number((e.currentTarget as HTMLInputElement).value))}
		/>
		<span class="val">{borderRadius ?? RADIUS_DEFAULT}px</span>
		{#if borderRadius !== null}
			<button class="link" onclick={() => onradius(null)} aria-label="Reset radius">↩</button>
		{/if}
	{/if}

	<div class="spacer"></div>

	<button class="btn secondary" onclick={oncopy} disabled={!hasChanges}>
		{copied ? '✓ Copied' : 'Copy prompt'}
	</button>
	<button class="btn primary" onclick={onadd} disabled={!canAdd}> + Add to canvas </button>
</div>

<style>
	.row {
		display: flex;
		align-items: center;
		gap: 10px;
		padding: 10px 24px 14px;
		border-top: 1px solid var(--border);
	}

	.label {
		font-family: var(--mono);
		font-size: 0.48rem;
		letter-spacing: 0.25em;
		text-transform: uppercase;
		color: var(--fg-dim);
		flex-shrink: 0;
	}

	.range {
		width: 160px;
		accent-color: var(--accent);
		cursor: pointer;
		flex-shrink: 0;
	}

	.val {
		font-family: var(--mono);
		font-size: 0.68rem;
		color: var(--fg-muted);
		min-width: 30px;
		flex-shrink: 0;
	}

	.link {
		font-size: 0.65rem;
		padding: 2px 4px;
		color: var(--fg-muted);
		background: transparent;
		border: none;
		cursor: pointer;
		transition: color 0.12s;
	}
	.link:hover {
		color: var(--fg);
	}

	.spacer {
		flex: 1;
	}

	.btn {
		padding: 7px 16px;
		font-size: 0.76rem;
		font-family: var(--sans);
		border-radius: 5px;
		cursor: pointer;
		transition: all 0.14s;
		white-space: nowrap;
		flex-shrink: 0;
	}
	.btn:disabled {
		opacity: 0.35;
		cursor: default;
	}

	.primary {
		background: var(--accent);
		color: var(--btn-primary-fg);
		border: none;
		font-weight: 500;
	}
	.primary:hover:not(:disabled) {
		opacity: 0.88;
	}

	.secondary {
		background: transparent;
		color: var(--fg-muted);
		border: 1px solid var(--border);
	}
	.secondary:hover:not(:disabled) {
		color: var(--fg);
		border-color: var(--border-strong);
	}
</style>
