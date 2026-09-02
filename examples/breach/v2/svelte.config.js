import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/vite-plugin-svelte').Options} */
export default {
	preprocess: vitePreprocess(),
	compilerOptions: {
		// Same as the parent app's. Runes everywhere.
		runes: true
	}
};
