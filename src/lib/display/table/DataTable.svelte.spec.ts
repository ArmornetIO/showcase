import { page } from 'vitest/browser';
import { describe, it, expect } from 'vitest';
import { render } from 'vitest-browser-svelte';
import DataTable from './DataTable.svelte';

const COLUMNS = [{ key: 'name', header: 'Name' }, { key: 'status', header: 'Status' }];
const ROWS = [{ name: 'Alpha', status: 'online' }, { name: 'Beta', status: 'offline' }];

describe('DataTable — table variant', () => {
	it('renders thead and rows', async () => {
		render(DataTable, { variant: 'table', columns: COLUMNS, rows: ROWS });
		await expect.element(page.getByText('Name')).toBeInTheDocument();
		await expect.element(page.getByText('Alpha')).toBeInTheDocument();
		await expect.element(page.getByText('Beta')).toBeInTheDocument();
	});

	it('renders empty state when rows=[]', async () => {
		render(DataTable, { variant: 'table', columns: COLUMNS, rows: [], empty: 'Nothing here.' });
		await expect.element(page.getByText('Nothing here.')).toBeInTheDocument();
	});

	it('row click fires onRowClick', async () => {
		let received: Record<string, unknown> | null = null;
		render(DataTable, { variant: 'table', columns: COLUMNS, rows: ROWS, onRowClick: (r) => (received = r) });
		await page.getByText('Alpha').click();
		expect(received).toEqual({ name: 'Alpha', status: 'online' });
	});
});

describe('DataTable — kv variant', () => {
	it('renders key-value pairs', async () => {
		render(DataTable, { variant: 'kv', kvRows: [['Region', 'us-east-1'], ['Status', 'healthy']] });
		await expect.element(page.getByText('Region')).toBeInTheDocument();
		await expect.element(page.getByText('us-east-1')).toBeInTheDocument();
	});

	it('kvTitle renders when provided', async () => {
		render(DataTable, { variant: 'kv', kvTitle: 'Node Config', kvRows: [['k', 'v']] });
		await expect.element(page.getByText('Node Config')).toBeInTheDocument();
	});
});

describe('DataTable — compare variant', () => {
	it('compare wrapper has overflow-x: auto', async () => {
		render(DataTable, {
			variant: 'compare',
			compareColumns: [{ key: 'f', header: 'Feature' }, { key: 'a', header: 'Plan A' }],
			compareRows: [{ type: 'feature', feature: 'SSO', values: { a: { type: 'check', on: true } } }]
		});
		const wrap = page.locator('.ct-wrap').first();
		const overflow = getComputedStyle(wrap.element() as Element).overflowX;
		expect(overflow).toBe('auto');
	});
});
