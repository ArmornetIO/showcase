import { page } from 'vitest/browser';
import { describe, it, expect } from 'vitest';
import { render } from 'vitest-browser-svelte';
import LogRow from './LogRow.svelte';

describe('LogRow', () => {
	it('renders timestamp, level, and message', async () => {
		render(LogRow, { ts: '12:01:33', level: 'info', message: 'Agent started' });
		await expect.element(page.getByText('12:01:33')).toBeInTheDocument();
		await expect.element(page.getByText('INFO')).toBeInTheDocument();
		await expect.element(page.getByText('Agent started')).toBeInTheDocument();
	});

	it('all log levels render without throwing', async () => {
		for (const level of ['info', 'warn', 'err', 'ok'] as const) {
			expect(() => render(LogRow, { ts: '00:00', level, message: 'msg' })).not.toThrow();
		}
	});

	it('message truncates with text-overflow on long content', async () => {
		const msg = 'A'.repeat(200);
		render(LogRow, { ts: '12:00', level: 'info', message: msg });
		const msgEl = page.locator('.log-msg, [class*="msg"]').first().element() as HTMLElement;
		expect(getComputedStyle(msgEl).overflow).toMatch(/hidden/);
	});
});
