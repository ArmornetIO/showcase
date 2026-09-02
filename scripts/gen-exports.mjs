#!/usr/bin/env node
/**
 * gen-exports.mjs — generates `src/lib/index.ts`, the package barrel.
 *
 * WHY THIS EXISTS
 * The barrel is API for a second package: `app-ui` aliases `showcase` to this
 * source tree, so every line here is something another app can import. Hand
 * maintaining it went wrong twice in one day — once when a store rename dropped
 * three names app-ui still imported, and once when a directory split rewrote 27
 * paths by hand and missed a type re-export. Both failures were mechanical, and
 * both surfaced in the other package rather than here.
 *
 * THE IDEA
 * The manifest names WHAT is public. It never names where anything lives: this
 * script scans `src/lib`, builds a symbol → file index, and resolves every path
 * itself. Moving a component between folders therefore needs no edit anywhere —
 * which is exactly the churn that broke the barrel before. Renaming or deleting
 * an exported symbol fails loudly instead, which is the case that deserves a
 * human.
 *
 * Usage:
 *   node scripts/gen-exports.mjs           write src/lib/index.ts
 *   node scripts/gen-exports.mjs --check   exit 1 if the file is stale
 *   node scripts/gen-exports.mjs --init    rebuild the manifest FROM index.ts
 *                                          (one-time bootstrap; see below)
 */

import ts from 'typescript';
import { readFileSync, writeFileSync, readdirSync } from 'fs';
import { resolve, dirname, basename, join, relative } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');
const libDir = resolve(root, 'src/lib');
const indexFile = resolve(libDir, 'index.ts');
const manifestFile = resolve(libDir, 'exports.manifest.json');

/** Never scanned: build output, tests, and the barrel itself. */
const SKIP_DIRS = new Set(['generated', '__test__']);

// ── Scanning: what does each module export? ─────────────────────────────────

function walk(dir, out = []) {
	for (const entry of readdirSync(dir, { withFileTypes: true })) {
		if (entry.isDirectory()) {
			if (!SKIP_DIRS.has(entry.name)) walk(join(dir, entry.name), out);
			continue;
		}
		const name = entry.name;
		if (name.endsWith('.spec.ts') || name.endsWith('.d.ts')) continue;
		if (name.endsWith('.svelte') || name.endsWith('.ts')) out.push(join(dir, name));
	}
	return out;
}

/**
 * A component's two script blocks, told apart.
 *
 * Values have to be declared in `<script module>` to be module exports, but
 * `export type` and `export interface` in the instance script are hoisted by
 * svelte2tsx and ARE importable — `StatusDot` declares `StatusLevel` that way,
 * and a scan that only reads the module block loses it.
 */
function scriptBlocks(source) {
	const blocks = [...source.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)];
	let module = '';
	let instance = '';
	for (const m of blocks) {
		if (/\bmodule\b|context=["']module["']/.test(m[1])) module = m[2];
		else instance = m[2];
	}
	return { module, instance };
}

/**
 * Every symbol a module exports, and whether it is type-only. Uses the compiler
 * AST rather than a regex because `export type { A } from './x.js'`,
 * `export interface`, `export class` and `export const` all have to be told
 * apart, and a near-miss here silently drops a name from the public API.
 */
function exportedSymbols(source, fileName) {
	const sf = ts.createSourceFile(fileName, source, ts.ScriptTarget.Latest, true);
	const found = new Map(); // name → { isType, declared }

	const isExported = (node) =>
		node.modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword) ?? false;

	// Names this file imported. `export { X }` where X came from an import is a
	// pass-through wearing a declaration's clothes — components do this
	// constantly (NodeDrawer re-exporting MeshNodeType, StatusBadge re-exporting
	// StatusLevel), and treating it as a declaration makes the barrel point at a
	// component instead of the types module that actually owns the name.
	const imported = new Set();
	for (const node of sf.statements) {
		if (!ts.isImportDeclaration(node) || !node.importClause) continue;
		const { name, namedBindings } = node.importClause;
		if (name) imported.add(name.text);
		if (namedBindings && ts.isNamedImports(namedBindings)) {
			for (const el of namedBindings.elements) imported.add(el.name.text);
		}
	}

	for (const node of sf.statements) {
		if (ts.isExportDeclaration(node)) {
			// `export { a } from './x'` passes someone else's binding along, and so
			// does a bare `export { a }` when `a` was imported above.
			const declared = !node.moduleSpecifier;
			if (node.exportClause && ts.isNamedExports(node.exportClause)) {
				for (const el of node.exportClause.elements) {
					const local = el.propertyName?.text ?? el.name.text;
					found.set(el.name.text, {
						isType: node.isTypeOnly || el.isTypeOnly,
						declared: declared && !imported.has(local)
					});
				}
			}
			continue;
		}
		if (!isExported(node)) continue;

		if (ts.isVariableStatement(node)) {
			for (const decl of node.declarationList.declarations) {
				if (ts.isIdentifier(decl.name)) found.set(decl.name.text, { isType: false, declared: true });
			}
		} else if (ts.isFunctionDeclaration(node) || ts.isClassDeclaration(node)) {
			if (node.name) found.set(node.name.text, { isType: false, declared: true });
		} else if (ts.isTypeAliasDeclaration(node) || ts.isInterfaceDeclaration(node)) {
			found.set(node.name.text, { isType: true, declared: true });
		} else if (ts.isEnumDeclaration(node)) {
			found.set(node.name.text, { isType: false, declared: true });
		}
	}
	return found;
}

/**
 * symbol → the module that DECLARES it, plus component name → its file.
 *
 * A name can legitimately appear in several modules — a domain barrel passing
 * one along, or a component re-exporting a type from a sibling `.types.ts`. The
 * declaration site is the one the package barrel should point at, so a
 * re-export never displaces a declaration. Two declarations of one name is a
 * genuine collision, recorded and only fatal if the manifest exports it.
 */
function buildIndex() {
	const symbols = new Map();
	const components = new Map();
	const collisions = new Map(); // symbol → [modules]

	function record(sym, module, isType, declared) {
		const prev = symbols.get(sym);
		if (!prev) {
			symbols.set(sym, { module, isType, declared });
			return;
		}
		if (declared && prev.declared) {
			collisions.set(sym, [...(collisions.get(sym) ?? [prev.module]), module]);
			return;
		}
		if (declared && !prev.declared) symbols.set(sym, { module, isType, declared });
	}

	for (const file of walk(libDir)) {
		if (file === indexFile) continue;
		const rel = './' + relative(libDir, file).split('\\').join('/');
		const source = readFileSync(file, 'utf8');

		if (file.endsWith('.svelte')) {
			const name = basename(file, '.svelte');
			components.set(name, rel);
			const { module: mod, instance } = scriptBlocks(source);
			for (const [sym, meta] of exportedSymbols(mod, file + '.ts')) {
				record(sym, rel, meta.isType, meta.declared);
			}
			// Only types from the instance block — an `export const` there is a
			// prop declaration in Svelte 4 terms, not something a consumer imports.
			for (const [sym, meta] of exportedSymbols(instance, file + '.ts')) {
				if (meta.isType) record(sym, rel, true, meta.declared);
			}
			continue;
		}

		// `.ts` modules are imported with a `.js` specifier under NodeNext.
		const spec = rel.replace(/\.ts$/, '.js');
		for (const [sym, meta] of exportedSymbols(source, file)) {
			record(sym, spec, meta.isType, meta.declared);
		}
	}

	return { symbols, components, collisions };
}

// ── Generating ──────────────────────────────────────────────────────────────

const HEADER = `// GENERATED by scripts/gen-exports.mjs — do not edit.
//
// The public surface of this package. \`app-ui\` aliases \`showcase\` to this
// source tree, so everything below is API for another app.
//
// To change what is exported, edit src/lib/exports.manifest.json and run
// \`npm run gen:exports\`. Paths are resolved from the filesystem, so moving a
// file between folders needs no edit here or there.
`;

function rule(title) {
	const line = '─'.repeat(Math.max(3, 78 - title.length - 5));
	return `// ── ${title} ${line}`;
}

/** Group a section's symbols by the module they resolve to, values before types. */
function emitSection(section, index, errors) {
	const lines = [];
	lines.push('');
	lines.push(rule(section.title));
	if (section.note) for (const l of section.note) lines.push(`// ${l}`);

	for (const entry of section.exports) {
		const { component, symbols = [], types = [], note, from } = entry;
		if (note) {
			lines.push('');
			for (const l of note) lines.push(`// ${l}`);
		}

		let module;
		if (component) {
			module = index.components.get(component);
			if (!module) {
				errors.push(`component "${component}" is in the manifest but not on disk`);
				continue;
			}
			// A component's own module-block exports ride along on its statement.
			const localOf = (s) => (typeof s === 'string' ? s : s.name);
			const own = symbols.filter((s) => index.symbols.get(localOf(s))?.module === module);
			const written = own.map((s) => (typeof s === 'string' ? s : `${s.name} as ${s.as}`));
			const extra = written.length ? `, ${written.join(', ')}` : '';
			lines.push(`export { default as ${component}${extra} } from '${module}';`);
			for (const [mod, names] of group(symbols.filter((s) => !own.includes(s)), index, errors, from)) {
				lines.push(emitList('export', names, mod));
			}
		} else if (symbols.length) {
			for (const [mod, names] of group(symbols, index, errors, from)) {
				lines.push(emitList('export', names, mod));
			}
		}

		// Types resolve the same way. A component's types usually live in its own
		// file, so that is the fallback when nothing else claims them.
		for (const [mod, names] of group(types, index, errors, from, module)) {
			lines.push(emitList('export type', names, mod));
		}
	}
	return lines;
}

/**
 * Bucket names by the module that declares them, preserving manifest order.
 *
 * One manifest entry routinely spans several files — `frames` lists nine names
 * that live across four modules. The old barrel hid that by re-exporting from a
 * domain sub-barrel; pointing at declaration sites instead costs a few more
 * statements and removes a hop, so a consumer's import resolves straight to the
 * file that defines the thing.
 */
function group(names, index, errors, pin, fallback) {
	const buckets = new Map();
	const put = (mod, name) => {
		if (!buckets.has(mod)) buckets.set(mod, []);
		buckets.get(mod).push(name);
	};

	for (const raw of names) {
		// A name is either "Thing" or { name, as } — the barrel renames a handful
		// of types on the way out (`ClusterOpts as SphereClusterOpts`), so what is
		// resolved and what is written differ.
		const local = typeof raw === 'string' ? raw : raw.name;
		const written = typeof raw === 'string' ? raw : `${raw.name} as ${raw.as}`;

		if (pin) {
			put(pin, written);
			continue;
		}
		if (index.collisions.has(local)) {
			errors.push(
				`"${local}" is declared in ${index.collisions.get(local).join(' and ')} — ` +
					`add "from" to its manifest entry to say which one the barrel means`
			);
			continue;
		}
		const hit = index.symbols.get(local);
		if (hit) {
			put(hit.module, written);
		} else if (fallback) {
			put(fallback, written);
		} else {
			errors.push(`symbol "${local}" is in the manifest but nothing exports it`);
		}
	}
	return buckets;
}

function emitList(keyword, names, module) {
	const one = `${keyword} { ${names.join(', ')} } from '${module}';`;
	if (one.length <= 100) return one;
	return `${keyword} {\n\t${names.join(',\n\t')}\n} from '${module}';`;
}

function generate(manifest, index) {
	const errors = [];
	const lines = [HEADER.trimEnd()];
	for (const section of manifest.sections) lines.push(...emitSection(section, index, errors));
	return { source: lines.join('\n') + '\n', errors };
}

// ── Bootstrap: build the manifest from the barrel that exists today ─────────
//
// Run once. Parsing the current index.ts means the manifest starts as an exact
// record of today's public surface — including every deliberate omission — with
// nothing transcribed by hand.

function initManifest() {
	const source = readFileSync(indexFile, 'utf8');
	const sf = ts.createSourceFile('index.ts', source, ts.ScriptTarget.Latest, true);
	const text = sf.getFullText();

	const sections = [];
	let current = { title: 'Exports', exports: [] };

	/** Comment lines immediately above a statement, minus the section rules. */
	function commentsAbove(node) {
		const ranges = ts.getLeadingCommentRanges(text, node.getFullStart()) ?? [];
		const out = [];
		for (const r of ranges) {
			const raw = text.slice(r.pos, r.end).trim();
			if (!raw.startsWith('//')) continue;
			const body = raw.replace(/^\/\/\s?/, '');
			const m = body.match(/^──\s*(.+?)\s*─+$/);
			if (m) {
				if (current.exports.length) sections.push(current);
				current = { title: m[1], exports: [] };
				continue;
			}
			out.push(body);
		}
		return out;
	}

	for (const node of sf.statements) {
		if (!ts.isExportDeclaration(node) || !node.moduleSpecifier) continue;
		const note = commentsAbove(node);
		const module = node.moduleSpecifier.text;
		const isTypeOnly = node.isTypeOnly;
		if (!node.exportClause || !ts.isNamedExports(node.exportClause)) continue;

		const names = node.exportClause.elements.map((el) => ({
			name: el.name.text,
			local: el.propertyName?.text,
			isDefault: el.propertyName?.text === 'default',
			isType: isTypeOnly || el.isTypeOnly
		}));

		const def = names.find((n) => n.isDefault);
		const rest = names
			.filter((n) => !n.isDefault)
			// Keep the rename: what resolves is the local name, what ships is the alias.
			.map((n) => (n.local && n.local !== n.name ? { name: n.local, as: n.name } : n.name));

		// Fold a type-only statement into the component/module entry above it when
		// they share a source, so the manifest reads as one entry per thing.
		const prev = current.exports[current.exports.length - 1];
		if (isTypeOnly && prev && prev.__module === module) {
			prev.types = [...(prev.types ?? []), ...rest];
			if (note.length) prev.note = [...(prev.note ?? []), ...note];
			continue;
		}

		const entry = { __module: module };
		if (def) entry.component = def.name;
		if (rest.length) entry[isTypeOnly ? 'types' : 'symbols'] = rest;
		if (note.length) entry.note = note;
		current.exports.push(entry);
	}
	if (current.exports.length) sections.push(current);

	// `__module` was only needed to fold statements together.
	for (const s of sections) for (const e of s.exports) delete e.__module;

	return { sections };
}

// ── Main ────────────────────────────────────────────────────────────────────

const mode = process.argv[2];

if (mode === '--init') {
	const manifest = initManifest();
	writeFileSync(manifestFile, JSON.stringify(manifest, null, 2) + '\n');
	const count = manifest.sections.reduce((n, s) => n + s.exports.length, 0);
	console.log(`[gen-exports] manifest written — ${manifest.sections.length} sections, ${count} entries`);
	process.exit(0);
}

const index = buildIndex();
const manifest = JSON.parse(readFileSync(manifestFile, 'utf8'));
const { source, errors } = generate(manifest, index);

if (errors.length) {
	console.error('[gen-exports] manifest and filesystem disagree:');
	for (const e of new Set(errors)) console.error(`  ${e}`);
	process.exit(1);
}

if (mode === '--check') {
	const onDisk = readFileSync(indexFile, 'utf8');
	if (onDisk !== source) {
		console.error('[gen-exports] src/lib/index.ts is stale — run `npm run gen:exports`.');
		process.exit(1);
	}
	console.log('[gen-exports] index.ts is up to date.');
	process.exit(0);
}

writeFileSync(indexFile, source);
const count = manifest.sections.reduce((n, s) => n + s.exports.length, 0);
console.log(`[gen-exports] index.ts written — ${manifest.sections.length} sections, ${count} entries`);
