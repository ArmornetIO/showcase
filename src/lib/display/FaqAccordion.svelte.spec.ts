import { describe, it, expect } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { page } from '@vitest/browser/context';
import FaqAccordion from './FaqAccordion.svelte';

const ITEMS = [
	{ q: 'What is SOC 2?', a: 'SOC 2 is a security framework.' },
	{ q: 'How long does it take?', a: 'Typically 3-6 months.' }
];

describe('FaqAccordion', () => {
	it('renders all questions', async () => {
		render(FaqAccordion, { items: ITEMS });
		await expect.element(page.getByText('What is SOC 2?')).toBeInTheDocument();
		await expect.element(page.getByText('How long does it take?')).toBeInTheDocument();
	});

	it('answers are initially hidden', async () => {
		const { container } = render(FaqAccordion, { items: ITEMS });
		const bodyWraps = container.querySelectorAll('.faq-body-wrap');
		for (const wrap of bodyWraps) {
			expect((wrap as HTMLElement).style.gridTemplateRows).toBe('0fr');
		}
	});

	it('opens answer on click', async () => {
		render(FaqAccordion, { items: ITEMS });
		const btn = page.getByRole('button', { name: /what is soc 2/i });
		await btn.click();
		await expect.element(page.getByText('SOC 2 is a security framework.')).toBeVisible();
	});

	it('collapses open item when clicked again', async () => {
		const { container } = render(FaqAccordion, { items: ITEMS });
		const btn = page.getByRole('button', { name: /what is soc 2/i });
		await btn.click();
		await btn.click();
		const firstWrap = container.querySelectorAll('.faq-body-wrap')[0] as HTMLElement;
		expect(firstWrap.style.gridTemplateRows).toBe('0fr');
	});

	it('closes previously open item when another is clicked', async () => {
		render(FaqAccordion, { items: ITEMS });
		const btn1 = page.getByRole('button', { name: /what is soc 2/i });
		const btn2 = page.getByRole('button', { name: /how long does it take/i });
		await btn1.click();
		await btn2.click();
		await expect.element(page.getByText('Typically 3-6 months.')).toBeVisible();
	});
});
