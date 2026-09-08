// Watch the marketing page for the intermittent rotation stutter.
//
// Loads the page with `hitch-watch` armed, holds it for a while, and prints
// every late frame the watch reported plus the summary. The point is the
// attribution columns, not the count: a late frame with no longtask is not our
// JS, and a heap drop across one is the collector.
//
//   node scripts/hitch-capture.mjs <url> <seconds> [--vw=N] [--vh=N] [--no-scroll]
//
// `--vw`/`--vh` exist for the fill-rate discriminator: capture once at the
// reference size, once at half of it, and compare late-frame counts. Fill-rate
// scales with pixel count; a display adaptively changing its own refresh rate
// does not. Without a viewport argument the two runs are the same run.
import { chromium } from 'playwright';

const argv = process.argv.slice(2);
const flag = (name, fallback) => {
	const hit = argv.find((a) => a.startsWith(`--${name}=`));
	return hit ? Number(hit.slice(name.length + 3)) : fallback;
};
const positional = argv.filter((a) => !a.startsWith('--'));

const url = positional[0] ?? 'http://127.0.0.1:5207/?preview&hitch';
const secs = Number(positional[1] ?? 120);
const vw = flag('vw', 1600);
const vh = flag('vh', 1000);
// Headless Chromium reports devicePixelRatio 1. Without this, any measurement of
// a density CLAMP is a no-op measuring nothing — `Math.min(1, ceiling)` is 1 —
// and the run-to-run noise gets mistaken for the change.
const dpr = flag('dpr', 1);
// The scroll half-way through is right for the marketing page and wrong for a
// held single-viewport scene, where it throws away half the capture.
const scroll = !argv.includes('--no-scroll');

const browser = await chromium.launch({
	args: [
		'--use-gl=angle',
		'--use-angle=default',
		'--enable-gpu-rasterization',
		'--ignore-gpu-blocklist',
		// The heap gauge the watch reads for GC detection is behind this.
		'--enable-precise-memory-info'
	]
});
const page = await browser.newPage({
	viewport: { width: vw, height: vh },
	deviceScaleFactor: dpr
});
console.log(
	`viewport ${vw}x${vh} · dpr ${dpr} · ${vw * vh} css px · ${vw * vh * dpr * dpr} device px · ${secs}s`
);

// The pattern the repo's own e2e tests use. A catch-all `**/api/**` stub breaks
// the app and measures a blank page.
await page.route('**/api/auth/session*', (r) =>
	r.fulfill({
		status: 200,
		contentType: 'application/json',
		body: JSON.stringify({
			subject: 'p',
			org_id: 'p',
			org_name: 'P',
			org_role: 'admin',
			authenticated: true
		})
	})
);

const lines = [];
page.on('console', (m) => {
	const t = m.text();
	if (t.includes('[hitch]') || t.includes('[gl:')) {
		lines.push(t);
		console.log(t);
	}
});

await page.goto(url, { waitUntil: 'networkidle' });
// SvelteKit hydration navigation destroys an evaluate context mid-measure.
await page.waitForTimeout(5000);

// Believe nothing until the thing under test is actually on screen and sized.
const census = await page.evaluate(() => {
	const c = [...document.querySelectorAll('canvas')].map((el) => {
		const r = el.getBoundingClientRect();
		return `${el.className || '(no class)'} ${Math.round(r.width)}x${Math.round(r.height)}`;
	});
	return { canvases: c, elements: document.querySelectorAll('*').length, watching: !!globalThis.__hitch?.enabled };
});
console.log('census', JSON.stringify(census, null, 1));

if (scroll) {
	// The pipeline scene is below the fold and its loop is gated on an
	// IntersectionObserver, so half the capture is spent where the user saw it.
	await page.waitForTimeout((secs * 1000) / 2);
	await page.evaluate(() => document.querySelector('canvas.pipeline, [class*=pipeline]')?.scrollIntoView({ block: 'center' }));
	await page.waitForTimeout((secs * 1000) / 2);
} else {
	await page.waitForTimeout(secs * 1000);
}

console.log('\n=== summary ===');
console.log(await page.evaluate(() => globalThis.__hitch.report()));
// Machine-readable, so two runs at two viewports can be compared without
// re-reading prose. `hitchesPerSec` is the discriminator's actual figure.
const snap = await page.evaluate(() => {
	const s = globalThis.__hitch.snapshot();
	return {
		frames: s.frames, period: s.period, p50: s.p50, p95: s.p95, max: s.max,
		hitches: s.hitches, gcHitches: s.gcHitches, alloc: s.alloc,
		loops: s.loops, gl: globalThis.__glHealth ?? null
	};
});
console.log('\n=== snapshot ===');
console.log(JSON.stringify({ viewport: { vw, vh }, cssPx: vw * vh,
	hitchesPerSec: +(snap.hitches / secs).toFixed(3), ...snap }, null, 1));
const rows = await page.evaluate(() => globalThis.__hitch.hitches);
console.log(JSON.stringify(rows, null, 1));
await browser.close();
