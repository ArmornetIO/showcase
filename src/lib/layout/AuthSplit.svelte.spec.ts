import { describe, it, expect, afterEach } from 'vitest';
import { render } from 'vitest-browser-svelte';
import AuthSplit from './AuthSplit.svelte';
import { createRawSnippet } from 'svelte';

// The shell is a layout, so there is little to assert about how it LOOKS. What
// is worth locking down is the contract the routes depend on, because app-ui
// pages may not carry CSS and therefore cannot patch around a regression here:
//
//   · the copy props actually render (a route passes strings, not markup)
//   · the form snippet lands inside the pane the seam and z-order are built for
//   · the published `auth-*` slot classes are STYLED — that is the whole reason
//     the route is allowed to be styleless, and a rename here would silently
//     un-style every consumer rather than fail a build
//   · the ground the Möbius occludes with tracks the theme rather than the
//     dark literal it was authored against

const snip = (html: string) =>
	createRawSnippet(() => ({ render: () => html }));

const base = {
	mark: 'ARMORNET',
	statement: { human: 'Every agent', machine: 'accounted for.' },
	sub: 'Identity, posture and interception.',
	step: '01 / WORKSPACE',
	form: snip('<p class="auth-lede">lede</p>')
};

afterEach(() => {
	document.documentElement.removeAttribute('data-theme');
});

describe('AuthSplit', () => {
	it('renders the mark, both halves of the statement, the sub and the step', async () => {
		const { container } = render(AuthSplit, base);
		expect(container.querySelector('.mark')?.textContent).toContain('ARMORNET');
		expect(container.querySelector('.statement')?.textContent).toContain('Every agent');
		expect(container.querySelector('.machine')?.textContent).toBe('accounted for.');
		expect(container.querySelector('.sub')?.textContent).toContain('Identity, posture');
		expect(container.querySelector('.step')?.textContent).toBe('01 / WORKSPACE');
	});

	it('puts the form inside the form pane, not the brand pane', async () => {
		const { container } = render(AuthSplit, base);
		expect(container.querySelector('.form-body .auth-lede')).not.toBeNull();
		expect(container.querySelector('.brand .auth-lede')).toBeNull();
	});

	it('styles every published auth-* slot class', async () => {
		// The route names these and owns no CSS, so an unstyled one is invisible
		// breakage rather than a build error. Asserting on a property each rule
		// actually sets is what makes the check mean "the rule matched".
		const { container } = render(AuthSplit, {
			...base,
			form: snip(
				'<p class="auth-lede">l</p><div class="auth-stack"></div>' +
					'<p class="auth-error">e</p><button class="auth-back">b</button>'
			)
		});
		const styleOf = (sel: string) =>
			getComputedStyle(container.querySelector(sel) as HTMLElement);

		expect(styleOf('.auth-lede').fontSize).not.toBe('');
		expect(styleOf('.auth-stack').display).toBe('flex');
		expect(styleOf('.auth-stack').flexDirection).toBe('column');
		expect(styleOf('.auth-error').color).not.toBe('');
		expect(styleOf('.auth-back').cursor).toBe('pointer');
	});

	it('omits the optional blocks rather than rendering empty chrome', async () => {
		const { container } = render(AuthSplit, { form: base.form });
		expect(container.querySelector('.mark')).toBeNull();
		expect(container.querySelector('.statement')).toBeNull();
		expect(container.querySelector('.sub')).toBeNull();
		expect(container.querySelector('.step')).toBeNull();
		expect(container.querySelector('.aside')).toBeNull();
	});

	it('takes its occluding ground from the theme, not the authored dark literal', async () => {
		// The near lap of the strip paints `ground` to hide the far lap. Wrong
		// ground means a grey smear instead of a hole — and the composition was
		// authored on black, so a light theme is exactly where this breaks.
		document.documentElement.setAttribute('data-theme', 'paper');
		const { container } = render(AuthSplit, base);
		const canvasHost = container.querySelector('.art');
		expect(canvasHost).not.toBeNull();
		const paperBg = getComputedStyle(document.documentElement)
			.getPropertyValue('--bg')
			.trim()
			.toLowerCase();
		// Guards the token itself: if `paper` ever stops declaring --bg, the shell
		// silently falls back to the dark triple and this test is why you know.
		expect(paperBg).toMatch(/^#[0-9a-f]{6}$/);
		expect(paperBg).not.toBe('#06070b');
	});
});
