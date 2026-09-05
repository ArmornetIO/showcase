// ── perf/attribute — name the function under one longtask ────────────────────
//
//   node scripts/perf/attribute.mjs \
//     --scenario=marketing-mesh-cluster \
//     --url=http://127.0.0.1:5541 [--hold=25000] [--top=25]
//
// `compare.mjs` says a 250ms task happened; this says what was on the stack.
//
// THE SAME SCENARIO, OR IT IS A DIFFERENT EXPERIMENT. Viewport, scroll target,
// settle and hold all come from `perf-scenarios/` for the same reason
// `compare.mjs` takes them from there: a script that re-types them profiles a
// page adjacent to the one the comparison convicted, and the two then disagree
// for a reason nobody can find. Only `--hold` may be overridden, because a
// profile is heavier than a measurement and a shorter one is sometimes enough.
//
// THE WINDOW IS THE WHOLE PROBLEM. A one-shot task that fires ~12s after a
// scroll is 1.5% of a 15s profile and reads as noise, and a 4s window opened at
// the scroll catches steady state instead. So: profile the entire hold, ask the
// page when the longtask actually was, and slice the samples to it afterwards.
// The window is then positioned by measurement rather than by guess.
import { chromium } from 'playwright';
import { SESSION, CHROME_ARGS, loadScenario, scrollAndAssert } from './run.mjs';

const argv = process.argv.slice(2);
const opt = (n, d) => {
	const hit = argv.find((a) => a.startsWith(`--${n}=`));
	return hit ? hit.slice(n.length + 3) : d;
};

const url = opt('url', 'http://127.0.0.1:5411').replace(/\/$/, '');
const scenario = await loadScenario(opt('scenario', 'marketing-hero'));
const holdMs = Number(opt('hold', scenario.holdMs));
const top = Number(opt('top', 25));

const { width, height, dpr } = scenario.viewport;
const browser = await chromium.launch({ args: CHROME_ARGS });
const page = await browser.newPage({
	viewport: { width, height },
	// Headless Chromium reports devicePixelRatio 1, and every cost that matters
	// here scales with pixels — see the same note in `run.mjs`.
	deviceScaleFactor: dpr
});
if (scenario.auth === 'stub-session') {
	await page.route('**/api/auth/session*', (r) =>
		r.fulfill({
			status: 200,
			contentType: 'application/json',
			body: JSON.stringify(SESSION)
		})
	);
}

// Longtasks are collected page-side because `PerformanceObserver` is the only
// thing that agrees with what `compare.mjs` reports; a profile can show a busy
// stretch the browser never counted as a task.
await page.addInitScript(() => {
	globalThis.__lt = [];
	new PerformanceObserver((l) => {
		for (const e of l.getEntries())
			globalThis.__lt.push({ start: e.startTime, dur: e.duration, name: e.name });
	}).observe({ entryTypes: ['longtask'] });
});

let profile, tasks, t0;
try {
	await page.goto(url + scenario.path, { waitUntil: 'networkidle' });
	await page.waitForTimeout(scenario.settleMs);
	await scrollAndAssert(page, scenario, url);

	const cdp = await page.context().newCDPSession(page);
	await cdp.send('Profiler.enable');
	// 60µs, not the 1ms default: a 250ms task is ~4000 samples instead of 250,
	// which is the difference between a named callee and a flat wall of
	// `(program)`.
	await cdp.send('Profiler.setSamplingInterval', { interval: 60 });
	t0 = await page.evaluate(() => performance.now());
	await cdp.send('Profiler.start');
	await page.waitForTimeout(holdMs);
	({ profile } = await cdp.send('Profiler.stop'));
	tasks = await page.evaluate(() => globalThis.__lt);
} finally {
	await browser.close();
}

// ── slice ────────────────────────────────────────────────────────────────────
const byId = new Map(profile.nodes.map((n) => [n.id, n]));
const parent = new Map();
for (const n of profile.nodes) for (const c of n.children ?? []) parent.set(c, n.id);

// Profiler timestamps are microseconds on the same monotonic clock as
// `performance.now()`, but with a different origin. `t0` was read immediately
// before `Profiler.start`, so profile.startTime is that instant.
const toPageMs = (usec) => t0 + (usec - profile.startTime) / 1000;

const times = [];
let t = profile.startTime;
for (const d of profile.timeDeltas) {
	t += d;
	times.push(t);
}

const label = (n) =>
	`${n.callFrame.functionName || '(anonymous)'}  ${(n.callFrame.url || '').split('/').pop()}:${n.callFrame.lineNumber + 1}`;

function report(title, lo, hi) {
	const self = new Map();
	let n = 0;
	for (let i = 0; i < profile.samples.length; i++) {
		const ms = toPageMs(times[i]);
		if (ms < lo || ms > hi) continue;
		n++;
		const node = byId.get(profile.samples[i]);
		if (!node) continue;
		const k = label(node);
		self.set(k, (self.get(k) ?? 0) + 1);
	}
	const span = hi - lo;
	console.log(
		`\n── ${title}  [${lo.toFixed(0)}..${hi.toFixed(0)}ms page time, ${span.toFixed(0)}ms, ${n} samples]`
	);
	if (!n) {
		console.log('  no samples in this window');
		return [];
	}
	const rows = [...self].sort((a, b) => b[1] - a[1]).slice(0, top);
	for (const [k, c] of rows) {
		console.log(
			`  ${((c / n) * 100).toFixed(1).padStart(5)}%  ${((c / n) * span).toFixed(0).padStart(5)}ms  ${k}`
		);
	}
	return rows;
}

// A stack for the heaviest non-idle leaf: the self-time winner of a burst is
// often a generic callee, and its caller is the thing to fix.
function stackOf(name, lo, hi) {
	for (let i = 0; i < profile.samples.length; i++) {
		const ms = toPageMs(times[i]);
		if (ms < lo || ms > hi) continue;
		const node = byId.get(profile.samples[i]);
		if (!node || label(node) !== name) continue;
		const out = [];
		let id = node.id;
		while (id !== undefined) {
			out.push(label(byId.get(id)));
			id = parent.get(id);
		}
		return out;
	}
	return [];
}

console.log(
	`scenario "${scenario.name}" on ${url} — ${profile.samples.length} samples, ` +
		`${((profile.endTime - profile.startTime) / 1e6).toFixed(1)}s`
);
console.log(`longtasks (page time ms):`);
for (const x of tasks) console.log(`  start=${x.start.toFixed(0)} dur=${x.dur.toFixed(0)} name=${x.name}`);

const inWindow = tasks.filter((x) => x.start > t0 && x.dur >= 50);
if (!inWindow.length) {
	console.log('\nNO longtask inside the profiled window — nothing to attribute.');
	report('whole profile', t0, t0 + holdMs);
} else {
	const worst = inWindow.sort((a, b) => b.dur - a.dur)[0];
	// Padded: the observer's `startTime` and the sampler's clock are close but
	// not identical, and a window that misses the task by 30ms attributes idle.
	const lo = worst.start - 120;
	const hi = worst.start + worst.dur + 120;
	const rows = report(`worst longtask (${worst.dur.toFixed(0)}ms)`, lo, hi);
	report('steady state (task excluded)', t0 + 1000, worst.start - 500);
	if (rows[0]) {
		console.log(`\nstack for ${rows[0][0]}:`);
		for (const [i, f] of stackOf(rows[0][0], lo, hi).entries())
			console.log(`  ${'  '.repeat(i)}← ${f}`);
	}
}
