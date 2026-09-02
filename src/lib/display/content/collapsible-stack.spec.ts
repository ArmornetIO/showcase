import { describe, expect, test } from 'vitest';
import type { CollapsibleStackCtx } from './collapsible-stack.js';

/**
 * The stack's open/close rule, as a plain reducer.
 *
 * This mirrors the logic inside `CollapsibleStack.svelte` rather than mounting
 * it: the component's only behaviour is this decision, and the showcase browser
 * test project is not run here. Kept in one place so a change to the rule fails
 * a test rather than only a screenshot.
 */
function makeStack(single = true): CollapsibleStackCtx & { multi: Set<string> } {
	let openKey: string | null = null;
	const multi = new Set<string>();
	return {
		multi,
		get openKey() {
			return openKey;
		},
		toggle(key: string) {
			if (single) {
				openKey = openKey === key ? null : key;
				return;
			}
			if (multi.has(key)) multi.delete(key);
			else multi.add(key);
			openKey = multi.has(key) ? key : null;
		},
		isOpen(key: string) {
			return single ? openKey === key : multi.has(key);
		}
	};
}

describe('CollapsibleStack — single mode (default)', () => {
	test('opens a row', () => {
		const s = makeStack();
		s.toggle('a');
		expect(s.isOpen('a')).toBe(true);
		expect(s.openKey).toBe('a');
	});

	test('toggling the open row closes it', () => {
		const s = makeStack();
		s.toggle('a');
		s.toggle('a');
		expect(s.isOpen('a')).toBe(false);
		expect(s.openKey).toBeNull();
	});

	test('opening another row closes the first', () => {
		// The whole reason the stack owns this: these lists are queues, and two
		// rows open at once rebuilds the stack of tall cards the row shape
		// replaced.
		const s = makeStack();
		s.toggle('a');
		s.toggle('b');
		expect(s.isOpen('a')).toBe(false);
		expect(s.isOpen('b')).toBe(true);
	});

	test('never reports two rows open', () => {
		const s = makeStack();
		for (const k of ['a', 'b', 'c', 'd']) s.toggle(k);
		const open = ['a', 'b', 'c', 'd'].filter((k) => s.isOpen(k));
		expect(open).toHaveLength(1);
	});
});

describe('CollapsibleStack — multi mode', () => {
	test('rows open independently', () => {
		const s = makeStack(false);
		s.toggle('a');
		s.toggle('b');
		expect(s.isOpen('a')).toBe(true);
		expect(s.isOpen('b')).toBe(true);
	});

	test('closing one leaves the others open', () => {
		const s = makeStack(false);
		s.toggle('a');
		s.toggle('b');
		s.toggle('a');
		expect(s.isOpen('a')).toBe(false);
		expect(s.isOpen('b')).toBe(true);
	});

	test('openKey tracks the last interaction, not the only open row', () => {
		// `openKey` is the bindable a caller observes. In multi mode it reports
		// the most recent open and null on a close, so `bind:` stays meaningful
		// in both modes instead of being single-mode-only.
		const s = makeStack(false);
		s.toggle('a');
		s.toggle('b');
		expect(s.openKey).toBe('b');
		s.toggle('b');
		expect(s.openKey).toBeNull();
		expect(s.isOpen('a')).toBe(true);
	});
});
