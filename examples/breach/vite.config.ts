import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import tailwindcss from '@tailwindcss/vite';

const repo = (p: string) => fileURLToPath(new URL(p, import.meta.url));

// ── BREACH, standalone ───────────────────────────────────────────────────────
// A plain Vite + Svelte app. No SvelteKit, no router, no adapter — which is the
// point: if the library needed any of that, it would not be a library.
//
// There is no `dependencies` block and no `node_modules` here. This app is
// nested inside `showcase/`, so Node resolves `vite`, `svelte` and the rest by
// walking up, and npm puts the parent's `.bin` on PATH. `npm run dev` therefore
// works on a fresh clone with no install of its own.
export default defineConfig({
	plugins: [svelte(), tailwindcss()],
	resolve: {
		alias: {
			// The library, by the name a published consumer would use. In this repo
			// it points at source so a change in `src/lib` is live-reloaded here;
			// published, the same specifier resolves through package.json exports.
			// Either way the example cannot reach past the barrel, which is the
			// property worth protecting.
			showcase: repo('../../src/lib/index.ts')
		}
	},
	server: {
		// Its own port, so it can run alongside the showcase app on 5173.
		port: 5199,
		fs: {
			// The library is imported from outside this app's root, so Vite has to
			// be told the parent is fair game to serve from.
			allow: [repo('../..')]
		}
	}
});
