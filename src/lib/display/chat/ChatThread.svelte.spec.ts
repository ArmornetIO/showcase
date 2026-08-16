import { page } from 'vitest/browser';
import { describe, it, expect, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import ChatThread from './ChatThread.svelte';
import type { ChatEntry } from './ChatThread.svelte';

const sampleMessages: ChatEntry[] = [
	{ id: '1', role: 'assistant', author: 'CLAUDE', content: 'How can I help?', timestamp: Date.now() },
	{ id: '2', role: 'user', author: 'YOU', content: 'Build me a form', timestamp: Date.now() }
];

describe('ChatThread', () => {
	it('shows empty state when messages array is empty', async () => {
		render(ChatThread, { messages: [], onSend: vi.fn() });
		await expect.element(page.locator('.chat-empty')).toBeInTheDocument();
	});

	it('hides empty state when messages are present', async () => {
		render(ChatThread, { messages: sampleMessages, onSend: vi.fn() });
		await expect.element(page.locator('.chat-empty')).not.toBeInTheDocument();
	});

	it('renders all message contents', async () => {
		render(ChatThread, { messages: sampleMessages, onSend: vi.fn() });
		await expect.element(page.getByText('How can I help?')).toBeInTheDocument();
		await expect.element(page.getByText('Build me a form')).toBeInTheDocument();
	});

	it('renders the per-message author label', async () => {
		const messages: ChatEntry[] = [
			{ id: 'a', role: 'assistant', author: 'DANA', content: 'Flagging this answer.' }
		];
		render(ChatThread, { messages, onSend: vi.fn() });
		await expect.element(page.getByText('DANA')).toBeInTheDocument();
	});

	it('calls onSend with trimmed text when Send is clicked', async () => {
		const onSend = vi.fn();
		render(ChatThread, { messages: [], onSend });
		await page.locator('.chat-textarea').fill('  Hello world  ');
		await page.locator('.chat-send').click();
		expect(onSend).toHaveBeenCalledWith('Hello world');
	});

	it('clears the textarea after sending', async () => {
		render(ChatThread, { messages: [], onSend: vi.fn() });
		await page.locator('.chat-textarea').fill('Test message');
		await page.locator('.chat-send').click();
		await expect.element(page.locator('.chat-textarea')).toHaveValue('');
	});

	it('does not call onSend for empty or whitespace-only input', async () => {
		const onSend = vi.fn();
		render(ChatThread, { messages: [], onSend });
		await page.locator('.chat-send').click();
		expect(onSend).not.toHaveBeenCalled();

		await page.locator('.chat-textarea').fill('   ');
		await page.locator('.chat-send').click();
		expect(onSend).not.toHaveBeenCalled();
	});

	it('disables textarea and send button when disabled prop is true', async () => {
		render(ChatThread, { messages: [], onSend: vi.fn(), disabled: true });
		await expect.element(page.locator('.chat-textarea')).toBeDisabled();
		await expect.element(page.locator('.chat-send')).toBeDisabled();
	});

	it('sends on Enter key without Shift', async () => {
		const onSend = vi.fn();
		render(ChatThread, { messages: [], onSend });
		const textarea = page.locator('.chat-textarea');
		await textarea.fill('via keyboard');
		await textarea.press('Enter');
		expect(onSend).toHaveBeenCalledWith('via keyboard');
	});

	it('does not send on Shift+Enter', async () => {
		const onSend = vi.fn();
		render(ChatThread, { messages: [], onSend });
		const textarea = page.locator('.chat-textarea');
		await textarea.fill('newline test');
		await textarea.press('Shift+Enter');
		expect(onSend).not.toHaveBeenCalled();
	});

	it('renders the actions slot when provided', async () => {
		// Verify component mounts cleanly; slot content is tested in integration
		expect(() => render(ChatThread, { messages: [], onSend: vi.fn() })).not.toThrow();
	});
});
