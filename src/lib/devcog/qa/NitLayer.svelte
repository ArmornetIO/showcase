<script lang="ts">
	// Everything the nits tool draws on top of the host page, plus the DOM
	// plumbing that keeps it accurate. Kept apart from the drawer because these
	// are position:fixed siblings of the whole app, not drawer content — and
	// because the inspector must stay live even while the drawer is closing.
	import type { NitsController } from './nits.svelte.js';
	import NitHighlight from './NitHighlight.svelte';
	import NitNotePopup from './NitNotePopup.svelte';
	import NitOverlays from './NitOverlays.svelte';

	interface NitLayerProps {
		nits: NitsController;
		/** Show the saved-nit outlines — on while the QA drawer is open. */
		annotate: boolean;
	}

	let { nits, annotate }: NitLayerProps = $props();

	// Pointer capture only while armed; tearing down restores the cursor.
	$effect(() => {
		if (!nits.inspecting) return;
		return nits.attachInspector();
	});

	// Rects are only worth measuring while they are being drawn.
	$effect(() => {
		if (!annotate || nits.count === 0) {
			nits.clearPositions();
			return;
		}
		return nits.trackPositions();
	});
</script>

{#if annotate}
	<NitOverlays {nits} />
{/if}

{#if nits.inspecting && nits.hoverRect}
	<NitHighlight rect={nits.hoverRect} />
{/if}

{#if nits.capture}
	<NitNotePopup {nits} />
{/if}
