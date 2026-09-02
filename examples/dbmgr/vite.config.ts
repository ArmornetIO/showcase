import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import tailwindcss from '@tailwindcss/vite';

const repo = (p: string) => fileURLToPath(new URL(p, import.meta.url));

// ── dbmgr console, standalone ────────────────────────────────────────────────
// A plain Vite + Svelte app, like `examples/breach`. No SvelteKit, no router,
// no adapter — the Go binary serves whatever this emits from a single embed.
//
// The build lands directly in `dbmgr/ui/dist` because that is the directory the
// Go `//go:embed` reads. Writing anywhere else would need a copy step that
// could silently go stale.
export default defineConfig({
	plugins: [svelte(), tailwindcss()],
	base: './',
	build: {
		outDir: repo('../../../dbmgr/ui/dist'),
		// Not emptied: that directory holds a committed .gitkeep, and without it
		// `//go:embed all:dist` fails to compile on a checkout that has never run
		// this build. Output filenames are fixed below, so nothing goes stale.
		emptyOutDir: false,
		// One JS and one CSS file. The binary is meant to be a single artifact
		// you can scp onto a box, so chunking buys nothing and costs requests.
		rollupOptions: {
			output: {
				entryFileNames: 'app.js',
				chunkFileNames: 'app.js',
				assetFileNames: 'app[extname]'
			}
		}
	},
	resolve: {
		alias: {
			// The library by the name a published consumer would use — the example
			// cannot reach past the barrel, which is the property worth protecting.
			showcase: repo('../../src/lib/index.ts')
		}
	},
	server: {
		// Its own port, alongside showcase (5173) and breach (5199).
		port: 5200,
		fs: { allow: [repo('../..')] },
		// `npm run dev` here talks to a locally running `dbmgr ui`.
		proxy: { '/api': 'http://localhost:8090' }
	}
});
