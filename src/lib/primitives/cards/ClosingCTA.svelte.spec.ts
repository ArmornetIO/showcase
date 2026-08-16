import { describe, it, expect } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { page } from '@vitest/browser/context';
import ClosingCTA from './ClosingCTA.svelte';

describe('ClosingCTA', () => {
	it('renders headline', async () => {
		render(ClosingCTA, { headline: 'Ready to ship compliance?' });
		await expect.element(page.getByRole('heading', { name: 'Ready to ship compliance?' })).toBeInTheDocument();
	});

	it('renders kicker', async () => {
		render(ClosingCTA, { headline: 'Test', kicker: 'GET STARTED' });
		await expect.element(page.getByText('GET STARTED')).toBeInTheDocument();
	});

	it('renders lede', async () => {
		render(ClosingCTA, { headline: 'Test', lede: 'Book a 30-minute intro call.' });
		await expect.element(page.getByText('Book a 30-minute intro call.')).toBeInTheDocument();
	});

	it('renders primary CTA link', async () => {
		render(ClosingCTA, { headline: 'Test', primaryLabel: 'Book a demo', primaryHref: '/demo' });
		const link = page.getByRole('link', { name: /book a demo/i });
		await expect.element(link).toBeInTheDocument();
		await expect.element(link).toHaveAttribute('href', '/demo');
	});

	it('renders secondary CTA link', async () => {
		render(ClosingCTA, {
			headline: 'Test',
			secondaryLabel: 'View pricing',
			secondaryHref: '/pricing'
		});
		await expect.element(page.getByRole('link', { name: /view pricing/i })).toBeInTheDocument();
	});

	it('renders without overlay when overlay=false', async () => {
		const { container } = render(ClosingCTA, { headline: 'Test', overlay: false });
		expect(container.querySelector('.cc-grid')).toBeNull();
	});
});
