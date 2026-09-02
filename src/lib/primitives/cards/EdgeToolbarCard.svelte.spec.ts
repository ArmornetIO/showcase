import { page } from 'vitest/browser';
import { describe, it, expect } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { createRawSnippet } from 'svelte';
import EdgeToolbarCard from './EdgeToolbarCard.svelte';

const snippet = (text: string) =>
	createRawSnippet(() => ({ render: () => `<span>${text}</span>` }));

describe('EdgeToolbarCard', () => {
	it('renders content only when no toolbar is given', async () => {
		render(EdgeToolbarCard, { children: snippet('body') });
		await expect.element(page.getByText('body')).toBeInTheDocument();
	});

	it('renders the docked toolbar alongside the content', async () => {
		render(EdgeToolbarCard, { edge: 'right', children: snippet('body'), toolbar: snippet('rail') });
		await expect.element(page.getByText('body')).toBeInTheDocument();
		await expect.element(page.getByText('rail')).toBeInTheDocument();
	});
});
