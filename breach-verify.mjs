import { chromium } from 'playwright';

const logs = [], errors = [], reqs = [];
const browser = await chromium.launch();
const page = await browser.newPage();
page.on('console', (m) => logs.push(`${m.type()}: ${m.text()}`));
page.on('pageerror', (e) => errors.push(String(e)));
page.on('response', (r) => { if (/\.wasm|wasm_exec/.test(r.url())) reqs.push(`${r.status()} ${r.url().split('/').pop()}`); });

const shot = (n) => page.screenshot({ path: `/tmp/claude/breach-${n}.png` });

await page.goto('http://127.0.0.1:5299/', { waitUntil: 'networkidle' });
await page.waitForTimeout(1200);

await page.getByRole('button', { name: /play alone/i }).click();
await page.waitForTimeout(1500);
await shot('a-seats');

// Whatever the seat picker offers.
const names = await page.locator('button').allInnerTexts();
console.log('--- buttons after Play alone ---');
console.log(names.map((t) => t.replace(/\s+/g, ' ').slice(0, 60)).filter(Boolean).join('\n'));

// Pick a side, then whatever the next screen asks for, up to four steps.
// Matched on the side's tagline: the button's text begins with whitespace, so
// an anchored /^RED/ never matches what innerText actually contains.
await page.locator('button', { hasText: 'Get in. Stay in.' }).first().click();
await page.waitForTimeout(1200);
await shot('a2-after-side');

for (let step = 0; step < 4; step++) {
  const texts = await page.locator('button:visible').allInnerTexts();
  console.log(`--- step ${step} visible buttons ---`);
  console.log(texts.map((t) => t.replace(/\s+/g, ' ').slice(0, 50)).filter(Boolean).join(' | '));
  const next = page.locator('button:visible', {
    hasText: /maintainer|handler|take|enter|sit|confirm|deal|begin|start|ready|play/i
  }).first();
  if (!(await next.count())) break;
  await next.click().catch(() => {});
  await page.waitForTimeout(1800);
  if (typeof (await page.evaluate(() => globalThis.breachRules)) !== 'undefined') break;
}
await page.waitForTimeout(5000);
await shot('b-table');

const state = await page.evaluate(() => ({
  breachRules: typeof globalThis.breachRules,
  version: globalThis.breachRules?.version ?? null,
  engineState: globalThis.breachRules ? JSON.parse(globalThis.breachRules.state()) : null,
  hardeningArchive: globalThis.breachRules ? globalThis.breachRules.hardening('archive') : null,
  text: document.body.innerText.replace(/\s+/g, ' ').slice(0, 260)
}));

console.log('--- wasm requests ---'); console.log(reqs.join('\n') || '(none)');
console.log('--- page errors ---'); console.log(errors.join('\n') || '(none)');
console.log('--- console (breach/wasm/error) ---');
console.log(logs.filter((l) => /breach|wasm|rules|error/i.test(l) && !/\[vite\]/.test(l)).slice(0, 20).join('\n') || '(none)');
console.log('--- state ---'); console.log(JSON.stringify(state, null, 2));
await browser.close();
