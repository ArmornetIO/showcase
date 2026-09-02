// ── agent-select · turning a figure into paths ───────────────────────────────
// Cull, shade, sort. All three are `pieceFacets` from `mesh-studio/pieces` —
// the same pass the globe's buildings and the breach board's characters go
// through — so this file only supplies the camera, the palette, and a frame to
// crop to. Two copies of a cull are two culls that drift.

import { pieceFacets, pieceProjector, studioFrame } from '../mesh-studio/pieces/piece-facets.js';
import type { PieceVert } from '../mesh-studio/pieces/pieces.js';
import type { TangentFrame } from '../physics/sphere.js';
import { figure, type Material } from './builds.js';
import type { Solid } from '../mesh-studio/pieces/pieces.js';
import type { CharacterSkin } from './characters.js';
import { poseKey, REST, type Pose } from './poses.js';

/** `pieceFacets` rounds its path coordinates to two decimals, which is plenty
 *  at node size and far too coarse for a model a metre and a half tall in unit
 *  space — an arm 0.05 wide would quantise to five steps. So the whole figure
 *  is drawn at a hundred to one and the viewBox is in those units. */
const STEP = 100;

/** How the figure is looked at, and what it is painted in.
 *
 *  Defaults, not constants: the select screen wants one fixed three-quarter
 *  view for every character, and the studio wants to turn one around. Turned a
 *  touch off axis so the visor keeps its own plane, tilted a touch down so the
 *  figure is looked AT rather than up to. */
export interface ArtOpts {
	/** Radians about the vertical. */
	yaw?: number;
	/** Radians, camera tilt. */
	pitch?: number;
	/** The shared suit — one grey across all four characters; see `builds.ts`. */
	suit?: string;
	/** What the figure is doing. Omitted means standing still. */
	pose?: Pose;
	/** Overrides the visor and hover pad — see `status.ts`. Omitted keeps the
	 *  character's own plate colour, so nothing has to opt in to a default. */
	lamp?: string | null;
	/** Lamp brightness. Below 1 the lights are going out. */
	glow?: number;
}

export const DEFAULT_ART = {
	yaw: 0.62,
	pitch: 0.11,
	suit: '#46536B',
	pose: REST,
	lamp: null as string | null,
	glow: 1
};

/**
 * Swing a solid about a height, in the plane that runs front-to-back.
 *
 * Applied to the geometry rather than to the drawn path on purpose: a limb
 * rotated after projection would keep the depth it had at rest, and the arm
 * that swung forward would still sort behind the torso it is now in front of.
 * Posing before the cull is what makes the painter's pass stay honest.
 */
function swing(s: Solid, angle: number, pivot: number): Solid {
	if (!angle) return s;
	const c = Math.cos(angle);
	const k = Math.sin(angle);
	return {
		faces: s.faces,
		verts: s.verts.map((v) => {
			const dh = v.h - pivot;
			return { e: v.e, n: v.n * c + dh * k, h: pivot - v.n * k + dh * c };
		})
	};
}

const lift = (s: Solid, dh: number): Solid =>
	dh ? { faces: s.faces, verts: s.verts.map((v) => ({ ...v, h: v.h + dh })) } : s;

/** Move a solid along the arc its pivot would swing it through, WITHOUT
 *  turning it — the ankle a rigid figure does not have. See `Part.rigid`. */
function orbit(s: Solid, angle: number, pivot: number): Solid {
	if (!angle) return s;
	const n = s.verts.reduce((a, v) => a + v.n, 0) / s.verts.length;
	const h = s.verts.reduce((a, v) => a + v.h, 0) / s.verts.length;
	const dh = h - pivot;
	const c = Math.cos(angle);
	const k = Math.sin(angle);
	const dn = n * c + dh * k - n;
	const dz = pivot - n * k + dh * c - h;
	return { faces: s.faces, verts: s.verts.map((v) => ({ e: v.e, n: v.n + dn, h: v.h + dz })) };
}

/** `band()` hands back three hard values. They are the right STEPS — a smooth
 *  ramp at node size turns to mush — but they sit close together for a subject
 *  this large, so the top and bottom are pulled apart. */
const EXPOSURE: Record<string, number> = { '1': 1.05, '0.76': 0.66, '0.54': 0.34 };

const clamp = (x: number) => Math.max(0, Math.min(255, Math.round(x)));
const hex = (c: string): [number, number, number] => [
	parseInt(c.slice(1, 3), 16),
	parseInt(c.slice(3, 5), 16),
	parseInt(c.slice(5, 7), 16)
];

/** Lit colour for a face. The unlit end is DARK and slightly blue rather than a
 *  paler version of the character's colour: a solid whose shadow side is the
 *  same hue at lower brightness reads as a flat sticker, which is the one thing
 *  drawing it in facets was meant to avoid. */
function shade(color: string, k: number): string {
	const [r, g, b] = hex(color);
	const t = Math.max(0, Math.min(1.35, k));
	return `rgb(${clamp(r * t + 9)},${clamp(g * t + 13)},${clamp(b * t + 26)})`;
}

/** The visor. Its own colour, not the body's — a light source is the one thing
 *  on the model that is not being lit by something else. */
function lamp(color: string, k: number): string {
	const [r, g, b] = hex(color);
	const m = (c: number) => clamp(c * 0.62 + 255 * 0.44 * k);
	return `rgb(${m(r)},${m(g)},${m(b)})`;
}

export interface Tri {
	d: string;
	fill: string;
	edge: string;
	glow: boolean;
}

/**
 * Every visible face of one character, back to front, in whatever frame it is
 * handed.
 *
 * Split out of `art()` because there is now more than one camera looking at a
 * figure. The select screen looks at it in a `studioFrame`; breach's
 * first-person scene stands the same character on a plot and looks at it in the
 * NODE's tangent frame, so it is lit by the key light the building beside it is
 * lit by and leans the way its ground leans. Same geometry, same three
 * materials, a different way of looking — and a second assembler of one figure
 * is how the roster and the board stop being the same four characters.
 */
export function figureFacets(
	k: CharacterSkin,
	frame: TangentFrame,
	opts: Pick<ArtOpts, 'suit' | 'pose' | 'lamp' | 'glow'> = {}
): Tri[] {
	const { suit, pose, glow } = { ...DEFAULT_ART, ...opts };
	// Identity stays the plate; only the emitting surface takes the status.
	const lamped = opts.lamp ?? k.color;

	const paint = new Map<Material, (band: number, tint: number) => [string, string]>([
		['suit', (b, t) => [shade(suit, b * t), shade(suit, b * t * 0.4)]],
		['plate', (b, t) => [shade(k.color, b * t), shade(k.color, b * t * 0.4)]],
		['lamp', (_b, t) => [lamp(lamped, t * glow), lamp(lamped, t * glow)]]
	]);

	const rows: Array<{ tri: Tri; depth: number }> = [];
	for (const part of figure(k.shape)) {
		// Pose first, then project. The bob rides everything; the swing only the
		// part that carries a limb tag.
		const turn = part.rigid ? orbit : swing;
		const posed = lift(
			part.limb ? turn(part.solid, pose[part.limb], part.pivot ?? 0) : part.solid,
			pose.bob
		);
		for (const f of pieceFacets([posed], frame)) {
			const [fill, edge] = paint.get(part.mat)!(EXPOSURE[String(f.shade)] ?? f.shade, part.tint);
			rows.push({ tri: { d: f.d, fill, edge, glow: part.mat === 'lamp' }, depth: f.depth });
		}
	}

	// `pieceFacets` sorts within one solid; merging several needs the same order
	// applied across all of them. +z is toward the viewer, so ascending is far
	// first, which is the order a painter works in.
	rows.sort((a, b) => a.depth - b.depth);
	return rows.map((r) => r.tri);
}

export interface Rect {
	x: number;
	y: number;
	w: number;
	h: number;
}

export interface Art {
	/** Back to front. A painter's pass is the whole hidden-surface problem. */
	tris: Tri[];
	/** The whole figure, padded. */
	box: Rect;
	/** Head and a little shoulder — what a tile wears. */
	bust: Rect;
	/** Where the feet are, for the ground shadow. */
	floor: number;
	/** The colour the figure is EMITTING, after any status override. What the
	 *  ground glow and any surrounding stage should pick up — a figure lit red
	 *  standing in its own pink pool is two states at once. */
	lamp: string;
}

const cache = new Map<string, Art>();

/** Everything visible for one character, in paint order.
 *
 *  Memoised on the whole signature rather than the character's key: a studio
 *  that turns the model re-enters with the same key and a different camera, and
 *  a key-only cache would hand back the first angle for ever. */
export function art(k: CharacterSkin, opts: ArtOpts = {}): Art {
	const { yaw, pitch, suit, pose, glow } = { ...DEFAULT_ART, ...opts };
	// Identity stays the plate; only the emitting surface takes the status.
	const lamped = opts.lamp ?? k.color;
	const id = `${k.key}|${k.color}|${suit}|${lamped}|${glow.toFixed(2)}|${yaw.toFixed(3)}|${pitch.toFixed(3)}|${poseKey(pose)}`;
	const hit = cache.get(id);
	if (hit) return hit;
	// One clip is 24 frames; a few characters, angles and tunings on top of that
	// is still small. Past this the entries are a tuning session nobody is
	// coming back to, and holding them is a leak rather than a cache.
	if (cache.size > 600) cache.clear();

	const frame = studioFrame(yaw, pitch, STEP);
	const project = pieceProjector(frame);
	const tris = figureFacets(k, frame, { suit, pose, lamp: lamped, glow });

	let x0 = Infinity;
	let x1 = -Infinity;
	let y0 = Infinity;
	let y1 = -Infinity;

	const grow = (v: PieceVert) => {
		const p = project(v);
		if (p.x < x0) x0 = p.x;
		if (p.x > x1) x1 = p.x;
		if (p.y < y0) y0 = p.y;
		if (p.y > y1) y1 = p.y;
	};

	// Bounds come from the REST geometry, never from the posed frame. A box
	// measured per frame breathes with the walk, and a figure whose framing
	// rescales every tick reads as the camera lurching rather than the character
	// moving. The swing margin below covers what a limb can reach.
	for (const part of figure(k.shape)) part.solid.verts.forEach(grow);

	// Breathing room, plus the furthest a swinging limb or a bobbing body can
	// travel out of the rest silhouette. Generous on purpose: a clip cropping its
	// own foot at the extremes of the cycle is the failure mode here.
	const pad = 0.06 * STEP + 0.16 * STEP;
	const w = x1 - x0 + pad * 2;
	const bw = w * 0.82;
	const out: Art = {
		tris,
		box: { x: x0 - pad, y: y0 - pad, w, h: y1 - y0 + pad * 2 },
		bust: { x: (x0 + x1) / 2 - bw / 2, y: y0 - 0.05 * STEP, w: bw, h: bw * 0.92 },
		floor: y1,
		lamp: lamped
	};
	cache.set(id, out);
	return out;
}
