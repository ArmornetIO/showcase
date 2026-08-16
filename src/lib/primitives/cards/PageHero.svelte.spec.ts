import { describe, it, expect } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { page } from '@vitest/browser/context';
import PageHero from './PageHero.svelte';

describe('PageHero', () => {
	it('renders headline', async () => {
		render(PageHero, { headline: 'Defend Your Stack' });
		await expect.element(page.getByRole('heading', { name: 'Defend Your Stack' })).toBeInTheDocument();
	});

	it('renders kicker', async () => {
		render(PageHero, { headline: 'Test', kicker: 'PLATFORM' });
		await expect.element(page.getByText('PLATFORM')).toBeInTheDocument();
	});

	it('renders lede text', async () => {
		render(PageHero, { headline: 'Test', lede: 'Automate your compliance program.' });
		await expect.element(page.getByText('Automate your compliance program.')).toBeInTheDocument();
	});

	it('renders without overlay when overlay=false', async () => {
		const { container } = render(PageHero, { headline: 'Test', overlay: false });
		expect(container.querySelector('.ph-grid-overlay')).toBeNull();
	});

	it('renders overlay by default', async () => {
		const { container } = render(PageHero, { headline: 'Test' });
		expect(container.querySelector('.ph-grid-overlay')).not.toBeNull();
	});
});
