import { describe, it, expect } from 'vitest';
import { resolveTab } from './browser-tab.svelte.js';

describe('resolveTab', () => {
	it('joins title and site', () => {
		expect(resolveTab([{ title: 'Relays', site: 'Armornet' }]).title).toBe('Relays — Armornet');
	});

	it('takes each field from the newest layer that sets it', () => {
		const tab = resolveTab([
			{ site: 'Armornet', count: 3 },
			{ title: 'Inbox', count: undefined }
		]);
		expect(tab.title).toBe('(3) Inbox — Armornet');
	});

	it('hides a zero count and caps a large one', () => {
		expect(resolveTab([{ title: 'X', count: 0 }]).title).toBe('X');
		expect(resolveTab([{ title: 'X', count: 250 }]).title).toBe('(99+) X');
	});
});
