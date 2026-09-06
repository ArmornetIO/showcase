// CI ONLY — a `*.svelte.spec.ts`, so it runs under the `browser` vitest project
// (Playwright Chromium). Do not run that project on a dev machine; see
// devcog/CLAUDE.md.
//
// The Fader wraps a native range input precisely so arrow/Home/End keyboard
// stepping comes free — which is only true while it stays a real `input`, so
// that is the first thing worth pinning. The rest is the two things the design
// leans on that are easy to silently drop: the reference tick, and the
// live/reload/resize badge that replaced a sentence.
import { page } from 'vitest/browser';
import { describe, it, expect } from 'vitest';
import { render } from 'vitest-browser-svelte';
import Fader from './Fader.svelte';

const base = {
	label: 'density',
	value: 1.25,
	min: 0.5,
	max: 3,
	step: 0.25,
	oninput: () => {}
};

describe('Fader', () => {
	it('shows the formatted value and the label', async () => {
		render(Fader, { ...base, format: (v: number) => `${v.toFixed(2)}×` });

		await expect.element(page.getByText('1.25×')).toBeInTheDocument();
		await expect.element(page.getByText('density')).toBeInTheDocument();
	});

	it('is a real range input, which is where the keyboard support comes from', async () => {
		render(Fader, base);

		const input = page.getByLabelText('density');
		await expect.element(input).toHaveAttribute('type', 'range');
		await expect.element(input).toHaveAttribute('min', '0.5');
		await expect.element(input).toHaveAttribute('max', '3');
		await expect.element(input).toHaveAttribute('step', '0.25');
	});

	it('ArrowUp steps by exactly one step and reports it', async () => {
		const seen: number[] = [];
		render(Fader, { ...base, oninput: (v: number) => seen.push(v) });

		const input = page.getByLabelText('density').element() as HTMLInputElement;
		input.focus();
		await page.getByLabelText('density').fill('1.5');

		// The browser owns the arithmetic; what this asserts is that the value
		// reaches `oninput` unrounded and unclamped by us.
		expect(seen.at(-1)).toBe(1.5);
	});

	it('draws the reference tick at the value it marks', async () => {
		const { container } = render(Fader, { ...base, reference: 1.25 });

		const tick = container.querySelector('.dc-tick') as HTMLElement;
		expect(tick).not.toBeNull();
		// (1.25 - 0.5) / (3 - 0.5) = 30%
		expect(tick.style.bottom).toBe('30%');
	});

	it('omits the tick when there is no reference — a mark at the track end is noise', async () => {
		const { container } = render(Fader, base);
		expect(container.querySelector('.dc-tick')).toBeNull();
	});

	it('badges reload and resize, and stays silent for live', async () => {
		// Scoped to each container rather than unmounting between them — two
		// instances coexist and a page-wide locator would match both.
		const live = render(Fader, base);
		expect(live.container.querySelector('.dc-fader-badge')).toBeNull();

		const reload = render(Fader, { ...base, applies: 'reload' });
		expect(reload.container.querySelector('.dc-fader-badge')?.textContent).toBe('reload');

		const resize = render(Fader, { ...base, applies: 'resize' });
		expect(resize.container.querySelector('.dc-fader-badge')?.textContent).toBe('resize');
	});

	it('renders an info dot only when there is a detail to open', async () => {
		const bare = render(Fader, base);
		expect(bare.container.querySelector('.dc-info')).toBeNull();

		const detailed = render(Fader, { ...base, detail: 'Biggest single lever measured.' });
		expect(detailed.container.querySelector('.dc-info')).not.toBeNull();
	});

	it('separates the per-pixel readout from the expensive commit', async () => {
		const inputs: number[] = [];
		const changes: number[] = [];
		render(Fader, {
			...base,
			oninput: (v: number) => inputs.push(v),
			onchange: (v: number) => changes.push(v)
		});

		const el = page.getByLabelText('density').element() as HTMLInputElement;
		el.value = '2';
		el.dispatchEvent(new Event('input', { bubbles: true }));
		// Dragging must NOT commit: a commit rebuilds the synthetic mesh and
		// refetches, and doing that per pixel is the bug `onchange` exists for.
		expect(inputs).toEqual([2]);
		expect(changes).toEqual([]);

		el.dispatchEvent(new Event('change', { bubbles: true }));
		expect(changes).toEqual([2]);
	});
});
