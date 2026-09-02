import { sveltekit } from '@sveltejs/kit/vite';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vitest/config';
import { playwright } from '@vitest/browser-playwright';
import { demoVariantPlugin } from './scripts/demoVariantPlugin.js';
import { sceneBridgePlugin } from './scripts/sceneBridgePlugin.js';

export default defineConfig({
	// sceneBridgePlugin is `apply: 'serve'` — it exists only on the dev server, so
	// the built SPA carries no trace of it.
	// `showcase` and `$examples` are NOT declared here: they are `kit.alias`
	// entries in svelte.config.js, which the SvelteKit plugin injects into this
	// config's resolution and into the generated tsconfig from one declaration.
	plugins: [demoVariantPlugin(), sceneBridgePlugin(), tailwindcss(), sveltekit()],
	test: {
		projects: [
			{
				// ── Browser tests (*.svelte.spec.ts) ──────────────────────────────
				extends: './vite.config.ts',
				test: {
					name: 'browser',
					include: ['src/**/*.svelte.spec.ts', 'examples/**/*.svelte.spec.ts'],
					browser: {
						enabled: true,
						provider: playwright(),
						instances: [{ browser: 'chromium', headless: true }]
					}
				}
			},
			{
				// ── Node tests (*.spec.ts, no DOM needed) ─────────────────────────
				extends: './vite.config.ts',
				test: {
					name: 'node',
					include: ['src/**/*.spec.ts', 'examples/**/*.spec.ts'],
					exclude: ['src/**/*.svelte.spec.ts', 'examples/**/*.svelte.spec.ts'],
					environment: 'node'
				}
			}
		]
	}
});
