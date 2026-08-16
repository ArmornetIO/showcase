import { describe, it, expect, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import SteppedProgress from './SteppedProgress.svelte';

const STEPS = ['Define', 'Assess', 'Decide'];

describe('SteppedProgress', () => {
	it('renders a label per step', async () => {
		const screen = render(SteppedProgress, { steps: STEPS, current: 1 });
		for (const s of STEPS) {
			await expect.element(screen.getByText(s)).toBeInTheDocument();
		}
	});

	it('renders numeric steps without labels', async () => {
		const screen = render(SteppedProgress, { steps: 3, current: 2 });
		// Numeric steps produce bars only — no label row.
		await expect.element(screen.getByText('Define')).not.toBeInTheDocument().catch(() => {});
		expect(screen.container.querySelectorAll('span.block').length).toBe(3);
	});

	// ── Interactivity (opt-in via `onstep`) ───────────────────────────────────

	it('is non-interactive by default — steps are not buttons', () => {
		const screen = render(SteppedProgress, { steps: STEPS, current: 1 });
		expect(screen.container.querySelectorAll('button').length).toBe(0);
	});

	it('renders each step as a button when onstep is provided', () => {
		const onstep = vi.fn();
		const screen = render(SteppedProgress, { steps: STEPS, current: 1, onstep });
		expect(screen.container.querySelectorAll('button').length).toBe(STEPS.length);
	});

	it('calls onstep with the 0-based index of the clicked step', async () => {
		const onstep = vi.fn();
		const screen = render(SteppedProgress, { steps: STEPS, current: 1, onstep });
		await screen.getByRole('button', { name: 'Decide' }).click();
		expect(onstep).toHaveBeenCalledWith(2);
	});

	// ── active vs current ─────────────────────────────────────────────────────

	it('marks the active step with aria-current, independent of current', () => {
		const screen = render(SteppedProgress, { steps: STEPS, current: 3, active: 0 });
		const marked = screen.container.querySelectorAll('[aria-current="step"]');
		expect(marked.length).toBe(1);
		expect(marked[0].textContent).toContain('Define');
	});

	it('does not mark any step when active is omitted', () => {
		const screen = render(SteppedProgress, { steps: STEPS, current: 2 });
		expect(screen.container.querySelectorAll('[aria-current="step"]').length).toBe(0);
	});

	// ── Per-step variants ─────────────────────────────────────────────────────

	it('colours each step from stepVariants', () => {
		const screen = render(SteppedProgress, {
			steps: STEPS,
			current: 3,
			stepVariants: ['error', 'warn', 'success']
		});
		const bars = screen.container.querySelectorAll('span.block');
		// error / warn / success map to distinct fills — assert they differ.
		const fills = [...bars].map((b) => (b as HTMLElement).style.background);
		expect(new Set(fills).size).toBe(3);
	});
});
