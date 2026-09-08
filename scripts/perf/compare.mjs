// ── perf/compare — N builds, one scenario, one verdict ───────────────────────
//
//   node scripts/perf/compare.mjs \
//     --scenario=marketing-hero \
//     --target="A=http://127.0.0.1:5401" \
//     --target="B=http://127.0.0.1:5402" \
//     [--repeats=3] [--gl] [--dom] [--json=out.json]
//
// Two rules are baked in because this project learned both the hard way.
//
// INTERLEAVED, NOT BATCHED. Targets run A,B,A,B — never A,A,B,B. A laptop that
// warms up, a fan that spins late, another process that starts halfway through:
// batched runs turn every one of those into "B is slower", and the conclusion
// looks exactly like a real regression.
//
// THE NOISE BAND IS MEASURED, NOT REMEMBERED. The repo's own figure is ±6%, and
// it lives in a handoff document that the next person will not have read. Here
// the spread across a target's own repeats IS the band, and a delta inside it is
// reported as "noise" rather than as a result. A perf tool that cannot say "no
// difference" will find a difference every time it is run.
import { runOnce, loadScenario } from './run.mjs';

const argv = process.argv.slice(2);
const opt = (n, d) => {
	const hit = argv.find((a) => a.startsWith(`--${n}=`));
	return hit ? hit.slice(n.length + 3) : d;
};
const targets = argv
	.filter((a) => a.startsWith('--target='))
	.map((a) => a.slice('--target='.length))
	.map((s) => {
		const i = s.indexOf('=');
		if (i < 0) throw new Error(`--target needs NAME=URL, got "${s}"`);
		return { name: s.slice(0, i), url: s.slice(i + 1).replace(/\/$/, '') };
	});

const scenarioName = opt('scenario', 'marketing-hero');
const repeats = Number(opt('repeats', 3));
const jsonOut = opt('json', '');
const wantGl = argv.includes('--gl');
const wantDom = argv.includes('--dom');
// Diagnostic counters perturb the frame numbers they sit beside — see probe.js.
// Opt in when you want the count, and do not quote frame times from that run.
const wantRect = argv.includes('--rect');

if (targets.length < 2) {
	console.error('need at least two --target=NAME=URL');
	process.exit(2);
}

const scenario = await loadScenario(scenarioName);

// ── metrics ─────────────────────────────────────────────────────────────────
// `dir` is which way is better. Getting this wrong turns a win into a
// regression in the report, silently, and nobody re-reads a table they trust.
const METRICS = [
	{ key: 'fps', label: 'fps', dir: 'up' },
	{ key: 'latePerSec', label: 'late frames/s', dir: 'down' },
	{ key: 'frameMs.p95', label: 'frame p95 (ms)', dir: 'down' },
	{ key: 'frameMs.max', label: 'frame max (ms)', dir: 'down' },
	{ key: 'rectCallsPerFrame', label: 'forced-layout reads/frame', dir: 'down' },
	{ key: 'glCallsPerFrame', label: 'GL calls/frame', dir: 'down' },
	{ key: 'domWritesPerSec', label: 'DOM attr writes/s', dir: 'down' }
];

const dig = (o, k) => k.split('.').reduce((a, p) => (a == null ? a : a[p]), o);
const median = (xs) => {
	const s = [...xs].sort((a, b) => a - b);
	return s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2;
};
/** Half the full spread, as a fraction of the median. The honest band for three
 *  samples — a standard deviation over n=3 implies a confidence this does not
 *  have. */
const spread = (xs) => {
	const m = median(xs);
	if (!m) return 0;
	return (Math.max(...xs) - Math.min(...xs)) / 2 / Math.abs(m);
};

const runs = new Map(targets.map((t) => [t.name, []]));

console.log(
	`scenario "${scenario.name}" · ${scenario.viewport.width}x${scenario.viewport.height} dpr ${scenario.viewport.dpr} · ` +
		`${scenario.holdMs / 1000}s hold · ${repeats} interleaved repeats\n`
);

for (let r = 0; r < repeats; r++) {
	for (const t of targets) {
		process.stdout.write(`  pass ${r + 1}/${repeats}  ${t.name} … `);
		const res = await runOnce(t.url, scenario, { gl: wantGl, dom: wantDom, rect: wantRect });
		runs.get(t.name).push(res);
		process.stdout.write(`${res.fps} fps, ${res.latePerSec} late/s\n`);
	}
}

// ── report ──────────────────────────────────────────────────────────────────
const base = targets[0];
console.log(`\n${'metric'.padEnd(28)}${targets.map((t) => t.name.padStart(14)).join('')}   vs ${base.name}`);
console.log('─'.repeat(28 + targets.length * 14 + 12));

const verdicts = [];
for (const m of METRICS) {
	const vals = new Map(
		targets.map((t) => [t.name, runs.get(t.name).map((r) => dig(r, m.key)).filter((v) => v != null)])
	);
	if ([...vals.values()].some((v) => v.length === 0)) continue;

	const meds = new Map([...vals].map(([n, v]) => [n, median(v)]));
	const bands = new Map([...vals].map(([n, v]) => [n, spread(v)]));
	const baseMed = meds.get(base.name);

	const cells = targets.map((t) => String(+meds.get(t.name).toFixed(2)).padStart(14)).join('');

	// The band to judge against is the noisier of the two being compared —
	// claiming a result inside the quieter one's spread is claiming precision
	// that only one side has.
	let note = '';
	for (const t of targets.slice(1)) {
		const med = meds.get(t.name);
		const band = Math.max(bands.get(base.name), bands.get(t.name), 0.02);
		const delta = baseMed === 0 ? 0 : (med - baseMed) / Math.abs(baseMed);
		const better = m.dir === 'up' ? delta > 0 : delta < 0;
		const pct = (delta * 100).toFixed(1);
		if (Math.abs(delta) <= band) {
			note = `${pct}% (noise, ±${(band * 100).toFixed(1)}%)`;
			verdicts.push({ metric: m.label, target: t.name, delta, band, verdict: 'noise' });
		} else {
			note = `${pct}% ${better ? 'BETTER' : 'WORSE'}`;
			verdicts.push({
				metric: m.label,
				target: t.name,
				delta,
				band,
				verdict: better ? 'better' : 'worse'
			});
		}
	}
	console.log(`${m.label.padEnd(28)}${cells}   ${note}`);
}

// Surfaces stay in the report because a merge or a density change moves them and
// nothing else in the table would say so.
console.log('\nsurfaces');
for (const t of targets) {
	const cs = runs.get(t.name)[0].canvases;
	const gl = cs.filter((c) => c.ratio && c.ratio > 1.05).length;
	console.log(
		`  ${t.name.padEnd(6)} ${cs.length} canvas (${gl} above 1.05x density), ${runs.get(t.name)[0].elements} elements` +
			(runs.get(t.name)[0].hasAppWatch ? ', app watch present' : '')
	);
}

const better = verdicts.filter((v) => v.verdict === 'better').length;
const worse = verdicts.filter((v) => v.verdict === 'worse').length;
console.log(
	`\n${better} metric(s) better, ${worse} worse, ${verdicts.length - better - worse} inside the noise band.`
);

if (jsonOut) {
	const { writeFile } = await import('node:fs/promises');
	await writeFile(
		jsonOut,
		JSON.stringify({ scenario: scenario.name, repeats, targets, verdicts, runs: [...runs] }, null, 1)
	);
	console.log(`json → ${jsonOut}`);
}
