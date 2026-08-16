import { describe, it, expect } from 'vitest';
import { MODES } from '../mesh-studio/modes.gen.js';
import { MODE_ICONS, labelForMode, glyphForMode, TERMINAL_GLYPH } from './mode-tool-icons.js';

describe('mode registry alignment', () => {
	// The Go and TS mode lists drifted for a long time — Go declared 12 modes and
	// the UI knew 8, so a third of them were invisible in the mesh, the agent
	// drawer and the installer catalog while running fine on the backend.
	// MODES is generated from agent/modes.yaml, so that half can no longer drift.
	// This guards the half that is still hand-authored: the glyph sets.

	it('every mode has a label', () => {
		for (const m of MODES) {
			expect(labelForMode(m.key), `mode ${m.key}`).toBe(m.label);
		}
	});

	it('every MODE_ICONS entry names a real mode', () => {
		const known = new Set(MODES.map((m) => m.key));
		for (const icon of MODE_ICONS) {
			expect(known.has(icon.key), `MODE_ICONS has "${icon.key}", absent from agent/modes.yaml`).toBe(
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

	it('mode keys are unique', () => {
		const keys = MODES.map((m) => m.key);
		expect(new Set(keys).size).toBe(keys.length);
	});
});
