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
	// NOTE ON `base`: it is deliberately NOT set here, and passed as
	// `--base=/breach/` by the Makefile's build-breach-vite instead.
	//
	// The binary mounts this app under a prefix (uiroutes.Breach), so the built
	// bundle needs it. But `base` also applies to `vite dev`, which would move
	// public/ off the root — and the wasm loader
	// (showcase/src/lib/agent/loader.ts) fetches `/armornet.wasm` root-relative
	// ON PURPOSE, because in the binary that file comes out of app-ui's static/
	// and is not part of this bundle at all. Setting base here would 404 the
	// game's own agent on :5199 while working fine in the binary, which is the
	// worst shape a config bug can have.
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
		// The game's server is the armornet binary on :8080 — the rules, the
		// tables and the fog all live there. Anchored with the trailing slash: a
		// bare `/api` prefix also matches `/api.ts`, a module in this app, and
		// forwarding that to the server takes the whole page down with a
		// redirect to /login. Match the route, not the letters.
		proxy: {
			'^/api/': {
				target: 'http://localhost:8080',
				changeOrigin: false,
				ws: true
			},
			// The Agent Line endpoint the game's WebAssembly agent connects to.
			//
			// It must be same-origin, and not for tidiness: the Line server upgrades
			// with gorilla/websocket's default origin check, which compares Origin to
			// Host INCLUDING the port. A page on :5199 dialling :4320 is refused
			// 403 before any armornet auth runs. changeOrigin stays false for the
			// same reason — rewriting Host to the target re-breaks it.
			'^/v1/opamp': {
				target: 'http://localhost:4320',
				changeOrigin: false,
				ws: true
			}
		},
		fs: {
			// The library is imported from outside this app's root, so Vite has to
			// be told the parent is fair game to serve from.
			allow: [repo('../..')]
		}
	}
});
