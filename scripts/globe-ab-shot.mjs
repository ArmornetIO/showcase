// Screenshot the marketing hero's globe. Used to A/B the GL shell against the
// SVG one it replaced.
//
//   node scripts/globe-ab-shot.mjs <url> <out.png> [--sel=.hero-visual]
//                                  [--vw=N] [--vh=N] [--t=SECONDS] [--settle=MS]
//
// `--t` pins the scene clock before shooting instead of trusting a wall-clock
// wait. A checkpoint taken on a timer will fail parity against CORRECT code the
// moment anything in the scene is random or time-dependent, and the failure gets
// blamed on whatever changed last. Requires the page to expose a seek hook; the
// script reports whether it found one, so a silent fallback to wall-clock timing
// is visible in the output rather than assumed.
//
// Waits well past `networkidle` before shooting: SvelteKit's hydration
// navigation tears down the page context mid-measure, and the hero's globe is
// sized from a `bind:clientWidth` that is 0 until layout has settled — shoot too
// early and you capture an empty box and conclude the renderer is broken.
import { chromium } from 'playwright';

const argv = process.argv.slice(2);
const opt = (name, fallback) => {
	const hit = argv.find((a) => a.startsWith(`--${name}=`));
	return hit ? hit.slice(name.length + 3) : fallback;
};
const [url, out] = argv.filter((a) => !a.startsWith('--'));
if (!url || !out) {
	console.error(
		'usage: node scripts/globe-ab-shot.mjs <url> <out.png> [--sel=.hero-visual] [--vw=N] [--vh=N] [--t=SEC] [--settle=MS]'
	);
	process.exit(2);
}
const sel = opt('sel', '.hero-visual');
const vw = Number(opt('vw', 1440));
const vh = Number(opt('vh', 900));
const settle = Number(opt('settle', 6000));
const seekT = opt('t', null);
// A/B one build against itself. `mask`, `opacity` and `stroke` are presentation
// attributes, so a stylesheet outranks whatever the component wrote and one shot
// can wear the previous shape without checking the previous source back out.
const css = opt('css', '');

const browser = await chromium.launch({
	args: [
		'--use-gl=angle',
		'--use-angle=default',
		'--enable-gpu-rasterization',
		'--ignore-gpu-blocklist',
	],
});
const page = await browser.newPage({ viewport: { width: vw, height: vh } });
// WITHOUT THIS THE SHOT IS OF THE LOGIN PAGE. `/` redirects when unauthenticated,
// the globe never mounts, and two such shots diff clean against each other — a
// parity check that passes because it is comparing two identical empty pages.
// Same stub the repo's own e2e tests use; a catch-all `**/api/**` breaks the app.
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

const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => {
	if (m.type() === 'error') errors.push(m.text());
});

await page.goto(url, { waitUntil: 'networkidle' });
// Scroll BEFORE settling, not at screenshot time. The scenes below the fold gate
// their loop on an IntersectionObserver, so a locator screenshot that scrolls
// and shoots in the same breath catches a canvas that has not drawn a frame yet
// — a blank rectangle that diffs clean against another blank rectangle.
if (sel) {
	await page.evaluate((s) => {
		document.querySelector(s)?.scrollIntoView({ block: 'center' });
	}, sel);
}
await page.waitForTimeout(settle);

// Pin the clock if the page offers a seek hook, so the checkpoint is a named
// moment rather than "whenever the timer fired". `seeked: false` in the output
// means this fell back to wall-clock timing and the shot is NOT reproducible.
let seeked = false;
if (seekT !== null) {
	seeked = await page.evaluate((t) => {
		const seek = globalThis.__sceneSeek;
		if (typeof seek !== 'function') return false;
		seek(Number(t));
		return true;
	}, seekT);
	await page.waitForTimeout(200);
}

if (css) {
	await page.addStyleTag({ content: css });
	await page.waitForTimeout(300);
}

const visual = page.locator(sel);
const box = await visual.boundingBox();

// Assert the surface is real and sized BEFORE believing the picture. A collapsed
// wrapper renders a beautiful blank rectangle at a beautiful frame rate.
const census = await page.evaluate((s) => {
	const el = document.querySelector(s);
	const canvases = [...(el?.querySelectorAll('canvas') ?? [])].map((c) => ({
		cls: c.className,
		css: [c.clientWidth, c.clientHeight],
		buffer: [c.width, c.height],
	}));
	return {
		found: !!el,
		svgs: el?.querySelectorAll('svg').length ?? 0,
		paths: el?.querySelectorAll('path').length ?? 0,
		canvases,
		// One surface with N passes after the merge; N surfaces before it. This is
		// the figure SC-006 is read off.
		gl: globalThis.__glHealth ?? null,
	};
}, sel);

await visual.screenshot({ path: out });
console.log(
	JSON.stringify(
		{ out, sel, viewport: { vw, vh }, seekT, seeked, box, census, errors: errors.slice(0, 8) },
		null,
		2
	)
);
await browser.close();
