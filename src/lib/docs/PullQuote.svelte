<script lang="ts">
	// PULL QUOTE — a sentence lifted out of the measure to be read on its own.
	//
	// Not a blockquote. A blockquote attributes something to someone else; a pull
	// quote repeats the document's OWN sentence at a size that stops the eye. They
	// look similar and mean opposite things, which is why this is a separate
	// component rather than a blockquote variant.
	import type { Snippet } from 'svelte';

	interface Props {
		children: Snippet;
		/** Attribution, when the line is genuinely a quotation. */
		cite?: string;
	}

	let { children, cite }: Props = $props();
</script>

<figure class="pull">
	<blockquote>{@render children()}</blockquote>
	{#if cite}
		<figcaption>{cite}</figcaption>
	{/if}
</figure>

<style>
	/* Negative inline margin at width, so the quote breaks the prose measure and
	   reads as an interruption. It collapses to flush at narrow widths, where
	   there is no margin to break into. */
	.pull {
		margin: 2.25rem 0;
		padding-left: 1.25rem;
		border-left: 2px solid var(--accent);
	}

	@media (min-width: 60rem) {
		.pull {
			margin-inline: -2.5rem 0;
		}
	}

	.pull blockquote {
		margin: 0;
		font-size: 1.3rem;
		line-height: 1.4;
		letter-spacing: -0.01em;
		color: var(--fg);
		font-style: normal;
	}

	.pull figcaption {
		margin-top: 0.6rem;
		font-family: var(--mono);
		font-size: 0.68rem;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		color: var(--fg-dim);
	}
</style>
