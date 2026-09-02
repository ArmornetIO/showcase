import { chromium } from 'playwright';
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1500, height: 900 } });
await p.goto('http://127.0.0.1:5180/showcase/builder', { waitUntil: 'networkidle' });
await p.waitForTimeout(1500);
const txt = await p.evaluate(() => {
  const o = document.querySelector('vite-error-overlay');
  return o?.shadowRoot?.textContent?.slice(0, 900) ?? 'none';
});
console.log(txt);
await b.close();
