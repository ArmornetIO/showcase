#!/usr/bin/env node
// ── render-figure — look at what the character is WEARING ────────────────────
// Sibling of `.claude/skills/create-piece/render-piece.mjs`, and it exists for
// the same reason: worn geometry fails visually, in ways no type check and no
// unit test can see. A hat that never turns looks perfect face-on. A hat that
// never sorts looks perfect until the head passes behind it. A hat cut for one
// skull looks perfect on that skull. Every one of those shipped in the overlay
// this replaced, and every one of them is obvious in a contact sheet.
//
//   node showcase/scripts/render-figure.mjs
//   node showcase/scripts/render-figure.mjs --build brute --yaws 0,90
//   node showcase/scripts/render-figure.mjs --walk
//
// Drives the real page in the real app — an offscreen re-render of the same
// maths would agree with the geometry and disagree with the product.

import { spawn } from 'node:child_process';
import { mkdirSync, openSync } from 'node:fs';
import path from 'node:path';

const REPO = path.resolve(import.meta.dirname, '../..');
const SHOWCASE = path.join(REPO, 'showcase');
// Playwright is a devDependency of app-ui, not showcase. Reaching across rather
// than installing it here — a tool nothing ships is not worth a new dependency.
const PLAYWRIGHT = path.join(REPO, 'app-ui/node_modules/playwright/index.mjs');

const args = process.argv.slice(2);
const flag = (n, d) => {
	const i = args.indexOf(`--${n}`);
	return i >= 0 && args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : d;
};
const has = (n) => args.includes(`--${n}`);

// Never 5173: a human's own dev server lives there.
const PORT = Number(flag('port', 5207));
const OUT = flag('out', path.join(process.env.TMPDIR || '/tmp', 'figures'));
mkdirSync(OUT, { recursive: true });

const q = new URLSearchParams();
q.set('yaws', flag('yaws', '0,60,120,180'));
if (flag('build', null)) q.set('build', flag('build'));
if (has('walk')) q.set('walk', '1');
if (flag('only', null)) q.set('only', flag('only'));
if (flag('cell', null)) q.set('cell', flag('cell'));

/** An HTTP GET, not a TCP connect: on macOS `127.0.0.1` does not see a Vite
 *  bound to `localhost` (which resolves to ::1), and the probe then reports
 *  "nothing there" right before the spawn fails with "port already in use".
 *
 *  And it checks the STATUS, because these ports are shared. A Vite serving a
 *  different app of this repo answers `/showcase/` with a 404 page explaining
 *  its own base path — which is a response, so a probe that only asked "did
 *  something reply" happily screenshotted that explanation. */
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
		stdio: ['ignore', log, log],
		detached: false
	});
	for (let i = 0; i < 60; i++) {
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
	const page = await browser.newPage({ viewport: { width: 1680, height: 1200 }, deviceScaleFactor: 2 });
	const url = `http://localhost:${PORT}/showcase/dev-bench/wearables?${q}`;
	await page.goto(url, { waitUntil: 'networkidle' });
	// The figure is pure SVG with no images to decode, so one frame is enough —
	// but the sheet mounts ~176 of them and the first paint is not the last.
	await page.waitForTimeout(900);
	const tag = [flag('build', ''), flag('only', ''), has('walk') ? 'walk' : ''].filter(Boolean).join('-');
	const file = path.join(OUT, `wearables${tag ? `-${tag}` : ''}.png`);
	await page.screenshot({ path: file, fullPage: true });
	await browser.close();
	console.log(file);
} finally {
	if (server) server.kill();
}
