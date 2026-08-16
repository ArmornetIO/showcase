<script lang="ts">
	// One component's section on a showcase page: the card it sits in, plus the
	// scroll-spy that tells the API sidebar which component you are looking at.
	//
	// The card is a `Panel` rather than a hand-rolled box — border, radius and
	// surface are the library's answer to "what does a card look like", and this
	// file has no business having a second opinion. What stays here is what Panel
	// does not do: the anchor id, the scroll offset under the sticky toolbar, and
	// the observer.
	import type { Snippet } from 'svelte';
	import Panel from '$lib/layout/Panel.svelte';
	import { showcaseState } from './showcaseState.svelte.js';

	let {
		component,
		children
	}: {
		component?: string;
		children: Snippet;
	} = $props();

	const targets = $derived(
		component ? component.split(' ').map((s) => s.trim()).filter(Boolean) : []
	);

	const anchorId = $derived(
		targets[0]
			? targets[0].replace(
					/([A-Z])/g,
					(_: string, c: string, i: number) => (i === 0 ? c.toLowerCase() : '-' + c.toLowerCase())
				)
			: undefined
	);

	let blockEl = $state<HTMLElement | null>(null);

	$effect(() => {
		if (!blockEl || !targets[0]) return;
		const primary = targets[0];
		const observer = new IntersectionObserver(
			(entries) => {
				for (const entry of entries) {
					if (entry.isIntersecting) {
						if (showcaseState.activeComponent !== primary) {
							showcaseState.activeComponent = primary;
							showcaseState.selectedCode = null;
						}
					}
				}
			},
			// Detection band: just below the toolbar, top 35% of viewport.
			// One section at a time becomes active as it scrolls into this band.
			{ rootMargin: '-52px 0px -65% 0px', threshold: 0 }
		);
		observer.observe(blockEl);
		return () => observer.disconnect();
	});
</script>

<div class="component-block" id={anchorId} bind:this={blockEl}>
	<Panel>
		<div class="block-body">
			{@render children()}
		</div>
	</Panel>
</div>

<style>
	/* The anchor target, not the card: an id and a scroll offset that clears the
	   sticky toolbar. Panel draws everything you can see. */
	.component-block {
		margin-bottom: 1.5rem;
		scroll-margin-top: 56px;
	}

	.block-body {
		display: flex;
		flex-direction: column;
		gap: 0.9rem;
	}
</style>
