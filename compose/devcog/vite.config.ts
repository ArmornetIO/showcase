import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';

const here = (p: string) => fileURLToPath(new URL(p, import.meta.url));

// ── The framework's dev console, as one script ───────────────────────────────
// compose serves this file at /_compose/devcog.js and injects a tag for it into
// every page it renders in development. One self-contained ES module: it is
// dropped into apps built with anything, so it may assume nothing about them —
// no shared chunks, no stylesheet, no runtime of theirs.
//
// Run from this directory (`npx vite build`); it resolves the bundler and svelte
// by walking up into showcase's node_modules, as the examples do.
export default defineConfig({
	plugins: [svelte()],
	build: {
		outDir: here('dist'),
		// Not emptied: dist holds the committed .gitkeep the Go embed directive
		// needs, and the output name is fixed, so nothing goes stale.
		emptyOutDir: false,
		copyPublicDir: false,
		modulePreload: false,
		rollupOptions: {
			input: here('../../src/lib/devcog/standalone.ts'),
			// No exports: the entry boots itself, and a lib-style facade would
			// otherwise be kept alive for a caller that does not exist.
			preserveEntrySignatures: false,
			output: {
				format: 'es',
				entryFileNames: 'devcog.js',
				codeSplitting: false
			}
		}
	}
});
