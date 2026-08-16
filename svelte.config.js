import adapter from '@sveltejs/adapter-static';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	compilerOptions: {
		// Force runes mode for the project, except for libraries. Can be removed in svelte 6.
		runes: ({ filename }) => (filename.split(/[/\\]/).includes('node_modules') ? undefined : true)
	},
	kit: {
		adapter: adapter({
			fallback: 'index.html'
		}),
		paths: {
			// Vitest browser mode serves its harness from `/__vitest__/`. The base
			// rewrites those asset URLs to `/showcase/__vitest__/`, which 404s, so the
			// harness page never boots and every browser spec dies on a closed
			// connection. Builds and dev are unaffected — VITEST is only set by the
			// test runner.
			base: process.env.VITEST ? '' : '/showcase'
		}
	}
};

export default config;
