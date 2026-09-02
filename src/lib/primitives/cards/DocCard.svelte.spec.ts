import { page } from 'vitest/browser';
import { describe, it, expect } from 'vitest';
import { render } from 'vitest-browser-svelte';
import DocCard from './DocCard.svelte';

describe('DocCard', () => {
	it('renders tag, title, meta', async () => {
		render(DocCard, { tag: 'ENG-01', title: 'Auth Spec', meta: 'DRAFT' });
		await expect.element(page.getByText('ENG-01')).toBeInTheDocument();
		await expect.element(page.getByText('Auth Spec')).toBeInTheDocument();
		await expect.element(page.getByText('DRAFT')).toBeInTheDocument();
	});

	it('onclick handler fires', async () => {
		let fired = false;
		render(DocCard, { tag: 'T', title: 'Doc', onclick: () => (fired = true) });
		await page.locator('.doc-card, [class*="doc"]').first().click();
		expect(fired).toBe(true);
	});

	it('all variants render without throwing', async () => {
		for (const variant of ['accent', 'cyan', 'emerald', 'blue'] as const) {
			expect(() => render(DocCard, { tag: 'T', title: 'D', variant })).not.toThrow();
		}
	});

	it('minimum height is at least 140px on mobile', async () => {
		render(DocCard, { tag: 'T', title: 'D' });
		const box = await page.locator('.doc-card, [class*="doc"]').first().boundingBox();
		expect(box!.height).toBeGreaterThanOrEqual(140);
	});

	it('rich mode renders as an anchor with id, version, tags, +N overflow and status', async () => {
		render(DocCard, {
			tag: 'ENG',
			docId: 'ENG-021',
			title: 'DB State Manager',
			href: '/docs/eng-021',
			version: '2',
			classification: 'INTERNAL',
			tags: ['db', 'schema', 'migrations', 'postgres', 'dbmgr'],
			maxTags: 4,
			authors: [{ handle: 'ir', name: 'Tony', commits: 12 }],
			status: 'implemented',
			updated: '2026-07-16',
			variant: 'accent'
		});
		await expect.element(page.getByText('ENG-021')).toBeInTheDocument();
		await expect.element(page.getByText('DB State Manager')).toBeInTheDocument();
		await expect.element(page.getByText('v2')).toBeInTheDocument();
		await expect.element(page.getByText('INTERNAL')).toBeInTheDocument();
		await expect.element(page.getByText('+1')).toBeInTheDocument();
		await expect.element(page.getByText('IMPLEMENTED · 2026-07-16')).toBeInTheDocument();
		expect(await page.locator('a.rich-card').count()).toBe(1);
	});

	it('rich mode falls back to author text when no author avatars', async () => {
		render(DocCard, {
			tag: 'POL',
			title: 'AUP',
			href: '/docs/aup',
			authorText: 'security-team',
			status: 'draft'
		});
		await expect.element(page.getByText('security-team')).toBeInTheDocument();
	});
});
