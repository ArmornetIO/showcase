// Node coverage for which group the console shows. This is a plain class, so it
// needs no browser — and the resolution rules are where the console has already
// gone wrong once: a gated group that was clicked used to fall back to another
// group, which made a dimmed tab look broken and left `Console.svelte`'s gate
// branch unreachable.
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ConsoleState } from './console-state.svelte.js';

const CONFIG = { stateKey: 'test_console' };

/** Minimal localStorage; the real one does not exist in the node project. */
function stubStorage(initial: Record<string, string> = {}) {
	const store = new Map(Object.entries(initial));
	vi.stubGlobal('localStorage', {
		getItem: (k: string) => store.get(k) ?? null,
		setItem: (k: string, v: string) => void store.set(k, v),
		removeItem: (k: string) => void store.delete(k),
		get length() {
			return store.size;
		},
		key: (i: number) => [...store.keys()][i] ?? null
	});
	return store;
}

const GROUPS = [
	{ id: 'page', available: true },
	{ id: 'render' },
	{ id: 'globe', available: false },
	{ id: 'perf' }
];

describe('ConsoleState', () => {
	beforeEach(() => vi.unstubAllGlobals());

	it('starts with nothing selected and resolves to the first available group', () => {
		stubStorage();
		const s = new ConsoleState(CONFIG);

		expect(s.selected).toBe('');
		expect(s.resolve(GROUPS)?.id).toBe('page');
	});

	it('returns undefined rather than guessing when there are no groups', () => {
		stubStorage();
		expect(new ConsoleState(CONFIG).resolve([])).toBeUndefined();
	});

	it('persists a selection under the host-supplied key', () => {
		const store = stubStorage();
		const s = new ConsoleState(CONFIG);

		s.select('perf');

		expect(s.selected).toBe('perf');
		expect(store.get('test_console')).toBe('perf');
	});

	it('restores what was stored', () => {
		stubStorage({ test_console: 'render' });
		const s = new ConsoleState(CONFIG);
		s.load();

		expect(s.resolve(GROUPS)?.id).toBe('render');
	});

	it('falls back when a STORED id names a group that no longer exists', () => {
		// The route changed, the host dropped a group, the globe unregistered — a
		// console rendering nothing is worse than one that moved.
		stubStorage({ test_console: 'mesh' });
		const s = new ConsoleState(CONFIG);
		s.load();

		expect(s.resolve(GROUPS)?.id).toBe('page');
	});

	it('falls back when a STORED id is gated on this route', () => {
		stubStorage({ test_console: 'globe' });
		const s = new ConsoleState(CONFIG);
		s.load();

		// You land somewhere usable rather than on a gate you did not ask for.
		expect(s.resolve(GROUPS)?.id).toBe('page');
	});

	it('KEEPS a gated group you clicked, so the panel can state the condition', () => {
		stubStorage();
		const s = new ConsoleState(CONFIG);

		s.select('globe');

		// The opposite of the stored case above, and the whole reason the two are
		// told apart: falling back here makes a dimmed tab look broken — you click
		// it and land elsewhere with nothing saying why.
		expect(s.resolve(GROUPS)?.id).toBe('globe');
		expect(s.resolve(GROUPS)?.available).toBe(false);
	});

	it('still falls back when a clicked id names nothing at all', () => {
		stubStorage();
		const s = new ConsoleState(CONFIG);

		s.select('gone');

		expect(s.resolve(GROUPS)?.id).toBe('page');
	});

	it('treats a missing `available` as available', () => {
		stubStorage();
		const s = new ConsoleState(CONFIG);
		s.select('render');

		expect(s.resolve(GROUPS)?.id).toBe('render');
	});

	it('returns the first group when every one of them is gated', () => {
		stubStorage();
		const allGated = [{ id: 'a', available: false }, { id: 'b', available: false }];

		// Something has to show, and its gate is the useful thing on screen.
		expect(new ConsoleState(CONFIG).resolve(allGated)?.id).toBe('a');
	});

	it('survives storage being unavailable', () => {
		// Private mode, disabled storage — the console still works, it just forgets.
		vi.stubGlobal('localStorage', undefined);
		const s = new ConsoleState(CONFIG);

		expect(() => s.load()).not.toThrow();
		expect(() => s.select('perf')).not.toThrow();
		expect(s.selected).toBe('perf');
	});

	it('throws nothing when storage rejects a write', () => {
		vi.stubGlobal('localStorage', {
			getItem: () => null,
			setItem: () => {
				throw new Error('QuotaExceededError');
			}
		});
		const s = new ConsoleState(CONFIG);

		expect(() => s.select('perf')).not.toThrow();
		expect(s.selected).toBe('perf');
	});
});
