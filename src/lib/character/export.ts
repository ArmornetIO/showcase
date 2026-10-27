// ── character · leaving the renderer ─────────────────────────────────────────
// The posed, dressed parts `paint` would draw, written out as a mesh a CAD
// package, a slicer or Blender can open. Takes `Painted[]` rather than a
// character so a scene's pile exports the same way a figure's does.
//
// Each part stays its own closed convex shell and they overlap where the body
// does (the visor sinks into the head). Slicers union that for free; a CAD
// package imports it as a mesh body per file (STL) or per part (OBJ).
//
// Axes: X = east, Y = north, Z = up — the frame is already right-handed and
// Z-up, which is what the faces' counter-clockwise winding is correct in, so
// nothing is flipped and the outward normals survive as-is.

import type { PieceVert } from '../mesh-studio/pieces/pieces.js';
import type { Painted } from './render.js';
import type { Anchors } from './builds.js';
import { lump } from './solids.js';

/** Build units are about a metre; CAD reads a bare mesh as millimetres. At 100
 *  a figure lands ~160 mm tall — a desk-sized print. */
export const MM_PER_UNIT = 100;

type P3 = [number, number, number];

const xyz = (v: PieceVert, k: number): P3 => [v.e * k, v.n * k, v.h * k];

/** Every part as triangles. Fanning from one corner is exact only because every
 *  `Solid` face is convex — the contract `pieces.ts` makes. */
function triangles(items: readonly Painted[], k: number): P3[][] {
	const out: P3[][] = [];
	for (const { solid } of items)
		for (const f of solid.faces)
			for (let j = 1; j + 1 < f.length; j++)
				out.push([xyz(solid.verts[f[0]], k), xyz(solid.verts[f[j]], k), xyz(solid.verts[f[j + 1]], k)]);
	return out;
}

function normal([a, b, c]: P3[]): P3 | null {
	const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
	const w = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
	const n: P3 = [u[1] * w[2] - u[2] * w[1], u[2] * w[0] - u[0] * w[2], u[0] * w[1] - u[1] * w[0]];
	const len = Math.hypot(...n);
	// A chamfer cut to zero leaves coincident corners; a zero-area triangle is a
	// non-manifold complaint in every slicer and adds nothing.
	return len < 1e-9 ? null : [n[0] / len, n[1] / len, n[2] / len];
}

/** Binary STL. No colour — the format has none any CAD package agrees on. */
export function toSTL(items: readonly Painted[], k = MM_PER_UNIT): ArrayBuffer {
	const tris = triangles(items, k).flatMap((t) => {
		const n = normal(t);
		return n ? [[n, ...t]] : [];
	});
	// The 80-byte header stays zeroed: one that starts with "solid" gets read as
	// ASCII STL by a few importers.
	const dv = new DataView(new ArrayBuffer(84 + tris.length * 50));
	dv.setUint32(80, tris.length, true);
	let o = 84;
	for (const t of tris) {
		for (const x of t.flat()) {
			dv.setFloat32(o, x, true);
			o += 4;
		}
		o += 2;
	}
	return dv.buffer;
}

const rgb = (c: string) =>
	[1, 3, 5].map((i) => {
		const x = parseInt(c.slice(i, i + 2), 16);
		return Number.isNaN(x) ? '0.5' : (x / 255).toFixed(4);
	});

/**
 * Wavefront OBJ, one object per part, named for what it is.
 *
 * Colour rides as `v x y z r g b` — the vertex-colour extension Blender and
 * MeshLab read — so one file carries it. Faces are written as triangles,
 * fanned from one corner (exact, since every face is convex): OBJ allows
 * n-gons, but Creality Print rejects any face with more than four corners.
 *
 * Pass `mtl` (the material file's name, written by `toMTL`) for slicers that
 * map colours to filaments: they read `usemtl` groups, which is how a figure
 * arrives as four spools rather than one grey body.
 */
export function toOBJ(items: readonly Painted[], k = MM_PER_UNIT, mtl?: string): string {
	const lines = ['# armornet character — millimetres, Z up'];
	if (mtl) lines.push(`mtllib ${mtl}`);
	let base = 1;
	items.forEach(({ solid, color, name }, i) => {
		const c = rgb(color).join(' ');
		lines.push(`o ${name ?? 'part'}_${i}`);
		if (mtl) lines.push(`usemtl ${material(color)}`);
		for (const v of solid.verts) lines.push(`v ${xyz(v, k).map((x) => x.toFixed(3)).join(' ')} ${c}`);
		for (const f of solid.faces)
			for (let j = 1; j + 1 < f.length; j++) lines.push(`f ${f[0] + base} ${f[j] + base} ${f[j + 1] + base}`);
		base += solid.verts.length;
	});
	return lines.join('\n') + '\n';
}

const material = (color: string) => `color_${color.replace('#', '').toLowerCase()}`;

/** The material file `toOBJ(…, mtl)` points at: one diffuse colour per colour
 *  the parts use. */
export function toMTL(items: readonly Painted[]): string {
	return [...new Set(items.map((p) => p.color))]
		.map((c) => `newmtl ${material(c)}\nKd ${rgb(c).join(' ')}\n`)
		.join('\n');
}

const heights = (p: Painted) => p.solid.verts.map((v) => v.h);

/**
 * A posed figure made printable: a peg across a hover gap (the drone's body
 * otherwise starts in mid-air, an island no slicer can print) and a base under
 * the lowest point, since every build is top-heavy once it wears a hat. Both
 * are sunk a hair into what they touch so the slicer sees one body.
 */
export function printable(items: readonly Painted[], a: Anchors, color: string): Painted[] {
	const extra = (solid: Painted['solid'], name: string): Painted => ({ solid, color, emits: false, tint: 1, name });
	const out = [...items];
	const pad = items.filter((p) => p.name === 'pad');
	if (pad.length) {
		const top = Math.max(...pad.flatMap(heights));
		const body = Math.min(...items.filter((p) => p.name !== 'pad').flatMap(heights));
		const r = a.chestW * 0.25;
		if (body > top) out.push(extra(lump(r, r, top - 0.01, body + 0.01), 'peg'));
	}
	const floor = Math.min(...items.flatMap(heights));
	out.push(extra(lump(a.headW * 1.4, a.headW * 1.25, floor - 0.06, floor + 0.002), 'base'));
	return out;
}

/** Millimetres per unit that make a pile of parts `mm` tall. */
export function scaleTo(items: readonly Painted[], mm: number): number {
	const hs = items.flatMap(heights);
	return mm / (Math.max(...hs) - Math.min(...hs));
}

/**
 * Hand one file to the browser.
 *
 * The URL is revoked a minute later, not straight after the click: revoking it
 * synchronously can cancel the download before the browser has read the blob,
 * and two saves in a row then arrive as just the second file.
 */
function save(body: BlobPart, file: string, type: string) {
	const a = document.createElement('a');
	a.href = URL.createObjectURL(new Blob([body], { type }));
	a.download = file;
	a.click();
	setTimeout(() => URL.revokeObjectURL(a.href), 60_000);
}

/** Save a pile of parts as `<name>.<kind>` through the browser. */
export function downloadMesh(items: readonly Painted[], kind: 'stl' | 'obj', name: string) {
	if (kind === 'stl') save(toSTL(items), `${name}.stl`, 'model/stl');
	else save(toOBJ(items), `${name}.obj`, 'model/obj');
}

/**
 * Save a coloured mesh for a slicer: `<name>.obj` first, then its `<name>.mtl`.
 *
 * The OBJ is the file to open — it carries per-vertex colour on its own; the
 * .mtl only has to sit beside it for slicers that map colours by material. The
 * second save waits a beat so a browser that asks "allow multiple downloads?"
 * has already kept the OBJ.
 */
export function downloadColoredOBJ(items: readonly Painted[], name: string, k = MM_PER_UNIT) {
	downloadColoredOBJs([{ name, items }], name, k);
}

/**
 * One OBJ per printed piece, all sharing `<mtl>.mtl`.
 *
 * A slicer loads each file as one object and cannot split one file back into
 * its pieces: split goes by connected shells, and every convex solid here is
 * its own shell, so a single file comes apart into hundreds. Saves are spaced
 * so the browser keeps every file.
 */
export function downloadColoredOBJs(pieces: { name: string; items: readonly Painted[] }[], mtl: string, k = MM_PER_UNIT) {
	pieces.forEach(({ name, items }, i) => setTimeout(() => save(toOBJ(items, k, `${mtl}.mtl`), `${name}.obj`, 'model/obj'), i * 400));
	setTimeout(() => save(toMTL(pieces.flatMap((p) => p.items)), `${mtl}.mtl`, 'text/plain'), pieces.length * 400);
}
