<script lang="ts">
	import type { Snippet } from 'svelte';
	import Button from './Button.svelte';
	import type { ButtonVariant, ButtonSize } from './Button.svelte';

	export interface ActionBarAction {
		label: string;
		variant?: ButtonVariant;
		size?: ButtonSize;
		disabled?: boolean;
		loading?: boolean;
		/**
		 * Which end of the bar the action sits at. Defaults to `start`, so a bar
		 * declared without sides keeps its plain left-to-right row.
		 */
		side?: 'start' | 'end';
		onclick: () => void;
	}

	interface ActionBarProps {
		actions: ActionBarAction[];
		/**
		 * Pin the bar to the bottom of the scroll container and give it a card
		 * border, so the commit action stays reachable on a long form instead of
		 * living at the far end of the scroll.
		 */
		sticky?: boolean;
		/**
		 * Status text between the two ends — what committing does right now.
		 * Pushes any `end` actions to the right edge.
		 */
		hint?: Snippet;
	}

	let { actions, sticky = false, hint }: ActionBarProps = $props();

	const starts = $derived(actions.filter((a) => (a.side ?? 'start') === 'start'));
	const ends = $derived(actions.filter((a) => a.side === 'end'));
	const split = $derived(!!hint || ends.length > 0);
</script>

<div class="bar {sticky ? 'bar-sticky' : 'bar-plain'}">
	{#each starts as action (action.label)}
		<Button
			variant={action.variant ?? 'ghost'}
			size={action.size ?? 'md'}
			disabled={action.disabled}
			loading={action.loading}
			onclick={action.onclick}
		>
			{action.label}
		</Button>
	{/each}

	{#if split}
		<span class="bar-spacer"></span>
	{/if}
	{#if hint}
		<span class="bar-hint">{@render hint()}</span>
	{/if}

	{#each ends as action (action.label)}
		<Button
			variant={action.variant ?? 'ghost'}
			size={action.size ?? 'md'}
			disabled={action.disabled}
			loading={action.loading}
			onclick={action.onclick}
		>
			{action.label}
		</Button>
	{/each}
</div>

<style>
	.bar {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}
	/* The original bar: a plain wrapping row under a hairline rule. */
	.bar-plain {
		flex-wrap: wrap;
		padding-top: 1rem;
		border-top: 1px solid rgba(94, 234, 212, 0.1);
	}
	@media (min-width: 640px) {
		.bar-plain {
			gap: 10px;
		}
	}
	/* Accent border + upward shadow so the bar reads as floating above the
	   content it commits, not as another card in the column. */
	.bar-sticky {
		position: sticky;
		bottom: 0;
		z-index: 20;
		gap: 0.75rem;
		padding: 0.7rem 1rem;
		border: 1px solid var(--accent);
		border-radius: var(--radius-surface);
		background: var(--bg-elev);
		box-shadow: 0 -10px 30px -12px rgba(0, 0, 0, 0.9);
	}
	.bar-spacer {
		flex: 1;
	}
	.bar-hint {
		display: inline-flex;
		align-items: center;
		gap: 0.4rem;
		font-family: var(--mono);
		font-size: 0.66rem;
		color: var(--fg-muted);
	}
</style>
