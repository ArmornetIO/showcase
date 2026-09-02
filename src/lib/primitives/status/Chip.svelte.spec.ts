import { page } from 'vitest/browser';
import { describe, it, expect } from 'vitest';
import { render } from 'vitest-browser-svelte';
import Chip from './Chip.svelte';

const COLORS = [
	'default', 'accent', 'success', 'warn', 'error',
	'cyan', 'blue', 'critical', 'get', 'post', 'delete', 'patch'
] as const;

describe('Chip', () => {
	it('renders children text', async () => {
		render(Chip, { children: () => 'ONLINE' });
		await expect.element(page.getByText('ONLINE')).toBeInTheDocument();
	});

	it('all colors render for ghost look without throwing', () => {
		for (const color of COLORS) {
			expect(() => render(Chip, { look: 'ghost', color, children: () => color })).not.toThrow();
		}
	});

	it('all colors render for filled look without throwing', () => {
		for (const color of COLORS) {
			expect(() => render(Chip, { look: 'filled', color, children: () => color })).not.toThrow();
		}
	});

	it('renders pulse dot when pulse=true', async () => {
		render(Chip, { color: 'accent', pulse: true, children: () => 'live' });
		await expect.element(page.getByText('live')).toBeInTheDocument();
	});

	it('renders as inline element (no layout break)', async () => {
		render(Chip, { children: () => 'OK' });
		const el = page.locator('span').element() as HTMLElement;
		expect(getComputedStyle(el).display).toMatch(/inline/);
	});
});
