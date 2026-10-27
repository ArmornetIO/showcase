#!/usr/bin/env node
/**
 * gen-office-nav.mjs
 *
 * Bakes the default Insider Threat map's walkable floor into
 * internal/breach/office/nav.json, which the office engine embeds to walk its
 * bots. The map is TypeScript geometry (examples/breach/insider/), so the grid
 * is computed by the same navGrid the client used to draw bots walking — the
 * server and every screen then agree on where a bot can go.
 *
 * Vite's module runner loads the map with no server and no port. The maps
 * import `showcase`, aliased to the library's own barrel as svelte.config.js
 * does, so a helper a map starts using needs nothing here.
 *
 * Usage:  node scripts/gen-office-nav.mjs [--check]
 */
import { runnerImport } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { emit, report, Lang, banner } from '../../scripts/emit.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const repo = resolve(here, '../..');
const check = process.argv.includes('--check');

// The Svelte plugin because the barrel exports components.
const { module } = await runnerImport(resolve(here, 'office-nav.ts'), {
	configFile: false,
	logLevel: 'error',
	plugins: [svelte({ configFile: false, emitCss: false })],
	resolve: { alias: { showcase: resolve(here, '../src/lib/index.ts') } }
});
const body = JSON.parse(module.bake());
const content = JSON.stringify({ generated: banner('gen-office-nav', 'showcase/examples/breach/insider'), ...body }, null, '\t') + '\n';

const res = emit(repo, { check, gen: 'gen-office-nav' }, [{ path: 'internal/breach/office/nav.json', content, lang: Lang.json }]);
report(res, 'gen-office-nav', 'npm run gen:office-nav');
