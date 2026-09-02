<script lang="ts">
	// The always-on-screen entry point: two buttons, bottom-right, above
	// everything. The QA button carries a count so an open nit batch is visible
	// without opening the drawer — otherwise it is easy to walk away from the
	// page with captures still pending.
	import DevIcon from './DevIcon.svelte';
	import { ICON_COG, ICON_QA } from './icons.js';

	interface DevCogClusterProps {
		qaActive: boolean;
		qaCount: number;
		flagsOpen: boolean;
		onToggleQa: () => void;
		onToggleFlags: () => void;
	}

	let { qaActive, qaCount, flagsOpen, onToggleQa, onToggleFlags }: DevCogClusterProps = $props();
</script>

<div class="dev-cluster" data-devcog>
	<button
		class="dev-btn"
		class:active={qaActive}
		title="QA tools"
		aria-label="Open QA tools"
		aria-expanded={qaActive}
		onclick={onToggleQa}
	>
		<DevIcon glyph={ICON_QA} />
		{#if qaCount > 0}
			<span class="dev-badge" aria-hidden="true">{qaCount > 9 ? '9+' : qaCount}</span>
		{/if}
	</button>

	<button
		class="dev-btn"
		class:active={flagsOpen}
		class:spin={flagsOpen}
		title="Feature flags"
		aria-label="Open feature flags"
		aria-expanded={flagsOpen}
		onclick={onToggleFlags}
	>
		<DevIcon glyph={ICON_COG} />
	</button>
</div>

<style>
	.dev-cluster {
		position: fixed;
		bottom: 1.25rem;
		right: 1.25rem;
		z-index: 9999;
		display: flex;
		flex-direction: column;
		gap: 6px;
		align-items: center;
	}

	.dev-btn {
		position: relative;
		width: 34px;
		height: 34px;
		border-radius: 50%;
		border: 1px solid var(--border-accent);
		background: var(--bg-elev);
		color: var(--fg-dim);
		display: flex;
		align-items: center;
		justify-content: center;
		cursor: pointer;
		transition: color 0.15s, border-color 0.15s, transform 0.3s, background 0.15s;
		box-shadow: 0 2px 12px rgba(0, 0, 0, 0.5);
	}
	.dev-btn:hover {
		color: var(--accent);
		border-color: var(--accent-glow);
		background: var(--accent-faint);
	}
	.dev-btn.active {
		color: var(--accent);
		border-color: var(--accent);
		background: var(--accent-faint);
	}
	.dev-btn.spin {
		transform: rotate(45deg);
	}

	.dev-badge {
		position: absolute;
		top: -3px;
		right: -3px;
		min-width: 15px;
		height: 15px;
		padding: 0 3px;
		box-sizing: border-box;
		border-radius: 8px;
		background: rgba(251, 191, 36, 0.92);
		color: rgba(0, 0, 0, 0.8);
		font-family: var(--mono, monospace);
		font-size: 0.52rem;
		line-height: 15px;
		text-align: center;
		font-weight: 600;
		box-shadow: 0 1px 4px rgba(0, 0, 0, 0.5);
	}
</style>
