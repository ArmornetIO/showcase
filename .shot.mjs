import { chromium } from '/Users/toner/git/armornet/app-ui/node_modules/playwright/index.mjs';
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1600, height: 950 } });
p.on('pageerror', e => console.log('PAGEERROR:', e.message));
p.on('console', m => { if (m.type() === 'error') console.log('CONSOLE:', m.text()); });
await p.goto(process.argv[2], { waitUntil: 'networkidle' });
await p.waitForTimeout(Number(process.argv[4] ?? 4000));
await p.screenshot({ path: process.argv[3] });
await b.close();
