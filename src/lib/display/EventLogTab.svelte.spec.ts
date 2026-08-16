import { page } from 'vitest/browser';
import { describe, it, expect } from 'vitest';
import { render } from 'vitest-browser-svelte';
import EventLogTab from './EventLogTab.svelte';

describe('EventLogTab', () => {
	it('renders the empty state with no events', async () => {
		render(EventLogTab, { events: [] });
		await expect.element(page.getByText('No activity recorded yet.')).toBeInTheDocument();
	});

	it('renders each event message', async () => {
		render(EventLogTab, {
			events: [
				{ tone: 'up', msg: 'Agent connected', ts: '2s ago' },
				{ tone: 'denied', msg: 'Blocked go package: rsc.io/quote', ts: '4m ago' }
			]
		});
		await expect.element(page.getByText('Agent connected')).toBeInTheDocument();
		await expect.element(page.getByText('Blocked go package: rsc.io/quote')).toBeInTheDocument();
	});

	it('takes a host-supplied title and empty text', async () => {
		render(EventLogTab, { events: [], title: 'Audit trail', emptyText: 'Nothing yet.' });
		await expect.element(page.getByText('Audit trail')).toBeInTheDocument();
		await expect.element(page.getByText('Nothing yet.')).toBeInTheDocument();
	});

	it('falls back to the neutral tone when the host supplies none', async () => {
		// An unrecognised event must still draw a row rather than blanking out.
		render(EventLogTab, { events: [{ msg: 'Something happened', ts: 'now' }] });
		await expect.element(page.getByText('Something happened')).toBeInTheDocument();
	});
});
