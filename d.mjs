import { chromium } from 'playwright';
const b = await chromium.launch({ args: ['--force-device-scale-factor=2'] });
const p = await b.newPage({ viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 2 });
const errs = [];
p.on('pageerror', (e) => errs.push(String(e)));
p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
await p.goto('http://localhost:5173/showcase/mockups/breach-hud', { waitUntil: 'networkidle' });
await p.waitForTimeout(2600);
const box = await p.evaluate(() => {
  const el = [...document.querySelectorAll('span')].find(s => s.textContent.trim() === 'my seat');
  const panel = el?.closest('[class*="pointer-events-auto"]');
  const r = panel?.getBoundingClientRect();
  return r ? { x: r.x, y: r.y, w: r.width, h: r.height } : null;
});
console.log('panel', box);
if (box) await p.screenshot({ path: '/tmp/claude/dials.png', clip: { x: box.x - 4, y: box.y - 4, width: box.w + 8, height: Math.min(box.h + 8, 996 - box.y) } });
const dials = await p.$$('div.relative.grid');
console.log('tiles:', dials.length);
for (const [i, label] of [[2, 'resource']]) {
  if (dials[i]) { await dials[i].hover(); await p.waitForTimeout(450);
    const c = await p.locator('[role="tooltip"]').count();
    console.log(label, 'tip:', c ? (await p.locator('[role="tooltip"]').innerText()).replace(/\n/g,' | ').slice(0,150) : 'NONE'); }
}
console.log('errors:', errs.slice(0,4).join(' | ') || '(none)');
await b.close();
