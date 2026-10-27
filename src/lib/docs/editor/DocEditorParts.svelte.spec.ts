import { page } from 'vitest/browser';
import { describe, it, expect, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import DocSegments from './DocSegments.svelte';
import SectionDock from './SectionDock.svelte';
import DocRail from './DocRail.svelte';
import DocCommitButton from './DocCommitButton.svelte';
import InsertMenu from './InsertMenu.svelte';

describe('DocSegments', () => {
	it('marks the current value pressed and reports a change', async () => {
		const onchange = vi.fn();
		render(DocSegments, {
			label: 'View',
			value: 'edit',
			options: [
				{ value: 'preview', label: 'Preview' },
				{ value: 'edit', label: 'Edit' }
			],
			onchange
		});
		await expect.element(page.getByRole('button', { name: 'Edit' })).toHaveAttribute('aria-pressed', 'true');
		await page.getByRole('button', { name: 'Preview' }).click();
		expect(onchange).toHaveBeenCalledWith('preview');
	});
});

describe('SectionDock', () => {
	it('badges a count and toggles by id', async () => {
		const ontoggle = vi.fn();
		render(SectionDock, {
			open: null,
			items: [{ id: 'checks', icon: 'zap', label: '2 checks', count: 2, lit: true }],
			ontoggle
		});
		await expect.element(page.getByText('2', { exact: true })).toBeInTheDocument();
		await page.getByRole('button', { name: '2 checks' }).click();
		expect(ontoggle).toHaveBeenCalledWith('checks');
	});
});

describe('DocRail', () => {
	it('shows the ref, the documents and the footer', async () => {
		render(DocRail, {
			ref: 'main',
			sha: 'a91f2c4',
			nodes: [{ name: 'Access control', path: 'docs/ac.md', depth: 0, is_dir: false }],
			onselect: () => {},
			footer: ['1 documents', 'org/repo']
		});
		await expect.element(page.getByText('main')).toBeInTheDocument();
		await expect.element(page.getByText('Access control')).toBeInTheDocument();
		await expect.element(page.getByText('org/repo')).toBeInTheDocument();
	});
});

describe('DocCommitButton', () => {
	it('is disabled with nothing pending', async () => {
		render(DocCommitButton, { count: 0, verb: 'Propose', onclick: () => {} });
		await expect.element(page.getByRole('button', { name: /Propose/ })).toBeDisabled();
	});
});

describe('InsertMenu', () => {
	it('filters and inserts with the keyboard', async () => {
		const oninsert = vi.fn();
		render(InsertMenu, {
			open: true,
			x: 0,
			y: 0,
			items: [
				{ id: 'h2', label: 'Heading', hint: 'A new section', icon: 'file-text', group: 'Content' },
				{ id: 'code', label: 'Code block', hint: 'Fenced code', icon: 'code', group: 'Content' }
			],
			oninsert,
			onclose: () => {}
		});
		await page.getByPlaceholder('Insert a block…').fill('code');
		await page.getByPlaceholder('Insert a block…').click();
		await expect.element(page.getByText('Heading')).not.toBeInTheDocument();
		await expect.element(page.getByText('Code block')).toBeInTheDocument();
	});
});
