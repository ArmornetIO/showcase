<script lang="ts">
	// The QA drawer's low-emphasis action button. Every batch action (clear,
	// copy prompt, and anything a host adds later) reads the same, so the
	// drawer never grows a second one-off button style.
	import type { Snippet } from 'svelte';

	interface GhostButtonProps {
		onclick: () => void;
		/** Lift to the accent colour for the primary action in a group. */
		accent?: boolean;
		disabled?: boolean;
		title?: string;
		children: Snippet;
	}

	let { onclick, accent = false, disabled = false, title, children }: GhostButtonProps = $props();
</script>

<button class="ghost" class:accent {disabled} {title} {onclick}>
	{@render children()}
</button>

<style>
	.ghost {
		font-family: var(--mono, monospace);
		font-size: 0.6rem;
		letter-spacing: 0.06em;
		padding: 2px 7px;
		border-radius: 3px;
		border: 1px solid var(--border);
		background: transparent;
		color: var(--fg-dim);
		cursor: pointer;
		transition: color 0.12s, border-color 0.12s, background 0.12s;
	}
	.ghost:hover:not(:disabled) {
		color: var(--fg);
		border-color: var(--border-strong);
	}
	.ghost:disabled {
		opacity: 0.5;
		cursor: default;
	}

	.accent {
		color: var(--accent);
		border-color: color-mix(in srgb, var(--accent) 40%, transparent);
	}
	.accent:hover:not(:disabled) {
		color: var(--accent);
		background: var(--accent-faint);
	}
</style>
