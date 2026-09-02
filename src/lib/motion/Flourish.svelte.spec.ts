import { page } from 'vitest/browser';
import { describe, it, expect } from 'vitest';
import { render } from 'vitest-browser-svelte';
import Flourish from './Flourish.svelte';

// The overlay is the top-level .fx span. Idle (trigger 0) paints nothing at all.
const fx = () => document.querySelector('.fx');

describe('Flourish', () => {
	it('stays quiet at rest — trigger 0 paints nothing', () => {
		render(Flourish, { kind: 'sparkle', trigger: 0 });
		expect(fx()).toBeNull();
	});

	it('renders nothing for kind none, even when triggered', () => {
		render(Flourish, { kind: 'none', trigger: 3 });
		expect(fx()).toBeNull();
	});

	it('paints an overlay once triggered', () => {
		render(Flourish, { kind: 'sparkle', trigger: 1 });
		expect(fx()).not.toBeNull();
	});

	it('emits star particles for the sparkle effect', () => {
		render(Flourish, { kind: 'sparkle', trigger: 1 });
		expect(document.querySelectorAll('.spark').length).toBeGreaterThan(0);
	});

	it('detonates a flash for the firework effect', () => {
		render(Flourish, { kind: 'firework', trigger: 1 });
		expect(document.querySelector('.fw-flash')).not.toBeNull();
	});

	it('sweeps a highlight for the shimmer effect', () => {
		render(Flourish, { kind: 'shimmer', trigger: 1 });
		expect(document.querySelector('.shimmer')).not.toBeNull();
	});

	it('blooms a wash for the aurora effect', () => {
		render(Flourish, { kind: 'aurora', trigger: 1 });
		expect(document.querySelector('.aura-bloom')).not.toBeNull();
	});

	it('honours a custom anchor origin', () => {
		render(Flourish, { kind: 'sparkle', trigger: 1, anchorX: '1.35rem' });
		const origin = document.querySelector('.origin') as HTMLElement;
		expect(origin.style.left).toBe('1.35rem');
	});

	it('is inert to pointer events — it must never eat a click', () => {
		render(Flourish, { kind: 'firework', trigger: 1 });
		expect(getComputedStyle(fx() as Element).pointerEvents).toBe('none');
	});
});
