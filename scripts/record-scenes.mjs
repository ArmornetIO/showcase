#!/usr/bin/env node
// ── record-scenes — the README's GIFs, filmed from the real ScenePlayer ──────
//
//   npm run record:scenes                          # every scene in README_SCENES
//   npm run record:scenes -- --scene tui-sign-in   # one, any id in the catalogue
//   node scripts/record-scenes.mjs --fps 10        # skip the build, film build/
//   … --stills /tmp/frames                         # also one PNG a second, to look at
//
// Films /scene/record from `build/` (the npm script runs `vite build` first).
//
// No server: Playwright answers the page's requests out of the build
// directory, so nothing listens on a port. No screen recorder either:
// Playwright's fake clock owns requestAnimationFrame and performance.now, and
// is stepped exactly one frame at a time — the camera's flights included — so
// every frame lands 1/fps after the last however long a screenshot took, and
// two runs of the same scene give the same GIF.

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { inflateSync } from 'node:zlib';
import { chromium } from 'playwright';
import gifenc from 'gifenc';

const { GIFEncoder, applyPalette, quantize } = gifenc;

/** What the README shows. Order is irrelevant; ids are the catalogue's. */
const README_SCENES = ['library-tour', 'mesh-reroute'];

const ROOT = path.resolve(import.meta.dirname, '..');
const BUILD = path.join(ROOT, 'build');
const ORIGIN = 'http://showcase.local';

const args = process.argv.slice(2);
const flag = (n, d) => {
	const i = args.indexOf(`--${n}`);
	return i >= 0 && args[i + 1] ? args[i + 1] : d;
};
const ids = args.includes('--scene') ? [flag('scene')] : README_SCENES;
// GIF delays are whole centiseconds, so the step is too: the clock advances by
// exactly what the viewer will wait, and the GIF plays at the scene's speed.
const FRAME_MS = Math.round(100 / Number(flag('fps', 12))) * 10;
const WIDTH = Number(flag('width', 960));
const HEIGHT = Number(flag('height', 540));
const HOLD_MS = 2000;
const OUT = path.resolve(ROOT, flag('out', 'docs/scenes'));
const STILLS = flag('stills');

const TYPES = {
	'.html': 'text/html',
	'.js': 'text/javascript',
	'.css': 'text/css',
	'.json': 'application/json',
	'.svg': 'image/svg+xml',
	'.png': 'image/png',
	'.woff2': 'font/woff2',
	'.wasm': 'application/wasm'
};

async function serveBuild(context) {
	await context.route(`${ORIGIN}/**`, async (route) => {
		const rel = decodeURIComponent(new URL(route.request().url()).pathname).replace(/^\/showcase/, '');
		const file = path.join(BUILD, rel);
		if (!file.startsWith(BUILD)) return route.abort();
		// Anything that is not a built file is a client-side route: the SPA fallback.
		const hit = path.extname(rel) ? await readFile(file).catch(() => null) : null;
		await route.fulfill({
			status: 200,
			contentType: hit ? (TYPES[path.extname(rel)] ?? 'application/octet-stream') : TYPES['.html'],
			body: hit ?? (await readFile(path.join(BUILD, 'index.html')))
		});
	});
}

/** The PNGs Chromium writes: 8-bit RGB or RGBA, never interlaced. */
function decodePng(buf) {
	let pos = 8;
	let w = 0;
	let h = 0;
	let bpp = 0;
	const idat = [];
	while (pos < buf.length) {
		const len = buf.readUInt32BE(pos);
		const type = buf.toString('latin1', pos + 4, pos + 8);
		const data = buf.subarray(pos + 8, pos + 8 + len);
		if (type === 'IHDR') {
			w = data.readUInt32BE(0);
			h = data.readUInt32BE(4);
			bpp = { 2: 3, 6: 4 }[data[9]];
			if (data[8] !== 8 || !bpp || data[12] !== 0) throw new Error('unsupported PNG layout');
		} else if (type === 'IDAT') idat.push(data);
		else if (type === 'IEND') break;
		pos += 12 + len;
	}
	const raw = inflateSync(Buffer.concat(idat));
	const stride = w * bpp;
	const px = new Uint8Array(stride * h);
	for (let y = 0; y < h; y++) {
		const filter = raw[y * (stride + 1)];
		const src = y * (stride + 1) + 1;
		const row = y * stride;
		for (let x = 0; x < stride; x++) {
			const a = x >= bpp ? px[row + x - bpp] : 0;
			const b = y ? px[row - stride + x] : 0;
			const c = x >= bpp && y ? px[row - stride + x - bpp] : 0;
			let v = raw[src + x];
			if (filter === 1) v += a;
			else if (filter === 2) v += b;
			else if (filter === 3) v += (a + b) >> 1;
			else if (filter === 4) {
				const p = a + b - c;
				const pa = Math.abs(p - a);
				const pb = Math.abs(p - b);
				const pc = Math.abs(p - c);
				v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
			}
			px[row + x] = v & 255;
		}
	}
	if (bpp === 4) return px;
	const rgba = new Uint8Array(w * h * 4);
	for (let i = 0, j = 0; i < px.length; i += 3, j += 4) {
		rgba[j] = px[i];
		rgba[j + 1] = px[i + 1];
		rgba[j + 2] = px[i + 2];
		rgba[j + 3] = 255;
	}
	return rgba;
}

async function film(context, id) {
	const page = await context.newPage();
	await page.clock.install({ time: 0 });
	await page.clock.pauseAt(1000);
	await page.goto(`${ORIGIN}/showcase/scene/record?id=${encodeURIComponent(id)}`);
	const stage = await page.waitForSelector('[data-scene]', { timeout: 15000 }).catch(() => null);
	if (!stage) throw new Error(`no scene "${id}" in the catalogue`);
	await page.evaluate(() => document.fonts.ready);
	const runMs = Number(await stage.getAttribute('data-run-ms'));
	// The player fits its camera two animation frames after mount.
	await page.clock.runFor(50);

	const shots = [];
	for (let t = 0; t <= runMs; t += FRAME_MS) {
		shots.push(await page.screenshot({ type: 'png' }));
		await page.clock.runFor(FRAME_MS);
	}
	await page.close();
	return shots;
}

/** One palette for the whole GIF, so a colour never flickers between two
 *  near-identical entries; and every pixel that did not change since the last
 *  frame is written transparent, which is most of them in a scene. */
function encode(shots) {
	const sample = [];
	for (let i = 0; i < shots.length; i += 8) {
		const rgba = decodePng(shots[i]);
		for (let p = 0; p < rgba.length; p += 32) sample.push(rgba[p], rgba[p + 1], rgba[p + 2], 255);
	}
	const palette = quantize(new Uint8Array(sample), 255);
	const clear = palette.length;

	const gif = GIFEncoder();
	let prev = null;
	shots.forEach((png, i) => {
		const index = applyPalette(decodePng(png), palette);
		const out = prev ? index.map((v, p) => (v === prev[p] ? clear : v)) : index;
		gif.writeFrame(out, WIDTH, HEIGHT, {
			palette: i === 0 ? [...palette, [0, 0, 0]] : undefined,
			delay: i === shots.length - 1 ? FRAME_MS + HOLD_MS : FRAME_MS,
			transparent: i > 0,
			transparentIndex: clear,
			dispose: 1
		});
		prev = index;
	});
	gif.finish();
	return gif.bytes();
}

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: WIDTH, height: HEIGHT }, colorScheme: 'dark' });
await serveBuild(context);
await mkdir(OUT, { recursive: true });
try {
	for (const id of ids) {
		const shots = await film(context, id);
		if (STILLS) {
			await mkdir(STILLS, { recursive: true });
			const every = Math.round(1000 / FRAME_MS);
			for (let i = 0; i < shots.length; i += every)
				await writeFile(path.join(STILLS, `${id}-${String(i / every).padStart(2, '0')}s.png`), shots[i]);
		}
		const bytes = encode(shots);
		const file = path.join(OUT, `${id}.gif`);
		await writeFile(file, bytes);
		console.log(`${path.relative(ROOT, file)}  ${shots.length} frames  ${(bytes.length / 1024).toFixed(0)} KB`);
	}
} finally {
	await browser.close();
}
