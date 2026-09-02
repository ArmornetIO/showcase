import { page } from 'vitest/browser';
import { describe, it, expect } from 'vitest';
import { render } from 'vitest-browser-svelte';
import PostureVerdict from './PostureVerdict.svelte';

describe('PostureVerdict', () => {
	it('renders the statement with prefix and suffix', async () => {
		render(PostureVerdict, {
			value: 82,
			animateValue: false,
			prefix: 'You have assurance on',
			suffix: 'of your critical third-party risk'
		});
		await expect.element(page.locator('.statement')).toBeInTheDocument();
		await expect.element(page.getByText('You have assurance on')).toBeInTheDocument();
	});

	it('derives the verdict chip from the value (Gaps at 82)', async () => {
		render(PostureVerdict, { value: 82, animateValue: false });
		await expect.element(page.locator('.chip--gaps')).toHaveText('Gaps');
	});

	it('derives Strong at ≥90 and Exposed below 70', async () => {
		render(PostureVerdict, { value: 94, animateValue: false });
		await expect.element(page.locator('.chip--strong')).toHaveText('Strong');
	});

	it('renders sub-clauses with tone classes', async () => {
		render(PostureVerdict, {
			value: 82,
			animateValue: false,
			clauses: [{ text: '4 critical vendors unassessed', tone: 'bad' }]
		});
		await expect.element(page.locator('.clause--bad')).toBeInTheDocument();
	});

	it('renders the first-run empty mode with no chip', async () => {
		render(PostureVerdict, { empty: true, emptySub: 'Add your vendors.' });
		await expect.element(page.locator('.empty-title')).toBeInTheDocument();
		await expect.element(page.locator('.chip--gaps')).not.toBeInTheDocument();
	});
});
