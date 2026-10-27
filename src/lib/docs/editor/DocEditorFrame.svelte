<script lang="ts">
	// The document editor's frame: the host's header across the full width, the rail,
	// and the document. There is no inspector panel — everything one would carry
	// belongs to a section, so it docks to the section.
	import type { Snippet } from 'svelte';

	interface Props {
		/** Full width, unstyled — the host brings its own page header. */
		header?: Snippet;
		rail?: Snippet;
		children: Snippet;
	}

	let { header, rail, children }: Props = $props();
</script>

<div
	class="grid h-[100dvh] bg-[var(--page-bg)] text-[var(--fg)]"
	style:grid-template-rows="auto minmax(0,1fr)"
	style:grid-template-columns={rail ? 'clamp(220px,18vw,300px) minmax(0,1fr)' : 'minmax(0,1fr)'}
>
	{#if header}
		<div style:grid-column="1 / -1">{@render header()}</div>
	{/if}

	{#if rail}
		<div class="min-h-0 overflow-hidden border-r border-[var(--border)]">
			{@render rail()}
		</div>
	{/if}

	<main class="flex min-h-0 min-w-0 flex-col bg-[var(--bg)]">
		{@render children()}
	</main>
</div>
