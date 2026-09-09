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

await page.goto(`${base}/mockups/breach-verdict`, { waitUntil: 'networkidle' });
await page.waitForTimeout(2200);

const caseButton = (n) => page.getByRole('button', { name: /seat ·/ }).nth(n);

if (only !== 'crest') {
	for (let i = 0; i < 4; i++) {
		// The switcher sits over the overlay, so a case is one click away with the
		// screen up — no dismissing, no reload.
		if (i > 0) await caseButton(i).click();
		await page.waitForTimeout(1800);
		await page.screenshot({ path: `${out}-over-${i + 1}.png` });
	}
}

// The gallery is behind the screen; the bar's own toggle takes it away.
await page.getByRole('button', { name: /hide the screen/ }).click();
await page.waitForTimeout(600);
const gallery = page.locator('div.flex.flex-wrap.items-end').first();
await gallery.screenshot({ path: `${out}-crest.png` });

console.log(errs.length ? `ERRORS:\n${errs.join('\n')}` : 'no console errors');
await browser.close();
