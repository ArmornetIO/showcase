import { describe, it, expect } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { page } from '@vitest/browser/context';
import PricingCard from './PricingCard.svelte';

describe('PricingCard', () => {
	it('renders tier name', async () => {
		render(PricingCard, { tier: 'Professional' });
		await expect.element(page.getByText('Professional')).toBeInTheDocument();
	});

	it('renders tagline', async () => {
		render(PricingCard, { tier: 'Pro', tagline: 'For growing teams' });
		await expect.element(page.getByText('For growing teams')).toBeInTheDocument();
	});

	it('renders price with unit', async () => {
		render(PricingCard, { tier: 'Pro', price: '$299', priceUnit: '/mo' });
		await expect.element(page.getByText('$299')).toBeInTheDocument();
		await expect.element(page.getByText('/mo')).toBeInTheDocument();
	});

	it('renders feature items with checkmarks', async () => {
		render(PricingCard, {
			tier: 'Pro',
			items: ['SOC 2 Readiness', 'Unlimited scans']
		});
		await expect.element(page.getByText('SOC 2 Readiness')).toBeInTheDocument();
		await expect.element(page.getByText('Unlimited scans')).toBeInTheDocument();
	});

	it('renders CTA as link when ctaHref provided', async () => {
		render(PricingCard, { tier: 'Pro', ctaLabel: 'Get started', ctaHref: '/signup' });
		const link = page.getByRole('link', { name: /get started/i });
		await expect.element(link).toBeInTheDocument();
		await expect.element(link).toHaveAttribute('href', '/signup');
	});

	it('renders CTA as button when no ctaHref', async () => {
		render(PricingCard, { tier: 'Pro', ctaLabel: 'Contact sales' });
		await expect.element(page.getByRole('button', { name: /contact sales/i })).toBeInTheDocument();
	});

	it('renders pending state', async () => {
		render(PricingCard, { tier: 'Enterprise', pending: true });
		await expect.element(page.getByText('Coming soon')).toBeInTheDocument();
	});

	it('renders badge', async () => {
		render(PricingCard, { tier: 'Pro', badge: 'MOST POPULAR' });
		await expect.element(page.getByText('MOST POPULAR')).toBeInTheDocument();
	});

	it('applies featured class', async () => {
		render(PricingCard, { tier: 'Pro', featured: true });
		const root = page.getByRole('generic').first();
		await expect.element(root).toHaveClass('pc-featured');
	});
});
