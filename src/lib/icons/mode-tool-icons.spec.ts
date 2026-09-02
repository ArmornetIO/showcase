import { describe, it, expect } from 'vitest';
import { MODES } from '../mesh-studio/modes.gen.js';
import {
	MODE_ICONS,
	MODE_ICON_GLYPHS,
	labelForMode,
	glyphForMode,
	modeIconName,
	TERMINAL_GLYPH
} from './mode-tool-icons.js';

describe('mode registry alignment', () => {
	// The Go and TS mode lists drifted for a long time — Go declared 12 modes and
	// the UI knew 8, so a third of them were invisible in the mesh, the agent
	// drawer and the installer catalog while running fine on the backend.
	// MODES is generated from agent/modes.go, so that half can no longer drift.
	// This guards the half that is still hand-authored: the glyph sets.

	it('every mode has a label', () => {
		for (const m of MODES) {
			expect(labelForMode(m.key), `mode ${m.key}`).toBe(m.label);
		}
	});

	it('every MODE_ICONS entry names a real mode', () => {
		const known = new Set(MODES.map((m) => m.key));
		for (const icon of MODE_ICONS) {
			expect(known.has(icon.key), `MODE_ICONS has "${icon.key}", absent from agent/modes.go`).toBe(
				true
			);
		}
	});

	it('every declared glyph choice resolves to a real drawn option', () => {
		// A glyph named in the manifest but absent from MODE_ICONS silently falls
		// back to the terminal silhouette, so the mode renders as something else
		// entirely rather than erroring.
		for (const m of MODES.filter((m) => m.glyph)) {
			const entry = MODE_ICONS.find((i) => i.key === m.key);
			expect(entry, `mode ${m.key} declares glyph "${m.glyph}" but has no MODE_ICONS entry`).toBeDefined();
			const opt = entry?.options.find((o) => o.name === m.glyph);
			expect(opt, `mode ${m.key} declares glyph "${m.glyph}", not among its drawn options`).toBeDefined();
		}
	});

	it('a mode with no drawn glyph falls back rather than throwing', () => {
		for (const m of MODES.filter((m) => !m.glyph)) {
			expect(glyphForMode(m.key)).toBe(TERMINAL_GLYPH);
		}
	});

	// The mesh resolves a mode's silhouette with glyphForMode. Everything that is
	// not the mesh — a list row, a drawer header, a button — asks Icon for
	// `mode-<key>`, which reads MODE_ICON_GLYPHS. That map is the one thing here
	// still written out by hand (a literal is what keeps IconName a union of real
	// names), so nothing structural stops a new mode from landing in modes.go
	// with a drawn glyph the mesh picks up and Icon does not. The fallback is
	// silent by design — modeIconName returns hello_world for an unknown key — so
	// the failure looks like "the drawer shows a terminal", not like an error.
	it('every mode is reachable as an Icon, drawing the mesh silhouette', () => {
		for (const m of MODES) {
			const name = modeIconName(m.key);
			expect(name, `mode ${m.key} has no "mode-${m.key}" entry in MODE_ICON_GLYPHS`).toBe(
				`mode-${m.key}`
			);
			expect(
				MODE_ICON_GLYPHS[name],
				`Icon "mode-${m.key}" draws something other than the mesh silhouette`
			).toBe(glyphForMode(m.key));
		}
	});

	it('mode keys are unique', () => {
		const keys = MODES.map((m) => m.key);
		expect(new Set(keys).size).toBe(keys.length);
	});
});
