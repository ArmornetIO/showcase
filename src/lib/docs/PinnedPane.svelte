<script lang="ts">
	// PINNED PANE — the artifact that stays beside the prose while it scrolls.
	//
	// The layout half of a split walkthrough. It owns the sticky positioning and the
	// step indicator; WHAT gets pinned is the caller's, because the pane must not
	// know whether it is holding a command, a config file or a table of results.
	//
	// On a narrow screen the pane cannot stay beside anything, so it is hidden
	// entirely and the caller renders the same artifact inline under each step. That
	// is a real duplication and it is the honest one — a sticky pane below the prose
	// would pin an artifact to a step the reader has already left.
	import type { Snippet } from 'svelte';
	import ProgressBar from '../display/progress/ProgressBar.svelte';

	interface Props {
		children: Snippet;
		/** Total steps, for the indicator. */
		steps: number;
		/** Zero-based index of the step currently being read. */
		current: number;
		/** CSS top offset — match the app header height so the pane pins below it. */
		topOffset?: string;
	}

	let { children, steps, current, topOffset = '0px' }: Props = $props();
</script>

<aside class="pane" style:--pane-top={topOffset} aria-live="polite">
	<div class="pane-inner">
		{#if steps > 1}
			<div class="pane-steps">
				<ProgressBar
					type="pips"
					{steps}
					filled={current + 1}
					pipSize={8}
					label="Step {current + 1} of {steps}"
				/>
			</div>
		{/if}
		<div class="pane-art">{@render children()}</div>
	</div>
</aside>

<style>
	.pane {
		position: sticky;
		top: calc(var(--pane-top) + 2rem);
		align-self: start;
		min-width: 0;
	}

	.pane-inner {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		/* Bounded to the viewport so a long artifact scrolls inside the pane instead
		   of pushing the sticky box taller than the screen, which un-sticks it. */
		max-height: calc(100vh - var(--pane-top) - 4rem);
	}

	.pane-art {
		min-height: 0;
		overflow: auto;
		scrollbar-width: thin;
	}

	@media (max-width: 60rem) {
		.pane {
			display: none;
		}
	}
</style>
