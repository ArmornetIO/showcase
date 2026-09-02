import { render } from 'vitest-browser-svelte';
import { expect, test } from 'vitest';
import CodeBlock from './CodeBlock.svelte';

test('renders the code and its title', async () => {
	const screen = render(CodeBlock, { code: '<Button />', title: 'example' });
	await expect.element(screen.getByText('example')).toBeInTheDocument();
	await expect.element(screen.getByText('Button')).toBeInTheDocument();
});

test('highlights components, strings and comments distinctly', async () => {
	const screen = render(CodeBlock, {
		code: '<!-- note -->\n<Button label="go" />'
	});
	const root = screen.container;
	expect(root.querySelector('.c-comment')?.textContent).toBe('<!-- note -->');
	expect(root.querySelector('.c-component')?.textContent).toBe('Button');
	expect(root.querySelector('.c-string')?.textContent).toBe('"go"');
});

test('escapes markup rather than injecting it', async () => {
	const screen = render(CodeBlock, { code: '<img src=x onerror="boom">' });
	expect(screen.container.querySelector('img')).toBeNull();
});

test('a double-slash inside a string stays a string', async () => {
	const screen = render(CodeBlock, { code: 'eyebrow="// risk · register"' });
	expect(screen.container.querySelector('.c-string')?.textContent).toBe('"// risk · register"');
	expect(screen.container.querySelector('.c-comment')).toBeNull();
});

test('dedent strips the common leading indent', async () => {
	const screen = render(CodeBlock, { code: '\n\t\t<a>\n\t\t\t<b>\n' });
	expect(screen.container.querySelector('code')?.textContent).toBe('<a>\n\t<b>');
});
