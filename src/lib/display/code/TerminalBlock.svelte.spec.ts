import { describe, it, expect } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { page } from '@vitest/browser/context';
import TerminalBlock from './TerminalBlock.svelte';

describe('TerminalBlock', () => {
	it('renders content in pre element', async () => {
		render(TerminalBlock, { content: 'agent start --mode passive' });
		await expect.element(page.getByText('agent start --mode passive')).toBeInTheDocument();
	});

	it('renders title in bar', async () => {
		render(TerminalBlock, { content: '', title: 'agent.yaml' });
		await expect.element(page.getByText('agent.yaml')).toBeInTheDocument();
	});

	it('renders without title when omitted', async () => {
		const { container } = render(TerminalBlock, { content: 'test' });
		expect(container.querySelector('.tb-title')).toBeNull();
	});

	it('renders traffic-light dots', async () => {
		const { container } = render(TerminalBlock, { content: '' });
		expect(container.querySelectorAll('.tb-dot')).toHaveLength(3);
	});
});
