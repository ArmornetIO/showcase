import { page } from 'vitest/browser';
import { describe, it, expect } from 'vitest';
import { render } from 'vitest-browser-svelte';
import ChatMessage from './ChatMessage.svelte';

describe('ChatMessage', () => {
	it('renders content for user role', async () => {
		render(ChatMessage, { role: 'user', content: 'Hello world' });
		await expect.element(page.getByText('Hello world')).toBeInTheDocument();
	});

	it('renders content for assistant role', async () => {
		render(ChatMessage, { role: 'assistant', content: 'I can help' });
		await expect.element(page.getByText('I can help')).toBeInTheDocument();
	});

	it('shows YOU label for user role', async () => {
		render(ChatMessage, { role: 'user', content: 'test' });
		await expect.element(page.getByText('YOU')).toBeInTheDocument();
	});

	it('shows CLAUDE label for assistant role', async () => {
		render(ChatMessage, { role: 'assistant', content: 'test' });
		await expect.element(page.getByText('CLAUDE')).toBeInTheDocument();
	});

	it('does not render role label for system messages', async () => {
		render(ChatMessage, { role: 'system', content: 'System notice' });
		await expect.element(page.locator('.msg-role')).not.toBeInTheDocument();
	});

	it('renders timestamp when provided', async () => {
		const timestamp = new Date('2025-01-01T14:30:00').getTime();
		render(ChatMessage, { role: 'user', content: 'Hi', timestamp });
		await expect.element(page.locator('.msg-time')).toBeInTheDocument();
	});

	it('omits timestamp element when not provided', async () => {
		render(ChatMessage, { role: 'user', content: 'Hi' });
		await expect.element(page.locator('.msg-time')).not.toBeInTheDocument();
	});

	it('applies msg-user class for user role', async () => {
		render(ChatMessage, { role: 'user', content: 'test' });
		await expect.element(page.locator('.msg-user')).toBeInTheDocument();
	});

	it('applies msg-assistant class for assistant role', async () => {
		render(ChatMessage, { role: 'assistant', content: 'test' });
		await expect.element(page.locator('.msg-assistant')).toBeInTheDocument();
	});

	it('applies msg-system class for system role', async () => {
		render(ChatMessage, { role: 'system', content: 'test' });
		await expect.element(page.locator('.msg-system')).toBeInTheDocument();
	});
});
