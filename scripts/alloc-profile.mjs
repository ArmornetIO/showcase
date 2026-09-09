// Who is allocating? The heap gauge says the page churns megabytes per frame
// and the collector runs every few frames; this names the functions doing it.
//
// A sampling HEAP profile, not a CPU profile — the two answer different
// questions and the CPU one will happily report that everything is cheap while
// the collector it is feeding eats the frames.
//
//   node scripts/alloc-profile.mjs <url> <seconds>
import { chromium } from 'playwright';

const url = process.argv[2] ?? 'http://127.0.0.1:5208/';
const secs = Number(process.argv[3] ?? 20);

const browser = await chromium.launch({
	args: ['--use-gl=angle', '--use-angle=default', '--enable-gpu-rasterization', '--ignore-gpu-blocklist']
});
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
await page.route('**/api/auth/session*', (r) =>
	r.fulfill({
		status: 200,
		contentType: 'application/json',
		body: JSON.stringify({ subject: 'p', org_id: 'p', org_name: 'P', org_role: 'admin', authenticated: true })
	})
);
await page.goto(url, { waitUntil: 'networkidle' });
await page.waitForTimeout(5000);

const cdp = await page.context().newCDPSession(page);
await cdp.send('HeapProfiler.enable');
// 4KB sampling interval: fine enough to attribute a per-frame allocator, coarse
// enough not to become the cost it is measuring.
await cdp.send('HeapProfiler.startSampling', { samplingInterval: 4096, includeObjectsCollectedByMajorGC: true, includeObjectsCollectedByMinorGC: true });
await page.waitForTimeout(secs * 1000);
const { profile } = await cdp.send('HeapProfiler.stopSampling');

const self = new Map();
(function walk(node) {
	const f = node.callFrame;
	const bytes = node.selfSize ?? 0;
	if (bytes) {
		const where = `${f.functionName || '(anonymous)'} — ${String(f.url).split('/').pop()}:${f.lineNumber + 1}`;
		self.set(where, (self.get(where) ?? 0) + bytes);
	}
	for (const c of node.children ?? []) walk(c);
})(profile.head);

const total = [...self.values()].reduce((a, b) => a + b, 0);
console.log(`heap allocated over ${secs}s: ${(total / 1048576).toFixed(1)} MB\n`);
for (const [k, v] of [...self].sort((a, b) => b[1] - a[1]).slice(0, 25))
	console.log(`${((v / total) * 100).toFixed(1).padStart(5)}%  ${(v / 1048576).toFixed(1).padStart(7)} MB  ${k}`);

await browser.close();
