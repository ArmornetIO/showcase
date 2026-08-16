import { page } from 'vitest/browser';
import { describe, it, expect } from 'vitest';
import { render } from 'vitest-browser-svelte';
import HexShield from './HexShield.svelte';

describe('HexShield', () => {
	it('renders without error and shows SHIELD label', async () => {
		render(HexShield, {});
		await expect.element(page.getByText('SHIELD · ACTIVE')).toBeInTheDocument();
	});

	it('shows STANDBY when active=false', async () => {
		render(HexShield, { active: false });
		await expect.element(page.getByText('SHIELD · STANDBY')).toBeInTheDocument();
	});

	it('displays layers count in meta-bot row', async () => {
		render(HexShield, { layers: 7 });
		await expect.element(page.getByText('07')).toBeInTheDocument();
	});

	it('displays plates count in meta-bot row', async () => {
		render(HexShield, { plates: 42 });
		await expect.element(page.getByText('42')).toBeInTheDocument();
	});

	it('renders the SVG honeycomb visualization', async () => {
		render(HexShield, {});
		const svg = document.querySelector('.hex-comb svg');
		expect(svg).not.toBeNull();
		const polygons = svg!.querySelectorAll('polygon');
		expect(polygons.length).toBeGreaterThan(0);
	});
});
