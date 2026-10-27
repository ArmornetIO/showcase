<script lang="ts">
	// PROSE FIGURE — an illustration inside a document, with its caption.
	//
	// Named ProseFigure, not Figure: `lib/character/Figure.svelte` already exists
	// and is a character-art cropper. Two unrelated things called Figure in one
	// barrel is a bug waiting for whoever imports the wrong one.
	//
	// The caption is part of the component rather than the caller's job because a
	// figure without one is the defect this is meant to prevent — a diagram whose
	// point lives only in the paragraph above it stops making sense the moment
	// anybody reorders the section.
	import type { Snippet } from 'svelte';

	interface Props {
		/** The illustration: inline SVG, an `<img>`, a canvas. */
		children: Snippet;
		caption: string;
		/** `bleed` lets a wide diagram break the prose measure. */
		width?: 'measure' | 'bleed';
	}

	let { children, caption, width = 'measure' }: Props = $props();
</script>

<figure class="figure" data-width={width}>
	<div class="fig-art">{@render children()}</div>
	<figcaption>{caption}</figcaption>
</figure>

<style>
	.figure {
		margin: 2rem 0;
	}

	.fig-art {
		border: 1px solid var(--border);
		border-radius: var(--radius-surface);
		background: var(--surface-raised);
		overflow: hidden;
	}
	.fig-art :global(svg),
	.fig-art :global(img) {
		display: block;
		width: 100%;
		height: auto;
	}

	figcaption {
		margin-top: 0.6rem;
		font-size: 0.82rem;
		line-height: 1.5;
		color: var(--fg-dim);
	}

	@media (min-width: 60rem) {
		.figure[data-width='bleed'] {
			margin-inline: -3rem;
		}
	}
</style>
