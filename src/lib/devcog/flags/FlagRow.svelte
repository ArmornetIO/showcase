<script lang="ts">
	// One feature flag: its label, where its current value came from, and the
	// switch that overrides it.
	import type { FlagSnapshot } from './engine.js';

	interface FlagRowProps {
		flag: FlagSnapshot;
		/** Friendly name; falls back to the raw key. */
		label?: string;
		onToggle: (key: string, enabled: boolean) => void;
	}

	let { flag, label, onToggle }: FlagRowProps = $props();

	const name = $derived(label ?? flag.key);
</script>

<li class="flag-row">
	<div class="flag-info">
		<span class="flag-label">{name}</span>
		<span class="flag-source" data-source={flag.source}>{flag.source}</span>
	</div>
	<button
		class="toggle"
		class:on={flag.enabled}
		role="switch"
		aria-checked={flag.enabled}
		aria-label="{flag.enabled ? 'Disable' : 'Enable'} {name}"
		onclick={() => onToggle(flag.key, !flag.enabled)}
	>
		<span class="thumb"></span>
	</button>
</li>

<style>
	.flag-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 0.55rem 1rem;
		border-bottom: 1px solid var(--border);
	}
	.flag-row:last-child {
		border-bottom: 0;
	}

	.flag-info {
		display: flex;
		flex-direction: column;
		gap: 0.12rem;
	}
	.flag-label {
		font-size: 0.8rem;
		color: var(--fg);
	}
	.flag-source {
		font-family: var(--mono, monospace);
		font-size: 0.58rem;
		color: var(--fg-dim);
		letter-spacing: 0.06em;
	}
	.flag-source[data-source='override'] {
		color: var(--accent);
	}
	.flag-source[data-source='server'] {
		color: var(--fg-muted);
	}

	.toggle {
		position: relative;
		width: 32px;
		height: 18px;
		border-radius: 9px;
		border: 1px solid var(--border-strong);
		background: var(--border);
		cursor: pointer;
		transition: background 0.2s, border-color 0.2s;
		padding: 0;
		flex-shrink: 0;
	}
	.toggle.on {
		background: var(--accent-faint-strong);
		border-color: var(--border-accent);
	}
	.thumb {
		position: absolute;
		top: 2px;
		left: 2px;
		width: 12px;
		height: 12px;
		border-radius: 50%;
		background: var(--fg-dim);
		transition: transform 0.2s, background 0.2s;
	}
	.toggle.on .thumb {
		transform: translateX(14px);
		background: var(--accent);
	}
</style>
