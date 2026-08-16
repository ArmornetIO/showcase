import { page } from 'vitest/browser';
import { describe, it, expect } from 'vitest';
import { render } from 'vitest-browser-svelte';
import SidebarNav from './SidebarNav.svelte';
import type { NavSection } from './SidebarNav.svelte';

const sections: NavSection[] = [
	{
		title: 'Main',
		items: [
			{ label: 'Primitives', href: '/primitives', icon: 'layout-grid' },
			{ label: 'Layout', href: '/layout', icon: 'layout-dashboard' }
		]
	},
	{
		title: 'Utilities',
		items: [{ label: 'Docs', href: '/docs', icon: 'file-text' }]
	}
];

describe('SidebarNav', () => {
	it('renders section titles', async () => {
		render(SidebarNav, { sections, isActive: () => false });
		await expect.element(page.getByText('Main')).toBeInTheDocument();
		await expect.element(page.getByText('Utilities')).toBeInTheDocument();
	});

	it('renders nav item labels', async () => {
		render(SidebarNav, { sections, isActive: () => false });
		await expect.element(page.getByText('Primitives')).toBeInTheDocument();
		await expect.element(page.getByText('Layout')).toBeInTheDocument();
		await expect.element(page.getByText('Docs')).toBeInTheDocument();
	});

	it('renders nav item hrefs', async () => {
		render(SidebarNav, { sections, isActive: () => false });
		// Wait on a link before reading them all — elements() is a synchronous
		// snapshot and would see an empty list if the render has not landed yet.
		await expect.element(page.getByRole('link').first()).toBeInTheDocument();
		const hrefs = page
			.getByRole('link')
			.elements()
			.map((l) => l.getAttribute('href'));
		expect(hrefs).toContain('/primitives');
		expect(hrefs).toContain('/layout');
		expect(hrefs).toContain('/docs');
	});

	it('marks active item with aria-current=page', async () => {
		render(SidebarNav, { sections, isActive: (href: string) => href === '/layout' });
		await expect
			.element(page.locator('a[aria-current="page"]'))
			.toHaveAttribute('href', '/layout');
	});

	it('collapses sibling subtrees when a row is expanded', async () => {
		const nested: NavSection[] = [
			{
				items: [
					{ label: 'Alpha', children: [{ label: 'Alpha One', href: '/a/1', icon: 'home' }] },
					{ label: 'Beta', children: [{ label: 'Beta One', href: '/b/1', icon: 'home' }] }
				]
			}
		];
		render(SidebarNav, { sections: nested, isActive: () => false });

		await page.getByRole('button', { name: 'Alpha' }).click();
		await expect.element(page.getByText('Alpha One')).toBeInTheDocument();

		// Opening Beta must close Alpha — one open subtree per level.
		await page.getByRole('button', { name: 'Beta' }).click();
		await expect.element(page.getByText('Beta One')).toBeInTheDocument();
		await expect.element(page.getByText('Alpha One')).not.toBeInTheDocument();
	});

	it('collapses top-level siblings across sections', async () => {
		// The real nav gives each top-level parent its own section, so top-level
		// rows must accordion against each other regardless of section.
		const nested: NavSection[] = [
			{
				items: [{ label: 'Alpha', children: [{ label: 'Alpha One', href: '/a/1', icon: 'home' }] }]
			},
			{
				items: [{ label: 'Beta', children: [{ label: 'Beta One', href: '/b/1', icon: 'home' }] }]
			}
		];
		render(SidebarNav, { sections: nested, isActive: () => false });

		await page.getByRole('button', { name: 'Alpha' }).click();
		await expect.element(page.getByText('Alpha One')).toBeInTheDocument();

		await page.getByRole('button', { name: 'Beta' }).click();
		await expect.element(page.getByText('Beta One')).toBeInTheDocument();
		await expect.element(page.getByText('Alpha One')).not.toBeInTheDocument();
	});

	it('keeps a parent open when its href is repeated by a child', async () => {
		// Mesh's parent row and its "All Agents" child share one href — keying
		// expand state by href made opening a child collapse its own parent.
		const nested: NavSection[] = [
			{
				items: [
					{
						label: 'Mesh',
						href: '/mesh',
						children: [
							{ label: 'All Agents', href: '/mesh', icon: 'home' },
							{
								label: 'Group One',
								href: '/mesh?mode=a',
								icon: 'home',
								children: [{ label: 'Mode A', href: '/mesh?mode=a', icon: 'home' }]
							}
						]
					}
				]
			}
		];
		render(SidebarNav, { sections: nested, isActive: () => false });

		await page.getByRole('button', { name: 'Expand' }).click();
		await expect.element(page.getByText('Group One')).toBeInTheDocument();

		// Opening the nested group must not close the Mesh subtree around it.
		await page.getByRole('link', { name: 'Group One' }).click();
		await expect.element(page.getByText('Mode A')).toBeInTheDocument();
		await expect.element(page.getByText('Group One')).toBeInTheDocument();
	});

	it('renders without section titles when omitted', async () => {
		const noTitleSections: NavSection[] = [{ items: [{ label: 'Home', href: '/', icon: 'home' }] }];
		render(SidebarNav, { sections: noTitleSections, isActive: () => false });
		await expect.element(page.getByText('Home')).toBeInTheDocument();
	});
});
