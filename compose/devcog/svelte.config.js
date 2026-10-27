import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/vite-plugin-svelte').Options} */
export default {
	preprocess: vitePreprocess(),
	compilerOptions: {
		runes: true,
		// Components insert their own styles into the root they mount in. The
		// console mounts inside a shadow root, where a separate stylesheet in the
		// page's <head> would never reach it.
		css: 'injected'
	}
};
