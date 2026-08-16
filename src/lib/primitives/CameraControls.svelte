<script lang="ts">
	import { getContext } from 'svelte';
	import { CANVAS_CTX } from './canvas-camera.js';
	import type { CanvasContextValue } from './canvas-camera.js';

	let {
		position = 'bottom-left',
		showFit = true,
	}: {
		position?: 'bottom-left' | 'bottom-right';
		showFit?: boolean;
	} = $props();

	const { camera } = getContext<CanvasContextValue>(CANVAS_CTX);
</script>

<div class="cv-controls" class:cv-controls--right={position === 'bottom-right'}>
	<button class="cv-ctrl-btn" onclick={() => camera.zoomIn()}  title="Zoom in">+</button>
	<button class="cv-ctrl-btn" onclick={() => camera.zoomOut()} title="Zoom out">−</button>
	{#if showFit}
		<button class="cv-ctrl-btn" onclick={() => camera.fitAll()} title="Fit all">⊙</button>
	{/if}
</div>

<style>
	.cv-controls {
		position: absolute;
		bottom: 20px;
		left: 16px;
		display: flex;
		flex-direction: column;
		gap: 4px;
		z-index: 10;
	}
	.cv-controls--right {
		left: auto;
		right: 16px;
	}

	.cv-ctrl-btn {
		width: 32px;
		height: 32px;
		display: flex;
		align-items: center;
		justify-content: center;
		background: var(--bg-elev);
		border: 1px solid var(--border);
		border-radius: 6px;
		color: var(--fg-muted);
		font-size: 14px;
		cursor: pointer;
		transition: border-color 0.15s, color 0.15s;
	}
	.cv-ctrl-btn:hover {
		border-color: var(--accent);
		color: var(--accent);
	}
</style>
