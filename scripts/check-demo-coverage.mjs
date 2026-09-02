#!/usr/bin/env node
/**
 * check-demo-coverage.mjs
 *
 * Answers one question: is every component in `src/lib` actually rendered by
 * some page in this showcase?
 *
 * The overview index can only be as honest as the pages behind it. It is built
 * from the routes on disk, so it cannot link to a page that does not exist —
 * but nothing stops a component from existing that no page ever mounts. That is
 * the gap this reports: a component you can import from the package and cannot
 * look at.
 *
 * Reachability is transitive and follows `.ts` as well as `.svelte`, because
 * several subsystems mount their components through a registry module rather
 * than a direct import (`builder/renderer/*`, `backdrop/backdrops.ts`). A
 * one-level scan of `+page.svelte` imports — which is all `route-map.json`
 * does — reports ~120 false orphans.
 *
 * Usage:  node scripts/check-demo-coverage.mjs [--check]
 *         --check exits 1 when an unlisted orphan exists.
 */

import { readFileSync, readdirSync, statSync } from 'fs';
import { resolve, dirname, join, relative } from 'path';
import { fileURLToPath } from 'url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const strict = process.argv.includes('--check');

// Mirrors gen-api.mjs — these hold no exhibitable components.
const SKIP_DIRS = new Set(['generated', '__test__', 'seo', 'registry', 'node_modules']);

/**
 * Orphans that are known and accepted, each with the reason it has no demo.
 * Same contract as `builder/registry-parity.spec.ts`: a component is either
 * reachable from a page, or it is listed here with a justification.
 */
const NO_DEMO_REASON = {
	// Injected into every page's ShowcaseBlock by `demoVariantPlugin` at build
	// time, so it renders on nearly every route while appearing in no source
	// import. Reachability is read off source, which cannot see a transform.
	DemoVariant: 'injected into every showcase page by demoVariantPlugin, not imported in source'
};

function componentFiles() {
	const out = [];
	(function walk(dir) {
		for (const e of readdirSync(dir, { withFileTypes: true })) {
			if (e.isDirectory()) {
				if (!SKIP_DIRS.has(e.name)) walk(join(dir, e.name));
			} else if (e.name.endsWith('.svelte')) out.push(join(dir, e.name));
		}
	})(join(root, 'src/lib'));
	return out;
}

// Static imports, re-exports and dynamic import() alike.
const SPEC_RE = /(?:from\s*|import\s*\(\s*)['"]([^'"]+)['"]/g;

const SUFFIXES = ['', '.svelte', '.ts', '.js', '.svelte.ts', '.svelte.js', '/index.ts', '/index.js'];

function resolveSpec(spec, fromFile) {
	let base;
	if (spec.startsWith('$lib/')) base = join(root, 'src/lib', spec.slice(5));
	else if (spec.startsWith('.')) base = resolve(dirname(fromFile), spec);
	else return null; // $app/*, bare package specifiers
	// The repo writes `./foo.js` for `./foo.ts` (NodeNext), so try that first.
	for (const c of [base, base.replace(/\.js$/, '.ts'), ...SUFFIXES.map((s) => base + s)]) {
		try {
			if (statSync(c).isFile()) return c;
		} catch {
			/* next candidate */
		}
	}
	return null;
}

function routeEntryPoints() {
	const out = [];
	(function walk(dir) {
		for (const e of readdirSync(dir, { withFileTypes: true })) {
			if (e.isDirectory()) walk(join(dir, e.name));
			else if (/^\+(page|layout)\.(svelte|ts|js)$/.test(e.name)) out.push(join(dir, e.name));
		}
	})(join(root, 'src/routes'));
	return out;
}

function reachable() {
	const seen = new Set(routeEntryPoints());
	const queue = [...seen];
	while (queue.length) {
		const file = queue.pop();
		let src;
		try {
			src = readFileSync(file, 'utf8');
		} catch {
			continue;
		}
		SPEC_RE.lastIndex = 0;
		let m;
		while ((m = SPEC_RE.exec(src)) !== null) {
			const target = resolveSpec(m[1], file);
			if (!target || seen.has(target)) continue;
			seen.add(target);
			queue.push(target);
		}
	}
	return seen;
}

const files = componentFiles();
const seen = reachable();
const orphans = files.filter((f) => !seen.has(f)).sort();

const name = (f) => f.split('/').pop().replace('.svelte', '');
const unlisted = orphans.filter((f) => !(name(f) in NO_DEMO_REASON));
const accepted = orphans.filter((f) => name(f) in NO_DEMO_REASON);

console.log(
	`[demo-coverage] ${files.length - orphans.length}/${files.length} components reachable from a page`
);
if (accepted.length) console.log(`[demo-coverage] ${accepted.length} accepted without a demo`);

if (unlisted.length) {
	console.log(`\n[demo-coverage] ${unlisted.length} component(s) no page renders:\n`);
	for (const f of unlisted) console.log(`  ${relative(root, f)}`);
	console.log(
		'\n  Give each one a demo page, or add it to NO_DEMO_REASON in this script with a reason.'
	);
}

if (strict && unlisted.length) process.exit(1);
