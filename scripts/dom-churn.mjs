// What is the page REWRITING, and how often?
//
// The highest-yield instrument in the box, and the one that finds bugs reading
// the code cannot: a `MutationObserver` counting attribute writes per second,
// keyed by element and attribute. `52496/s path[d]` is a finding; `0/s` clears a
// component no matter how expensive it looks.
//
// Rough scale: anything in the tens of thousands per second is the answer.
//
//   node scripts/dom-churn.mjs <url> [seconds] [--auth]
import { chromium } from 'playwright';

const url = process.argv[2];
const secs = Number(process.argv[3] ?? 5);
const auth = process.argv.includes('--auth');
if (!url) {
	console.error('usage: node scripts/dom-churn.mjs <url> [seconds] [--auth]');
	process.exit(2);
}

const browser = await chromium.launch({
	args: ['--use-gl=angle', '--use-angle=default', '--enable-gpu-rasterization', '--ignore-gpu-blocklist']
});
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
if (auth)
	await page.route('**/api/auth/session*', (r) =>
		r.fulfill({
			status: 200,
			contentType: 'application/json',
			body: JSON.stringify({ subject: 'p', org_id: 'p', org_name: 'P', org_role: 'admin', authenticated: true })
		})
	);
await page.goto(url, { waitUntil: 'networkidle' });
// SvelteKit's hydration navigation destroys the evaluate context mid-measure.
await page.waitForTimeout(5000);

const out = await page.evaluate(async (ms) => {
	const attrs = new Map();
	const nodes = { added: 0, removed: 0, text: 0 };
	const key = (t, a) => {
		const cls = (t.getAttribute?.('class') || '')
			.split(' ').filter((c) => c && !c.startsWith('svelte-')).slice(0, 3).join('.');
		return `${t.tagName?.toLowerCase() ?? '?'}${cls ? '.' + cls : ''}[${a}]`;
	};
	const o = new MutationObserver((ms_) => {
		for (const m of ms_) {
			if (m.type === 'attributes') {
				const k = key(m.target, m.attributeName);
				attrs.set(k, (attrs.get(k) ?? 0) + 1);
			} else if (m.type === 'characterData') nodes.text++;
			else {
				nodes.added += m.addedNodes.length;
				nodes.removed += m.removedNodes.length;
			}
		}
	});
	o.observe(document.body, { attributes: true, childList: true, characterData: true, subtree: true });
	await new Promise((r) => setTimeout(r, ms));
	o.disconnect();
	return {
		nodes,
		attrs: [...attrs].sort((a, b) => b[1] - a[1]).slice(0, 20),
		canvases: [...document.querySelectorAll('canvas')].length,
		svgs: [...document.querySelectorAll('svg')].length,
		paths: [...document.querySelectorAll('path')].length,
		elements: document.querySelectorAll('*').length
	};
}, secs * 1000);

console.log(`census: ${out.elements} elements · ${out.svgs} svg · ${out.paths} path · ${out.canvases} canvas`);
console.log(`nodes/s: +${(out.nodes.added / secs).toFixed(0)} -${(out.nodes.removed / secs).toFixed(0)} · text ${(out.nodes.text / secs).toFixed(0)}/s\n`);
for (const [k, n] of out.attrs) console.log(`${(n / secs).toFixed(0).padStart(8)}/s  ${k}`);
if (!out.attrs.length) console.log('  no attribute writes at all — nothing here is DOM-driven');

await browser.close();
