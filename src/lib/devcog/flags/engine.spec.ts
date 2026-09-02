import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createFlagStore } from './engine.js';

// Minimal in-memory localStorage stub for the node test env.
class MemStorage {
	private m = new Map<string, string>();
	getItem(k: string) {
		return this.m.has(k) ? (this.m.get(k) as string) : null;
	}
	setItem(k: string, v: string) {
		this.m.set(k, String(v));
	}
	removeItem(k: string) {
		this.m.delete(k);
	}
	clear() {
		this.m.clear();
	}
}

type Runtime = { features?: Record<string, boolean>; serve?: string; dev?: boolean };

function setup(runtime?: Runtime) {
	const storage = new MemStorage();
	const reload = vi.fn();
	// @ts-expect-error — stubbing browser globals in node.
	globalThis.localStorage = storage;
	// @ts-expect-error — stubbing browser globals in node.
	globalThis.window = { __TEST__: runtime, location: { reload } };
	const store = createFlagStore({
		overridesKey: 'test-flags',
		serveModeKey: 'test-serve-mode',
		runtimeGlobal: '__TEST__',
		defaultServeMode: 'marketing',
		keys: ['alpha', 'beta', 'gamma'] as const
	});
	return { store, storage, reload };
}

describe('createFlagStore', () => {
	beforeEach(() => {
		// @ts-expect-error — reset globals between tests.
		delete globalThis.localStorage;
		// @ts-expect-error — reset globals between tests.
		delete globalThis.window;
	});

	it('defaults every flag OFF with no override and no server value', () => {
		const { store } = setup();
		expect(store.isEnabled('alpha')).toBe(false);
		expect(store.snapshot().every((f) => f.enabled === false)).toBe(true);
	});

	it('reads server-injected defaults from window[runtimeGlobal]', () => {
		const { store } = setup({ features: { alpha: true, beta: false } });
		expect(store.isEnabled('alpha')).toBe(true);
		expect(store.isEnabled('beta')).toBe(false);
		const snap = store.snapshot();
		expect(snap.find((f) => f.key === 'alpha')).toEqual({
			key: 'alpha',
			enabled: true,
			source: 'server'
		});
	});

	it('localStorage override beats the server value', () => {
		const { store } = setup({ features: { alpha: true } });
		store.setOverride('alpha', false);
		expect(store.isEnabled('alpha')).toBe(false);
		expect(store.snapshot().find((f) => f.key === 'alpha')).toEqual({
			key: 'alpha',
			enabled: false,
			source: 'override'
		});
	});

	it('setOverride(null) clears the override and falls back to server', () => {
		const { store } = setup({ features: { alpha: true } });
		store.setOverride('alpha', false);
		expect(store.isEnabled('alpha')).toBe(false);
		store.setOverride('alpha', null);
		expect(store.isEnabled('alpha')).toBe(true);
	});

	it('clearOverrides removes all overrides at once', () => {
		const { store } = setup();
		store.setOverride('alpha', true);
		store.setOverride('beta', true);
		store.clearOverrides();
		expect(store.isEnabled('alpha')).toBe(false);
		expect(store.isEnabled('beta')).toBe(false);
	});

	it('snapshot preserves the configured key order', () => {
		const { store } = setup();
		expect(store.snapshot().map((f) => f.key)).toEqual(['alpha', 'beta', 'gamma']);
	});

	it('serveMode resolves override → server → default', () => {
		const a = setup();
		expect(a.store.serveMode()).toBe('marketing'); // default
		const b = setup({ serve: 'app' });
		expect(b.store.serveMode()).toBe('app'); // server
		b.store.setServeModeOverride('showcase');
		expect(b.store.serveMode()).toBe('showcase'); // override wins
		expect(b.reload).toHaveBeenCalled();
	});

	it('isDevMode reflects the server dev flag', () => {
		expect(setup().store.isDevMode()).toBe(false);
		expect(setup({ dev: true }).store.isDevMode()).toBe(true);
	});

	it('is SSR-safe: no throw when storage/window are absent', () => {
		const store = createFlagStore({
			overridesKey: 'k',
			serveModeKey: 's',
			runtimeGlobal: '__NONE__',
			defaultServeMode: 'marketing',
			keys: ['alpha'] as const
		});
		expect(() => store.isEnabled('alpha')).not.toThrow();
		expect(store.isEnabled('alpha')).toBe(false);
		expect(store.serveMode()).toBe('marketing');
		expect(store.snapshot()).toHaveLength(1);
	});
});
