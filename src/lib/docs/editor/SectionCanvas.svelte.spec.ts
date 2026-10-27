import { page } from 'vitest/browser';
import { describe, it, expect, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import SectionCanvas from './SectionCanvas.svelte';
import type { CanvasSection } from './SectionCanvas.svelte';

const sections: CanvasSection[] = [
	{ id: 'intro', title: 'Intro', level: 2, body: 'Hello.', html: '<p>Hello.</p>' },
	{ id: 'usage', title: 'Usage', level: 2, body: 'Run it.', html: '<p>Run it.</p>' }
];

describe('SectionCanvas', () => {
	it('renders sections as prose until one is selected', async () => {
		render(SectionCanvas, { mode: 'edit', sections, source: '', path: 'a.md' });
		await expect.element(page.getByRole('heading', { name: 'Intro' })).toBeInTheDocument();
		expect(document.querySelector('textarea')).toBeNull();
	});

	// Editing happens where the prose stood, not in a separate view.
	it('turns the selected section into heading and body inputs', async () => {
		const onbody = vi.fn();
		render(SectionCanvas, {
			mode: 'edit',
			sections,
			source: '',
			path: 'a.md',
			selectedId: 'usage',
			onbody
		});
		await expect.element(page.getByLabelText('Heading')).toHaveValue('Usage');
		await page.getByLabelText('Markdown for Usage').fill('Run it twice.');
		expect(onbody).toHaveBeenLastCalledWith('usage', 'Run it twice.');
	});

	it('says a renamed heading keeps its id', async () => {
		render(SectionCanvas, {
			mode: 'edit',
			sections: [{ ...sections[0], title: 'Welcome', was: 'Intro' }],
			source: '',
			path: 'a.md',
			selectedId: 'intro'
		});
		await expect.element(page.getByText(/Renamed in place from “Intro”/)).toBeInTheDocument();
	});

	it('shows the whole file in raw mode', async () => {
		render(SectionCanvas, { mode: 'raw', sections, source: '# The file', path: 'a.md' });
		await expect.element(page.getByText('# The file')).toBeInTheDocument();
	});

	it('offers the grip and insert only when their callbacks are wired', async () => {
		const { container } = render(SectionCanvas, {
			mode: 'edit',
			sections,
			source: '',
			path: 'a.md'
		});
		expect(container.querySelector('[draggable="true"]')).toBeNull();
		expect(container.querySelector('[aria-label^="Insert block"]')).toBeNull();
	});
});
