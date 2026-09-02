import { page } from 'vitest/browser';
import { describe, it, expect } from 'vitest';
import { render } from 'vitest-browser-svelte';
import ProfileCard from './ProfileCard.svelte';

describe('ProfileCard', () => {
	it('renders initials, name, role', async () => {
		render(ProfileCard, { initials: 'JD', name: 'Jane Doe', role: 'Engineer' });
		await expect.element(page.getByText('JD')).toBeInTheDocument();
		await expect.element(page.getByText('Jane Doe')).toBeInTheDocument();
		await expect.element(page.getByText('Engineer')).toBeInTheDocument();
	});

	it('bio renders when provided', async () => {
		render(ProfileCard, { initials: 'JD', name: 'Jane', role: 'Eng', bio: 'Security lead.' });
		await expect.element(page.getByText('Security lead.')).toBeInTheDocument();
	});

	it('tags render when provided', async () => {
		render(ProfileCard, { initials: 'JD', name: 'Jane', role: 'Eng', tags: ['red team', 'cloud'] });
		await expect.element(page.getByText('red team')).toBeInTheDocument();
		await expect.element(page.getByText('cloud')).toBeInTheDocument();
	});

	it('four corner bracket spans are in DOM', async () => {
		render(ProfileCard, { initials: 'JD', name: 'Jane', role: 'Eng' });
		const corners = page.locator('.pc-corner, [class*="corner"]');
		expect(await corners.count()).toBeGreaterThanOrEqual(4);
	});
});
