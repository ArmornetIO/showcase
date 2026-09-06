// CI ONLY — a `*.svelte.spec.ts`, so it runs under the `browser` vitest project
// (Playwright Chromium). Do not run that project on a dev machine; see
// devcog/CLAUDE.md.
//
// This covers the one behaviour the redesign turned around, and the reason the
// inspector moved out of the panel and onto the cluster: **closing the console
// must not disarm the inspector.** The old drawer called `stopInspect()` on
// close, so the element you were about to click — usually underneath where the
// panel sits — went unarmed the moment you got the panel out of the way.
//
// The controller half of the Escape ladder is covered in `qa/nits-controller.spec.ts`
// (node). What can only be checked here is that DevCog wires the two together in
// the right order.
import { page } from 'vitest/browser';
import { describe, it, expect, beforeEach } from 'vitest';
import { render } from 'vitest-browser-svelte';
import DevCog from './DevCog.svelte';

/** DevCog contributes CAPTURE and PERF itself, so no host groups are needed. */
const NO_GROUPS = { groups: [] };

async function press(key: string) {
	window.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
	await new Promise((r) => setTimeout(r, 40));
}

describe('DevCog', () => {
	beforeEach(() => localStorage.clear());

	it('shows the cluster with the inspector and the console as separate buttons', async () => {
		render(DevCog, NO_GROUPS);

		await expect.element(page.getByLabelText('Inspect element')).toBeInTheDocument();
		await expect.element(page.getByLabelText('Open dev console')).toBeInTheDocument();
	});

	it('arms the inspector without opening the console', async () => {
		const { container } = render(DevCog, NO_GROUPS);

		await page.getByLabelText('Inspect element').click();

		await expect.element(page.getByLabelText('Stop inspecting')).toHaveAttribute('aria-pressed', 'true');
		// One action to arm — and the panel stays out of the way.
		expect(container.querySelector('.devcog-console')).toBeNull();
	});

	it('KEEPS the inspector armed when the console is closed', async () => {
		const { container } = render(DevCog, NO_GROUPS);

		await page.getByLabelText('Inspect element').click();
		await page.getByLabelText('Open dev console').click();
		expect(container.querySelector('.devcog-console')).not.toBeNull();

		await page.getByLabelText('Close console').click();

		expect(container.querySelector('.devcog-console')).toBeNull();
		// The whole point of the cluster. If this ever flips back, clicks get
		// eaten with nothing on screen explaining why.
		await expect.element(page.getByLabelText('Stop inspecting')).toHaveAttribute('aria-pressed', 'true');
	});

	it('unwinds Escape inspector-first, console-second', async () => {
		const { container } = render(DevCog, NO_GROUPS);

		await page.getByLabelText('Inspect element').click();
		await page.getByLabelText('Open dev console').click();

		// First Escape takes the inspector and leaves the panel up — the reverse
		// would leave the page armed with nothing on screen saying so.
		await press('Escape');
		expect(container.querySelector('.devcog-console')).not.toBeNull();
		await expect.element(page.getByLabelText('Inspect element')).toHaveAttribute('aria-pressed', 'false');

		// Second Escape closes the console.
		await press('Escape');
		expect(container.querySelector('.devcog-console')).toBeNull();
	});

	it('persists the selected group so the next mount restores it', async () => {
		render(DevCog, NO_GROUPS);
		await page.getByLabelText('Open dev console').click();
		await page.getByRole('tab', { name: /PERF/ }).click();

		await expect.element(page.getByRole('tab', { name: /PERF/ })).toHaveAttribute('aria-selected', 'true');
		// The restore half is `ConsoleState`, covered in `console/console-state.spec.ts`
		// where it needs no browser. What this asserts is that DevCog hands the
		// click to it at all.
		expect(localStorage.getItem('devcog_console')).toBe('perf');
	});

	it('writes only its own storage keys', async () => {
		render(DevCog, NO_GROUPS);
		await page.getByLabelText('Open dev console').click();
		await page.getByRole('tab', { name: /CAPTURE/ }).click();

		// FR-024: nothing belonging to the product being inspected.
		for (const key of Object.keys(localStorage)) {
			expect(key.startsWith('devcog_')).toBe(true);
		}
	});
});
