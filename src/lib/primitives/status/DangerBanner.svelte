<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		title: string;
		message: string;
		/** Optional action (e.g. a danger Button) placed at the right end. */
		action?: Snippet;
		/**
		 * `danger` is something broken. `caution` is something that WILL break if
		 * you do not read it — a breaking change in a release, a one-way migration
		 * step. Both need the same "stop and read this" weight, which is why they
		 * are one component; red for a warning about the future would cry wolf, and
		 * a second component would drift from this one's proportions.
		 */
		tone?: 'danger' | 'caution';
	}

	let { title, message, action, tone = 'danger' }: Props = $props();
</script>

<div class="danger-banner" data-tone={tone}>
	<div class="db-text">
		<div class="db-title">{title}</div>
		<div class="db-msg">{message}</div>
	</div>
	{#if action}
		{@render action()}
	{/if}
</div>

<style>
	.danger-banner {
		--db-hue: #f87171;
		display: flex;
		align-items: center;
		gap: 24px;
		padding: 22px 26px;
		border: 1px solid color-mix(in srgb, var(--db-hue) 40%, transparent);
		border-radius: var(--radius-control);
		background: color-mix(in srgb, var(--db-hue) 4%, transparent);
	}
	.danger-banner[data-tone='caution'] {
		--db-hue: var(--palette-amber, #fcd34d);
	}
	.db-text {
		flex: 1;
		min-width: 0;
	}
	.db-title {
		font-family: var(--mono);
		font-size: 13px;
		letter-spacing: 0.18em;
		text-transform: uppercase;
		color: var(--db-hue);
		margin-bottom: 8px;
	}
	.db-msg {
		font-family: var(--mono);
		font-size: 13px;
		color: var(--fg-muted);
		letter-spacing: 0.02em;
	}
</style>
