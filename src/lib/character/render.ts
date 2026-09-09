// ── agent-select · turning a figure into paths ───────────────────────────────
// Cull, shade, sort. All three are `pieceFacets` from `mesh-studio/pieces` —
// the same pass the globe's buildings and the breach board's characters go
// through — so this file only supplies the camera, the palette, and a frame to
// crop to. Two copies of a cull are two culls that drift.

import { pieceFacets, pieceProjector, studioFrame } from '../mesh-studio/pieces/piece-facets.js';
import type { PieceVert } from '../mesh-studio/pieces/pieces.js';
import type { TangentFrame } from '../physics/sphere.js';
import { type Material } from './builds.js';
import { lift, orbit, swing } from './solids.js';
import { measure } from './builds.js';
import { assemble, wearable, wornKey, type Anchor } from './wearables.js';
import type { Solid } from '../mesh-studio/pieces/pieces.js';
import type { CharacterSkin, Shape } from './characters.js';
import { poseKey, REST, type Pose } from './poses.js';
import { crestParts, type CrestOpts } from './crest.js';

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
	/** What the figure has ON — keys into `wearables.WEARABLES`. Worn items are
	 *  assembled into the same part list the body is, so they turn, sort, shade
	 *  and pose with it. */
	worn?: readonly string[];
	/** Which build the worn items are CUT for — see `assemble`. Omitted means
	 *  the wearer's own, which is the only answer anything dressing itself
	 *  wants; set it to put a figure in clothes made for somebody else. */
	wornFit?: Shape;
	/** The hue worn items fly in — the PLAYER's colour, not the class's plate.
	 *  A hat belongs to the account; the shoulders under it do not. */
	trim?: string;
	/**
	 * Per-thing colour overrides, keyed by body tag (`boot`, `visor`, `hood`…)
	 * or by worn item key (`hat.tophat`, `emblem.star`).
	 *
	 * The four material colours above are the BROADCAST — change `suit` and
	 * every suit-material mass moves together, which is what you want when you
	 * are dressing a squad. This is the exception to it, for when you want one
	 * boot red. Most specific wins: item, then body tag, then material.
	 *
	 * Sparse on purpose. An absent key is not "no colour", it is "whatever the
	 * material says", so the map only ever holds what somebody deliberately
	 * changed — and resetting a part is a delete rather than a lookup of what it
	 * used to be.
	 */
	tints?: Readonly<Record<string, string>>;
	/**
	 * A hexagonal ring to stand the character in — see `crest.ts`.
	 *
	 * It rides in HERE, rather than being drawn around the figure by whoever is
	 * placing it, because the only thing that can decide whether the rim is in
	 * front of a shoulder is the depth sort, and the depth sort lives on this
	 * side of the wall. A crest painted afterwards in CSS can only cut, and
	 * cutting is what put a flat edge through the side of every head.
	 */
	crest?: CrestOpts | null;
}

export const DEFAULT_ART = {
	yaw: 0.62,
	pitch: 0.11,
	suit: '#46536B',
	pose: REST,
	lamp: null as string | null,
	glow: 1,
	worn: [] as readonly string[],
	trim: '#F5B942',
	tints: {} as Readonly<Record<string, string>>,
	crest: null as CrestOpts | null
};

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

/**
 * Fill in what the caller left out — and treat "left out" as including
 * `undefined`.
 *
 * `{ ...DEFAULT_ART, ...opts }` is the obvious spelling and it is wrong for an
 * options bag whose every field is optional: a key present with the value
 * `undefined` OVERRIDES the default rather than falling back to it. Callers
 * write that shape constantly — `art(k, { pose: walking ? clip : undefined })`
 * — and it crashed in `poseKey`, several frames from the call that caused it.
 */
function settings(
	opts: ArtOpts
	// `wornFit` is out of the `Required` set beside `lamp`, and for a stronger
	// reason: `lamp` has a default of `null`, and this has no expressible default
	// at all. Absent means "whatever build is wearing them", which is not a
	// `Shape` — naming one here would be picking a body for everybody who did not
	// ask. Read straight off `opts` where it is used.
): Required<Omit<ArtOpts, 'lamp' | 'wornFit'>> & { lamp: string | null; wornFit?: Shape } {
	const out = { ...DEFAULT_ART };
	for (const [k, v] of Object.entries(opts)) {
		if (v !== undefined) (out as Record<string, unknown>)[k] = v;
	}
	return out;
}

export interface Tri {
	d: string;
	fill: string;
	edge: string;
	glow: boolean;
	/** Out-of-focus radius in the same units `d` is drawn in. 0 is sharp. */
	blur: number;
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
	opts: Pick<ArtOpts, 'suit' | 'pose' | 'lamp' | 'glow' | 'worn' | 'wornFit' | 'trim' | 'tints' | 'crest'> = {}
): Tri[] {
	return paint(figureParts(k, opts), frame, settings(opts).glow);
}

/**
 * One solid, with its colour already decided.
 *
 * The unit the painter works in, and deliberately dumber than a `Part`: no
 * material, no tag, no limb. Everything that needs to know what a mass IS has
 * finished by the time this exists, which is what lets a figure, a crest and a
 * building on the same card go through one sort without the painter learning
 * three vocabularies.
 */
export interface Painted {
	solid: Solid;
	color: string;
	/** A light source — lit by nothing, so it skips the shading bands. */
	emits: boolean;
	/** Albedo the mass carries within its own colour. */
	tint: number;
	/**
	 * Throw it out of focus, in world units.
	 *
	 * Carried per THING rather than computed from depth, because focus is a
	 * composition decision and not a fact about the geometry: two objects the
	 * same distance away are not always both meant to be soft, and the subject
	 * of a shot is whatever the shot says it is.
	 */
	blur?: number;
}

/**
 * Cull, shade and depth-sort a pile of solids into paths.
 *
 * The whole hidden-surface problem, and the reason a scene can hold more than
 * one character: `pieceFacets` sorts WITHIN one solid, so anything drawn from
 * several has to re-sort across all of them, once, here. Two things sorted
 * separately and concatenated are two things that cannot pass in front of each
 * other — which is a figure standing permanently in front of a wall it is
 * supposed to be behind.
 */
export function paint(items: readonly Painted[], frame: TangentFrame, glow = 1): Tri[] {
	const rows: Array<{ tri: Tri; depth: number }> = [];
	for (const it of items) {
		for (const f of pieceFacets([it.solid], frame)) {
			const b = EXPOSURE[String(f.shade)] ?? f.shade;
			const t = it.tint;
			// Worn items are lit exactly like the body — same bands, same shadow
			// end. That equality is the point: a hat shaded by any other rule is
			// the sticker this replaced, wearing a different hat. An emitter is
			// the one exception, because it is not being lit by anything.
			const [fill, edge] = it.emits
				? [lamp(it.color, t * glow), lamp(it.color, t * glow)]
				: [shade(it.color, b * t), shade(it.color, b * t * 0.4)];
			rows.push({
				tri: { d: f.d, fill, edge, glow: it.emits, blur: it.blur ?? 0 },
				depth: f.depth
			});
		}
	}

	// +z is toward the viewer, so ascending is far first — the order a painter
	// works in.
	rows.sort((a, b) => a.depth - b.depth);
	return rows.map((r) => r.tri);
}

/**
 * One character's masses, posed and coloured, in the character's OWN space.
 *
 * Stops short of projecting so that a scene can move them first. A figure that
 * only exists as finished paths is a figure that can only ever stand at the
 * origin, and a card wants two of them a pace apart.
 */
export function figureParts(
	k: CharacterSkin,
	opts: Pick<ArtOpts, 'suit' | 'pose' | 'lamp' | 'glow' | 'worn' | 'wornFit' | 'trim' | 'tints' | 'crest'> = {}
): Painted[] {
	const { suit, pose, worn, trim, tints, crest } = settings(opts);
	// Identity stays the plate; only the emitting surface takes the status.
	const lamped = opts.lamp ?? k.color;

	/** What a material means, before anything overrides it. */
	const material: Record<Material, string> = { suit, plate: k.color, lamp: lamped, trim };

	/** The colour of one part. Most specific source wins: the item's own colour,
	 *  then its body mass's, then the material it is made of. */
	const colorOf = (part: { mat: Material; tag?: string; owner?: string }) =>
		(part.owner && tints[part.owner]) || (part.tag && tints[part.tag]) || material[part.mat];

	// The crest joins the SAME list, so it is culled, shaded, projected and —
	// the only part that matters — depth-sorted against the body rather than
	// composited over it. It is scenery rather than anatomy, so it is never
	// posed and never measured; `art` takes its bounds off `assemble` alone,
	// which is what stops a ring around a character from reframing them.
	const scene = [
		...assemble(k.shape, worn, opts.wornFit),
		...(crest ? crestParts(k.shape, crest) : [])
	];
	return scene.map((part) => {
		// Pose first, then project. The bob rides everything; the swing only the
		// part that carries a limb tag.
		const turn = part.rigid ? orbit : swing;
		return {
			solid: lift(
				part.limb ? turn(part.solid, pose[part.limb], part.pivot ?? 0) : part.solid,
				pose.bob
			),
			// Resolved once per part rather than per facet — a part has one colour
			// and two hundred faces.
			color: colorOf(part),
			emits: part.mat === 'lamp',
			tint: part.tint
		};
	});
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
	/**
	 * Where each anchor lands on screen, in the same units as `box`.
	 *
	 * Published by the renderer because the renderer is the only thing that
	 * knows: it owns the camera. A surface that wants "clicking the head selects
	 * headwear" would otherwise place its hit boxes at hand-picked percentages of
	 * the figure — which is the `HEAD_Y = 0.50` mistake again, one layer up, and
	 * would silently stop pointing at the head the moment anybody turned the
	 * model.
	 */
	hit: Partial<Record<Anchor, Rect>>;
	/** The colour the figure is EMITTING, after any status override. What the
	 *  ground glow and any surrounding stage should pick up — a figure lit red
	 *  standing in its own pink pool is two states at once. */
	lamp: string;
}

const cache = new Map<string, Art>();

/** The override map as one stable string. Sorted, because `{boot:'#f00'}` and
 *  the same map built in another order are the same figure and must not be
 *  cached twice — and because an unsorted key would miss on every re-render
 *  that happened to enumerate differently. */
const tintKey = (t: Readonly<Record<string, string>>) =>
	Object.keys(t)
		.sort()
		.map((k) => `${k}:${t[k]}`)
		.join(',');

/** Everything visible for one character, in paint order.
 *
 *  Memoised on the whole signature rather than the character's key: a studio
 *  that turns the model re-enters with the same key and a different camera, and
 *  a key-only cache would hand back the first angle for ever. */
export function art(k: CharacterSkin, opts: ArtOpts = {}): Art {
	const { yaw, pitch, suit, pose, glow, worn, trim, tints, crest } = settings(opts);
	// Identity stays the plate; only the emitting surface takes the status.
	const lamped = opts.lamp ?? k.color;
	// The worn set and its colour are IN the signature, and have to be: this
	// cache is keyed on everything that changes a pixel, so a loadout left out
	// of it would hand back the figure wearing the previous hat for ever.
	const id = `${k.key}|${k.color}|${suit}|${lamped}|${glow.toFixed(2)}|${yaw.toFixed(3)}|${pitch.toFixed(3)}|${poseKey(pose)}|${wornKey(worn)}|${opts.wornFit ?? ''}|${trim}|${tintKey(tints)}|${crest ? JSON.stringify(crest) : ''}`;
	const cached = cache.get(id);
	if (cached) return cached;
	// One clip is 24 frames; a few characters, angles and tunings on top of that
	// is still small. Past this the entries are a tuning session nobody is
	// coming back to, and holding them is a leak rather than a cache.
	if (cache.size > 600) cache.clear();

	const frame = studioFrame(yaw, pitch, STEP);
	const project = pieceProjector(frame);
	const tris = figureFacets(k, frame, {
		suit,
		pose,
		lamp: lamped,
		glow,
		worn,
		trim,
		tints,
		// The camera's own yaw, so a crest squares up to the VIEW rather than to
		// the character's north. Filled in here because this is the only level
		// that knows both — the call site asks for a crest, not for an angle.
		crest: crest && { face: yaw, ...crest }
	});

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
	//
	// DRESSED, not bare. A top hat stands half a head above the crown and a halo
	// above that; measuring the body alone crops both off at every size, and at
	// the bust and chip crops it beheads them.
	// Hoisted above the bounds passes: both of them need the shoulder line, and
	// the hit rects further down need the same measurements.
	const a = measure(k.shape);
	const dressed = assemble(k.shape, worn, opts.wornFit);
	for (const part of dressed) part.solid.verts.forEach(grow);

	// ── The bust, measured from the head and not from the figure ────────────
	// The bust used to be derived from the whole silhouette's width, which was
	// harmless while a figure was only a body — and wrong the moment it could
	// hold things. A card out at arm's length widened the box, the bust widened
	// with it, and the portrait became a small head in the corner of a mostly
	// empty hex.
	//
	// So it is measured from the head and WHAT IS WORN ON THE HEAD, which is the
	// literal definition of the shot. Two rules, because body and worn parts
	// fail differently: a body mass qualifies by being above the shoulder, and a
	// worn item qualifies by being anchored to the head. Height alone is not
	// enough — a card held at chest height reaches past the shoulder line, which
	// is exactly the bug this replaced.
	//
	// This pass now sets the frame's CENTRE and its TOP only. Its width used to
	// come from here too, and that is what let headwear resize its wearer; see
	// the skull measurement below.
	let hx0 = Infinity;
	let hx1 = -Infinity;
	let hy0 = Infinity;
	for (const part of dressed) {
		const anchor = part.owner ? wearable(part.owner)?.anchor : undefined;
		if (part.owner && anchor !== 'crown' && anchor !== 'brow') continue;
		for (const v of part.solid.verts) {
			if (!part.owner && v.h < a.shoulder) continue;
			const pt = project(v);
			if (pt.x < hx0) hx0 = pt.x;
			if (pt.x > hx1) hx1 = pt.x;
			if (pt.y < hy0) hy0 = pt.y;
		}
	}

	// Breathing room, plus the furthest a swinging limb or a bobbing body can
	// travel out of the rest silhouette. Generous on purpose: a clip cropping its
	// own foot at the extremes of the cycle is the failure mode here.
	// Where the clickable regions of the body land, under this camera. Projected
	// through the same `project` the facets went through, so they track the model
	// rather than approximating it.
	const hh = a.crown - a.jaw;
	const span = (e: number, h0: number, h1: number): Rect => {
		const pts = [
			project({ e: -e, n: 0, h: h0 }),
			project({ e, n: 0, h: h0 }),
			project({ e: -e, n: 0, h: h1 }),
			project({ e, n: 0, h: h1 })
		];
		const xs = pts.map((p) => p.x);
		const ys = pts.map((p) => p.y);
		return {
			x: Math.min(...xs),
			y: Math.min(...ys),
			w: Math.max(...xs) - Math.min(...xs),
			h: Math.max(...ys) - Math.min(...ys)
		};
	};
	const hit: Partial<Record<Anchor, Rect>> = {
		// The crown region runs up past the skull, because what you are clicking on
		// is where a hat WOULD be as much as where the head is.
		crown: span(a.headW, a.jaw, a.crown + 0.4 * hh),
		brow: span(a.headW, a.brow - 0.12 * hh, a.brow + 0.12 * hh),
		shoulders: span(a.armE + a.armW, a.shoulder, a.armTop),
		chest: span(a.chestW, 0.4 * a.tall, 0.55 * a.tall)
	};

	const pad = 0.06 * STEP + 0.16 * STEP;
	const w = x1 - x0 + pad * 2;
	// SQUARE, about the head, with a lot of air. Every well that asks for a bust
	// is square and every one of them slices — so a frame wider than it is tall
	// is scaled to the well's HEIGHT and loses the difference off its sides. At
	// 0.92 that was 4% of a head gone each side: an ear, then a temple, then a
	// brim, and the portrait reads as a head jammed in a box.
	// Height is the free direction. A square that runs past the jaw lands on
	// shoulder, which is what the socket underneath wanted anyway.
	//
	// WIDTH COMES OFF THE SKULL, and the skull is a number the model already
	// knows — `measure()` gives `headW` and `headD` for the build, and those
	// four corners projected are the head, exactly, with nothing on it. It used
	// to come off the drawn silhouette instead, which meant the widest thing a
	// character was WEARING set how big the character was drawn: a top hat's
	// brim is 1.62 head-widths of flat plate, so the Architect was framed half
	// again as wide as the Maintainer and came out that much smaller beside them
	// in a row of portraits whose whole job is to be compared.
	//
	// The hat is still in frame VERTICALLY — `hy0` is measured dressed, so a
	// tall hat is never cropped — it just no longer votes on scale. A brim wider
	// than the frame overhangs, which is what a portrait does with a brim.
	const skull = [-1, 1].flatMap((se) =>
		[-1, 1].map((sn) => project({ e: se * a.headW, n: sn * a.headD, h: a.brow }).x)
	);
	const bw = (Math.max(...skull) - Math.min(...skull)) * 1.16;
	const out: Art = {
		tris,
		box: { x: x0 - pad, y: y0 - pad, w, h: y1 - y0 + pad * 2 },
		bust: { x: (hx0 + hx1) / 2 - bw / 2, y: hy0 - bw * 0.07, w: bw, h: bw },
		floor: y1,
		hit,
		lamp: lamped
	};
	cache.set(id, out);
	return out;
}
