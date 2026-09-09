// CI ONLY — this is a `*.svelte.spec.ts`, so it runs under the `browser`
// vitest project (Playwright Chromium). Do not run that project on a dev
// machine; see devcog/CLAUDE.md.
//
// What is worth pinning here is the two things the rail was hand-built for
// rather than reusing `navigation/Tabs.svelte`: roving arrow-key focus, and
// gated groups staying reachable instead of disappearing. Both are behaviours
// a snapshot cannot see and both have already regressed once.
import { page } from 'vitest/browser';
import { describe, it, expect } from 'vitest';
import { render } from 'vitest-browser-svelte';
import GroupRail from './GroupRail.svelte';
import type { ToolGroup } from './types.js';

/** The rail never renders a group body, so the snippet is inert scaffolding. */
const body = (() => {}) as unknown as ToolGroup['content'];

const GROUPS: ToolGroup[] = [
	{ id: 'page', label: 'PAGE', glyph: '▤', content: body },
	{ id: 'render', label: 'RENDER', glyph: '◧', content: body },
	{
		id: 'globe',
		label: 'GLOBE',
		glyph: '◍',
		available: false,
		gate: 'Needs a registered globe on the page.',
		content: body
	},
	{ id: 'capture', label: 'CAPTURE', glyph: '◎', count: 4, content: body }
];

describe('GroupRail', () => {
	it('renders every group, including the unavailable one', async () => {
		render(GroupRail, { groups: GROUPS, active: 'page', onselect: () => {} });

		for (const g of GROUPS) {
			await expect.element(page.getByRole('tab', { name: new RegExp(g.label) })).toBeInTheDocument();
		}
	});

	it('a gated group stays clickable and carries its condition as the title', async () => {
		let picked = '';
		render(GroupRail, { groups: GROUPS, active: 'page', onselect: (id) => (picked = id) });

		const globe = page.getByRole('tab', { name: /GLOBE/ });
		// Dimmed, not disabled: a group you cannot click is one you cannot learn
		// the gate for.
		await expect.element(globe).toHaveAttribute('title', 'Needs a registered globe on the page.');
		await globe.click();
		expect(picked).toBe('globe');
	});

	it('gives the rail one tab stop — only the active group is reachable by Tab', async () => {
		render(GroupRail, { groups: GROUPS, active: 'render', onselect: () => {} });

		await expect.element(page.getByRole('tab', { name: /RENDER/ })).toHaveAttribute('tabindex', '0');
		await expect.element(page.getByRole('tab', { name: /PAGE/ })).toHaveAttribute('tabindex', '-1');
		await expect.element(page.getByRole('tab', { name: /GLOBE/ })).toHaveAttribute('tabindex', '-1');
	});

	it('ArrowDown and ArrowUp move the selection, wrapping at both ends', async () => {
		const picks: string[] = [];
		render(GroupRail, { groups: GROUPS, active: 'page', onselect: (id) => picks.push(id) });

		const rail = page.getByRole('tablist');
		await rail.element().dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
		expect(picks.at(-1)).toBe('render');

		// From the first entry, ArrowUp wraps to the last rather than dead-ending.
		await rail.element().dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }));
		expect(picks.at(-1)).toBe('capture');
	});

	it('Home and End jump to the ends', async () => {
		const picks: string[] = [];
		render(GroupRail, { groups: GROUPS, active: 'render', onselect: (id) => picks.push(id) });

		const rail = page.getByRole('tablist');
		await rail.element().dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true }));
		expect(picks.at(-1)).toBe('capture');
		await rail.element().dispatchEvent(new KeyboardEvent('keydown', { key: 'Home', bubbles: true }));
		expect(picks.at(-1)).toBe('page');
	});

	it('arrow keys skip nothing — a gated group is still a stop on the way past', async () => {
		const picks: string[] = [];
		// active = render, so ArrowDown lands on the gated globe.
		render(GroupRail, { groups: GROUPS, active: 'render', onselect: (id) => picks.push(id) });

		await page
			.getByRole('tablist')
			.element()
			.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
		expect(picks.at(-1)).toBe('globe');
	});

	it('shows a count badge only where a group has one', async () => {
		render(GroupRail, { groups: GROUPS, active: 'page', onselect: () => {} });

		await expect.element(page.getByRole('tab', { name: /CAPTURE/ })).toHaveTextContent('4');
		await expect.element(page.getByRole('tab', { name: /PAGE/ })).not.toHaveTextContent('4');
	});

	it('marks the tablist vertical so a screen reader announces the right axis', async () => {
		render(GroupRail, { groups: GROUPS, active: 'page', onselect: () => {} });
		await expect.element(page.getByRole('tablist')).toHaveAttribute('aria-orientation', 'vertical');
	});
});
