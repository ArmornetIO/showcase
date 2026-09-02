import { render } from 'vitest-browser-svelte';
import { expect, test } from 'vitest';
import Timeline from './Timeline.svelte';
import type { TimelineEvent } from './Timeline.svelte';

const events: TimelineEvent[] = [
	{ id: 'a', when: '4s', title: 'agent', subject: 'prod-14', trail: 'enrolled', desc: 'local', tone: 'ok' },
	{ id: 'b', when: '1m', title: 'blocked', subject: 'left-pad', desc: 'typosquat · npm', tone: 'bad' }
];

test('rail variant renders every event', async () => {
	const screen = render(Timeline, { events });
	await expect.element(screen.getByText('prod-14')).toBeInTheDocument();
	await expect.element(screen.getByText('left-pad')).toBeInTheDocument();
	await expect.element(screen.getByText('typosquat · npm')).toBeInTheDocument();
});

test('feed variant renders rows as a list, with the age and the subject', async () => {
	const screen = render(Timeline, { events, variant: 'feed' });
	await expect.element(screen.getByRole('listitem').first()).toBeInTheDocument();
	await expect.element(screen.getByText('prod-14')).toBeInTheDocument();
	await expect.element(screen.getByText('4s')).toBeInTheDocument();
});

test('an event without a subject still renders its title', async () => {
	const screen = render(Timeline, {
		events: [{ id: 'c', when: '2m', title: 'First scan completed' }],
		variant: 'feed'
	});
	await expect.element(screen.getByText('First scan completed')).toBeInTheDocument();
});
