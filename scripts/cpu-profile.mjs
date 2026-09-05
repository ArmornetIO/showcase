// Where is the main thread actually spending time?
//
// Self-time by function, from a CDP sampling profile. Read this AFTER
// `dom-churn.mjs` says the page is not rewriting the DOM — a canvas that repaints
// itself every frame writes no attributes and is invisible to the observer, and
// this is the instrument that sees it.
//
// Reading the result: `(program)` is native, GPU or idle. `getBoundingClientRect`
// and `setAttribute` high means layout thrash — go back to the churn probe.
// Named GL calls mean a per-frame driver round-trip.
//
// Profile a PRODUCTION build for honest numbers: in dev, Svelte's `get_stack`
// instrumentation has measured 34% of a profile, and it does not exist in prod.
// Profile a dev build when you need readable names.
//
//   node scripts/cpu-profile.mjs <url> [seconds] [--auth] [--cookie name=value]
import { chromium } from 'playwright';

const args = process.argv.slice(2);
const url = args[0];
const secs = Number(args[1] ?? 10);
const cookieArg = args.includes('--cookie') ? args[args.indexOf('--cookie') + 1] : null;
if (!url) {
	console.error('usage: node scripts/cpu-profile.mjs <url> [seconds] [--auth] [--cookie n=v]');
	process.exit(2);
}

const browser = await chromium.launch({
	args: ['--use-gl=angle', '--use-angle=default', '--enable-gpu-rasterization', '--ignore-gpu-blocklist']
});
const context = await browser.newContext({ viewport: { width: 1600, height: 1000 } });
if (cookieArg) {
	const i = cookieArg.indexOf('=');
	const u = new URL(url);
	await context.addCookies([
		{ name: cookieArg.slice(0, i), value: cookieArg.slice(i + 1), domain: u.hostname, path: '/' }
	]);
}
const page = await context.newPage();
if (args.includes('--auth'))
	await page.route('**/api/auth/session*', (r) =>
		r.fulfill({
			status: 200,
			contentType: 'application/json',
			body: JSON.stringify({ subject: 'p', org_id: 'p', org_name: 'P', org_role: 'admin', authenticated: true })
		})
	);

await page.goto(url, { waitUntil: 'networkidle' });
await page.waitForTimeout(5000);

const cdp = await context.newCDPSession(page);
await cdp.send('Profiler.enable');
await cdp.send('Profiler.setSamplingInterval', { interval: 100 });
await cdp.send('Profiler.start');
await page.waitForTimeout(secs * 1000);
const { profile } = await cdp.send('Profiler.stop');

const byId = new Map(profile.nodes.map((n) => [n.id, n]));
const self = new Map();
for (const id of profile.samples ?? []) {
	const n = byId.get(id);
	if (!n) continue;
	const f = n.callFrame;
	const file = String(f.url).split('/').pop() || f.url || '';
	const k = `${f.functionName || '(anonymous)'}${file ? ' — ' + file.split('?')[0] + ':' + (f.lineNumber + 1) : ''}`;
	self.set(k, (self.get(k) ?? 0) + 1);
}
const total = [...self.values()].reduce((a, b) => a + b, 0) || 1;
console.log(`${total} samples over ${secs}s\n`);
for (const [k, v] of [...self].sort((a, b) => b[1] - a[1]).slice(0, 25))
	console.log(`${((v / total) * 100).toFixed(1).padStart(5)}%  ${k}`);

await browser.close();
