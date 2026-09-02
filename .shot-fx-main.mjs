import { chromium } from 'playwright';
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 2 });
p.on('pageerror', (e) => console.log('ERR', String(e)));
p.on('console', (m) => m.type() === 'error' && console.log('CONSOLE', m.text()));
await p.goto('http://127.0.0.1:5199/showcase/mockups/logo-nanotech', { waitUntil: 'networkidle' });
// Let it play through so the spark canvas accumulates real trails, then park.
await p.waitForTimeout(4600);
await p.screenshot({ path: '/tmp/nanotech/s-live1.png' });
await p.waitForTimeout(900);
await p.screenshot({ path: '/tmp/nanotech/s-live2.png' });
await p.waitForTimeout(900);
await p.screenshot({ path: '/tmp/nanotech/s-live3.png' });
await b.close();
console.log('ok');
