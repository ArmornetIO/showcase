import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import tailwindcss from '@tailwindcss/vite';

const repo = (p: string) => fileURLToPath(new URL(p, import.meta.url));

// ── BREACH v2, standalone ────────────────────────────────────────────────────
// Its own root and its own port so it runs beside v1 rather than replacing it.
// No proxy blocks: v2 has no server half — the whole game is the four files
// next to this one.
export default defineConfig({
	plugins: [svelte(), tailwindcss()],
	resolve: {
		alias: {
			showcase: repo('../../../src/lib/index.ts')
		}
	},
	server: {
		port: 5200,
		fs: {
			// app.css and the shared dice helpers live one level up, and the design
			// tokens two more above that.
			allow: [repo('../../..')]
		}
	}
});
