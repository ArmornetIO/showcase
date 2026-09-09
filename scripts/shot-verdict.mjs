// One-off: shoot the BREACH end screen and its crest gallery.
import { chromium } from 'playwright';

const base = process.argv[2] ?? 'http://localhost:5188/showcase';
const out = process.argv[3] ?? '/tmp/verdict';
const only = process.argv[4] ?? 'all';

const browser = await chromium.launch();
const page = await browser.newPage({
	viewport: { width: 1500, height: 950 },
	deviceScaleFactor: 2
});
const errs = [];
page.on('console', (m) => m.type() === 'error' && errs.push(m.text()));
page.on('pageerror', (e) => errs.push(String(e)));

await page.goto(`${base}/examples/breach/verdict`, { waitUntil: 'networkidle' });
await page.waitForTimeout(2200);

if (only !== 'crest') {
	await page.screenshot({ path: `${out}-over.png` });
	// The case buttons sit under the overlay's scrim, so the screen has to go
	// before the next case can be picked.
	for (let i = 1; i < 4; i++) {
		await page.evaluate(() => {
			document.querySelectorAll('.fixed.inset-0').forEach((n) => n.remove());
		});
		await page.evaluate((n) => {
			[...document.querySelectorAll('button')]
				.filter((b) => /seat ·/.test(b.textContent ?? ''))
				[n]?.click();
		}, i);
		await page.waitForTimeout(1800);
		await page.screenshot({ path: `${out}-over-${i + 1}.png` });
	}
	await page.reload({ waitUntil: 'networkidle' });
	await page.waitForTimeout(1500);
}

// The gallery lives under the overlay's scrim.
await page.keyboard.press('Escape');
await page.evaluate(() => {
	document.querySelectorAll('.fixed.inset-0.z-\\[80\\]').forEach((n) => n.remove());
});
await page.waitForTimeout(400);
const gallery = page.locator('div.flex.flex-wrap.items-end').first();
await gallery.screenshot({ path: `${out}-crest.png` });

console.log(errs.length ? `ERRORS:\n${errs.join('\n')}` : 'no console errors');
await browser.close();
