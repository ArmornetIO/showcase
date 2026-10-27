<script lang="ts">
	// Renders nothing in the page. Every instance writes the same resolved
	// title, so which one's head effect runs last no longer matters. The icon
	// needs no stack: a browser uses the last icon link in the head, and
	// svelte:head appends in mount order and removes on unmount.
	import { claimTab, type BrowserTabProps } from './browser-tab.svelte.js';

	let props: BrowserTabProps = $props();
	const tab = claimTab(() => props);
</script>

<svelte:head>
	{#if tab.title}<title>{tab.title}</title>{/if}
	{#if props.icon}<link rel="icon" href={props.icon} />{/if}
</svelte:head>
