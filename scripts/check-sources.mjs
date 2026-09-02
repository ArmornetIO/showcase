// Fail the build on hazards the type checker structurally cannot see.
//
// svelte-check reads types. These are failures where every type is correct, the
// file compiles, and the result is silently wrong on screen — which makes them
// far more expensive than a type error, because nothing tells you. Each check
// here exists because it already cost someone an afternoon.
//
// Run by `npm run check`, before svelte-check.

import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { readdir } from 'node:fs/promises';
import { join, relative, resolve } from 'node:path';

const ROOT = resolve(import.meta.dirname, '..');
const SRC = join(ROOT, 'src');

const failures = [];

// ── Walk src/ ──────────────────────────────────────────────────────────────
// fs, not git: the whole point of check A is to find files git is hiding.
async function walk(dir, out = []) {
	for (const e of await readdir(dir, { withFileTypes: true })) {
		if (e.name === 'node_modules' || e.name === '.svelte-kit') continue;
		const p = join(dir, e.name);
		if (e.isDirectory()) await walk(p, out);
		else if (/\.(svelte|ts|js|html)$/.test(e.name)) out.push(p);
	}
	return out;
}

const files = await walk(SRC);

// ── A. Tailwind cannot see gitignored files ────────────────────────────────
//
// Tailwind v4 derives its source list from git, so a gitignored file is skipped
// during class detection. Utility classes used ONLY in that file are never
// generated. The file compiles, the classes appear in the DOM, and they do
// nothing — which reads as a layout bug, not a build problem, and sends you
// hunting through CSS that was never emitted.
//
// This is not hypothetical: `src/routes/mockups/*` is ignored by design, so
// every mockup that styles itself with utilities has to be un-ignored to work.
// The .gitignore already carries the exceptions and the reason.

const ignored = new Set();
if (files.length) {
	try {
		// check-ignore exits 1 when nothing matches, which is not an error here.
		const out = execFileSync('git', ['check-ignore', '--stdin'], {
			cwd: ROOT,
			input: files.join('\n'),
			encoding: 'utf8'
		});
		for (const line of out.split('\n')) if (line.trim()) ignored.add(resolve(ROOT, line.trim()));
	} catch (err) {
		if (err.status === 1 && err.stdout !== undefined) {
			for (const line of String(err.stdout).split('\n'))
				if (line.trim()) ignored.add(resolve(ROOT, line.trim()));
		} else {
			throw err;
		}
	}
}

/** Tailwind-shaped tokens: `flex`, `gap-2`, `text-[var(--fg)]`, `grid-cols-[…]`. */
const UTILITY = /(?:^|\s)-?(?:[a-z][a-z0-9]*-)*[a-z][a-z0-9]*(?:-\[[^\]\s]+\])?(?=\s|$)/;
const HALLMARK =
	/\b(?:flex|grid|hidden|absolute|relative|truncate|rounded(?:-|\b)|(?:m|p)[trblxy]?-|gap-|text-|bg-|border-|w-|h-|min-|max-|items-|justify-|col-|row-|space-|opacity-|z-)/;

function carriesUtilities(src) {
	// Only class attributes count — prose and comments mentioning "flex" do not.
	for (const m of src.matchAll(/\bclass(?:Name)?\s*=\s*(["'`])([\s\S]*?)\1/g)) {
		const value = m[2];
		if (HALLMARK.test(value) && UTILITY.test(value)) return true;
	}
	return false;
}

for (const f of files) {
	if (!ignored.has(f)) continue;
	let src;
	try {
		src = readFileSync(f, 'utf8');
	} catch {
		continue;
	}
	if (!carriesUtilities(src)) continue;
	failures.push({
		file: relative(ROOT, f),
		what: 'gitignored file uses Tailwind utility classes',
		why: 'Tailwind derives its source list from git, so classes used only here are never generated and the file renders unstyled.',
		fix: 'Un-ignore it in showcase/.gitignore (see the mockups block), or style it with a scoped <style> instead.'
	});
}

// ── B. A path or glob containing `*/` closes the comment around it ─────────
//
// `/** … docs/corporate/*​/_template.md … */` ends at the `*​/` inside the path.
// Whatever follows is parsed as code. The parser does fail, but it fails
// somewhere further down with a message about an unexpected token, pointing at
// a line that is fine. Naming the real cause is worth the twenty lines.

for (const f of files) {
	let src;
	try {
		src = readFileSync(f, 'utf8');
	} catch {
		continue;
	}
	if (!src.includes('/*')) continue;

	const lines = src.split('\n');
	let inBlock = false;
	lines.forEach((line, i) => {
		let rest = line;
		let col = 0;
		while (rest.length) {
			if (!inBlock) {
				const open = rest.indexOf('/*');
				if (open === -1) break;
				// A `//` earlier on the line means the `/*` is inside a line comment.
				const lineComment = rest.indexOf('//');
				if (lineComment !== -1 && lineComment < open) break;
				inBlock = true;
				rest = rest.slice(open + 2);
				col += open + 2;
				continue;
			}
			const close = rest.indexOf('*/');
			if (close === -1) break;
			// The close is suspicious when it is glued to a path-ish character and
			// the comment "continues" with more text on the same line.
			const before = rest[close - 1];
			const after = rest.slice(close + 2);
			if (before && /[A-Za-z0-9_)\]]/.test(before) === false && before !== ' ' && after.trim()) {
				failures.push({
					file: `${relative(ROOT, f)}:${i + 1}`,
					what: 'a `*/` inside a block comment closes it early',
					why: 'A path or glob like `foo/*/bar` terminates the comment at the `*/`, and the rest of the line is parsed as code.',
					fix: 'Rewrite the path without the glob, or escape it (`*\\/`).'
				});
			}
			inBlock = false;
			rest = rest.slice(close + 2);
			col += close + 2;
		}
	});
}

// ── Report ─────────────────────────────────────────────────────────────────
if (failures.length) {
	console.error(`\n✖ check-sources found ${failures.length} problem(s):\n`);
	for (const f of failures) {
		console.error(`  ${f.file}`);
		console.error(`    ${f.what}`);
		console.error(`    why: ${f.why}`);
		console.error(`    fix: ${f.fix}\n`);
	}
	process.exit(1);
}

console.log(`check-sources: ${files.length} files, no problems`);
