#!/usr/bin/env node
/**
 * gen-canvas-bundle.mjs
 *
 * Emits the knowledge bundle the design agent validates against:
 * src/lib/generated/canvas-bundle.json — every placeable component and the
 * properties it actually accepts, with each property's kind, options and
 * numeric bounds.
 *
 * DERIVED, never hand-written. The server refuses any operation naming a
 * component or property that is not in this bundle, so a hand-kept copy would
 * be a list that silently stops matching the components that actually resolve —
 * and the failure would look like the agent inventing things.
 *
 * It reads src/lib/builder/registry.ts through the TypeScript compiler AST
 * rather than importing it, for the same reason gen-api.mjs does: registry.ts
 * imports Svelte and sibling modules, so executing it needs a bundler, while
 * the data we want is a literal that can simply be read.
 *
 * Usage:  node scripts/gen-canvas-bundle.mjs [--check]
 */

import ts from 'typescript';
import { readFileSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');
const registryPath = resolve(root, 'src/lib/builder/registry.ts');
const outPath = resolve(root, 'src/lib/generated/canvas-bundle.json');

const src = readFileSync(registryPath, 'utf8');
const sf = ts.createSourceFile(registryPath, src, ts.ScriptTarget.Latest, true);

/** Read a string/number/boolean literal, or undefined when it is computed. */
function literal(node) {
	if (!node) return undefined;
	if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return node.text;
	if (ts.isNumericLiteral(node)) return Number(node.text);
	if (node.kind === ts.SyntaxKind.TrueKeyword) return true;
	if (node.kind === ts.SyntaxKind.FalseKeyword) return false;
	if (ts.isPrefixUnaryExpression(node) && node.operator === ts.SyntaxKind.MinusToken) {
		const inner = literal(node.operand);
		return typeof inner === 'number' ? -inner : undefined;
	}
	return undefined;
}

function prop(objLit, name) {
	for (const m of objLit.properties) {
		if (ts.isPropertyAssignment(m) && m.name.getText() === name) return m.initializer;
	}
	return undefined;
}

/** Options may be an inline array or a reference to a derived const. */
function readOptions(node) {
	if (!node || !ts.isArrayLiteralExpression(node)) return undefined;
	const out = node.elements.map(literal).filter((v) => typeof v === 'string');
	return out.length ? out : undefined;
}

function readProps(objLit) {
	const out = {};
	if (!objLit || !ts.isObjectLiteralExpression(objLit)) return out;
	for (const m of objLit.properties) {
		if (!ts.isPropertyAssignment(m) || !ts.isObjectLiteralExpression(m.initializer)) continue;
		const key = ts.isStringLiteral(m.name) ? m.name.text : m.name.getText().replace(/['"]/g, '');
		const kind = literal(prop(m.initializer, 'kind'));
		if (typeof kind !== 'string') continue;

		const def = { kind };
		const options = readOptions(prop(m.initializer, 'options'));
		if (options) def.options = options;
		const min = literal(prop(m.initializer, 'min'));
		const max = literal(prop(m.initializer, 'max'));
		if (typeof min === 'number') def.min = min;
		if (typeof max === 'number') def.max = max;
		out[key] = def;
	}
	return out;
}

const components = [];
let seenRegistry = false;

sf.forEachChild((node) => {
	if (!ts.isVariableStatement(node)) return;
	for (const decl of node.declarationList.declarations) {
		if (decl.name.getText() !== 'REGISTRY') continue;
		seenRegistry = true;
		const arr = decl.initializer;
		if (!arr || !ts.isArrayLiteralExpression(arr)) continue;
		for (const el of arr.elements) {
			if (!ts.isObjectLiteralExpression(el)) continue;
			const id = literal(prop(el, 'id'));
			if (typeof id !== 'string') continue;
			components.push({ id, props: readProps(prop(el, 'props')) });
		}
	}
});

if (!seenRegistry) {
	console.error('gen-canvas-bundle: no REGISTRY export found in registry.ts');
	process.exit(1);
}
if (components.length === 0) {
	// An empty bundle refuses every component the agent proposes, and the symptom
	// is indistinguishable from a broken agent. Fail here instead.
	console.error('gen-canvas-bundle: REGISTRY parsed to zero components');
	process.exit(1);
}

components.sort((a, b) => a.id.localeCompare(b.id));
const json = JSON.stringify({ components }, null, 2) + '\n';

if (process.argv.includes('--check')) {
	let existing = '';
	try {
		existing = readFileSync(outPath, 'utf8');
	} catch {
		console.error('gen-canvas-bundle: canvas-bundle.json is missing — run the generator');
		process.exit(1);
	}
	if (existing !== json) {
		console.error('gen-canvas-bundle: canvas-bundle.json is stale — run the generator');
		process.exit(1);
	}
	console.log(`[gen-canvas-bundle] up to date — ${components.length} components`);
	process.exit(0);
}

writeFileSync(outPath, json);
console.log(`[gen-canvas-bundle] ${components.length} components → src/lib/generated/canvas-bundle.json`);
