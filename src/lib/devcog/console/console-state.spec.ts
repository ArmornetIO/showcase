// Node coverage for which group the console shows and whether it is open. This
// is a plain class, so it needs no browser — and the resolution rules are where
// the console has already gone wrong once: a gated group that was clicked used
// to fall back to another group, which made a dimmed tab look broken and left
// `Console.svelte`'s gate branch unreachable.
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ConsoleState } from './console-state.svelte.js';

const CONFIG = { stateKey: 'test_console' };

/** Minimal cookie jar; `document` does not exist in the node project. */
function stubCookies(initial: Record<string, string> = {}) {
	const jar = new Map(Object.entries(initial));
	vi.stubGlobal('document', {
		get cookie() {
			return [...jar].map(([k, v]) => `${k}=${v}`).join('; ');
		},
		set cookie(assignment: string) {
			const pair = assignment.split(';')[0];
			const eq = pair.indexOf('=');
			jar.set(pair.slice(0, eq), pair.slice(eq + 1));
		}
	});
	return jar;
}

const GROUPS = [
	{ id: 'page', available: true },
	{ id: 'render' },
	{ id: 'globe', available: false },
	{ id: 'perf' }
];

describe('ConsoleState', () => {
	beforeEach(() => vi.unstubAllGlobals());

	it('starts closed with nothing selected and resolves to the first available group', () => {
		stubCookies();
		const s = new ConsoleState(CONFIG);
		s.load();

		expect(s.open).toBe(false);
		expect(s.selected).toBe('');
		expect(s.resolve(GROUPS)?.id).toBe('page');
	});

	it('returns undefined rather than guessing when there are no groups', () => {
		stubCookies();
		expect(new ConsoleState(CONFIG).resolve([])).toBeUndefined();
	});

	it('persists the selection and open state under the host-supplied name', () => {
		const jar = stubCookies();
		const s = new ConsoleState(CONFIG);

		s.setOpen(true);
		s.select('perf');

		expect(s.selected).toBe('perf');
		expect(jar.get('test_console')).toBe('1.perf');
	});

	it('restores what another app on the host left behind', () => {
		// The alignment the cookie exists for: this console mounts in a different
		// app from the one that wrote it, and arrives the way that one was left.
		stubCookies({ test_console: '1.render' });
		const s = new ConsoleState(CONFIG);
		s.load();

		expect(s.open).toBe(true);
		expect(s.resolve(GROUPS)?.id).toBe('render');
	});

	it('falls back when a STORED id names a group that no longer exists', () => {
		// The route changed, the host dropped a group, or this app never had it —
		// a console rendering nothing is worse than one that moved.
		stubCookies({ test_console: '0.mesh' });
		const s = new ConsoleState(CONFIG);
		s.load();

		expect(s.resolve(GROUPS)?.id).toBe('page');
	});

	it('falls back when a STORED id is gated on this route', () => {
		stubCookies({ test_console: '0.globe' });
		const s = new ConsoleState(CONFIG);
		s.load();

		// You land somewhere usable rather than on a gate you did not ask for.
		expect(s.resolve(GROUPS)?.id).toBe('page');
	});

	it('KEEPS a gated group you clicked, so the panel can state the condition', () => {
		stubCookies();
		const s = new ConsoleState(CONFIG);

		s.select('globe');

		// The opposite of the stored case above, and the whole reason the two are
		// told apart: falling back here makes a dimmed tab look broken — you click
		// it and land elsewhere with nothing saying why.
		expect(s.resolve(GROUPS)?.id).toBe('globe');
		expect(s.resolve(GROUPS)?.available).toBe(false);
	});

	it('still falls back when a clicked id names nothing at all', () => {
		stubCookies();
		const s = new ConsoleState(CONFIG);

		s.select('gone');

		expect(s.resolve(GROUPS)?.id).toBe('page');
	});

	it('treats a missing `available` as available', () => {
		stubCookies();
		const s = new ConsoleState(CONFIG);
		s.select('render');

		expect(s.resolve(GROUPS)?.id).toBe('render');
	});

	it('returns the first group when every one of them is gated', () => {
		stubCookies();
		const allGated = [
			{ id: 'a', available: false },
			{ id: 'b', available: false }
		];

		// Something has to show, and its gate is the useful thing on screen.
		expect(new ConsoleState(CONFIG).resolve(allGated)?.id).toBe('a');
	});

	it('ignores an unreadable cookie', () => {
		stubCookies({ test_console: 'render' });
		const s = new ConsoleState(CONFIG);
		s.load();

		expect(s.selected).toBe('');
		expect(s.open).toBe(false);
	});

	it('survives there being no document', () => {
		const s = new ConsoleState(CONFIG);

		expect(() => s.load()).not.toThrow();
		expect(() => s.select('perf')).not.toThrow();
		expect(s.selected).toBe('perf');
	});

	it('throws nothing when the cookie write is rejected', () => {
		vi.stubGlobal('document', {
			get cookie() {
				return '';
			},
			set cookie(_: string) {
				throw new Error('SecurityError');
			}
		});
		const s = new ConsoleState(CONFIG);

		expect(() => s.setOpen(true)).not.toThrow();
		expect(s.open).toBe(true);
	});
});
