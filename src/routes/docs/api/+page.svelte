<script lang="ts">
	// <ApiReference> as app-ui renders it at /docs/api, viewable without the app.
	import ApiReference from '$lib/docs/apiref/ApiReference.svelte';
	import type { ApiIsland } from '$lib/docs/apiref/types.js';

	// A glob, not an import: api.data.json is gitignored, so a fresh checkout (CI)
	// has none, and a static import fails svelte-check and the build there. Copy
	// the file here from app-ui/src/lib/generated/ to render the live spec.
	const island = Object.values(
		import.meta.glob<ApiIsland>('./api.data.json', { eager: true, import: 'default' })
	)[0];

	const EMPTY: ApiIsland = {
		title: 'API reference',
		version: '',
		description: 'Copy app-ui/src/lib/generated/api.data.json here to render the real API.',
		host: '',
		total: 0,
		resources: [],
		schemas: {},
		schemes: []
	};
</script>

<ApiReference data={island ?? EMPTY} />
