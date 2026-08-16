import { fileURLToPath } from 'node:url';
import { sveltekit } from '@sveltejs/kit/vite';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vitest/config';
import { playwright } from '@vitest/browser-playwright';
import { demoVariantPlugin } from './scripts/demoVariantPlugin.js';
import { sceneBridgePlugin } from './scripts/sceneBridgePlugin.js';

export default defineConfig({
	// sceneBridgePlugin is `apply: 'serve'` — it exists only on the dev server, so
	// the built SPA carries no trace of it.
	plugins: [demoVariantPlugin(), sceneBridgePlugin(), tailwindcss(), sveltekit()],
	resolve: {
		alias: {
			// `examples/` sits OUTSIDE `src/` and imports the library by its package
			// name, exactly as `app-ui` does. That is the whole point of an example:
			// it is a consumer, so it must not be able to reach into `src/lib`
			// internals by relative path. In dev the name resolves to source; a
			// published consumer gets `dist` through package.json exports.
			showcase: fileURLToPath(new URL('./src/lib/index.ts', import.meta.url)),
			$examples: fileURLToPath(new URL('./examples', import.meta.url))
		}
	},
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
