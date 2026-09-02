// ── frame-bench — measure real frame times for a URL ─────────────────────────
// Scaffolding for the SVG→WebGL ports. Reports p50/p95/max and a dropped-frame
// COUNT rather than an average FPS, for the reason `perf/frame-probe.ts` spells
// out: a mean over 60 frames moves by four tenths of an FPS for a 40ms stall,
// which is invisible in the number and obvious to a hand.
//
// Frames are timed in the page from rAF, so the figure includes layout, paint
// and composite — the part that matters here, since the whole premise of these
// ports is that the cost was downstream of our own script.
//
// Usage: node scripts/frame-bench.mjs <url> [label] [seconds]

import { chromium } from 'playwright';

const url = process.argv[2];
const label = process.argv[3] ?? url;
const seconds = Number(process.argv[4] ?? 6);

if (!url) {
	console.error('usage: node scripts/frame-bench.mjs <url> [label] [seconds]');
	process.exit(1);
}

const browser = await chromium.launch({
	// The default headless GPU path falls back to SwiftShader, which would measure
	// a software rasteriser rather than the machine's. These are the flags that
	// make a headless run comparable to a real one.
	args: ['--use-gl=angle', '--use-angle=default', '--enable-gpu-rasterization', '--ignore-gpu-blocklist'],
});
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => {
	if (m.type() === 'error') errors.push(m.text());
});

await page.goto(url, { waitUntil: 'networkidle' });

// Let shaders compile, buffers upload and the first layout settle. Measuring
// through warm-up is how a port gets blamed for its own first frame.
await page.waitForTimeout(1500);

const stats = await page.evaluate(async (secs) => {
	const dts = [];
	let last = 0;
	const started = performance.now();
	await new Promise((resolve) => {
		const tick = (ts) => {
			if (last) dts.push(ts - last);
			last = ts;
			if (performance.now() - started < secs * 1000) requestAnimationFrame(tick);
			else resolve();
		};
		requestAnimationFrame(tick);
	});

	const sorted = [...dts].sort((a, b) => a - b);
	const q = (p) => sorted[Math.min(sorted.length - 1, Math.round(p * (sorted.length - 1)))] ?? 0;
	const mean = dts.reduce((a, b) => a + b, 0) / (dts.length || 1);

	return {
		frames: dts.length,
		fps: 1000 / mean,
		p50: q(0.5),
		p95: q(0.95),
		max: sorted[sorted.length - 1] ?? 0,
		// A 60Hz budget. The headline: a count of visible stutters, not a rate.
		dropped: dts.filter((d) => d > 1000 / 60 + 1).length,
		bench: window.__bench ?? null,
	};
}, seconds);

const dom = await page.evaluate(() => ({
	elements: document.getElementsByTagName('*').length,
	svgNodes: document.querySelectorAll('svg *').length,
	animate: document.querySelectorAll('animate, animateMotion, animateTransform').length,
	filtered: document.querySelectorAll('[filter]').length,
	canvases: document.querySelectorAll('canvas').length,
}));

console.log(
	JSON.stringify({ label, url, ...stats, dom, errors: errors.slice(0, 5) }, null, 2),
);

await browser.close();
