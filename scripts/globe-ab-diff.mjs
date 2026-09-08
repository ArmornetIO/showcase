// Compare two PNGs by decoding them in a headless browser (no image dep).
//
// The A/B half of `globe-ab-shot.mjs`: capture the hero once per renderer, then
// diff. Everything in that scene is dark on dark, so a screenshot pair proves
// nothing by eye — the GL port's first draft looked "about right" beside the SVG
// and was in fact missing its whole graticule. That showed up here as a mean of
// 3.95 against 0.48 for the fixed one.
//
// Do NOT try to isolate the globe by hiding its siblings first. The page's
// gradients live in a sibling <svg>'s <defs>, and `fill: url(#…)` cannot reach a
// paint server inside a `display: none` subtree — hiding them silently strips
// the SVG side's body and invents a difference that is not there.
//
//   node scripts/globe-ab-diff.mjs <a.png> <b.png>
import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';

const [a, b] = process.argv.slice(2);
const enc = (p) => readFileSync(p).toString('base64');

const browser = await chromium.launch();
const page = await browser.newPage();
const out = await page.evaluate(
	async ([da, db]) => {
		const load = (d) =>
			new Promise((res) => {
				const i = new Image();
				i.onload = () => res(i);
				i.src = 'data:image/png;base64,' + d;
			});
		const ia = await load(da);
		const ib = await load(db);
		const grab = (img) => {
			const c = document.createElement('canvas');
			c.width = img.width;
			c.height = img.height;
			const x = c.getContext('2d');
			x.drawImage(img, 0, 0);
			return x.getImageData(0, 0, c.width, c.height).data;
		};
		const pa = grab(ia);
		const pb = grab(ib);
		const W = ia.width;
		// Sample a grid of points and report both images' luminance side by side,
		// so a missing layer shows up as a column of difference rather than a
		// single scalar that averages it away.
		const at = (px, x, y) => {
			const i = (y * W + x) * 4;
			return Math.round(0.2126 * px[i] + 0.7152 * px[i + 1] + 0.0722 * px[i + 2]);
		};
		const probes = {
			'outside globe (left)': [200, 700],
			'left limb edge': [578, 353],
			'inside near left limb': [640, 353],
			'globe mid-left': [800, 353],
			'globe centre': [1152, 353],
			'top-right backdrop': [1350, 60],
			'below shield': [1150, 600],
			'globe lower edge': [1152, 820],
		};
		const rows = {};
		for (const [k, [x, y]] of Object.entries(probes))
			rows[k] = { gl: at(pa, x, y), svg: at(pb, x, y) };
		let diff = 0;
		let n = 0;
		for (let i = 0; i < pa.length; i += 4 * 37) {
			diff += Math.abs(pa[i] - pb[i]) + Math.abs(pa[i + 1] - pb[i + 1]) + Math.abs(pa[i + 2] - pb[i + 2]);
			n++;
		}
		return { size: [ia.width, ia.height], rows, meanAbsDiff: +(diff / n / 3).toFixed(2) };
	},
	[enc(a), enc(b)],
);
console.log(JSON.stringify(out, null, 2));
await browser.close();
