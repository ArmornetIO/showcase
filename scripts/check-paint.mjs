#!/usr/bin/env node
// ── check-paint — does a colour change actually reach the model? ─────────────
// The question this answers cannot be answered by `svelte-check`, and it was
// answered wrongly once already: the surface looked dead, and the cause turned
// out to be a 500 in an unrelated component that made the whole route fail to
// render. A check that runs on the MODEL, with no layout, no chrome and no
// browser, separates "the paint seam is broken" from "the page is down".
//
// It also guards the thing most likely to rot silently: `art()` memoises on its
// whole signature, so any colour left out of that key hands back a stale figure
// for ever, and nothing else in the build would notice.
//
//   node showcase/scripts/check-paint.mjs
import { createServer } from 'vite';

const server = await createServer({
	server: { middlewareMode: true, hmr: false },
	appType: 'custom',
	logLevel: 'error'
});

try {
	const { art } = await server.ssrLoadModule('/src/lib/character/render.ts');
	const { CHARACTERS } = await server.ssrLoadModule('/src/lib/character/characters.ts');

	const who = CHARACTERS[0];
	// A loadout with something WORN, or `trim` paints nothing and passes vacuously.
	const base = { yaw: 0.62, worn: ['hat.tophat'], trim: '#F5B942' };
	const fills = (o, k = who) => art(k, o).tris.map((t) => t.fill);
	const A = fills(base);

	const cases = [
		['suit', () => fills({ ...base, suit: '#00FF00' })],
		// Plate is not an option — it is the character's own colour, so it moves
		// by handing `art()` a differently-coloured skin. Covered here because it
		// reaches the same paint map by a different door.
		['plate', () => fills(base, { ...who, color: '#FFCC00' })],
		['trim', () => fills({ ...base, trim: '#00CCFF' })],
		['lamp', () => fills({ ...base, lamp: '#FF00FF' })]
	];

	let fail = 0;
	for (const [name, run] of cases) {
		const B = run();
		const moved = B.filter((f, i) => f !== A[i]).length;
		const ok = B.length === A.length && moved > 0;
		if (!ok) fail++;
		console.log(`${ok ? 'PASS' : 'FAIL'}  ${name.padEnd(6)} ${moved}/${A.length} facets`);
	}

	const memoOk = fills({ ...base, suit: '#111111' }).join() !== fills({ ...base, suit: '#EEEEEE' }).join();
	if (!memoOk) fail++;
	console.log(`${memoOk ? 'PASS' : 'FAIL'}  memo   two suits are two figures`);

	// ── Per-part overrides ───────────────────────────────────────────────────
	// The half the first version of this check could not have caught: it only
	// asked whether a MATERIAL moved everything of that kind. These ask whether
	// one thing can move ALONE, which is the actual request.
	const only = (tints) => {
		const B = fills({ ...base, tints });
		return B.filter((f, i) => f !== A[i]).length;
	};
	const boots = only({ boot: '#FF0000' });
	const hat = only({ 'hat.tophat': '#FF0000' });
	const both = only({ boot: '#FF0000', 'hat.tophat': '#00FF00' });

	const cheap = [
		['boots alone', boots > 0 && boots < both],
		['one hat alone', hat > 0 && hat < both],
		['disjoint', boots + hat === both],
		// A tag the model does not have must not silently repaint something else.
		['unknown slot is inert', only({ nonesuch: '#FF0000' }) === 0]
	];
	for (const [name, ok] of cheap) {
		if (!ok) fail++;
		console.log(`${ok ? 'PASS' : 'FAIL'}  part   ${name}`);
	}
	console.log(`       boots=${boots} hat=${hat} both=${both} of ${A.length} facets`);

	process.exitCode = fail ? 1 : 0;
} finally {
	await server.close();
}
