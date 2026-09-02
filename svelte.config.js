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
		// The only place either alias is declared. SvelteKit feeds these to Vite
		// AND writes them into the generated `.svelte-kit/tsconfig.json` alongside
		// its own `$lib`/`$app` mappings — so runtime resolution and type
		// resolution cannot drift, and `tsconfig.json` no longer has to re-declare
		// the generated mappings by hand to avoid clobbering them.
		//
		// `showcase` exists because `examples/` sits OUTSIDE `src/` and imports the
		// library by its package name, exactly as `app-ui` does. That is the whole
		// point of an example: it is a consumer, so it must not be able to reach
		// into `src/lib` internals by relative path. In dev the name resolves to
		// source; a published consumer gets `dist` through package.json exports.
		alias: {
			showcase: 'src/lib/index.ts',
			$examples: 'examples'
		},
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
