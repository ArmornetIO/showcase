import { page } from 'vitest/browser';
import { describe, it, expect } from 'vitest';
import { render } from 'vitest-browser-svelte';
import ArticleCard from './ArticleCard.svelte';

const BASE = {
	index: 1, category: 'SECURITY', readTime: '4 min',
	title: 'Zero Trust', excerpt: 'An overview.', author: { initials: 'JD', name: 'Jane Doe' }
};

describe('ArticleCard', () => {
	it('renders title, category, excerpt', async () => {
		render(ArticleCard, BASE);
		await expect.element(page.getByText('Zero Trust')).toBeInTheDocument();
		await expect.element(page.getByText('SECURITY')).toBeInTheDocument();
	});

	it('renders as <a> when href provided', async () => {
		render(ArticleCard, { ...BASE, href: '/articles/1' });
		await expect.element(page.locator('a[href="/articles/1"]')).toBeInTheDocument();
	});

	it('renders as <div> without href', async () => {
		render(ArticleCard, BASE);
		await expect.element(page.locator('div.ac-root, [class*="ac-root"]')).toBeInTheDocument();
	});

	it('author name and initials render', async () => {
		render(ArticleCard, BASE);
		await expect.element(page.getByText('Jane Doe')).toBeInTheDocument();
		await expect.element(page.getByText('JD')).toBeInTheDocument();
	});
});
