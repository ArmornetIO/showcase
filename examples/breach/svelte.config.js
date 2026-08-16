import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/vite-plugin-svelte').Options} */
export default {
	preprocess: vitePreprocess(),
	compilerOptions: {
		// Matches the parent's setting. Runes everywhere except `node_modules`, so
		// the library's own components compile the way they were written.
		runes: true
	}
};
