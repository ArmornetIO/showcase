import { chromium } from '/Users/toner/git/armornet/app-ui/node_modules/playwright/index.mjs';
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1600, height: 950 }, deviceScaleFactor: 3 });
await p.goto('http://127.0.0.1:5199/showcase/mockups/breach-hud', { waitUntil: 'networkidle' });
await p.waitForTimeout(4000);
await p.screenshot({ path: '.shots/bar.png', clip: { x: 365, y: 852, width: 875, height: 82 } });
await b.close();
