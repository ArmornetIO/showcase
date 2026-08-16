import { page } from 'vitest/browser';
import { describe, it, expect } from 'vitest';
import { render } from 'vitest-browser-svelte';
import HudCorners from './HudCorners.svelte';

describe('HudCorners', () => {
	it('renders 4 corner span elements without error', async () => {
		render(HudCorners, {});
		// All 4 corners are aria-hidden spans; check they exist via their CSS classes
		const container = document.querySelector('.hcr-tl');
		expect(container).not.toBeNull();
		expect(document.querySelector('.hcr-tr')).not.toBeNull();
		expect(document.querySelector('.hcr-bl')).not.toBeNull();
		expect(document.querySelector('.hcr-br')).not.toBeNull();
	});

	it('accepts custom color and applies it as a CSS custom property', async () => {
		render(HudCorners, { color: '#ff0000' });
		const tl = document.querySelector('.hcr-tl') as HTMLElement | null;
		expect(tl).not.toBeNull();
		expect(tl!.style.getPropertyValue('--hcr-color')).toBe('#ff0000');
	});

	it('accepts custom size and applies it as a CSS custom property', async () => {
		render(HudCorners, { size: 14 });
		const tl = document.querySelector('.hcr-tl') as HTMLElement | null;
		expect(tl).not.toBeNull();
		expect(tl!.style.getPropertyValue('--hcr-size')).toBe('14px');
	});

	it('accepts custom offset and applies it as a CSS custom property', async () => {
		render(HudCorners, { offset: 12 });
		const tl = document.querySelector('.hcr-tl') as HTMLElement | null;
		expect(tl).not.toBeNull();
		expect(tl!.style.getPropertyValue('--hcr-offset')).toBe('12px');
	});
});
