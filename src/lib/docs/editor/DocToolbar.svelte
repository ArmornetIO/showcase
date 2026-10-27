<script lang="ts">
	// The open document's own toolbar: everything true of THIS document — its
	// identity, its figures, how it reads — and nothing true of the session.
	import type { Snippet } from 'svelte';

	interface Props {
		/** Accent-toned lead — a document id, or its family. */
		id?: string;
		title: string;
		version?: string;
		status?: { label: string; color: string };
		/** Figures and chips after the identity. */
		children?: Snippet;
		/** Right-aligned — view switches, sign-off. */
		end?: Snippet;
	}

	let { id, title, version, status, children, end }: Props = $props();
</script>

<div
	class="flex flex-wrap items-center gap-3 border-b border-[var(--border)] px-5 py-2 font-(family-name:--mono) text-[0.6rem]"
>
	{#if id}<span class="text-[var(--accent)]">{id}</span>{/if}
	<span class="truncate text-[var(--fg)]">{title}</span>
	{#if version}<span class="text-[var(--fg-dim)]">v{version}</span>{/if}
	{#if status}
		<span
			class="rounded border px-1.5 py-0.5 text-[0.55rem] tracking-wide uppercase"
			style:color={status.color}
			style:border-color="color-mix(in srgb, {status.color} 35%, transparent)"
			style:background="color-mix(in srgb, {status.color} 10%, transparent)"
		>
			{status.label}
		</span>
	{/if}
	{#if children}{@render children()}{/if}
	<span class="flex-1"></span>
	{#if end}{@render end()}{/if}
</div>
