import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import tailwindcss from '@tailwindcss/vite';

const repo = (p: string) => fileURLToPath(new URL(p, import.meta.url));

// ── Roadmap, standalone ──────────────────────────────────────────────────────
// A plain Vite + Svelte app, like `examples/breach`. `base` is passed by the
// build for the /roadmap mount, not set here, so `vite dev` serves from root.
export default defineConfig({
	plugins: [svelte(), tailwindcss()],
	// Its own cache: sharing showcase's lets this optimizer wipe the showcase
	// dev server's deps (see examples/breach/vite.config.ts).
	cacheDir: repo('../../node_modules/.vite-roadmap'),
	resolve: {
		alias: {
			showcase: repo('../../src/lib/index.ts')
		}
	},
	server: {
		port: 5699,
		fs: { allow: [repo('../..')] }
	}
});
