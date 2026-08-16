<script lang="ts">
	import type { JsonLdSchema } from './types.js';

	let { schema }: { schema: JsonLdSchema } = $props();

	const serialized = $derived(JSON.stringify(schema));
</script>

<svelte:head>
	{@html `<script type="application/ld+json">${serialized}</script>`}
</svelte:head>
