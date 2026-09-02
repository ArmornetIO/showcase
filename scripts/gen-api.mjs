#!/usr/bin/env node
/**
 * gen-api.mjs
 * Auto-discovers all Svelte components in src/lib/primitives/, extracts their
 * prop types and any exported interfaces from sibling .types.ts files using
 * the TypeScript compiler AST, and writes JSON to src/lib/generated/*.api.json.
 *
 * Handles two $props() patterns:
 *   1. Inline type literal:   let { ... }: { prop: Type } = $props()
 *   2. Named interface ref:   let { ... }: ButtonProps = $props()
 *      → resolves the interface declaration in the same script block
 *
 * Usage:  node scripts/gen-api.mjs
 */

import ts from 'typescript';
import { readFileSync, writeFileSync, mkdirSync, readdirSync } from 'fs';
import { resolve, dirname, basename, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');
const libDir = resolve(root, 'src/lib');
const outDir = resolve(root, 'src/lib/generated');

// Subdirectories to skip — not component dirs
const SKIP_DIRS = new Set(['generated', '__test__', 'seo', 'dev', 'registry']);

// ── Helpers ────────────────────────────────────────────────────────────────

function extractScriptBlock(svelteSource) {
	// Pick the non-module <script> block
	const matches = [...svelteSource.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)];
	for (const m of matches) {
		if (!m[1].includes('module')) return m[2];
	}
	return matches[0]?.[2] ?? '';
}

function leadingJsDoc(node, sf) {
	const text = sf.getFullText();
	const ranges = ts.getLeadingCommentRanges(text, node.getFullStart());
	if (!ranges) return undefined;
	for (const r of [...ranges].reverse()) {
		const c = text.slice(r.pos, r.end);
		if (c.startsWith('/**')) {
			return c
				.replace(/^\/\*\*\s*/, '')
				.replace(/\s*\*\/$/, '')
				.replace(/^\s*\*\s?/gm, '')
				.trim();
		}
	}
	return undefined;
}

function memberToField(member, sf) {
	if (!ts.isPropertySignature(member)) return null;
	return {
		name: member.name.getText(sf),
		type: member.type?.getText(sf) ?? 'unknown',
		optional: !!member.questionToken,
		...(leadingJsDoc(member, sf) ? { description: leadingJsDoc(member, sf) } : {}),
	};
}

// ── Extract props from a Svelte script block ───────────────────────────────
// Handles both inline type literals and named interface references.

function extractProps(svelteSource) {
	const script = extractScriptBlock(svelteSource);
	const sf = ts.createSourceFile('x.svelte.ts', script, ts.ScriptTarget.Latest, true);

	// Index all interface declarations in the file for named-ref resolution
	const interfaces = new Map(); // name → InterfaceDeclaration node
	function collectInterfaces(node) {
		if (ts.isInterfaceDeclaration(node)) {
			interfaces.set(node.name.text, node);
		}
		ts.forEachChild(node, collectInterfaces);
	}
	collectInterfaces(sf);

	const defaults = new Map();
	const props = [];

	function visit(node) {
		if (
			ts.isVariableDeclaration(node) &&
			ts.isObjectBindingPattern(node.name) &&
			node.initializer &&
			ts.isCallExpression(node.initializer) &&
			node.initializer.expression.getText(sf) === '$props'
		) {
			// Collect defaults from binding elements
			for (const el of node.name.elements) {
				if (ts.isBindingElement(el) && el.initializer) {
					const name = ts.isIdentifier(el.name) ? el.name.text : el.name.getText(sf);
					defaults.set(name, el.initializer.getText(sf));
				}
			}

			// Resolve the type — inline literal or named interface
			let members = null;
			if (node.type && ts.isTypeLiteralNode(node.type)) {
				members = node.type.members;
			} else if (node.type && ts.isTypeReferenceNode(node.type)) {
				const refName = node.type.typeName.getText(sf);
				const iface = interfaces.get(refName);
				if (iface) members = iface.members;
			}

			if (members) {
				for (const member of members) {
					const field = memberToField(member, sf);
					if (!field) continue;
					const def = defaults.get(field.name);
					props.push({ ...field, ...(def !== undefined ? { default: def } : {}) });
				}
			}
		}
		ts.forEachChild(node, visit);
	}

	visit(sf);
	return props;
}

// ── Extract exported interfaces from a .ts file ────────────────────────────

function extractInterfaces(tsSource, names) {
	const sf = ts.createSourceFile('types.ts', tsSource, ts.ScriptTarget.Latest, true);
	const byName = new Map();

	function visit(node) {
		if (
			ts.isInterfaceDeclaration(node) &&
			(names.length === 0 || names.includes(node.name.text)) &&
			(node.modifiers ?? []).some((m) => m.kind === ts.SyntaxKind.ExportKeyword)
		) {
			const fields = node.members
				.map((m) => memberToField(m, sf))
				.filter(Boolean);
			byName.set(node.name.text, { name: node.name.text, fields });
		}
		ts.forEachChild(node, visit);
	}

	visit(sf);

	const ordered = names.length > 0
		? names.map((n) => byName.get(n)).filter(Boolean)
		: [...byName.values()];
	return ordered;
}

// ── Process one component ──────────────────────────────────────────────────

function processComponent(svelteFile) {
	const name = basename(svelteFile, '.svelte');
	const dir = dirname(svelteFile);
	const source = readFileSync(svelteFile, 'utf8');
	const props = extractProps(source);

	// Look for a sibling <kebab-name>.types.ts
	const kebab = name.replace(/([A-Z])/g, (c, _, i) => i > 0 ? `-${c.toLowerCase()}` : c.toLowerCase());
	let interfaces = [];
	try {
		interfaces = extractInterfaces(readFileSync(join(dir, `${kebab}.types.ts`), 'utf8'), []);
	} catch {
		// no types file — fine
	}

	return { component: name, props, interfaces };
}

// ── Discover all component svelte files under src/lib/ ────────────────────

function collectSvelteFiles(dir) {
	const files = [];
	for (const entry of readdirSync(dir, { withFileTypes: true })) {
		if (entry.isDirectory()) {
			if (!SKIP_DIRS.has(entry.name)) {
				files.push(...collectSvelteFiles(join(dir, entry.name)));
			}
		} else if (entry.name.endsWith('.svelte') && entry.name !== 'ApiTable.svelte') {
			files.push(join(dir, entry.name));
		}
	}
	return files;
}

mkdirSync(outDir, { recursive: true });

const files = collectSvelteFiles(libDir);

const dict = {};
for (const file of files) {
	const meta = processComponent(file);
	if (meta.props.length === 0 && meta.interfaces.length === 0) continue;
	dict[meta.component] = meta;
	console.log(`[gen-api] ${meta.component} — ${meta.props.length} props, ${meta.interfaces.length} interfaces`);
}

writeFileSync(resolve(outDir, 'api.json'), JSON.stringify(dict, null, 2));
console.log(`[gen-api] done — ${Object.keys(dict).length} components → src/lib/generated/api.json`);

// ── Route map: route-id → [ComponentNames] ────────────────────────────────
// Parsed from each +page.svelte's default imports. Any imported name that
// exists in the api dict is included, preserving import order.

const routesDir = resolve(root, 'src/routes');
const routeMap = {};
const importRe = /import\s+(\w+)\s+from\s+['"][$]lib\/[^'"]+\.svelte['"]/g;

for (const entry of readdirSync(routesDir, { withFileTypes: true })) {
	if (!entry.isDirectory()) continue;
	const pageFile = join(routesDir, entry.name, '+page.svelte');
	try {
		const content = readFileSync(pageFile, 'utf8');
		const components = [];
		let m;
		importRe.lastIndex = 0;
		while ((m = importRe.exec(content)) !== null) {
			if (dict[m[1]] && !components.includes(m[1])) components.push(m[1]);
		}
		if (components.length) routeMap[`/${entry.name}`] = components;
	} catch {
		// no page file for this dir
	}
}

writeFileSync(resolve(outDir, 'route-map.json'), JSON.stringify(routeMap, null, 2));
console.log(`[gen-api] route-map.json — ${Object.keys(routeMap).length} routes`);
