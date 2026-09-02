/**
 * Fails when `index.ts` no longer matches what the manifest and the filesystem
 * imply — the barrel is generated, and a stale generated file is worse than a
 * hand-written one because nobody thinks to read it.
 *
 * This catches the two ways the barrel rotted before:
 *   · a file moved and the paths in the barrel went with it by hand (or didn't);
 *   · a symbol was renamed or deleted and the barrel kept exporting the old name,
 *     which only broke in `app-ui`, a package away from the change.
 *
 * Both now surface here instead, with a message naming the symbol.
 */
import { describe, it, expect } from 'vitest';
import { execFileSync } from 'child_process';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const script = resolve(__dirname, '../../scripts/gen-exports.mjs');

describe('generated barrel', () => {
	it('is up to date with the manifest and the filesystem', () => {
		let output = '';
		let failed = false;
		try {
			output = execFileSync('node', [script, '--check'], { encoding: 'utf8' });
		} catch (err) {
			failed = true;
			const e = err as { stdout?: string; stderr?: string };
			output = `${e.stdout ?? ''}${e.stderr ?? ''}`;
		}

		expect(
			failed,
			`${output.trim()}\n\nFix: run \`npm run gen:exports\` and commit the result.`
		).toBe(false);
	});
});
