#!/usr/bin/env node
/**
 * gen-favicon.mjs
 *
 * Emits the tab icon for every app in this repo, from the one component that
 * decides what the logo IS.
 *
 * A favicon has to be a FILE — the browser fetches a URL for it, so
 * `<ArmornetLogo>` cannot serve one — and every app bundles its own assets, so
 * there is no single file three apps can share. That is three copies of the
 * mark on disk, and hand-cutting them is exactly the "three votes on the logo"
 * ArmornetLogo.svelte exists to prevent: the next silhouette tweak wins the one
 * a human remembers to re-export and the other two quietly become a different
 * product's icon.
 *
 * So the copies are DERIVED. The shield choice comes from `LOGO_SHAPE` and the
 * geometry from `CREST_MESH_GEOMETRY`, both read out of the components
 * themselves, and `--check` fails the build when a written file has drifted
 * from what they currently say.
 *
 * The module script of ArmornetCrestMesh.svelte is plain TypeScript with no
 * imports, so it is transpiled and executed rather than read as an AST — unlike
 * gen-api.mjs, the values wanted here are computed (mitred inner walls, fitted
 * figure transforms), not literals sitting in the source.
 *
 * What this file DOES decide is the favicon's treatment, and it is deliberately
 * not the component's defaults. All three came out of looking at the thing at
 * 16, 20, 24, 32 and 48px on a dark and a light tab strip:
 *
 *   · `filled`, not `outline`. Drawn in line, the figure's three ringed
 *     satellites are a 0.5 stroke around a radius-1 counter — both far under a
 *     pixel at 16px — and the interior silts into one blob, which is the exact
 *     failure CRESTLINK_SPOKES' own comment describes. Filled, the shield is a
 *     solid the browser can always resolve and the figure is knocked THROUGH
 *     it, so what silts up is the hole and the mark keeps its silhouette. It
 *     also needs no ground: the tab strip shows through the counters, which is
 *     what the component's docs say the inverse is for.
 *   · glow off — a 0.7 blur under a 16px mark is a smear the width of the mark.
 *   · inner wall off — the component's own docs say to drop it below ~32px.
 *
 * Usage:  node scripts/gen-favicon.mjs [--check]
 */

import ts from 'typescript';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { pathToFileURL } from 'node:url';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const showcase = resolve(__dirname, '..');
const repo = resolve(showcase, '..');

const check = process.argv.includes('--check');

// ── The mark's colour, baked ─────────────────────────────────────────────────
// A favicon is fetched as a standalone document: no stylesheet, so no
// `var(--accent)`. This is the dark theme's `--accent` from tokens.css, and it
// is one of the few places in this repo a token is duplicated as a literal for
// a reason other than first paint. One colour only — the mark is monochrome and
// the knockouts are transparent.
const ACCENT = '#5eead4';

// The mark's weight AT TAB SIZE, which is not the component's 0.5. This is an
// optical size, the same idea as a type family cutting a heavier face for small
// text: at 16px the counters between the figure and the shield wall close up,
// and opening them costs stroke. Wall and figure move together, so the "one
// weight for both" rule the component states still holds.
const WEIGHT = 0.8;

// ── Where each app keeps its own icon ────────────────────────────────────────
// Three apps, three bundlers, three asset conventions — the console imports it
// as a module, showcase serves it from static/, BREACH from public/. Adding an
// app means adding a line here.
const TARGETS = [
	'app-ui/src/lib/assets/favicon.svg',
	'showcase/static/favicon.svg',
	'showcase/examples/breach/public/favicon.svg'
];

/** Run a .svelte file's `<script module>` as a module and return its exports. */
async function moduleScript(file) {
	const src = readFileSync(file, 'utf8');
	const m = src.match(/<script[^>]*\bmodule\b[^>]*>([\s\S]*?)<\/script>/);
	if (!m) throw new Error(`no <script module> in ${file}`);
	const js = ts.transpileModule(m[1], {
		compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext }
	}).outputText;
	const tmp = join(mkdtempSync(join(tmpdir(), 'gen-favicon-')), 'mod.mjs');
	writeFileSync(tmp, js);
	return import(pathToFileURL(tmp).href);
}

const mesh = await moduleScript(resolve(showcase, 'src/lib/icons/ArmornetCrestMesh.svelte'));
// ArmornetLogo's module script imports the mesh, which the transpiled copy
// cannot resolve — and the only thing wanted from it is the shape name, which
// is a literal. Read it rather than run it.
const logoSrc = readFileSync(resolve(showcase, 'src/lib/icons/ArmornetLogo.svelte'), 'utf8');
const shapeMatch = logoSrc.match(/LOGO_SHAPE:\s*CrestMeshShape\s*=\s*'([^']+)'/);
if (!shapeMatch) throw new Error('LOGO_SHAPE not found in ArmornetLogo.svelte');
const shape = shapeMatch[1];

const g = mesh.CREST_MESH_GEOMETRY[shape];
if (!g) throw new Error(`LOGO_SHAPE '${shape}' is not a shape in CREST_MESH_GEOMETRY`);

const outline = mesh.outlinePath(g);
const fit = mesh.fitTransform(g);
const { CRESTLINK_SPOKES, CRESTLINK_NODES, CRESTLINK_HUB, CRESTLINK_NODE_R, CRESTLINK_HUB_R } =
	mesh;

// Stroked with NO fill, so each satellite cuts a RING and leaves its own centre
// solid — the hollow dot the outline variant draws, read the other way round.
const nodes = CRESTLINK_NODES.map(
	([cx, cy]) => `\t\t\t\t<circle cx="${cx}" cy="${cy}" r="${CRESTLINK_NODE_R}" />`
).join('\n');

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-1 -1 26 26" width="64" height="64" role="img" aria-labelledby="t">
	<title id="t">Armornet</title>

	<!--
		GENERATED by showcase/scripts/gen-favicon.mjs. Do not edit — run
		\`npm run gen:favicon\` in showcase/ instead.

		The '${shape}' shield and the crestlink figure inside it come from
		ArmornetCrestMesh.svelte, which is where the logo is decided. This is the
		mark's inverse cut heavier, because it is read at 16px on whatever colour
		a browser paints its tab strip; the generator says why.
	-->

	<defs>
		<!-- White keeps, black cuts. -->
		<mask id="cut" maskUnits="userSpaceOnUse" x="-1" y="-1" width="26" height="26">
			<rect x="-1" y="-1" width="26" height="26" fill="#fff" />
			<g transform="${fit}" fill="none" stroke="#000" stroke-width="${WEIGHT}" stroke-linecap="round" stroke-linejoin="round">
				<path d="${CRESTLINK_SPOKES}" />
${nodes}
				<circle cx="${CRESTLINK_HUB[0]}" cy="${CRESTLINK_HUB[1]}" r="${CRESTLINK_HUB_R}" fill="#000" />
			</g>
		</mask>
	</defs>

	<path d="${outline}" fill="${ACCENT}" stroke="${ACCENT}" stroke-width="${WEIGHT}" stroke-linejoin="round" mask="url(#cut)" />
</svg>
`;

let drift = false;
for (const t of TARGETS) {
	const path = resolve(repo, t);
	const current = (() => {
		try {
			return readFileSync(path, 'utf8');
		} catch {
			return null;
		}
	})();
	if (current === svg) continue;
	if (check) {
		console.error(`favicon drift: ${relative(repo, path)}`);
		drift = true;
	} else {
		writeFileSync(path, svg);
		console.log(`favicon → ${relative(repo, path)}`);
	}
}

if (drift) {
	console.error('\nRun `npm run gen:favicon` in showcase/ and commit the result.');
	process.exit(1);
}
