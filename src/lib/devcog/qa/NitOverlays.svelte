<script lang="ts">
	// Ghost outlines over every element that already carries a nit, so the
	// batch is visible on the page itself and not just as a list of selectors.
	// Rects come from the controller, which re-measures on scroll and resize.
	import DevIcon from '../DevIcon.svelte';
	import { ICON_NOTE } from '../icons.js';
	import type { NitsController } from './nits.svelte.js';

	interface NitOverlaysProps {
		nits: NitsController;
	}

	let { nits }: NitOverlaysProps = $props();
</script>

{#each nits.nits as nit (nit.id)}
	{@const rect = nits.positions[nit.id]}
	{#if rect && rect.width > 0 && rect.height > 0}
		<div
			data-devcog
			class="nit-ann-outline"
			style="top:{rect.top}px;left:{rect.left}px;width:{rect.width}px;height:{rect.height}px;"
			aria-hidden="true"
		></div>
		<div
			data-devcog
			class="nit-ann-badge"
			style="top:{rect.top - 9}px;left:{rect.right - 9}px;"
			aria-hidden="true"
			title={nit.note}
		>
			<DevIcon glyph={ICON_NOTE} size={12} />
		</div>
	{/if}
{/each}

<style>
	.nit-ann-outline {
		position: fixed;
		z-index: 9994;
		pointer-events: none;
		border: 1.5px dashed rgba(140, 140, 160, 0.35);
		border-radius: 2px;
		background: rgba(140, 140, 160, 0.04);
	}

	.nit-ann-badge {
		position: fixed;
		z-index: 9994;
		pointer-events: none;
		width: 18px;
		height: 18px;
		display: flex;
		align-items: center;
		justify-content: center;
		background: rgba(251, 191, 36, 0.9);
		border-radius: 3px;
		box-shadow: 0 1px 4px rgba(0, 0, 0, 0.4);
		color: rgba(0, 0, 0, 0.75);
	}
</style>
