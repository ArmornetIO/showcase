<script lang="ts">
	// The always-on-screen entry point: two buttons, bottom-right, above
	// everything.
	//
	// The first arms the element inspector. It lives here rather than inside the
	// console because the element you need to click is usually under where the
	// panel would be — and because the armed state has to stay visible after the
	// console closes, or clicks get eaten with nothing on screen explaining why.
	//
	// The count rides on the inspect button so a pending batch is visible
	// without opening anything; otherwise it is easy to walk away from the page
	// with captures still unsaved.
	import DevIcon from './DevIcon.svelte';
	import { ICON_COG, ICON_QA } from './icons.js';

	interface DevCogClusterProps {
		inspecting: boolean;
		captureCount: number;
		consoleOpen: boolean;
		onToggleInspect: () => void;
		onToggleConsole: () => void;
	}

	let {
		inspecting,
		captureCount,
		consoleOpen,
		onToggleInspect,
		onToggleConsole
	}: DevCogClusterProps = $props();
</script>

<div class="dev-cluster" data-devcog>
	<button
		class="dev-btn"
		class:active={inspecting}
		class:armed={inspecting}
		title={inspecting ? 'Stop inspecting (Esc)' : 'Inspect element'}
		aria-label={inspecting ? 'Stop inspecting' : 'Inspect element'}
		aria-pressed={inspecting}
		onclick={onToggleInspect}
	>
		<DevIcon glyph={ICON_QA} />
		{#if captureCount > 0}
			<span class="dev-badge" aria-hidden="true">{captureCount > 9 ? '9+' : captureCount}</span>
		{/if}
	</button>

	<button
		class="dev-btn"
		class:active={consoleOpen}
		class:spin={consoleOpen}
		title="Dev console"
		aria-label="Open dev console"
		aria-expanded={consoleOpen}
		onclick={onToggleConsole}
	>
		<DevIcon glyph={ICON_COG} />
	</button>
</div>

<style>
	.dev-cluster {
		position: fixed;
		right: 18px;
		bottom: 18px;
		z-index: 9997;
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.dev-btn {
		position: relative;
		display: flex;
		align-items: center;
		justify-content: center;
		width: 34px;
		height: 34px;
		border-radius: 50%;
		border: 1px solid color-mix(in srgb, var(--accent) 35%, transparent);
		background: var(--bg-elev);
		color: var(--fg-dim);
		cursor: pointer;
		transition:
			color 0.15s,
			border-color 0.15s,
			box-shadow 0.15s;
	}
	.dev-btn:hover {
		color: var(--accent);
		border-color: var(--accent);
	}
	.dev-btn.active {
		color: var(--accent);
		border-color: var(--accent);
		background: var(--accent-faint);
	}

	/* Armed has to read from across the room: the page is eating clicks. */
	.dev-btn.armed {
		box-shadow: 0 0 10px var(--accent-glow);
		animation: armed-pulse 2s ease-in-out infinite;
	}
	@keyframes armed-pulse {
		0%,
		100% {
			box-shadow: 0 0 6px var(--accent-glow);
		}
		50% {
			box-shadow: 0 0 16px var(--accent-glow);
		}
	}

	.dev-btn.spin :global(svg) {
		transform: rotate(90deg);
		transition: transform 0.2s ease;
	}

	.dev-badge {
		position: absolute;
		top: -3px;
		right: -3px;
		min-width: 13px;
		height: 13px;
		padding: 0 3px;
		border-radius: 7px;
		background: var(--accent);
		color: var(--bg);
		font-family: var(--mono, monospace);
		font-size: 0.5rem;
		line-height: 13px;
		text-align: center;
	}
</style>
