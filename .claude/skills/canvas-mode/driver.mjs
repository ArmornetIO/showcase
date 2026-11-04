#!/usr/bin/env node
// Starts showcase's dev server and screenshots routes for canvas-mode.
// Run from the showcase root:
//   node .claude/skills/canvas-mode/driver.mjs start
//   node .claude/skills/canvas-mode/driver.mjs ss /mockups/my-feature my-feature
//   node .claude/skills/canvas-mode/driver.mjs stop

import { spawn } from 'node:child_process';
import { existsSync, writeFileSync, readFileSync, mkdirSync, openSync, rmSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const TMP = process.env.TMPDIR ?? '/tmp';
const SHOTS = `${TMP}/showcase-shots`;
const LOG = `${TMP}/showcase-dev.log`;
const PID = `${TMP}/showcase-dev.pid`;
const PORT = 5173;
const ORIGIN = `http://127.0.0.1:${PORT}`;
const BASE = '/showcase';

const log = (...a) => console.error('[canvas-mode]', ...a);

async function up() {
	try {
		await fetch(`${ORIGIN}${BASE}/`, { method: 'HEAD', signal: AbortSignal.timeout(1000) });
		return true;
	} catch {
		return false;
	}
}

async function start() {
	if (await up()) return log(`already up on :${PORT}`);
	const out = openSync(LOG, 'a');
	const child = spawn('npm', ['run', 'dev', '--', '--host', '127.0.0.1', '--port', String(PORT), '--strictPort'], {
		cwd: ROOT,
		detached: true,
		stdio: ['ignore', out, out]
	});
	child.unref();
	writeFileSync(PID, String(child.pid));
	log(`dev server PID ${child.pid}, log ${LOG}`);
	const deadline = Date.now() + 60_000;
	while (Date.now() < deadline) {
		if (await up()) return log('ready');
		await new Promise((r) => setTimeout(r, 600));
	}
	throw new Error(`dev server did not come up in 60s; see ${LOG}`);
}

function stop() {
	if (!existsSync(PID)) return log('no server started by this driver');
	const pid = Number(readFileSync(PID, 'utf8'));
	// Negative pid: npm spawns vite as a child, so kill the whole group.
	try { process.kill(-pid, 'SIGTERM'); } catch (e) { log(`kill failed: ${e.message}`); }
	rmSync(PID);
}

async function screenshot(path, name) {
	const { chromium } = await import('playwright');
	mkdirSync(SHOTS, { recursive: true });
	const browser = await chromium.launch();
	try {
		const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
		await page.goto(`${ORIGIN}${BASE}${path}`, { waitUntil: 'networkidle', timeout: 20_000 });
		const file = `${SHOTS}/${name}.png`;
		await page.screenshot({ path: file });
		console.log(file);
	} finally {
		await browser.close();
	}
}

const [, , cmd, path = '/', name = 'shot'] = process.argv;
if (cmd === 'start') await start();
else if (cmd === 'stop') stop();
else if (cmd === 'ss') await screenshot(path, name);
else {
	console.error('usage: driver.mjs start | stop | ss <route> [name]');
	process.exit(1);
}
