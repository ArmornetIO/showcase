import { page } from 'vitest/browser';
import { describe, it, expect } from 'vitest';
import { render } from 'vitest-browser-svelte';
import BreakpointProbe from './__test__/BreakpointProbe.svelte';

describe('useBreakpoint', () => {
	it('returns false at desktop viewport width', async () => {
		render(BreakpointProbe, { key: 'sm' });
		await expect.element(page.getByTestId('matches')).toHaveTextContent('false');
	});
});
