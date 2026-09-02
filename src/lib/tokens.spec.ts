import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

// Every `var(--x)` in the library must resolve — either against tokens.css (a
// design token) or against a definition in the referencing file itself (a
// component-scoped property, e.g. AlertBlade's `--blade-*` set via `style:`).
//
// An unresolved reference WITHOUT a fallback is invalid at computed-value time:
// the whole declaration is dropped and the property falls back to its initial
// value — transparent for a background, black for a color. Nothing throws and
// nothing logs. It is simply wrong, in every theme at once, and this test is
// the only thing that catches it.
//
// An unresolved reference WITH a fallback is a softer bug — it renders the
// fallback rather than the house value, so it looks *plausible* while quietly
// opting out of the design system. `collectUnresolved` reports both tiers;
// only the first fails the suite.

const LIB = fileURLToPath(new URL('.', import.meta.url));
const SOURCE_EXT = new Set(['.svelte', '.ts', '.css']);

/** Prefixes owned by tooling, not by us. */
const EXTERNAL_PREFIXES = ['--tw-'];

/**
 * Custom properties a *consumer* is invited to set, so the library referencing
 * one without defining it is the contract, not a bug. Keep this list short and
 * justify every entry.
 */
const CONSUMER_SET = new Set([
	// motion/vanish.ts — a component opts into an exit origin by setting this on
	// its own node; the documented default lives in the fallback.
	'--exit-origin'
]);

function sourceFiles(dir: string, acc: string[] = []): string[] {
	for (const entry of readdirSync(dir, { withFileTypes: true })) {
		if (entry.name === 'generated' || entry.name === 'node_modules') continue;
		// This file quotes token names as examples; it is not a stylesheet.
		if (entry.name === 'tokens.spec.ts') continue;
		const full = join(dir, entry.name);
		if (entry.isDirectory()) sourceFiles(full, acc);
		else if (SOURCE_EXT.has(extname(entry.name))) acc.push(full);
	}
	return acc;
}

/** Comments discuss tokens without using them. Each comment is replaced by its
 *  own newlines rather than a space, so reported line numbers still match the
 *  file on disk. `//` needs the `[^:]` guard so `https://…` survives. */
function stripComments(src: string): string {
	const blank = (m: string) => m.replace(/[^\n]/g, '');
	return src
		.replace(/\/\*[\s\S]*?\*\//g, blank)
		.replace(/<!--[\s\S]*?-->/g, blank)
		.replace(/(^|[^:])\/\/[^\n]*/g, (m, p1) => p1);
}

/** Custom-property names *declared* in a source string. Three forms, because
 *  components set component-scoped properties three ways:
 *    1. `--x: value`     — a `<style>` block, inline `style="…"`, or CSS built
 *                          as a string in .ts
 *    2. `style:--x={v}`  — the Svelte style directive (no trailing colon, so it
 *                          needs its own pattern)
 *    3. `'--x': value`   — a quoted key in a style object / record */
function declaredIn(src: string): Set<string> {
	return new Set(
		[
			...src.matchAll(/(--[a-z0-9-]+)\s*:/gi),
			...src.matchAll(/style:(--[a-z0-9-]+)/gi),
			...src.matchAll(/['"`](--[a-z0-9-]+)['"`]\s*:/gi)
		].map((m) => m[1])
	);
}

const globalTokens = declaredIn(readFileSync(join(LIB, 'tokens.css'), 'utf8'));

interface Unresolved {
	/** `--name — path/to/File.svelte` */
	where: string;
	/** A `var(--x, fallback)` renders the fallback instead of breaking outright. */
	hasFallback: boolean;
}

function collectUnresolved(): Unresolved[] {
	const out: Unresolved[] = [];

	for (const file of sourceFiles(LIB)) {
		const src = stripComments(readFileSync(file, 'utf8'));
		const local = declaredIn(src);

		// Capture the character after the name so a fallback (`,`) is detectable.
		for (const m of src.matchAll(/var\(\s*(--[a-z0-9-]+)\s*(,?)/gi)) {
			const name = m[1];
			if (EXTERNAL_PREFIXES.some((p) => name.startsWith(p))) continue;
			if (CONSUMER_SET.has(name)) continue;
			if (globalTokens.has(name) || local.has(name)) continue;

			const where = `${name} — ${file.slice(LIB.length)}`;
			if (!out.some((u) => u.where === where)) {
				out.push({ where, hasFallback: m[2] === ',' });
			}
		}
	}

	return out.sort((a, b) => a.where.localeCompare(b.where));
}

describe('design tokens', () => {
	it('resolves every var() against tokens.css or its own file', () => {
		const broken = collectUnresolved()
			.filter((u) => !u.hasFallback)
			.map((u) => u.where);

		expect(
			broken,
			`These var() references resolve to nothing and have no fallback, so the\n` +
				`declaration is dropped entirely:\n  ${broken.join('\n  ')}\n`
		).toEqual([]);
	});

	it('names no house font family outside tokens.css', () => {
		// Restating a font stack locally is the same drift as a hardcoded color,
		// but quieter: the component renders *almost* right, and only diverges
		// when the primary face fails to load and the two fallback chains part
		// ways. `--mono` walks JetBrains → SF Mono → Menlo → Consolas; a local
		// `'JetBrains Mono', monospace` jumps straight to the generic.
		const HOUSE_FACES = ['JetBrains Mono', 'JetBrains_Mono', 'Rajdhani', 'Orbitron'];
		const offenders: string[] = [];

		for (const file of sourceFiles(LIB)) {
			// tokens.css is where the faces are *supposed* to be named.
			if (file.endsWith('tokens.css')) continue;
			const src = stripComments(readFileSync(file, 'utf8'));
			src.split('\n').forEach((line, i) => {
				if (!HOUSE_FACES.some((f) => line.includes(f))) return;
				// A line that names a face *and* a token is a redundant fallback
				// (`var(--mono, 'JetBrains Mono', monospace)`) — still drift.
				offenders.push(`${file.slice(LIB.length)}:${i + 1} — ${line.trim()}`);
			});
		}

		expect(
			offenders,
			`Font families belong to tokens.css. Use var(--mono), var(--mono-display)\n` +
				`or var(--sans-brand):\n  ${offenders.join('\n  ')}\n`
		).toEqual([]);
	});

	it('carries no fallback on a token that already exists', () => {
		// `var(--fg, #e9f2f4)` where `--fg` IS defined: the fallback is unreachable
		// dead code, and in practice it goes stale. Before this test, the library
		// held 253 of them documenting THREE different wrong values for --accent
		// (#5fead4, #5fead5, and the real #5eead4), plus a --palette-red fallback
		// that was a different colour entirely.
		//
		// A fallback on an UNDEFINED name is a different thing and stays legal —
		// that is a component-scoped property (`--edge`, `--tc`, `--item-color`)
		// whose owner sets it inline, and there the fallback is the live default.
		const offenders: string[] = [];

		for (const file of sourceFiles(LIB)) {
			const rel = file.slice(LIB.length);
			// devcog/ is mid-restructure in a parallel branch of work; re-include it
			// (delete this line) once that lands — it has ~22 known occurrences.
			if (rel.startsWith('devcog/')) continue;

			const src = stripComments(readFileSync(file, 'utf8'));
			src.split('\n').forEach((line, i) => {
				for (const m of line.matchAll(/var\(\s*(--[a-z0-9-]+)\s*,/gi)) {
					if (globalTokens.has(m[1])) {
						offenders.push(`${rel}:${i + 1} — ${m[1]} (defined; drop the fallback)`);
					}
				}
			});
		}

		expect(
			offenders,
			`A defined token needs no fallback — the fallback can never render, and\n` +
				`these drift silently when the token changes:\n  ${offenders.join('\n  ')}\n`
		).toEqual([]);
	});

	it('has no var() falling back past an undefined token', () => {
		// A fallback keeps the page rendering, so this never looks broken — the
		// component just quietly renders the fallback instead of the house value
		// and stops tracking the theme. Every fallback chain must bottom out on a
		// token that exists, or name a property in CONSUMER_SET that a host is
		// expected to supply.
		const drifting = collectUnresolved()
			.filter((u) => u.hasFallback)
			.map((u) => u.where);

		expect(
			drifting,
			`These var() references name a token that does not exist, so they always\n` +
				`render their fallback and silently opt out of the design system:\n  ` +
				`${drifting.join('\n  ')}\n`
		).toEqual([]);
	});
});
