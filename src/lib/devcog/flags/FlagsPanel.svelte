<script lang="ts">
	// The flags popup: serve mode, every flag with its provenance, and the perf
	// monitor when the host asks for it. Anchored above the cog cluster.
	import PerfPanel from '../../perf/PerfPanel.svelte';
	import type { FlagSnapshot } from './engine.js';
	import FlagRow from './FlagRow.svelte';
	import ModeSwitcher from './ModeSwitcher.svelte';

	interface FlagsPanelProps {
		snap: FlagSnapshot[];
		mode: string;
		modes: readonly string[];
		flagLabel?: (key: string) => string | undefined;
		flagsHref: string;
		showPerf: boolean;
		onToggle: (key: string, enabled: boolean) => void;
		onModeChange: (mode: string) => void;
		onClose: () => void;
	}

	let {
		snap,
		mode,
		modes,
		flagLabel,
		flagsHref,
		showPerf,
		onToggle,
		onModeChange,
		onClose
	}: FlagsPanelProps = $props();

	const enabledCount = $derived(snap.filter((f) => f.enabled).length);
</script>

<button class="flags-backdrop" data-devcog onclick={onClose} aria-label="Close feature flags"
></button>

<div class="flags-popup" data-devcog role="dialog" aria-label="Feature flags">
	<div class="flags-header">
		<span class="flags-title">// flags</span>
		<ModeSwitcher {mode} {modes} onChange={onModeChange} />
	</div>

	{#if snap.length === 0}
		<p class="flags-empty">No flags registered.</p>
	{:else}
		<ul class="flag-list">
			{#each snap as flag (flag.key)}
				<FlagRow {flag} label={flagLabel?.(flag.key)} {onToggle} />
			{/each}
		</ul>
	{/if}

	{#if showPerf}
		<PerfPanel />
	{/if}

	<!-- The count rides in the footer, not the header: the header row is already
	     exactly as wide as the serve-mode switcher needs, and anything added
	     beside the title pushes the last mode off the popup's clipped edge. -->
	<div class="flags-footer">
		<span class="flags-count">{enabledCount} of {snap.length} on</span>
		<a href={flagsHref} onclick={onClose}>full flags page →</a>
	</div>
</div>

<style>
	.flags-backdrop {
		position: fixed;
		inset: 0;
		z-index: 9997;
		background: transparent;
		border: none;
		cursor: default;
	}

	.flags-popup {
		position: fixed;
		bottom: 5.5rem;
		right: 1.25rem;
		z-index: 9998;
		width: 272px;
		background: var(--bg-elev);
		border: 1px solid var(--border);
		border-radius: 10px;
		box-shadow: 0 8px 40px rgba(0, 0, 0, 0.7);
		overflow: hidden;
		max-height: calc(100vh - 7rem);
		display: flex;
		flex-direction: column;
	}

	.flags-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 0.6rem 1rem;
		border-bottom: 1px solid var(--border);
		flex-shrink: 0;
		gap: 0.5rem;
	}
	.flags-title {
		font-family: var(--mono, monospace);
		font-size: 0.65rem;
		color: var(--fg-dim);
		letter-spacing: 0.1em;
		flex-shrink: 0;
	}
	.flags-count {
		font-family: var(--mono, monospace);
		font-size: 0.6rem;
		color: var(--fg-dim);
		letter-spacing: 0.06em;
	}

	.flag-list {
		list-style: none;
		padding: 0;
		margin: 0;
		overflow-y: auto;
		flex: 1;
	}

	.flags-empty {
		margin: 0;
		padding: 1rem;
		font-family: var(--mono, monospace);
		font-size: 0.68rem;
		color: var(--fg-dim);
	}

	.flags-footer {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.5rem;
		padding: 0.55rem 1rem;
		border-top: 1px solid var(--border);
		flex-shrink: 0;
	}
	.flags-footer a {
		font-family: var(--mono, monospace);
		font-size: 0.65rem;
		color: var(--fg-dim);
		text-decoration: none;
		transition: color 0.15s;
	}
	.flags-footer a:hover {
		color: var(--accent);
	}
</style>
