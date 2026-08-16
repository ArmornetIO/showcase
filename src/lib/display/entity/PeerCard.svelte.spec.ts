import { page } from 'vitest/browser';
import { describe, it, expect } from 'vitest';
import { render } from 'vitest-browser-svelte';
import PeerCard from './PeerCard.svelte';

describe('PeerCard', () => {
	it('renders name, id, latency', async () => {
		render(PeerCard, { name: 'Alpha Node', id: 'node-001', latency: '12ms', color: '#5FEAD5' });
		await expect.element(page.getByText('Alpha Node')).toBeInTheDocument();
		await expect.element(page.getByText('node-001')).toBeInTheDocument();
		await expect.element(page.getByText('12ms')).toBeInTheDocument();
	});
});
