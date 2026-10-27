import { describe, it, expect, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import WorkspacePicker from './WorkspacePicker.svelte';

// The route behind this carries no CSS and no markup of its own, so the
// contract worth locking is the one it leans on: the expected workspace is
// lifted out, a press reports which one, and nothing is pressable mid-switch.

const workspaces = [
	{ id: 'a', name: 'Acme Security', description: 'MDR for fintech.', role: 'admin' },
	{ id: 'b', name: 'Northwind Health', website: 'northwindhealth.org', role: 'member' },
	{ id: 'c', name: 'toner-lab' }
];

describe('WorkspacePicker', () => {
	it('lifts the last-used workspace out of the stack', async () => {
		const { container } = render(WorkspacePicker, { workspaces, lastId: 'a' });
		expect(container.querySelector('.row.featured .name')?.textContent).toBe('Acme Security');
		expect(container.querySelectorAll('.stack .row')).toHaveLength(2);
	});

	it('shows what each org says about itself, and says when it has said nothing', async () => {
		const { container } = render(WorkspacePicker, { workspaces });
		const rows = container.querySelectorAll('.row');
		expect(rows[0].querySelector('.desc')?.textContent).toBe('MDR for fintech.');
		expect(rows[1].querySelector('.site')?.textContent).toBe('northwindhealth.org');
		expect(rows[2].querySelector('.desc.empty')).not.toBeNull();
	});

	it('marks a row with its status and leaves the rest unmarked', async () => {
		const { container } = render(WorkspacePicker, {
			workspaces: [
				{ id: 'a', name: 'Acme', status: { label: 'No alpha access', tone: 'warn' as const } },
				{ id: 'b', name: 'Northwind' }
			]
		});
		const marked = container.querySelectorAll('.status');
		expect(marked).toHaveLength(1);
		expect(marked[0].textContent).toBe('No alpha access');
		expect(marked[0].classList.contains('warn')).toBe(true);
	});

	it('reports the pressed workspace', async () => {
		const onpick = vi.fn();
		const { container } = render(WorkspacePicker, { workspaces, onpick });
		(container.querySelectorAll('.row')[2] as HTMLButtonElement).click();
		expect(onpick).toHaveBeenCalledWith('c');
	});

	it('disables every row while one is being entered', async () => {
		const { container } = render(WorkspacePicker, { workspaces, busyId: 'b' });
		const rows = [...container.querySelectorAll<HTMLButtonElement>('.row')];
		expect(rows.every((r) => r.disabled)).toBe(true);
	});
});
