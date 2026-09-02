import { describe, it, expect } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { page } from '@vitest/browser/context';
import HudCard from './HudCard.svelte';

describe('HudCard', () => {
	it('renders title', async () => {
		render(HudCard, { title: 'Threat Detection' });
		await expect.element(page.getByText('Threat Detection')).toBeInTheDocument();
	});

	it('renders eyebrow with slash prefix', async () => {
		render(HudCard, { title: 'Test', eyebrow: 'DETECT' });
		await expect.element(page.getByText('/ DETECT')).toBeInTheDocument();
	});

	it('renders body text', async () => {
		render(HudCard, { title: 'Test', body: 'Supporting description text' });
		await expect.element(page.getByText('Supporting description text')).toBeInTheDocument();
	});

	it('renders outline numeral', async () => {
		render(HudCard, { title: 'Test', num: '01' });
		await expect.element(page.getByText('01')).toBeInTheDocument();
	});

	it('renders window label', async () => {
		render(HudCard, { title: 'Test', windowLabel: 'agent.core' });
		await expect.element(page.getByText('agent.core')).toBeInTheDocument();
	});

	it('renders CTA link when ctaHref provided', async () => {
		render(HudCard, { title: 'Test', ctaLabel: 'Learn more', ctaHref: '/docs' });
		const link = page.getByRole('link', { name: /learn more/i });
		await expect.element(link).toBeInTheDocument();
		await expect.element(link).toHaveAttribute('href', '/docs');
	});

	it('renders CTA as span when no ctaHref', async () => {
		render(HudCard, { title: 'Test', ctaLabel: 'Read more' });
		await expect.element(page.getByText('Read more →')).toBeInTheDocument();
	});

	it('applies featured class', async () => {
		render(HudCard, { title: 'Test', featured: true });
		const root = page.getByRole('generic').first();
		await expect.element(root).toHaveClass('hc-featured');
	});

	it('accepts all four variants without error', async () => {
		for (const variant of ['accent', 'cyan', 'emerald', 'blue'] as const) {
			render(HudCard, { title: variant, variant });
			await expect.element(page.getByText(variant)).toBeInTheDocument();
		}
	});
});
