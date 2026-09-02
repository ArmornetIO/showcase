/**
 * Enforces the barrel rule for stores.
 *
 * A store is exported from `index.ts` if and only if a host app needs it to
 * drive a component the barrel also exports. Library behaviour is public; the
 * state behind showcase's own pages and tools is not.
 *
 * Both directions are checked, because both have bitten:
 *   · a store nobody exported is invisible to app-ui, which aliases `showcase`
 *     to this source tree and cannot reach past the barrel;
 *   · a store exported by accident becomes API that a second package can start
 *     depending on, and taking it back later is a breaking change.
 *
 * Stores are discovered by globbing rather than listed, so moving a file
 * between folders never silently drops it from this check.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'fs';
import { dirname, join, relative } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const LIB = __dirname;

/**
 * Stores that stay out of the barrel, and why. A new entry here is a claim that
 * no host app could drive this state — if a host ever needs it, export it and
 * delete the line rather than widening the exception.
 */
const APP_INTERNAL: Record<string, string> = {
	builder:
		'the mockup builder tool document — only the builder page and CompositorLayer, and a host has no canvas to put it on',
	docsLayout:
		"showcase's own docs shell arrangement; DocsShell is not exported and app-ui ships its own",
	showcaseState:
		'scroll-spy for the showcase gallery pages — meaningless outside this app'
};

/** Walk `src/lib` for rune modules. */
function walk(dir: string, out: string[] = []): string[] {
	for (const entry of readdirSync(dir, { withFileTypes: true })) {
		const full = join(dir, entry.name);
		if (entry.isDirectory()) walk(full, out);
		else if (entry.name.endsWith('.svelte.ts') && !entry.name.endsWith('.spec.svelte.ts')) {
			out.push(full);
		}
	}
	return out;
}

/**
 * Singleton stores only: `export const x = new X()` or `export const x = $state(…)`.
 * A module that exports a class or a factory is per-instance — callers build
 * their own, so there is nothing for the barrel to own.
 */
function singletonExports(src: string): string[] {
	const names: string[] = [];
	const re = /^export const (\w+)(?::[^=]+)? = (?:new [A-Z]\w*\(|\$state[(<])/gm;
	let m: RegExpExecArray | null;
	while ((m = re.exec(src))) names.push(m[1]);
	return names;
}

const barrel = readFileSync(join(LIB, 'index.ts'), 'utf8');

/** Does the barrel re-export this name? */
function exported(name: string): boolean {
	// Matches `export { x }`, `export { x, y }` and multi-line export blocks.
	return new RegExp(`^\\s*${name},?\\s*$|export \\{[^}]*\\b${name}\\b[^}]*\\}`, 'm').test(barrel);
}

const stores = walk(LIB)
	.flatMap((file) =>
		singletonExports(readFileSync(file, 'utf8')).map((name) => ({
			name,
			file: relative(LIB, file)
		}))
	)
	// Not state: a grid constant and a DOM attribute name that match the shape.
	.filter(({ name }) => name !== 'GRID' && name !== 'DEVCOG');

describe('store barrel rule', () => {
	it('finds the stores at all (guards the glob itself)', () => {
		// If a refactor breaks the discovery regex this suite would pass vacuously.
		expect(stores.map((s) => s.name)).toEqual(
			expect.arrayContaining(['theme', 'advancedSettings', 'alertBlade', 'builder'])
		);
	});

	it('exports every store that is not app-internal', () => {
		const missing = stores
			.filter(({ name }) => !APP_INTERNAL[name] && !exported(name))
			.map(({ name, file }) => `${name} (${file})`);

		expect(
			missing,
			`These stores are not exported from index.ts:\n  ${missing.join('\n  ')}\n\n` +
				`Fix: export it, or add it to APP_INTERNAL with the reason a host app could never drive it.`
		).toHaveLength(0);
	});

	it('keeps app-internal stores out of the barrel', () => {
		const leaked = Object.keys(APP_INTERNAL)
			.filter((name) => stores.some((s) => s.name === name))
			.filter((name) => exported(name));

		expect(
			leaked,
			`These stores are app-internal but exported from index.ts:\n  ${leaked.join(', ')}\n\n` +
				`Exporting one makes it API for app-ui, which aliases 'showcase' to this source tree.`
		).toHaveLength(0);
	});

	it('has no stale APP_INTERNAL entries', () => {
		const stale = Object.keys(APP_INTERNAL).filter(
			(name) => !stores.some((s) => s.name === name)
		);

		expect(
			stale,
			`These APP_INTERNAL entries name no store — renamed or deleted?\n  ${stale.join(', ')}`
		).toHaveLength(0);
	});
});
