import { describe, it, expect } from 'vitest';
import {
	PANEL_SHAPES,
	applyPanelShape,
	isPanelShape,
	panelShapeClasses,
	readPanelShape
} from './panel-shape.js';

describe('panelShapeClasses', () => {
	it('keeps the glass surface for shapes that use the default outline', () => {
		const cls = panelShapeClasses('default');
		expect(cls).toContain('glass');
		expect(cls).toContain('r-surface');
		expect(cls).not.toContain('is-bare');
	});

	it('strips the default outline from shapes that draw their own', () => {
		for (const s of ['bracket', 'split', 'rule', 'notch', 'chamfer'] as const) {
			expect(panelShapeClasses(s)).toContain('is-bare');
			expect(panelShapeClasses(s)).not.toContain('glass');
		}
	});

	it('unclips shapes that put content outside the card box', () => {
		// A tab hangs above the top edge; clipping to the corners would cut it off.
		expect(panelShapeClasses('tab')).toContain('overflow-visible');
		expect(panelShapeClasses('default')).toContain('overflow-hidden');
	});

	it('never overturns an explicit allowOverflow', () => {
		expect(panelShapeClasses('default', true)).toContain('overflow-visible');
	});
});

describe('applyPanelShape', () => {
	// A stand-in rather than a real element: showcase's node vitest project has no
	// DOM and the package takes no new dependency for one. What is under test here
	// is the class arithmetic, which is all `applyPanelShape` does — the real
	// element path is covered by driving the QA cog in a browser.
	function panel(className = 'panel tone-default glass r-surface overflow-hidden shape-default') {
		const set = new Set(className.split(' '));
		return {
			classList: {
				contains: (c: string) => set.has(c),
				add: (...cs: string[]) => cs.forEach((c) => set.add(c)),
				remove: (...cs: string[]) => cs.forEach((c) => set.delete(c))
			},
			getAttribute: () => null
		} as unknown as HTMLElement;
	}

	it('swaps the whole class set, not just the shape class', () => {
		const el = panel();
		applyPanelShape(el, 'notch');
		expect(el.classList.contains('shape-notch')).toBe(true);
		expect(el.classList.contains('shape-default')).toBe(false);
		// The stale `glass`/`r-surface` would have kept the default outline
		// painting underneath the clipped one.
		expect(el.classList.contains('glass')).toBe(false);
		expect(el.classList.contains('is-bare')).toBe(true);
	});

	it('leaves classes it does not own alone', () => {
		const el = panel('panel tone-default glass r-surface overflow-hidden my-page-class');
		applyPanelShape(el, 'tab');
		expect(el.classList.contains('tone-default')).toBe(true);
		expect(el.classList.contains('my-page-class')).toBe(true);
	});

	it('refuses anything that is not a panel', () => {
		expect(applyPanelShape(panel('some-other-card'), 'tab')).toBe(false);
		expect(applyPanelShape(null, 'tab')).toBe(false);
	});

	it('round-trips through readPanelShape for every shape', () => {
		const el = panel();
		for (const s of PANEL_SHAPES) {
			applyPanelShape(el, s.value);
			expect(readPanelShape(el)).toBe(s.value);
		}
	});
});

describe('isPanelShape', () => {
	it('rejects a value that is not in the catalogue', () => {
		expect(isPanelShape('tab')).toBe(true);
		expect(isPanelShape('trapezoid')).toBe(false);
	});
});
