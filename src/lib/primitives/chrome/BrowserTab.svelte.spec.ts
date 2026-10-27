import { describe, it, expect } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { flushSync } from 'svelte';
import BrowserTab from './BrowserTab.svelte';

describe('BrowserTab', () => {
	it('layers over an earlier tab and hands it back on unmount', () => {
		const base = render(BrowserTab, { title: 'Home', site: 'Armornet', count: 2 });
		flushSync();
		expect(document.title).toBe('(2) Home — Armornet');

		const page = render(BrowserTab, { title: 'Inbox' });
		flushSync();
		expect(document.title).toBe('(2) Inbox — Armornet');

		page.unmount();
		flushSync();
		expect(document.title).toBe('(2) Home — Armornet');
		base.unmount();
	});
});
