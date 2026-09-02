<script lang="ts">
	// The inspector's live hover: a lit box over the element under the pointer,
	// with the rest of the page knocked back by an oversized shadow so the pick
	// target reads at a glance.

	interface NitHighlightProps {
		rect: DOMRect;
	}

	let { rect }: NitHighlightProps = $props();

	// The label sits above the target, unless the target is at the very top of
	// the viewport — then it would be clipped, so it tucks under the edge.
	const labelTop = $derived(Math.max(rect.top - 22, 4));
</script>

<div
	data-devcog
	class="nit-highlight"
	style="top:{rect.top}px;left:{rect.left}px;width:{rect.width}px;height:{rect.height}px;"
	aria-hidden="true"
></div>
<div
	data-devcog
	class="nit-highlight-label"
	style="top:{labelTop}px;left:{rect.left}px;"
	aria-hidden="true"
>
	click to annotate
</div>

<style>
	.nit-highlight {
		position: fixed;
		z-index: 9995;
		pointer-events: none;
		border: 2px solid var(--accent, #5eead4);
		background: rgba(94, 234, 212, 0.07);
		border-radius: 2px;
		box-shadow: 0 0 0 2000px rgba(0, 0, 0, 0.12);
	}

	.nit-highlight-label {
		position: fixed;
		z-index: 9995;
		pointer-events: none;
		font-family: var(--mono, monospace);
		font-size: 0.58rem;
		color: var(--bg, #0a0f1a);
		background: var(--accent, #5eead4);
		padding: 1px 6px;
		border-radius: 3px;
		white-space: nowrap;
	}
</style>
