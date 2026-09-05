// Count WebGL entry points per frame, by method, for one on-screen scene.
//
//   node scripts/gl-calls.mjs <url> <seconds> --sel="<css>" [--vw --vh --dpr]
//
// The GL layers in this repo are read as "expensive" or "cheap" from their
// source, and the source lies in both directions: a helper that looks like a
// binding is a string lookup across the driver boundary, and a loop that looks
// like a storm is four `uniform` calls. This counts them.
//
// `getAttribLocation`, `getUniformLocation` and every other `get*` are broken
// out first, because they are the ones that cost more than their call: they
// cross into the driver and can make it flush work it had batched. A frame with
// a thousand of them is a different animal from a frame with a thousand
// `vertexAttrib4f`.
//
// Instrumented in an init script, not after load — a context created before the
// patch lands is a context this never sees.
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
const secs = Number(positional[1] ?? 10);
const vw = num('vw', 1600);
const vh = num('vh', 1000);
const dpr = num('dpr', 2);
const sel = str('sel', '');

const browser = await chromium.launch({
	args: [
		'--use-gl=angle',
		'--use-angle=default',
		'--enable-gpu-rasterization',
		'--ignore-gpu-blocklist'
	]
});
const page = await browser.newPage({ viewport: { width: vw, height: vh }, deviceScaleFactor: dpr });
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

await page.addInitScript(() => {
	const counts = Object.create(null);
	let frames = 0;
	const proto = WebGL2RenderingContext.prototype;
	for (const name of Object.getOwnPropertyNames(proto)) {
		const desc = Object.getOwnPropertyDescriptor(proto, name);
		if (!desc || typeof desc.value !== 'function') continue;
		const fn = desc.value;
		Object.defineProperty(proto, name, {
			...desc,
			value: function (...args) {
				counts[name] = (counts[name] ?? 0) + 1;
				return fn.apply(this, args);
			}
		});
	}
	const tick = () => {
		frames++;
		requestAnimationFrame(tick);
	};
	requestAnimationFrame(tick);
	globalThis.__gl = {
		reset() {
			for (const k of Object.keys(counts)) delete counts[k];
			frames = 0;
		},
		read() {
			return { frames, counts: { ...counts } };
		}
	};
});

await page.goto(url, { waitUntil: 'networkidle' });
await page.waitForTimeout(5000);
if (sel) {
	await page.evaluate((s) => {
		document.querySelector(s)?.scrollIntoView({ block: 'center' });
	}, sel);
	// The scenes gate on an IntersectionObserver with a half-screen margin, so
	// the loop needs a moment to notice it is being looked at.
	await page.waitForTimeout(2500);
}
await page.evaluate(() => globalThis.__gl.reset());
await page.waitForTimeout(secs * 1000);

const { frames, counts } = await page.evaluate(() => globalThis.__gl.read());
const total = Object.values(counts).reduce((a, b) => a + b, 0);
const gets = Object.entries(counts).filter(([k]) => k.startsWith('get'));
const rows = Object.entries(counts)
	.sort((a, b) => b[1] - a[1])
	.slice(0, 14)
	.map(([k, v]) => `${String(Math.round(v / Math.max(frames, 1))).padStart(6)}/f  ${k}`);
console.log(
	JSON.stringify(
		{
			sel,
			frames,
			callsPerFrame: +(total / Math.max(frames, 1)).toFixed(1),
			getsPerFrame: +(gets.reduce((a, [, v]) => a + v, 0) / Math.max(frames, 1)).toFixed(1)
		},
		null,
		1
	)
);
console.log(rows.join('\n'));
await browser.close();
