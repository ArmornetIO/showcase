#!/usr/bin/env node
// ── render-card — look at what a card is a picture OF ────────────────────────
// Sibling of `render-figure.mjs`, for the other thing the scene renderer draws.
// Card art is tuned by eye and by nothing else: a `Shot` is eleven numbers, and
// whether they add up to "somebody fixing a bug at night" or to "a guy standing
// near a building" is not a question any of the eleven can answer on its own.
//
//   node showcase/scripts/render-card.mjs --card contribution
//   node showcase/scripts/render-card.mjs --card contribution --sweep 'Lead facing=0.2,1.5,2.4'
//   node showcase/scripts/render-card.mjs --deck            # the whole hand
//
// Drives the Outfitter's card bench in the real app, for the same reason
// render-figure drives the real wearables page — an offscreen re-render of the
// same maths would agree with the geometry and disagree with the product.

import { spawn } from 'node:child_process';
import { mkdirSync, openSync } from 'node:fs';
import path from 'node:path';

const REPO = path.resolve(import.meta.dirname, '../..');
const SHOWCASE = path.join(REPO, 'showcase');
const PLAYWRIGHT = path.join(REPO, 'app-ui/node_modules/playwright/index.mjs');

const args = process.argv.slice(2);
const flag = (n, d) => {
	const i = args.indexOf(`--${n}`);
	return i >= 0 && args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : d;
};
const has = (n) => args.includes(`--${n}`);

// Never 5173: a human's own dev server lives there.
const PORT = Number(flag('port', 5207));
const OUT = flag('out', path.join(process.env.TMPDIR || '/tmp', 'cards'));
mkdirSync(OUT, { recursive: true });

const CARD = flag('card', 'contribution');

async function serving() {
	try {
		const res = await fetch(`http://localhost:${PORT}/showcase/`, {
			signal: AbortSignal.timeout(1500)
		});
		return res.ok;
	} catch {
		return false;
	}
}

async function start() {
	if (await serving()) {
		console.log(`· reusing dev server on :${PORT}`);
		return null;
	}
	const log = openSync(path.join(OUT, 'vite.log'), 'w');
	const proc = spawn('npx', ['vite', '--port', String(PORT), '--strictPort'], {
		cwd: SHOWCASE,
		stdio: ['ignore', log, log]
	});
	for (let i = 0; i < 90; i++) {
		await new Promise((r) => setTimeout(r, 500));
		if (await serving()) return proc;
	}
	proc.kill();
	throw new Error(`vite did not come up on :${PORT} — see ${path.join(OUT, 'vite.log')}`);
}

const server = await start();
try {
	const { chromium } = await import(PLAYWRIGHT);
	const browser = await chromium.launch();
	const page = await browser.newPage({
		viewport: { width: 1440, height: 1000 },
		deviceScaleFactor: 2
	});

	if (has('deck')) {
		// The whole hand, at the size a hand is read at — the only view that
		// answers "do these look like twelve different pictures".
		await page.goto(`http://localhost:${PORT}/showcase/mockups/breach-cards`, {
			waitUntil: 'networkidle'
		});
		await page.waitForTimeout(900);
		const file = path.join(OUT, 'deck.png');
		await page.screenshot({ path: file, fullPage: true });
		console.log(file);
	} else {
		await page.goto(`http://localhost:${PORT}/showcase/mockups/breach-outfitter`, {
			waitUntil: 'networkidle'
		});
		await page.getByRole('button', { name: 'Cards', exact: true }).click();
		await page.locator('aside.panel .pick select').selectOption(CARD);
		await page.waitForTimeout(600);

		const stage = page.locator('.hold');
		// A sweep drives ONE of the panel's sliders across several values —
		// `--sweep 'Lead facing=0.2,0.9,1.6'`. Tuning a shot is answering "which
		// of these" and not "is this right", and asking it one render at a time
		// costs a dev-server boot per answer.
		const sweep = flag('sweep', null);
		const [label, list] = sweep ? sweep.split('=') : [null, ''];
		const values = list ? list.split(',').map(Number) : [null];

		for (const v of values) {
			if (v !== null) {
				// Bound by the slider's LABEL. An nth-child index here re-binds
				// itself to a different knob the day one is added above it.
				const row = page.locator('aside.panel label.row', { hasText: label });
				await row.locator('input[type=range]').evaluate((el, n) => {
					el.value = String(n);
					el.dispatchEvent(new Event('input', { bubbles: true }));
				}, v);
				await page.waitForTimeout(400);
			}
			const file = path.join(OUT, `${CARD}${v === null ? '' : `-${v}`}.png`);
			await stage.screenshot({ path: file });
			console.log(file);
		}
	}
	await browser.close();
} finally {
	if (server) server.kill();
}
