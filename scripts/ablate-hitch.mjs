// Attribute the marketing page's hitch to a PART of the hero, without editing it.
//
//   node scripts/ablate-hitch.mjs <url> <seconds> --css="<rule>" [--vw --vh --dpr]
//
// Two things it does that `hitch-capture.mjs` does not, and both change the
// number enough to matter:
//
//  · It resets the watch after the page has settled, so the figure is the
//    STEADY STATE. `hitch-capture` divides every hitch since the watch armed by
//    the capture window, which folds hydration, font swap and GL init into a
//    per-second rate for a page that had long since stopped doing them.
//  · It ablates with CSS rather than DOM surgery. `mask`, `stroke`, `opacity`
//    and `display` are presentation attributes, so a stylesheet outranks
//    whatever the component wrote and keeps outranking it as Svelte re-renders;
//    stripping attributes only holds until the next mount.
//
// The ablation is a discriminator, not a fix: it says which part of the picture
// the cost is in, and nothing about what the part should become.
import { chromium } from 'playwright';

const argv = process.argv.slice(2);
const num = (n, d) => {
	const hit = argv.find((a) => a.startsWith(`--${n}=`));
	return hit ? Number(hit.slice(n.length + 3)) : d;
};
const str = (n, d) => {
	const hit = argv.find((a) => a.startsWith(`--${n}=`));
	return hit ? hit.slice(n.length + 3) : d;
};
const positional = argv.filter((a) => !a.startsWith('--'));
const url = positional[0];
const secs = Number(positional[1] ?? 40);
const vw = num('vw', 1600);
const vh = num('vh', 1000);
// Headless Chromium reports devicePixelRatio 1, and every cost here scales with
// pixels. Without this the run measures a different page than the viewer has.
const dpr = num('dpr', 2);
const css = str('css', '');
// Bring a below-the-fold scene on screen before the window opens. Half these
// loops gate on an IntersectionObserver, so measuring them from the top of the
// page measures a scene that is deliberately doing nothing.
const scrollTo = str('scroll', '');

const browser = await chromium.launch({
	args: [
		'--use-gl=angle',
		'--use-angle=default',
		'--enable-gpu-rasterization',
		'--ignore-gpu-blocklist',
		'--enable-precise-memory-info'
	]
});
const page = await browser.newPage({ viewport: { width: vw, height: vh }, deviceScaleFactor: dpr });
// The pattern the repo's own e2e tests use. `/` redirects when unauthenticated,
// and a capture of the login page is a beautifully quiet one.
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
await page.goto(url, { waitUntil: 'networkidle' });
await page.waitForTimeout(5000);

if (scrollTo) {
	await page.evaluate((s) => {
		document.querySelector(s)?.scrollIntoView({ block: 'center' });
	}, scrollTo);
	await page.waitForTimeout(2500);
}
if (css) {
	await page.addStyleTag({ content: css });
	await page.waitForTimeout(1500);
}
await page.evaluate(() => globalThis.__hitch.reset?.());
await page.waitForTimeout(secs * 1000);

const snap = await page.evaluate(() => {
	const s = globalThis.__hitch.snapshot();
	return { frames: s.frames, hitches: s.hitches, gcHitches: s.gcHitches, alloc: s.alloc };
});
console.log(JSON.stringify({ css, hitchesPerSec: +(snap.hitches / secs).toFixed(3), ...snap }, null, 1));
await browser.close();
