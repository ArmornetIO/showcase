// ── What a card is a picture OF ──────────────────────────────────────────────
// Card art, derived rather than authored. Forty cards is forty illustrations
// nobody is going to draw, and the alternative the face had until now was a
// line icon in a ring — which is not art, it is a bullet point.
//
// The scene is BUILT from what the card already says about itself:
//
//   owner     who is in the shot.
//   targets   WHERE. A card that hits the Forge is a picture of the Forge, and
//             the board already knows which building the Forge is.
//   squad     who else. `{count, shape}`.
//   vector    how they are arriving.
//
// That derivation gets every card to a competent picture. It does not get any
// card to a GOOD one, because what a card means is not in its fields: "fix real
// bugs for real people" and "sock-puppets complain until the owner gives in"
// are both `econ`-ish red cards with a crowd and a building, and they should
// not look remotely alike. So `SHOT` overrides the derivation per card, and the
// derivation is what a card falls back to until it has been through the room.
import { ALL_PIECES } from '$lib/mesh-studio/pieces/piece-catalogue.js';
import { box, type Piece, type PieceVert, type Solid } from '$lib/mesh-studio/pieces/pieces.js';
import type { SceneSpec, Actor, Prop } from '$lib/character/scene.js';
import type { CharacterSkin } from '$lib/character/characters.js';
import type { Pose, ClipId, ClipOpts } from '$lib/character/poses.js';
import { poseAt } from '$lib/character/poses.js';
import { statusById } from '$lib/character/status.js';
// The same call that stamps an emblem on a figure's chest, used as scenery —
// see `COURT_SEAL`. A device the model already knows how to draw beats a device
// authored twice.
import { glyph, GLYPHS } from '$lib/character/glyphs.js';
import type { BackdropId } from '$lib/backdrop/backdrops.js';
import { structureById, type Ability, type Klass } from '$examples/breach/internal/rules.js';
import type { CardFx } from '$examples/breach/internal/fx.js';
import { kitFor } from '$examples/breach/hud/kit.js';

// ── What somebody in the shot is DOING ───────────────────────────────────────
// A standing figure has no verb, and a card whose art has no verb is a portrait
// of a person near a building. These are static poses rather than clip frames
// because a card is one frame: `poseAt('walk', 0.2)` is a good stride and a
// terrible photograph, since the interesting part of a walk is the extreme and
// the clip spends most of its cycle away from one.
const DOING = {
	/** Bent to the work, both arms out and down. The only pose in the set that
	 *  needs something under the hands — see the bench on `contribution`. */
	work: { legL: -0.1, legR: 0.13, armL: 0.92, armR: 0.8, bob: -0.06 },
	/** Weight on one leg, arms almost still. Present, not acting. */
	watch: { legL: -0.06, legR: 0.09, armL: 0.06, armR: -0.04, bob: 0 },
	/** The extreme of a stride, taken deliberately rather than sampled. */
	stride: poseAt('walk', 0.25),
	/** Low and reaching, weight forward. */
	creep: { legL: 0.3, legR: -0.22, armL: 0.34, armR: 0.2, bob: -0.11 },
	/** Squared up, arms back off the body. Posted. */
	guard: { legL: -0.2, legR: 0.2, armL: -0.22, armR: -0.22, bob: 0 },
	/**
	 * Sat at a desk, arms out to it.
	 *
	 * Legs swung most of a right angle and the whole body dropped to seat
	 * height. The legs come out horizontal because nothing in this figure has a
	 * knee — which would be a problem anywhere except behind a desk, where the
	 * desk eats them. Only ever use it with something in front.
	 */
	sit: { legL: 1.45, legR: 1.38, armL: 0.86, armR: 0.8, bob: -0.34 },
	/**
	 * Sunk. Dropped on the spot, arms hanging a little forward, no stance at all.
	 *
	 * The one pose in the set with no verb, and that is what it is for: `watch`
	 * is somebody choosing not to act and this is somebody who has stopped
	 * getting a say. The whole read is in the `bob` — a figure standing a tenth
	 * of a pace lower than everything around it is a figure giving way, and at
	 * card size that is legible when a slumped shoulder is not.
	 */
	sink: { legL: -0.03, legR: 0.05, armL: 0.24, armR: 0.17, bob: -0.16 },
	/**
	 * On the floor. Legs straight out, arms hanging, dropped half a pace.
	 *
	 * `sink` is somebody who has stopped getting a say while still on their feet;
	 * this is the same person afterwards. It is deliberately NOT `sit` at a lower
	 * offset, which was the first attempt and read as a crouch: `sit`'s arms are
	 * out at 0.8 because they are reaching for a desk, and arms reaching for
	 * something are arms belonging to somebody still doing something. The whole
	 * difference between working and finished is in the arms.
	 *
	 * Only ever at ground level, and best in near profile — legs out flat toward
	 * the camera foreshorten to nothing, and legs out flat ACROSS it are the
	 * whole silhouette.
	 */
	felled: { legL: 1.52, legR: 1.44, armL: 0.22, armR: 0.16, bob: -0.52 }
} satisfies Record<string, Pose>;

export type Doing = keyof typeof DOING;
export const DOING_KEYS = Object.keys(DOING) as Doing[];

/** A screen, open on the desk. Laptop-sized and not an inch more — the point
 *  of it is to be a small bright rectangle with a dark person bent over it, and
 *  anything wider is a billboard. */
const SCREEN: Piece = [box(-0.25, 0.25, -0.02, 0.02, 0.04, 0.34)];

/**
 * The other half of the laptop, and the reason the last one was invisible.
 *
 * A lit slab standing on a desk in front of a figure has no silhouette of its
 * own — it is a bright rectangle against a body, and it reads as part of the
 * body. What makes a laptop a laptop is the L: a dark deck lying flat with a
 * lit lid rising off the back of it. Two props because a prop carries one
 * colour, and the whole shape is the difference between the two.
 */
const DECK: Piece = [box(-0.25, 0.25, -0.18, 0.18, 0, 0.04)];

/**
 * A beam between two points, square in section.
 *
 * Every primitive in `pieces.ts` extrudes straight up — `box` and `prism` both —
 * so none of them can make a diagonal, and the diagonal is the whole point of
 * this card. Eight vertices authored by hand is the entire fix, wound the same
 * way `box` winds: the A end backwards, the B end forwards, one quad per side.
 * Culling and shading then need no special case, because nothing about them
 * assumed the beam was upright.
 *
 * The section is squared to the RUN rather than to the world, or a beam at 45°
 * draws thinner than a vertical one of the same `r` and the wire changes weight
 * as it changes angle.
 */
function beam(
	a: { e: number; h: number },
	b: { e: number; h: number },
	r: number
): Solid {
	const de = b.e - a.e;
	const dh = b.h - a.h;
	const len = Math.hypot(de, dh) || 1;
	// Perpendicular to the run, in the plane the run lives in.
	const pe = (-dh / len) * r;
	const ph = (de / len) * r;
	// Order is `n̂, p, −n̂, −p` at each end: counter-clockwise about the run, which
	// is what makes the B-end quad face outward under `box`'s winding.
	const ring = (c: { e: number; h: number }): PieceVert[] => [
		{ e: c.e, n: r, h: c.h },
		{ e: c.e + pe, n: 0, h: c.h + ph },
		{ e: c.e, n: -r, h: c.h },
		{ e: c.e - pe, n: 0, h: c.h - ph }
	];
	return {
		verts: [...ring(a), ...ring(b)],
		faces: [
			[0, 3, 2, 1],
			[4, 5, 6, 7],
			[0, 1, 5, 4],
			[1, 2, 6, 5],
			[2, 3, 7, 6],
			[3, 0, 4, 7]
		]
	};
}

/**
 * A flat shape standing up, extruded a little way into the page.
 *
 * `prism` extrudes a footprint UPWARD, which is the right primitive for a
 * building and the wrong one for a wall: a wall is a shape in elevation. This
 * takes the outline in the plane the viewer is looking at — `e` right, `h` up,
 * wound counter-clockwise as you would draw it — and gives it thickness in `n`.
 *
 * It is what lets a wall have a slanted top. Nothing built out of `box` can have
 * an edge that is not level, so with `box` alone the seam between two buildings
 * can only ever be a step.
 */
function panel(outline: [number, number][], t = 0.07): Solid {
	// Reversed, so the ring reads counter-clockwise seen from BEHIND — which is
	// the orientation `box`'s face winding assumes of its second ring.
	const r = [...outline].reverse();
	const k = r.length;
	const verts: PieceVert[] = [
		...r.map(([e, h]) => ({ e, n: -t, h })),
		...r.map(([e, h]) => ({ e, n: t, h }))
	];
	const near = [0, ...Array.from({ length: k - 1 }, (_, i) => k - 1 - i)];
	const far = Array.from({ length: k }, (_, i) => k + i);
	const sides = Array.from({ length: k }, (_, i) => {
		const j = (i + 1) % k;
		return [i, j, k + j, k + i];
	});
	return { verts, faces: [near, far, ...sides] };
}

/**
 * A wall with a hole in it.
 *
 * Four boxes around an opening, and not one box with a lit slab stuck to the
 * front. The renderer has no apertures — a wall is a solid — so the only way to
 * look INTO a room is to leave the room-shaped gap out of the geometry and put
 * the room behind it. The lit pane and whoever is in there are separate props
 * at a greater `n`, and `paint` sorts them through the hole for free.
 *
 * Thin on purpose: at 0.07 the reveal round the opening is a couple of pixels,
 * which is a window. Any thicker and it is an embrasure.
 */
function windowWall(w: number, h: number, ow: number, sill: number, head: number): Piece {
	const t = 0.07;
	return [
		box(-w, w, -t, t, 0, sill),
		box(-w, w, -t, t, head, h),
		box(-w, -ow, -t, t, sill, head),
		box(ow, w, -t, t, sill, head)
	];
}

/**
 * The same wall twice.
 *
 * Both halves of this card are the identical piece at the identical size, and
 * that is the entire argument the card makes: same shot, same night, same
 * window — one has a person behind it and one has a machine. Authoring them as
 * two similar walls would lose the rhyme to a rounding error.
 */
const WINDOW_WALL: Piece = windowWall(3, 3.2, 1.2, 1.775, 2.521);

/**
 * The frame in the hole.
 *
 * A gap in a wall with light behind it is a rectangle of light, which is what
 * both windows on this card were until now. What makes a window a window is the
 * BARS: a sill proud of the wall under it, a reveal round it, and mullions
 * across it. The mullions do nearly all the work at card size — a rectangle is
 * a rectangle at any scale, but a rectangle with a cross in it is a window.
 *
 * Sits a little in front of the wall rather than flush with it, so the sill
 * catches the light and throws an edge. A frame in the same plane as the wall is
 * a drawing of a frame.
 */
function windowFrame(w: number, h: number, cy: number, cols: number, rows: number): Piece {
	const t = 0.035;
	const parts: Solid[] = [
		box(-w - 2 * t, w + 2 * t, -t, t, cy + h, cy + h + 2 * t),
		// The sill alone is deeper than the rest — it is the one member of a
		// window frame that sticks out far enough to stand something on.
		box(-w - 2 * t, w + 2 * t, -2.5 * t, 2.5 * t, cy - h - 2.5 * t, cy - h),
		box(-w - 2 * t, -w, -t, t, cy - h, cy + h),
		box(w, w + 2 * t, -t, t, cy - h, cy + h)
	];
	for (let i = 1; i < cols; i++) {
		const e = -w + (2 * w * i) / cols;
		parts.push(box(e - t, e + t, -t, t, cy - h, cy + h));
	}
	for (let i = 1; i < rows; i++) {
		const y = cy - h + (2 * h * i) / rows;
		parts.push(box(-w, w, -t, t, y - t, y + t));
	}
	return parts;
}

/**
 * ── THE SEAM · a card cut into two worlds ────────────────────────────────────
 *
 * A 45° diagonal with a different place either side of it. Three cards run on
 * it and each says something different with the same line, which is why it is a
 * primitive here rather than a shape copied three times:
 *
 *   `contribution`  two halves that are CONNECTED — a house and a data centre,
 *                   with a wire crossing the middle.
 *   `takeover`      two halves that are INDISTINGUISHABLE — the same page twice,
 *                   and the failure is that nothing tells them apart.
 *   `lotl`          two halves with NOTHING between them — no wire, because
 *                   nothing had to travel.
 *
 * THE RULE THAT MAKES IT A DEVICE RATHER THAN A GRAPHIC. The diagonal is always
 * the top EDGE of the near wall. A line ruled over the top of two buildings is
 * a decoration lying on the card; a line that is the edge of the near building
 * is where one world stops, and it cuts across the other because it is made of
 * something.
 *
 * THE ONE FACT WORTH KNOWING BEFORE PLACING ANYTHING. Substitute `seamAt` into
 * the projection and the depth term cancels:
 *
 *     screenAt(n, seamAt(e, n, at))  ===  e + at
 *
 * So on screen the seam is a plain diagonal in `e` alone, and a wall may stand
 * at ANY depth and still meet it exactly. It is also how you check a placement:
 * a thing is on the near side when `screenAt(n, h) < e + at`, which is the whole
 * of the arithmetic and needs no rendering to answer.
 */

/** How a pace of height and a pace of depth convert to screen height at the
 *  deck's tilt. Every framing decision in this file is these two numbers. */
const RISE = 0.966;
const TILT = 0.257;

/**
 * Where a point lands in screen height.
 *
 * The formula every `look` in this file is derived from, written down once.
 * Depth is worth HEIGHT and nothing else under an orthographic camera — which
 * is a staging tool, not a nuisance: pushing a thing deeper lifts it up the
 * frame at no cost in size.
 */
const screenAt = (n: number, h: number) => RISE * h + TILT * n;

/** The seam, as a height on a wall standing at `n`. `at` is where the line
 *  sits, in screen units. */
const seamAt = (e: number, n: number, at: number) => (e + at - TILT * n) / RISE;

export interface SeamWall {
	/** Where the diagonal sits: on screen it is exactly `S = e + at`. */
	at: number;
	/** The depth the wall stands at. Does not move the line — see above. */
	n: number;
	from?: number;
	to?: number;
	/**
	 * How far below the ground the wall runs.
	 *
	 * Must be low enough that the seam is still above it at `from`, or the
	 * outline crosses itself and the panel turns inside out. Deliberately not
	 * clamped: a wall that silently changed shape would be worse than one that
	 * visibly broke.
	 */
	foot?: number;
	t?: number;
	/** A rectangular opening — a window to see the far world through. Four
	 *  convex panels rather than one, because a shape with a hole in it is not
	 *  one solid and `paint` culls per solid. */
	hole?: { from: number; to: number; sill: number; head: number };
}

/** The near wall of a split card, its top edge cut by the seam. */
function seamWall(w: SeamWall): Piece {
	const { at, n, from = -3.4, to = 3.4, foot = -1.2, t = 0.07, hole } = w;
	const top = (e: number) => seamAt(e, n, at);
	if (!hole) {
		return [panel([[from, foot], [to, foot], [to, top(to)], [from, top(from)]], t)];
	}
	return [
		panel([[from, foot], [hole.from, foot], [hole.from, top(hole.from)], [from, top(from)]], t),
		panel([[hole.from, foot], [hole.to, foot], [hole.to, hole.sill], [hole.from, hole.sill]], t),
		panel(
			[
				[hole.from, hole.head],
				[hole.to, hole.head],
				[hole.to, top(hole.to)],
				[hole.from, top(hole.from)]
			],
			t
		),
		panel([[hole.to, foot], [to, foot], [to, top(to)], [hole.to, top(hole.to)]], t)
	];
}

const SEAM = 2.25;
const HOUSE_N = 0.2;

/** His house: the near wall, its top cut by the seam, with a hole for the
 *  window he is sitting behind. */
const HOUSE_WALL: Piece = seamWall({
	at: SEAM,
	n: HOUSE_N,
	from: -2.3,
	to: 2.3,
	foot: -0.8,
	hole: { from: 0.15, to: 1.55, sill: 0.232, head: 1.836 }
});

/**
 * His window's frame. A domestic cross — one mullion each way, four panes.
 *
 * The horizontal member sits at the middle of the opening on purpose: that lands
 * it across the desk and the laptop, not across his head. A bar through the head
 * costs the one silhouette on this card that has to survive being eight pixels.
 */
const HOUSE_FRAME: Piece = windowFrame(0.7, 0.802, 1.034, 2, 2);

/**
 * The hall's glazing. Vertical members only, and FIVE of them against six
 * cabinets behind.
 *
 * The mismatch is the point. Mullions on the same pitch as the racks read as one
 * shelving unit; on a different pitch the two grids beat against each other, and
 * that beat is what the eye reads as glass in front of contents. A single-height
 * strip with vertical divisions and no transom is industrial glazing and nothing
 * else — it is the shape, not the contents, that says "not a house".
 */
const HALL_FRAME: Piece = windowFrame(1.2, 0.373, 2.148, 5, 1);

/**
 * ── THE HALL ─────────────────────────────────────────────────────────────────
 * Six cabinets, identical, evenly spaced, dead level, with the outer ones
 * running off the edge of the card.
 *
 * The evenness IS the read. One cabinet in a window is a cupboard; what makes a
 * building a data hall is mechanical repetition, which is the one place on this
 * card where sameness is the content. Any variation — a taller unit, a wider
 * gap, one turned — turns a machine hall back into a room with furniture in it.
 */
const HALL: Piece = [-1, -0.6, -0.2, 0.2, 0.6, 1].map((e) =>
	box(e - 0.16, e + 0.16, -0.12, 0.12, 0, 0.68)
);

/**
 * Their lights, in ROWS across the whole hall rather than scattered per
 * cabinet. Scatter reads as decoration; a level row reads as installed kit. The
 * only green on the card, so the eye registers "other technology" before it has
 * read anything at all.
 */
const HALL_PORTS: Piece = [-1, -0.6, -0.2, 0.2, 0.6, 1].flatMap((e) =>
	[0.16, 0.32, 0.48].map((h) => box(e - 0.09, e + 0.09, -0.01, 0.01, h, h + 0.045))
);

/** The light in the hall. Wide, because it backs a strip and not a punch. */
const HALL_LIGHT: Piece = [box(-1.35, 1.35, -0.02, 0.02, 0, 1)];

/** The room, seen through the hole. A lit slab standing well behind the wall
 *  and running far past the opening in both axes — it is the light at the back
 *  of a room, and the one thing that must never show an edge inside the frame. */
// Only just bigger than the opening it backs. A lit slab is the one prop that
// cannot be sized generously: it sits DEEPER than the wall, so it reads higher on
// screen than the wall does, and any surplus at the top climbs out over the
// roofline and lands in the sky as a wedge of lit nothing.
const ROOM: Piece = [box(-0.75, 0.75, -0.02, 0.02, 0, 1.6)];

/** A desk. Solid to the floor, because it has to hide a seated figure's legs,
 *  which come out horizontally (see `sit`). Narrower than the opening so the
 *  lit room still shows down both sides of it. */
const DESK: Piece = [box(-0.34, 0.34, -0.16, 0.16, 0, 0.62)];

/** The pole. Foreground, in the gap between the two walls, tall enough that the
 *  wire crosses it just under the mast head — which is the one detail that makes
 *  the diagonal a WIRE rather than a stripe drawn across the card. */
const POLE: Piece = [
	box(-0.06, 0.06, -0.06, 0.06, 0, 1.58),
	box(-0.36, 0.36, -0.045, 0.045, 1.34, 1.42)
];

/**
 * The wire, and the split.
 *
 * One run, corner to corner, at a true 45° ON SCREEN — which is not a 45° in the
 * world: the camera's tilt means a pace of height is 0.966 of a pace of width,
 * so the slope is 1.035 and not 1. Getting that wrong is a diagonal that is
 * visibly not the diagonal.
 *
 * Parallel to the seam, so it emerges from behind his roof rather than being
 * ruled across the front of everything. The roof cutting it is what puts it IN
 * the scene: a line nothing occludes is a line that is not anywhere.
 *
 * The offset is squeezed from both sides and there is exactly one band it can
 * live in. Too small and the pole's mast has nowhere to show between the
 * roofline and the cable; too large and — since the wire climbs and the hall's
 * glazing does not — it rises through the far window and rules a line across the
 * data hall. `0.62` is the widest gap that still passes under the glazing's
 * near corner.
 *
 * Thin, and dimmed by its `tint` rather than by its colour. An emitter is drawn
 * `colour·0.62 + 112·tint`, so the tint is exactly the knob for "how much white
 * is added" — picking a darker hex instead just desaturates it and leaves the
 * glow, which is how the first cut ended up a pale stripe ruled across the card.
 */
const WIRE_N = 3;
const WIRE: Piece = [
	beam(
		{ e: -2.3, h: seamAt(-2.3, WIRE_N, SEAM) + 0.62 },
		{ e: 1.5, h: seamAt(1.5, WIRE_N, SEAM) + 0.62 },
		0.018
	)
];

/**
 * ── THE CASCADE ──────────────────────────────────────────────────────────────
 * A curtain of falling text, built out of dashes.
 *
 * Columns rather than lines, because the subject is VOLUME arriving and a
 * column is the only arrangement that has a direction. Rows of text sit there;
 * columns pour. Each one stops at its own height, which is the entire
 * difference between a cascade and a hem — an even bottom edge reads as a
 * printed panel no matter what it is made of.
 *
 * The dashes are deliberately not characters. At the size a card is held the
 * glyph is three pixels wide, so what the eye is actually reading is the
 * RHYTHM: varied widths with gaps in them is text, and a solid bar is a bar.
 * Anything more faithful is detail nobody can resolve, paid for in facets.
 *
 * `avoid` is the one concession to what is standing in front of it. A layer
 * nearer the camera than the subject sells the burial and costs the silhouette,
 * so the near layer drops the columns that would fall through a head. Dropping
 * whole columns rather than clipping glyphs keeps the streams reading as
 * streams; a column cut short mid-fall looks like it landed on him.
 */
function cascade(opts: {
	/** Half-width, in paces. Runs past the card on purpose — a curtain with two
	 *  visible ends is a banner. */
	span: number;
	cols: number;
	/** Where the streams come from, and the lowest any of them reaches. */
	top: number;
	floor: number;
	seed: number;
	/** Glyph width. Height and row pitch are struck off it, so one number
	 *  changes the size of the text without changing what it looks like. */
	glyph?: number;
	/** Columns closer to the middle than this are dropped. */
	avoid?: number;
}): Piece {
	const g = opts.glyph ?? 0.11;
	const row = g * 1.05;
	let s = opts.seed >>> 0;
	const rnd = () => ((s = Math.imul(s ^ (s >>> 15), 2246822507) >>> 0) / 4294967296);

	const out: Solid[] = [];
	const pitch = (2 * opts.span) / (opts.cols - 1);
	for (let i = 0; i < opts.cols; i++) {
		const e = -opts.span + i * pitch;
		// Drawn and discarded rather than skipped, so the stream lengths do not
		// reshuffle when the hole moves — otherwise tuning `avoid` re-rolls the
		// whole curtain and every other value has to be found again.
		const end = opts.floor + (opts.top - opts.floor) * Math.pow(rnd(), 0.72);
		if (opts.avoid && Math.abs(e) < opts.avoid) continue;
		for (let h = opts.top - rnd() * row; h > end; h -= row) {
			// A gap is a character that has not arrived yet. Without them every
			// column is one long bar and the wall stops being made of anything.
			if (rnd() < 0.18) continue;
			// Indented as well as trimmed. Varying only the width leaves every
			// glyph flush left, and a column of ragged-right dashes on a hard left
			// edge is a bar chart — the one thing this must not turn into.
			// Wider than they are tall, by a lot. A glyph on a square footprint is a
			// pixel and the curtain turns to confetti; text is a horizontal mark,
			// and that proportion is the only thing carrying the read at three
			// pixels across.
			const x = e + g * 0.28 * rnd();
			out.push(box(x, x + g * (0.55 + 0.85 * rnd()), -0.02, 0.02, h, h + g * 0.4));
		}
	}
	return out;
}

/** Behind him, at depth. Finer than the layer in front of it, which is the only
 *  perspective cue available — the camera is orthographic, so distance costs a
 *  thing nothing in size and the grain has to be authored. */
const FEED_FAR: Piece = cascade({ span: 3.1, cols: 26, top: 2.7, floor: -1.9, seed: 0x9e37, glyph: 0.078 });

/** The mass. Reads as the card's own colour, because it is the largest lit
 *  thing on it — see the `backdrop` slot below. */
const FEED_MID: Piece = cascade({ span: 2.7, cols: 34, top: 3.1, floor: -1.7, seed: 0x51ed, glyph: 0.092 });

/**
 * In FRONT of him, which is what makes it a burial rather than a backdrop.
 *
 * A curtain that is entirely behind the subject is weather; the same curtain
 * with a few streams falling nearer than he is standing is something he is
 * inside of. The hole keeps his head and shoulders out of it — see `avoid`.
 */
const FEED_NEAR: Piece = cascade({
	span: 1.95,
	cols: 11,
	// Starts well above the card. This layer is a pace from the lens, so it
	// gains almost nothing in screen height from its depth — a top struck at the
	// same number as the layers behind it begins halfway down the picture, and
	// text that starts in mid-air is not falling.
	top: 3.8,
	floor: -1.1,
	seed: 0xc0de,
	glyph: 0.13,
	avoid: 0.55
});

/**
 * A commit graph, standing in the curtain.
 *
 * The cascade says VOLUME and nothing else — it could be a log, a chat, a
 * mailbox. One spine with nodes on it and a branch that leaves and comes back
 * is the one drawing that says git and cannot say anything else, and it costs
 * eleven solids. Without it the card is a man buried in text; with it he is
 * buried in a repository.
 *
 * Read bottom-up, because that is which way a commit graph runs and which way
 * the text is falling: the branch opens low, runs alongside, and merges back
 * in at the top. The merge is the point of the card — the moment somebody else's
 * work lands in his project — so it sits high, where the eye starts.
 */
const GIT_GRAPH: Piece = (() => {
	const r = 0.022;
	const node = (e: number, h: number): Solid => box(e - 0.055, e + 0.055, -r, r, h - 0.055, h + 0.055);
	const trunk = 0;
	const branch = 0.46;
	return [
		// Stops short of the top edge, and the topmost node is its HEAD. A trunk
		// run off the top of the frame is a line, not a history.
		box(trunk - r, trunk + r, -r, r, -0.9, 2.66),
		box(branch - r, branch + r, -r, r, 0.42, 1.72),
		beam({ e: trunk, h: 0.08 }, { e: branch, h: 0.42 }, r),
		beam({ e: branch, h: 1.72 }, { e: trunk, h: 2.06 }, r),
		node(trunk, -0.5),
		node(trunk, 0.08),
		node(trunk, 0.74),
		node(trunk, 1.4),
		node(trunk, 2.06),
		node(trunk, 2.64),
		node(branch, 0.75),
		node(branch, 1.34)
	];
})();

/**
 * ── THE LINE ─────────────────────────────────────────────────────────────────
 * A conveyor running away from the camera, with an identical crate at every
 * station.
 *
 * Both halves of `divergence` are built from these two functions on the SAME
 * list of stations, and that is the card's whole argument: the crate coming out
 * is the crate that went in, at the same pitch, on the same bed, drawn from the
 * same geometry. Authoring the two runs separately would lose the identity to a
 * rounding error, and the identity is the only thing that makes the colour
 * change mean anything.
 *
 * The stations recede as well as travel, so the line has a direction — a row
 * that only moves sideways is a shelf. It also buys the card a real focus
 * gradient: source end soft, shipped end sharp, because they are genuinely
 * further away.
 */
type Station = readonly [e: number, n: number];

/**
 * The pitch, in paces, and why it is not rounder.
 *
 * Depth is worth −0.58 of a pace of screen width at the deck's bearing and east
 * is worth +0.81, so a station that steps 0.62 east and 0.18 back lands 0.61
 * further along the picture. Stepping a round 0.8 and 0.35 puts barely two
 * crates either side of the building in frame, and two is not a run — the card
 * needs enough of both halves for the eye to check the rhythm before it notices
 * the colour.
 */
const STEP_E = 0.62;
const STEP_N = 0.18;
const stations = (from: number, to: number): Station[] =>
	Array.from({ length: to - from + 1 }, (_, i) => [(from + i) * STEP_E, -(from + i) * STEP_N]);

/** Before the building. Deeper, and reading right to left as it goes back. */
const SOURCE_AT: Station[] = stations(-5, -1);

/**
 * The station you cannot see.
 *
 * Behind the Forge, on purpose and by construction: the pitch is unbroken
 * through it, so the eye completes the line across the building — and the one
 * crate it completes it with is the one where the substitution happened. A gap
 * here would read as a break in the conveyor. What the card needs is for
 * nothing to look wrong.
 */
const SWAP_AT: Station[] = stations(0, 0);

/** After. Nearer, and the same five steps mirrored — same pitch, same count. */
const SHIPPED_AT: Station[] = stations(1, 5);

/** How high the deck of the conveyor runs. Crates stand on it, so everything
 *  else on the line is struck off this one number. */
const DECK_H = 0.5;

/**
 * The bed: a deck and a trestle leg at every station.
 *
 * `box` cannot make a diagonal, so the deck is one segment per station and the
 * overlap between neighbours closes into a continuous run. The legs are not
 * decoration — a solid slab from the ground up is a parapet, and the whole
 * difference between a wall and a conveyor is being able to see under it.
 */
const bedAt = (at: readonly Station[]): Piece =>
	at.flatMap(([e, n]) => [
		box(e - 0.36, e + 0.36, n - 0.28, n + 0.28, DECK_H - 0.15, DECK_H),
		box(e - 0.24, e - 0.16, n - 0.13, n + 0.13, 0, DECK_H - 0.15)
	]);

/** A crate: a body and a lid standing proud of it. The lid is the whole read —
 *  a cube is a block, and a block with a lip round the top is a container. */
const cratesAt = (at: readonly Station[]): Piece =>
	at.flatMap(([e, n]) => [
		box(e - 0.17, e + 0.17, n - 0.17, n + 0.17, DECK_H, DECK_H + 0.28),
		box(e - 0.2, e + 0.2, n - 0.2, n + 0.2, DECK_H + 0.28, DECK_H + 0.34)
	]);

const BED: Piece = bedAt([...SOURCE_AT, ...SWAP_AT, ...SHIPPED_AT]);
const SOURCE_CRATES: Piece = cratesAt(SOURCE_AT);
const SWAP_CRATE: Piece = cratesAt(SWAP_AT);
const SHIPPED_CRATES: Piece = cratesAt(SHIPPED_AT);

/**
 * A running light down the front of the housing.
 *
 * Proud of the bed rather than flush with it — a face in the same plane as the
 * thing it is on z-fights, and a strip that flickers as the card scales is
 * worse than no strip. Cold, because the machine is the one honest party on
 * this card and the colour story is cold source, cold machine, hot output.
 */
const BED_LAMP: Piece = [...SOURCE_AT, ...SWAP_AT, ...SHIPPED_AT].map(([e, n]) =>
	box(e - 0.36, e + 0.36, n - 0.31, n - 0.29, DECK_H - 0.12, DECK_H - 0.06)
);

/**
 * ── THE OFFICE FLOOR ─────────────────────────────────────────────────────────
 * Three bays of a cubicle bank, seen square on from the aisle.
 *
 * Every dimension below is set by ONE requirement: the heads clear the
 * partitions. A sleeper card whose figures are hidden behind their own desks is
 * a picture of furniture — the whole card is a face, and a face at 136px is a
 * visor. So the counter lands at chest height, the partitions at the shoulder,
 * and the only thing above the topmost horizontal line in the shot is three
 * heads in a row.
 */
/** Centre-to-centre of the seats. Also the bay width — a cubicle is as wide as
 *  the person in it plus a hand's breadth, which is most of what makes it one.
 *  A ghost's head is 0.72 across (`head` is a HALF-width), so anything under a
 *  pace here puts three skulls in contact and the row reads as one mass. */
const BAY = 1.15;
/** The one grey all three of them are. Written once because the whole card is
 *  the claim that no two of these figures differ by anything. */
const OFFICE = '#7E8CA3';
const SEATS = [-BAY, 0, BAY];

/**
 * Where the top of the counter lands.
 *
 * Set by the FIGURE and nothing else, and it is the most load-bearing number on
 * the card. A ghost is 1.66 tall, `sit` drops it 0.34, and the head is two
 * fifths of the height — so a seated one is a head from 0.66 up, a short torso
 * under it, and legs out flat at 0.36.
 *
 * The desk has to land in the narrow gap between those last two, and everything
 * on this card that looks like a taste decision is really this constraint.
 *
 * Too HIGH and it swallows the torso and the arms, which is fatal: a head alone
 * — dark, rounded, one bright band across it — is not a person at card size, it
 * is a monitor, and three monitors in a row is a picture of the furniture. What
 * makes it a person is the pair of arms coming down out of the shoulders onto
 * the desk. Too LOW and `sit`'s knee-less legs clear the front edge and lie in
 * mid-air.
 */
const DESK_H = 0.4;

/** The counter. One slab to the floor, for `sit`'s reason — see the pose: the
 *  figure has no knees, and this is what hides that. */
const COUNTER: Piece = [box(-1.92, 1.92, -0.34, 0.34, 0, DESK_H)];

/**
 * How high the partitions stand.
 *
 * Chosen so the back wall's top edge crosses the heads ABOVE the visors — about
 * three quarters up. Lower and three faces float over a rail; higher and it
 * takes their eyes, which are the only thing on this card worth printing.
 */
const PART_H = 1.03;

/**
 * The wall they have their backs to, and the piece that makes the card legible.
 *
 * Everything in this bank runs front-to-back except the counter, and front-to-
 * back surfaces seen square on are thin verticals — so without this the shot is
 * three heads among a set of poles. One long horizontal behind them turns the
 * poles into what they are, which is the dividers between bays.
 *
 * Behind the seats, so it never occludes anybody: it is a line drawn ACROSS the
 * picture at a height, not a thing in front of one.
 */
const BACK_WALL: Piece = [box(-1.92, 1.92, -0.05, 0.05, 0, PART_H)];

/** The dividers, running front-to-back from the back wall out past the front
 *  edge of the counter. Four of them, so the row has two ENDS — a bank that runs
 *  off both edges of the card is a wall, and this one has to be countable.
 *
 *  Their `e` is set by the HEADS: a ghost's is 0.72 across, so a divider inside
 *  ±0.58 of a seat is a post growing out of somebody's ear. */
const DIVIDERS: Piece = [-1.73, -0.58, 0.58, 1.73].map((e) =>
	box(e - 0.05, e + 0.05, -0.68, 0.68, 0, PART_H)
);

/**
 * Three laptop lids, seen from BEHIND — the side the aisle sees.
 *
 * Dark slab, and a bar of the card's own hue peeking over its top edge. The lit
 * PANE is turned away from us on purpose: a screen facing the camera is three
 * bright rectangles exactly where the three faces go, and this card is nothing
 * but the three faces. What says a machine is on is the halo, not the pane.
 *
 * Both are kept SHORT, and that is the whole tuning of them. A lid tall enough
 * to look like a laptop from the aisle stands in front of the torso and the
 * arms, and takes the person back out of the picture the desk height was set to
 * keep in it. It gets the bottom third of the body and no more.
 *
 * Low and well forward of the seats for a second reason too: screen glow and a
 * visor are the only emitting things on the card, and at card size two orange
 * bars a few pixels apart are one orange bar.
 */
const LIDS: Piece = SEATS.map((e) => box(e - 0.24, e + 0.24, -0.02, 0.02, DESK_H, 0.56));
const LID_GLOW: Piece = SEATS.map((e) => box(e - 0.26, e + 0.26, 0.03, 0.07, 0.545, 0.6));

/** A ceiling tube, hung by the caller — see the extras, which put two of them at
 *  two depths. The single cue that turns a row of desks into a FLOOR of them:
 *  nowhere else does a light run dead straight across the whole width of a room,
 *  and two parallel ones say there is a room over the heads rather than a void. */
const CEILING_STRIP: Piece = [box(-3.4, 3.4, -0.06, 0.06, 0, 0.08)];

/**
 * The next bank back, and the one after it.
 *
 * Empty, dimmer, softer. This is the part of the card that is actually about the
 * rule text: a sleeper is not hiding in a room, it is hiding in a POPULATION —
 * and a population is drawn by making the three you can see obviously three of
 * very many. The camera is orthographic, so depth costs no size and buys pure
 * height: each bank simply stacks up the frame behind the last.
 *
 * The WALL of a row and nothing else — no dividers, unlike the near bank. A
 * divider is a thin front-to-back thing, so square on it is a vertical stroke,
 * and a vertical stroke standing in empty air behind three heads is a pole. Up
 * close they are legible because there is a counter and a cast and a lit screen
 * to tell you what they are between; out here there is nothing to read them
 * against, and all they do is grow antennae out of the row in front.
 *
 * So the far rows are pure horizontals, stacking up the frame. Depth on this
 * card is carried by that stack and by focus — which is all an orthographic
 * camera has, since it will not give up any scale.
 */
const FAR_ROW: Piece = [box(-3.6, 3.6, -0.05, 0.05, 0, PART_H)];

/**
 * ── THE LOADING DOCK ─────────────────────────────────────────────────────────
 * A wall with a roller door standing open in it, and the light of the building
 * coming out through the gap.
 *
 * The opening goes to the FLOOR, which is the whole difference between this and
 * `windowWall`: a window is a hole you look through and a door is a hole you
 * walk through, and at card size the only thing that tells them apart is
 * whether the light reaches the ground. Three boxes round a gap, and the light
 * is a separate prop behind it — the renderer has no apertures, so a hole is
 * something you leave out of the geometry.
 *
 * TALL AND NARROW, and that is not a taste call. The first cut of this was
 * nearly square and nearly two paces across, and a big pale rectangle hung in a
 * flat wall is not a doorway — it is a screen, and it turned a dock at night
 * into a meeting room. What says "door" at 136px is the PROPORTION: a lit slot
 * much taller than it is wide, with a frame proud of the wall round it and light
 * lying on the ground in front.
 */
const DOOR_W = 0.62;
const DOOR_H = 2.3;
const DOCK_WALL: Piece = [
	box(-4.2, -DOOR_W, -0.07, 0.07, 0, 3.4),
	box(DOOR_W, 4.2, -0.07, 0.07, 0, 3.4),
	box(-DOOR_W, DOOR_W, -0.07, 0.07, DOOR_H, 3.4),
	// The frame — two jambs and a head, standing forward of the wall. Flush and
	// same-toned is a drawing of a frame; proud, every member catches a lit edge,
	// which is the whole of what tells a hole from a panel.
	box(-DOOR_W - 0.09, -DOOR_W, -0.15, 0.15, 0, DOOR_H + 0.09),
	box(DOOR_W, DOOR_W + 0.09, -0.15, 0.15, 0, DOOR_H + 0.09),
	box(-DOOR_W - 0.09, DOOR_W + 0.09, -0.15, 0.15, DOOR_H, DOOR_H + 0.09)
];
const DOOR_LIGHT: Piece = [box(-DOOR_W, DOOR_W, -0.02, 0.02, 0, DOOR_H)];

/**
 * The light on the ground in front of it.
 *
 * The one cue that makes an open door read as OPEN rather than as a lit panel
 * set into a wall: light does not stop at a threshold. It is also the only
 * object on this card that puts anything on the tarmac between the doorway and
 * the deal, which is the ground the two of them are standing on.
 *
 * Untapered, because a taper needs an east/north outline and every primitive
 * here extrudes upward. Most of it is occluded by the cast and the crates
 * anyway, which is exactly where a spill should be interrupted.
 */
const DOOR_SPILL: Piece = [box(-DOOR_W - 0.2, DOOR_W + 0.2, -1.35, 1.35, 0, 0.015)];

/** What the deal is done on. Waist height, because the case has to sit at the
 *  height two standing figures are reaching to — the whole read of the shot is
 *  four hands over one object. */
const CRATE: Piece = [box(-0.44, 0.44, -0.34, 0.34, 0, 0.66)];

/**
 * The case, open. Three parts, and the LID is the one doing the work.
 *
 * Hinged flat back rather than tilted, so it stands vertically behind the tray.
 * Nothing in `pieces` can tilt about the east axis — every primitive extrudes
 * straight up — and a case open at 70° would need geometry authored by hand for
 * a shape that reads no better. Upright it is a dark rectangle standing behind
 * a lit one, which is what an open case is at a glance, and it gives the goods
 * something to glow against.
 */
const CASE_TRAY: Piece = [box(-0.38, 0.38, -0.24, 0.2, 0.66, 0.79)];
const CASE_LID: Piece = [box(-0.38, 0.38, 0.2, 0.25, 0.79, 1.26)];

/**
 * What is in it, and the punchline of the card: not guns in foam, a row of
 * BADGES. "Cheaper than a zero-day, and it comes with a badge" is the rule text,
 * and the one thing the staging must not do is let the merchandise read as
 * hardware.
 *
 * Four of them, at four pixels each on a printed card. They will not resolve
 * into objects and are not meant to — what survives the size is a lit bar with
 * gaps in it, which is a tray with things laid out in it rather than a lamp.
 */
const CASE_GOODS: Piece = [-0.26, -0.09, 0.09, 0.26].map((e) =>
	box(e - 0.06, e + 0.06, -0.18, 0.12, 0.79, 0.83)
);

/**
 * The van, in profile.
 *
 * `panel` rather than boxes, because the one line that makes a van a van is the
 * drop from the roof down over the cab — and nothing built from `box` can have
 * an edge that is not level. Parked nose-in and turned off the camera axis, so
 * it shows a side and an end and reads as a solid rather than as a black
 * rectangle at the edge of the card.
 */
const VAN: Piece = [
	panel(
		[
			[-1.55, 0],
			[1.55, 0],
			[1.55, 0.92],
			[0.62, 0.92],
			[0.36, 1.62],
			[-1.55, 1.62]
		],
		0.68
	)
];
/** One light on in the cab. A parked van with nobody in it is scenery; a parked
 *  van with a light on is somebody waiting. */
const VAN_LAMP: Piece = [box(0.42, 0.66, -0.7, 0.7, 1.0, 1.42)];

/**
 * Crates already unloaded, sitting on the tarmac in the near foreground.
 *
 * Put there to FILL rather than to decorate, and the distinction matters. Two
 * standing figures and a doorway leave the bottom third of the window on bare
 * ground — the card is wider than it is tall and the subject is neither — and
 * the two ways out of that are to crop the shot or to put something in the
 * space. Cropping costs the doorway, which is the card's whole second sentence.
 *
 * They also happen to be the last prop the borrowed picture needs: nobody has
 * ever seen this scene without crates already open on the ground.
 */
const YARD_CRATES: Piece = [
	box(-1.08, -0.06, -0.42, 0.42, 0, 0.46),
	box(0.14, 0.92, -0.36, 0.36, 0, 0.38)
];

/**
 * ── THE EGRESS GATE ──────────────────────────────────────────────────────────
 * A walk-through detector, face on.
 *
 * Face on is the only bearing that works, and it decides the whole card. A
 * portal is a thing you pass ALONG, so shot from the side it is two slabs and a
 * lintel with no hole in it — the opening only exists when you are looking down
 * its axis. That in turn fixes which way the man is walking: out of the frame,
 * toward the camera, because that is the direction the arch is pointing.
 */
const ARCH_W = 0.62;
const ARCH_H = 2.0;
const DETECTOR: Piece = [
	box(-ARCH_W - 0.15, -ARCH_W, -0.24, 0.24, 0, ARCH_H),
	box(ARCH_W, ARCH_W + 0.15, -0.24, 0.24, 0, ARCH_H),
	box(-ARCH_W - 0.15, ARCH_W + 0.15, -0.24, 0.24, ARCH_H, ARCH_H + 0.22)
];

/**
 * Its status light, and the point of the card.
 *
 * GREEN. The gate is powered, it is manned, it is working, and it is reporting
 * clear while the thing it exists to stop walks through it — which is a harder
 * and truer picture than a broken gate. A dark detector would say somebody
 * forgot to switch it on; a lit one says the control ran and passed.
 *
 * Mostly the header bar. The strips down the posts are four pixels wide on a
 * printed card and are there to tie the colour to the uprights; the bar across
 * the top is the part that actually reads, and it is where a status light lives
 * on the real machine anyway.
 */
const DETECTOR_LAMP: Piece = [
	box(-ARCH_W, ARCH_W, -0.26, -0.22, ARCH_H + 0.05, ARCH_H + 0.16),
	box(-ARCH_W - 0.13, -ARCH_W - 0.02, -0.26, -0.22, 0.55, ARCH_H - 0.3),
	box(ARCH_W + 0.02, ARCH_W + 0.13, -0.26, -0.22, 0.55, ARCH_H - 0.3)
];

/**
 * What the guard stands behind.
 *
 * Waist height and no higher. A real security desk comes to the chest, and at
 * chest height it cuts the figure off at the shoulders — which leaves a head on
 * a box, the exact read the `sleeper` card spends its whole geometry avoiding,
 * and costs this one the turned BODY that says he is watching rather than
 * facing front.
 */
const PODIUM: Piece = [
	box(-0.42, 0.42, -0.26, 0.26, 0, 0.55),
	box(-0.48, 0.48, -0.3, 0.3, 0.55, 0.63)
];

/**
 * What he is carrying, and the only warm thing in the shot.
 *
 * Small, and deliberately not a case — a man leaving a building with a case is
 * a man leaving a building. What makes this a theft is that the object is LIT:
 * it is the one thing on the card that is obviously data, it is out in the open
 * at hip height, and both the gate and the guard are looking straight at it.
 */
const PAYLOAD: Piece = [box(-0.17, 0.17, -0.11, 0.11, 0, 0.27)];

/** The lobby behind him: one wall and one long band of interior light. The band
 *  does all of it — a flat wall says nothing about which side of a building you
 *  are on, and a wall with a lit storey in it is somewhere people work. */
const LOBBY_WALL: Piece = [box(-4.2, 4.2, -0.06, 0.06, 0, 3.2)];
const LOBBY_BAND: Piece = [box(-3.6, 3.6, -0.02, 0.02, 1.0, 1.58)];

/**
 * ── THE SAME PAGE, TWICE ─────────────────────────────────────────────────────
 * Two flat walls at two depths with the seam between them, and one sign-in page
 * on each.
 *
 * Deliberately abstract, where every other authored card is a place. A phish is
 * two servers rendering one page, and the whole content of that fact is that
 * there is no scenery to tell them apart — a card that gave the fake a back
 * alley and the real one an office would have answered the question the player
 * is supposed to fail.
 */
const PHISH_SEAM = 1.5;
/** Thicker than the other two walls, so the seam's own top face catches light
 *  and the division reads as an edge rather than as a ruled line. */
const PHISH_NEAR: Piece = seamWall({
	at: PHISH_SEAM,
	n: 2.6,
	from: -1.4,
	to: 3.6,
	foot: -3.2,
	t: 0.14
});
const PHISH_FAR: Piece = [box(-4.4, 4.4, -0.07, 0.07, -3.5, 3.6)];

/**
 * The page. A lit slab with dark rows across it — a title, two fields and a
 * button.
 *
 * The rows are the whole design. A plain lit rectangle is a window, and this
 * card already has two of those in the walls behind it; what makes a rectangle
 * a FORM is horizontal bars stacked at the top of it with a short one under
 * them, and that arrangement survives being thirty pixels wide when nothing
 * else about a login page does.
 *
 * The button is short and left-aligned, which is the one asymmetry in the whole
 * object — and asymmetry is what stops the stack reading as a grille.
 */
const PAGE_W = 0.56;
const PAGE_H = 0.82;
const PAGE: Piece = [box(-PAGE_W, PAGE_W, -0.02, 0.02, 0, PAGE_H)];
const PAGE_ROWS: Piece = [
	box(-PAGE_W + 0.1, PAGE_W - 0.28, -0.06, -0.03, 0.63, 0.71),
	box(-PAGE_W + 0.1, PAGE_W - 0.1, -0.06, -0.03, 0.42, 0.52),
	box(-PAGE_W + 0.1, PAGE_W - 0.1, -0.06, -0.03, 0.26, 0.36),
	box(-PAGE_W + 0.1, -PAGE_W + 0.42, -0.06, -0.03, 0.08, 0.19)
];

/**
 * ── THE TELLER'S SIDE ────────────────────────────────────────────────────────
 * A bank counter with a screen on it and one window through it, seen from
 * BEHIND — from the staff side, where the customer never stands.
 *
 * The whole card is that point of view. Shot from the hall this is a bank; shot
 * from back here it is a bank with something on the floor, and the customer at
 * the window cannot tell the two apart because the window is identical either
 * way. That is the geometry the rule text describes: nothing about the position
 * changed, only who is standing in it.
 */
const SILL = 1.25;
const HEAD = 2.3;
const SCREEN_TOP = 2.85;
const GAP = 0.85;

/**
 * Waist-high, running off both edges, and OPEN UNDERNEATH on our side.
 *
 * A solid plinth is what a counter looks like from the hall, and it is the
 * wrong object for this card: with no void under it there is nowhere for the
 * man on the floor to be, and he ends up sitting in front of the furniture in
 * plain view of a customer who is supposed not to be able to see him. Panelled
 * on the far face only — which is exactly how a real counter is built, and it
 * is the whole reason a bank looks like a bank from one side and like a desk
 * from the other.
 *
 * The two heights are the card. High enough that the void under it hides a body
 * from the hall; low enough to serve over. Nothing about the object changes
 * between those two readings except where you are standing.
 */
const BANK_COUNTER: Piece = [
	box(-3.6, 3.6, -0.5, 0.5, SILL - 0.16, SILL + 0.08),
	box(-3.6, 3.6, 0.32, 0.46, 0, SILL - 0.16)
];

/** The screen above it, and the one hole in it. Three boxes round a gap — the
 *  renderer has no apertures, so a window is a shape you leave out. */
const TELLER_SCREEN: Piece = [
	box(-3.6, -GAP, -0.05, 0.05, SILL, SCREEN_TOP),
	box(GAP, 3.6, -0.05, 0.05, SILL, SCREEN_TOP),
	box(-GAP, GAP, -0.05, 0.05, HEAD, SCREEN_TOP)
];

/** The frame in the hole, and the tray under it. No mullions: a teller window is
 *  one pane and a gap, and the tray is the detail that says which kind of window
 *  it is — every other glazed opening in this deck is something you look
 *  through, and this is one you pass things through. */
const SCREEN_FRAME: Piece = windowFrame(GAP, (HEAD - SILL) / 2, (SILL + HEAD) / 2, 1, 1);
const SCREEN_TRAY: Piece = [box(-GAP + 0.12, GAP - 0.12, -0.3, 0.16, SILL + 0.08, SILL + 0.14)];

/** The glazing either side. Emitting so it reads as glass rather than as more
 *  wall — the only thing that separates a screen from a partition is that you
 *  can see the hall through it. */
const SCREEN_GLASS: Piece = [
	box(-3.4, -GAP - 0.06, -0.02, 0.02, SILL + 0.14, SCREEN_TOP - 0.14),
	box(GAP + 0.06, 3.4, -0.02, 0.02, SILL + 0.14, SCREEN_TOP - 0.14)
];

/** His station: a terminal on the counter, lit, turned to the staff side. The
 *  object that makes standing there a JOB rather than loitering. */
const TILL: Piece = [
	box(-0.06, 0.06, -0.06, 0.06, SILL + 0.08, SILL + 0.17),
	box(-0.23, 0.23, -0.03, 0.03, SILL + 0.15, SILL + 0.44)
];
const TILL_GLOW: Piece = [box(-0.2, 0.2, -0.055, -0.035, SILL + 0.18, SILL + 0.41)];

/** The hall on the other side: one wall, one lit band. Enough that the customer
 *  is standing somewhere rather than in front of nothing. */
const HALL_WALL: Piece = [box(-5, 5, -0.06, 0.06, 0, 4)];
const HALL_BAND: Piece = [box(-4.4, 4.4, -0.02, 0.02, 2.1, 2.7)];

/**
 * ── THE DAM ──────────────────────────────────────────────────────────────────
 * A wall holding water back, seen from below and downstream.
 *
 * A note on SCALE before anything else, because it is the constraint the whole
 * card is built around. The camera is orthographic and the frame is one window,
 * so a dam drawn at the size of a real dam puts a person at two pixels — and
 * this card needs both, the mass and the people on it. So it is a weir: about
 * two and a half figures tall. What makes it read as a dam is not its height,
 * it is the vocabulary — a crest cap, a row of regular piers, an apron at the
 * toe, and water standing above the top edge.
 */
const DAM_H = 5;
const DAM_W = 7;
const DAM: Piece = [
	box(-DAM_W, DAM_W, -0.55, 0.55, 0, DAM_H - 0.24),
	// The crest, proud of the face. A wall that simply stops is a wall; a wall
	// with a capping course along the top is a structure somebody built.
	box(-DAM_W, DAM_W, -0.7, 0.7, DAM_H - 0.24, DAM_H),
	// The apron at the toe, running toward the camera. It is what the Handler is
	// standing on, and it is the only thing in the shot that says the near ground
	// is a spillway floor rather than a field.
	box(-DAM_W, DAM_W, -1.9, -0.5, 0, 0.42)
];

/**
 * The piers, and they are here for the crack's sake.
 *
 * A blank concrete face gives a jagged line nothing to be jagged against — on
 * its own the crack reads as a shadow, or as one more vertical among nothing.
 * A row of DEAD REGULAR verticals is what makes an irregular one obviously
 * wrong, and it is the same reason the real thing has them.
 */
const DAM_PIERS: Piece = [-5.5, -3.3, -1.1, 1.1, 3.3, 5.5].map((e) =>
	box(e - 0.17, e + 0.17, -0.72, -0.55, 0.42, DAM_H - 0.24)
);

/**
 * The crack.
 *
 * `beam` segments, which is the helper `contribution` had to write because
 * nothing in `pieces` can make a diagonal — every primitive extrudes straight
 * up. Each one is thinner than the last: a crack in a retaining wall is widest
 * where the head of water is greatest, and a fissure of constant width reads as
 * a drawn line rather than as a failure.
 *
 * It stops short of the crest and short of the apron. A crack that runs the
 * full height is a wall cut in two, which is a different and much less
 * frightening picture — the thing that is wrong here is still holding.
 *
 * SHORT segments and BRANCHES, which is the whole of the difference between a
 * crack and a lightning bolt. Four long limbs with two direction changes drew a
 * bold chevron — a graphic device, not a fracture. Concrete does not fail in
 * three strokes: it wanders, it changes its mind every half pace, and it throws
 * off hairlines that go nowhere. Seven segments down the main run and three
 * spurs off it, each spur thinner than the limb it leaves.
 */
const CRACK: Piece = [
	beam({ e: 0.34, h: 4.55 }, { e: 0.12, h: 4.0 }, 0.085),
	beam({ e: 0.12, h: 4.0 }, { e: 0.4, h: 3.45 }, 0.075),
	beam({ e: 0.4, h: 3.45 }, { e: 0.14, h: 2.85 }, 0.066),
	beam({ e: 0.14, h: 2.85 }, { e: 0.44, h: 2.25 }, 0.056),
	beam({ e: 0.44, h: 2.25 }, { e: 0.2, h: 1.62 }, 0.046),
	beam({ e: 0.2, h: 1.62 }, { e: 0.42, h: 1.02 }, 0.036),
	beam({ e: 0.42, h: 1.02 }, { e: 0.28, h: 0.55 }, 0.026),
	// The spurs. Each one leaves the main run at a node rather than mid-limb,
	// because that is where concrete actually splits.
	beam({ e: 0.4, h: 3.45 }, { e: 0.86, h: 3.02 }, 0.03),
	beam({ e: 0.14, h: 2.85 }, { e: -0.26, h: 2.46 }, 0.026),
	beam({ e: 0.44, h: 2.25 }, { e: 0.8, h: 1.86 }, 0.022)
];

/**
 * What is already coming through it.
 *
 * One thin run down the face from the widest part of the fissure, and a wet
 * patch where it reaches the apron. Dim, cool, and the only thing in the
 * picture that is moving — which is the point of putting it in the base state
 * rather than saving it for the play: the failure is not pending, it is under
 * way, and it has been under way since before anybody filed anything.
 */
const SEEP: Piece = [
	box(0.4, 0.52, -0.02, 0.02, 0.42, 2.24),
	box(0.28, 0.64, -0.03, 0.03, 0.5, 0.78)
];

/**
 * And what comes through it the moment the card is played.
 *
 * Four more runs, from four more points along the fracture, and a wash across
 * the toe wide enough to join them. Nothing here is animated — a card is one
 * frame — so "more water" has to be said with COUNT and REACH rather than with
 * motion: one trickle becomes five, and the highest of them starts most of the
 * way up the face, which is the part a dam cannot survive being wet.
 */
const SEEP_MORE: Piece = [
	box(0.06, 0.18, -0.02, 0.02, 0.42, 3.36),
	box(0.68, 0.8, -0.02, 0.02, 0.42, 2.92),
	box(-0.22, -0.1, -0.02, 0.02, 0.42, 2.4),
	box(0.2, 0.3, -0.02, 0.02, 0.42, 1.6),
	box(-0.05, 0.9, -0.035, 0.035, 0.5, 0.9)
];

/**
 * The waiver, bolted to the face beside the crack.
 *
 * The card is not "a crack nobody noticed". It is the rule text: somebody
 * noticed, wrote it up, and the write-up is the reason it is now invisible. A
 * neat lit notice, correctly filed, mounted next to a structural failure, is
 * the only object that can say that — and it is the one warm thing in the shot,
 * because on this card the paperwork is the payload.
 */
const WAIVER: Piece = [box(-0.55, 0.55, -0.05, 0.05, 0, 0.74)];
const WAIVER_ROWS: Piece = [
	box(-0.44, 0.1, -0.08, -0.06, 0.56, 0.65),
	box(-0.44, 0.44, -0.08, -0.06, 0.38, 0.47),
	box(-0.44, 0.44, -0.08, -0.06, 0.24, 0.33),
	box(-0.44, -0.12, -0.08, -0.06, 0.08, 0.18)
];

/** The reservoir, as one thin slab. It stands ABOVE the crest in the frame
 *  without being above it in the world — deeper is higher under this camera,
 *  which is the only reason a shot from downstream can show the water at all. */
const RESERVOIR: Piece = [box(-11, 11, -7, 7, 0, 0.06)];

/**
 * A kayak: hull, and a paddle across it.
 *
 * The paddler is a real actor sitting in it rather than a block on top, and at
 * this scale that is affordable — a figure is a third of the dam's height here.
 * It also matters: the card needs PEOPLE above the crack, and an abstract mark
 * would have been three more objects in a picture that already has objects.
 */
const KAYAK: Piece = [box(-1.3, 1.3, -0.24, 0.24, 0, 0.4)];
const PADDLE: Piece = [beam({ e: -0.62, h: 0.48 }, { e: 0.62, h: 0.2 }, 0.04)];

/**
 * ── THE ATTESTATION COURT ────────────────────────────────────────────────────
 * A raised bench with a device on the wall over it, seen from the floor of the
 * chamber.
 *
 * The heights are a HIERARCHY and that is the only reason they are what they
 * are. The bench is high because a bench is high; the man behind it stands on a
 * dais so that being behind a high bench does not reduce him to a head on a
 * slab — the `sleeper` problem, and the reason every desk in this file is
 * measured against the figure rather than against furniture. The seal is above
 * them both, and the man the document is for stands on the floor.
 */
const BENCH_H = 0.95;
const DAIS_H = 0.5;

/** What he stands on. Without it the bench eats him to the shoulders and the
 *  card loses the pair of arms that are the whole verb. */
const COURT_DAIS: Piece = [box(-2.5, 1.4, -0.75, 0.75, 0, DAIS_H)];

const COURT_BENCH: Piece = [
	box(-2.3, 1.2, -0.36, 0.36, 0, BENCH_H - 0.13),
	box(-2.42, 1.32, -0.46, 0.46, BENCH_H - 0.13, BENCH_H)
];

/** The bar. Says "court" more cheaply than any amount of masonry, and it is
 *  also what the bottom of the frame is made of — a rail across the near ground
 *  is the one prop that both fills the dead band and means something. */
const COURT_RAIL: Piece = [
	box(-2.9, 2.9, -0.045, 0.045, 0.62, 0.72),
	...[-2.4, -1.2, 0, 1.2, 2.4].map((e) => box(e - 0.05, e + 0.05, -0.05, 0.05, 0, 0.66))
];

/**
 * The document, lying flat and lit, and the press standing on it.
 *
 * Flat rather than propped, because the verb is `signs` and a page you are
 * signing is a page on a table. The rows are the same trick `takeover`'s login
 * page and `exception`'s waiver use — a lit rectangle is a lamp, and a lit
 * rectangle with dark bars stacked in it is a document, at any size down to
 * about twenty pixels.
 */
const WRIT: Piece = [box(-0.5, 0.5, -0.34, 0.34, 0, 0.03)];
const WRIT_ROWS: Piece = [
	box(-0.4, 0.16, -0.25, -0.18, 0.03, 0.05),
	box(-0.4, 0.4, -0.11, -0.04, 0.03, 0.05),
	box(-0.4, 0.4, 0.03, 0.1, 0.03, 0.05)
];

/** The press, on the paper rather than beside it. A stamp resting next to a
 *  document is stationery; a stamp standing ON one is the moment. */
const SEAL_PRESS: Piece = [
	box(-0.28, 0.28, -0.26, 0.26, 0.04, 0.3),
	box(-0.09, 0.09, -0.09, 0.09, 0.3, 0.66),
	box(-0.34, 0.34, -0.17, 0.17, 0.66, 0.82)
];

/**
 * The court's own device, on the wall above the bench.
 *
 * `glyph()` from the character model, used as SCENERY for the first time. It is
 * the same call that puts an emblem on a figure's chest, which is exactly why
 * it belongs here: the registrar wears `emblem.ring` and the wall behind him
 * carries the identical device at twenty times the size. Nothing has to say he
 * speaks for the court.
 *
 * A signet rather than the keyhole this card's `icon` suggests — `keyhole` is
 * already the Handler's own chest emblem, and putting it on the court's wall
 * would read as a mistake before it read as an argument.
 */
const COURT_SEAL: Piece = glyph(GLYPHS.ring, 0.42, 0.07);

const COURT_WALL: Piece = [box(-5, 5, -0.07, 0.07, 0, 4.4)];
/** One moulding, above the heads. The wall is the biggest surface on the card
 *  and a flat field of it has no size; a single horizontal gives it one. */
const COURT_TRIM: Piece = [box(-5, 5, -0.16, 0.16, 1.98, 2.1)];

/**
 * ── TWO DESKS ────────────────────────────────────────────────────────────────
 * His, and one in an office he has never been to, with the seam between them.
 *
 * The near wall is his room, cut on the diagonal the way `contribution`'s house
 * is cut by its roofline. Nothing is seen through a window on this card — he
 * sits in FRONT of the wall rather than behind it, because the two halves here
 * are not two views, they are two ROOMS, and a window would say one is looking
 * at the other.
 */
// Re-derived for THIS card's window rather than copied from `contribution`'s.
// The seam constant is framing-dependent — it is a screen position, so 2.25 is
// only corner-to-corner in the window `contribution` is shot through. Borrowing
// the number instead of the device is what puts the diagonal off the edge of
// the card and leaves the near wall covering a wedge.
const LOTL_SEAM = 1.75;
const LOTL_WALL: Piece = seamWall({ at: LOTL_SEAM, n: 2.4, foot: -3.5 });

/** His desk. Top at 0.44 for the reason every desk in this file is: `sit` has no
 *  knees, so the desk has to hide the legs, and it has to stop below 0.66 or it
 *  takes the arms with them. */
const LOTL_DESK: Piece = [box(-0.64, 0.64, -0.3, 0.3, 0, 0.44)];

/**
 * The other desk, and the whole reason it is built like this: it is OPEN
 * UNDERNEATH.
 *
 * A slab on two end legs, because the thing this card is about is under it. A
 * solid pedestal is what an office desk looks like and it would hide the only
 * object on the far side of the seam worth drawing.
 */
const OFFICE_DESK: Piece = [
	box(-0.78, 0.78, -0.36, 0.36, 0.62, 0.72),
	box(-0.78, -0.66, -0.34, 0.34, 0, 0.62),
	box(0.66, 0.78, -0.34, 0.34, 0, 0.62)
];

/**
 * The legacy box under it. Beige, slotted, and old.
 *
 * Deliberately the dullest object on the card. It is the estate's own kit,
 * bought and installed and inventoried by the people it is being used against,
 * and the moment it looks like an attacker's tool the card has said the opposite
 * of its rules text. What makes it read is the SLOTS — a plain box is a box, and
 * a box with a stack of vents in it is a machine somebody racked in 2009.
 */
const LEGACY: Piece = [
	box(-0.3, 0.3, -0.26, 0.26, 0, 0.62),
	...[0.14, 0.24, 0.34, 0.44].map((h) => box(-0.22, 0.06, -0.29, -0.26, h, h + 0.05))
];
/** Its lights. The same colour as the screen on his face — see the shot. */
const LEGACY_LEDS: Piece = [box(0.12, 0.24, -0.29, -0.26, 0.46, 0.53)];

/** An empty chair, pushed back from the far desk. The one prop whose whole job
 *  is that nobody is in it: the office is not being used and the machine in it
 *  is working anyway. */
const OFFICE_CHAIR: Piece = [
	box(-0.28, 0.28, -0.28, 0.28, 0.4, 0.48),
	box(-0.28, 0.28, 0.2, 0.28, 0.48, 0.98),
	box(-0.06, 0.06, -0.06, 0.06, 0, 0.4)
];

/** The back of his lid, and the light off the front of it. Same reason
 *  `sleeper` builds its laptops as an L with a halo: he is turned toward the
 *  camera, so the lit face is turned AWAY, and a bright rectangle where his
 *  chest should be is not a screen — it is a slab. */
const LOTL_GLOW: Piece = [box(-0.34, 0.34, 0.02, 0.06, 0, 0.055)];

const OFFICE_WALL: Piece = [box(-4.6, 4.6, -0.07, 0.07, -4, 3.4)];
/** A lit band in it — the floor behind, still working. Without it the far half
 *  is a flat field with two small objects on it, and the seam has nothing to
 *  divide. */
const OFFICE_BAND: Piece = [box(-4.2, 4.2, -0.02, 0.02, 1.05, 1.52)];

/**
 * ── THE PLANT ROOM ───────────────────────────────────────────────────────────
 * A rank of identical cabinets with something clamped to each of them, under a
 * sweep that covers the lot.
 *
 * Everything here is built to be IDENTICAL and then differ in one channel. The
 * cabinets are one piece mapped across four positions, the parasites are one
 * piece placed four times, and the only thing not shared between them is whether
 * the prop emits. That is not a shortcut — it is the card: a sweep sorts a room
 * into found and missed by exactly one property, and the property is whether the
 * thing is switched on.
 */
const SWEEP_AT = [-2.3, -1.15, 0, 1.15];
/** Half-width. Set against the 1.15 pitch: a 0.27 gap between cabinets is what
 *  makes a RANK rather than a wall with lines drawn on it. */
const SWEEP_RACK_W = 0.44;
const SWEEP_RACK_H = 1.25;

const SWEEP_RACKS: Piece = SWEEP_AT.map((e) =>
	box(e - SWEEP_RACK_W, e + SWEEP_RACK_W, -0.35, 0.35, 0, SWEEP_RACK_H)
);

/** Vent bands on the front of each. Four plain boxes in a row are furniture;
 *  four boxes with a stack of louvres in them are equipment, and the card needs
 *  the player to believe these are things that could be running. */
const SWEEP_VENTS: Piece = SWEEP_AT.flatMap((e) =>
	[0.24, 0.46, 0.68].map((h) =>
		box(e - SWEEP_RACK_W + 0.08, e + SWEEP_RACK_W - 0.08, -0.38, -0.35, h, h + 0.09)
	)
);

/**
 * The parasite. One piece, placed four times, coloured differently once.
 *
 * Small and clamped high on the cabinet face rather than sitting on top of it —
 * a box on top of a box is a bigger box, and what says "this does not belong
 * here" is an object breaking the flush front of something otherwise uniform.
 * The stub on top is a lead going somewhere it should not.
 */
const SWEEP_IMPLANT: Piece = [
	box(-0.15, 0.15, -0.1, 0.1, 0, 0.22),
	box(-0.06, 0.06, -0.1, 0.1, 0.22, 0.3)
];

/**
 * The sweep, as light lying on the floor.
 *
 * Full width and stopping just SHORT of the cabinets in depth, which is a
 * rendering constraint doing a favour. `paint` sorts by facet centroid and the
 * tilt makes height count as nearness, so a floor slab — centroid at h 0.01 —
 * loses to nothing and wins against everything; run under the rank it would
 * paint over the cabinet feet and read as light in FRONT of them. Ending at
 * their toes is both correct and what a floor wash actually looks like.
 *
 * It must never read as a boundary. The card's whole claim is that the search
 * covered all four, so this spans the full row and is dim enough to be an
 * ambient condition rather than a spotlight with an edge.
 */
const SWEEP_WASH: Piece = [box(-3.6, 3.6, -1.5, 1.5, 0, 0.02)];

/** Overhead services. Two runs at two depths, because one is a bar and two is a
 *  ceiling — and because the upper third of this frame is otherwise bare wall.
 *  Hung low enough to clear the cost gem's corner. */
const SWEEP_DUCT: Piece = [box(-4.2, 4.2, -0.16, 0.16, 0, 0.26)];

const SWEEP_WALL: Piece = [box(-5, 5, -0.07, 0.07, -1, 3.4)];

/**
 * ── THE STRONGROOM DOOR ──────────────────────────────────────────────────────
 * A door that does not open, and two keys far enough apart that nobody reaches
 * both.
 *
 * The DISTANCE is the object. A brute's hands sit ±0.47 from its own centre
 * (`measure().armE`), and the two stations stand 3.3 paces apart — so the gap is
 * not a matter of degree, it is seven times the reach of the person standing
 * between them. That ratio is the only thing on this card doing security work,
 * which is why the stations are pushed to the frame edges and the door is left
 * to fill the middle.
 *
 * It is the third door in the deck and the first that is not a portal. `insider`
 * and `exfil` both put people in front of a lit opening and the subject is
 * something passing through; this one is square on, has no opening, emits
 * nothing, and is never going to be walked through. Same object, opposite claim.
 *
 * Prefixed `STRONG_` throughout: `DOOR_W`, `DOOR_H` and `HALL_WALL` are already
 * the loading dock's and the bank's, and a second meaning for a name in a file
 * this long is a bug waiting for whoever edits the wrong one.
 */
const STRONG_W = 0.82;
const STRONG_H = 2.7;

/** Frame and leaf as two solids, the leaf standing proud. Flush and same-toned
 *  is a drawing of a door; forward, the leaf catches its own light and the
 *  reveal round it is what says the thing is thick. */
const STRONG_DOOR: Piece = [
	box(-STRONG_W - 0.16, STRONG_W + 0.16, -0.18, 0.18, 0, STRONG_H + 0.16),
	box(-STRONG_W, STRONG_W, -0.3, -0.18, 0, STRONG_H)
];

/** The wheel. The only detail on the leaf, and it is there because a slab with
 *  nothing on it is a wall — what makes a door heavy is the hardware. */
const STRONG_WHEEL: Piece = [
	box(-0.27, 0.27, -0.36, -0.3, 1.14, 1.66),
	box(-0.07, 0.07, -0.42, -0.36, 1.32, 1.48)
];

/**
 * A key station: a post with a deck on it, and a lit plate standing up off the
 * front.
 *
 * The deck stops at 0.6 because that is where the hands are. `work` drops the
 * arms about a third of a pace below the shoulder, and a standing brute's
 * shoulder is at 0.82 — so a console any higher is one the pose cannot touch,
 * and the figure reads as loitering beside furniture.
 *
 * The plate is UPRIGHT rather than lying on the deck. A flat face foreshortens
 * to a sixth of its own width at this camera's tilt, which is the lesson `ca`'s
 * writ paid for: at card size a lit horizontal is a sliver and a lit vertical is
 * a mark.
 */
const KEY_POST: Piece = [
	box(-0.26, 0.26, -0.24, 0.24, 0, 0.52),
	box(-0.34, 0.34, -0.3, 0.3, 0.52, 0.6)
];
const KEY_LAMP: Piece = [box(-0.22, 0.22, -0.34, -0.3, 0.6, 0.78)];

/** The hall. One course above head height, split either side of the door frame
 *  — a wall with no horizontal in it has no size, and one that crossed the door
 *  would cut the only object on the card that is supposed to be whole. */
const STRONG_WALL: Piece = [box(-5.2, 5.2, -0.08, 0.08, -1, 3.4)];
const STRONG_COURSE: Piece = [
	box(-5.2, -1.02, -0.18, 0.18, 1.58, 1.72),
	box(1.02, 5.2, -0.18, 0.18, 1.58, 1.72)
];

/**
 * ── THE MINT ─────────────────────────────────────────────────────────────────
 * A machine that issues one credential at a time, and the tray of dead ones
 * under it.
 *
 * THE WHOLE CARD IS A VERTICAL and every number below serves that. A mouth at
 * the top, one live token part way down, a heap at the bottom — and the only
 * thing that says how long the live one has left is HOW FAR IT HAS FALLEN. A
 * still frame cannot animate a countdown, so the countdown is a position.
 *
 * `MINT_N` is set by the depth sort, not by taste. `paint` orders by facet
 * centroid and the tilt makes height count as nearness, so a knee-high tray
 * standing at the wall's own depth loses to a wall four paces tall and vanishes
 * — the `exception` seep bug. Three quarters of a pace forward is enough, and
 * costs a fifth of a pace of drop on screen.
 */
const MINT_N = 3.85;
const MINT_MOUTH_H = 1.55;
const MINT_TOP_H = 2.05;

/** The tray, and the lip that holds the pile in. A shallow tray rather than a
 *  bin: a bin tall enough to look like one hides the heap, which is the only
 *  part of this machine that says the process has been running all day. */
const MINT_BASE: Piece = [
	box(-0.5, 0.5, -0.34, 0.34, 0, 0.32),
	box(-0.5, 0.5, -0.34, -0.28, 0.32, 0.42),
	box(-0.5, 0.5, 0.28, 0.34, 0.32, 0.42),
	box(-0.5, -0.44, -0.34, 0.34, 0.32, 0.42),
	box(0.44, 0.5, -0.34, 0.34, 0.32, 0.42)
];

/** Two rails, never one. A single upright is a pole; a pair is a track, and a
 *  track is the only thing that makes a small bright object between them read
 *  as falling rather than as hanging. */
const MINT_RAILS: Piece = [
	box(-0.3, -0.24, -0.05, 0.05, 0.42, MINT_MOUTH_H),
	box(0.24, 0.3, -0.05, 0.05, 0.42, MINT_MOUTH_H)
];

/** The issuing head. Wide over narrow rails over a wide tray — a silhouette that
 *  steps in and back out is a machine; a column of one width is a post. */
const MINT_HEAD: Piece = [
	box(-0.42, 0.42, -0.3, 0.3, MINT_MOUTH_H, MINT_TOP_H),
	box(-0.48, 0.48, -0.34, 0.34, MINT_TOP_H - 0.06, MINT_TOP_H + 0.05),
	// Two recessed lines on the face. At this size they are three pixels and they
	// are the difference between a machine and a crate on legs.
	box(-0.3, 0.3, -0.32, -0.29, MINT_MOUTH_H + 0.14, MINT_MOUTH_H + 0.19),
	box(-0.3, 0.3, -0.32, -0.29, MINT_MOUTH_H + 0.26, MINT_MOUTH_H + 0.31)
];

/** The slot it comes out of, lit. The top of the value gradient — see the shot:
 *  this is the brightest thing on the card and everything below it is dimmer
 *  than the thing above. */
const MINT_MOUTH: Piece = [
	box(-0.24, 0.24, -0.33, -0.29, MINT_MOUTH_H - 0.09, MINT_MOUTH_H + 0.01)
];

/** One credential. Hand-sized, and narrow enough to pass between the rails —
 *  which is what makes it belong to the machine rather than sit in front of it. */
const TOKEN: Piece = [box(-0.17, 0.17, -0.03, 0.03, 0, 0.055)];

/**
 * Every one that has already run out.
 *
 * Jittered in all three axes, because a stack is a thing somebody put away and a
 * HEAP is a thing that accumulated. The offsets are the entire difference and
 * they are worth more than the count: eight slabs squared up would read as one
 * block, and the card needs the eye to see these are many of the same object.
 */
const SPENT_HEAP: Piece = (
	[
		[-0.1, -0.02, 0.32],
		[0.08, 0.03, 0.335],
		[-0.04, 0.05, 0.375],
		[0.11, -0.04, 0.39],
		[-0.13, 0.02, 0.43],
		[0.02, -0.05, 0.45],
		[0.09, 0.04, 0.49],
		[-0.07, -0.01, 0.545]
	] as [number, number, number][]
).map(([e, n, h]) => box(e - 0.17, e + 0.17, n - 0.03, n + 0.03, h, h + 0.055));

/** His console. Top at 0.62 for the reason every work surface in this file has
 *  its height: `work` drops the hands to about 0.56 on a brute, and a desk at a
 *  plausible 0.75 leaves them floating over it. */
const MINT_CONSOLE: Piece = [
	box(-0.62, 0.62, -0.3, 0.3, 0, 0.54),
	box(-0.68, 0.68, -0.34, 0.34, 0.54, 0.62)
];
/** Upright and offset along the console, not in front of him. A panel at his own
 *  `e` stands across his chest and his visor — the `ca` press mistake. */
const CONSOLE_PANEL: Piece = [box(-0.19, 0.19, -0.31, -0.27, 0.62, 0.88)];

const FORGE_WALL: Piece = [box(-5, 5, -0.07, 0.07, 0, 3.6)];
/** One low band. The wall is the biggest surface on the card and a flat field of
 *  it has no size; this is the cheapest horizontal that cannot collide with the
 *  column, because it sits behind the tray rather than beside the token. */
const FORGE_SKIRT: Piece = [box(-5, 5, -0.14, 0.14, 0.3, 0.42)];

/**
 * ── THE BYPASS ───────────────────────────────────────────────────────────────
 * A line that stops, and a line that does not.
 *
 * The two heights are the whole design. They land 1.1 apart on screen — about
 * 36px on a printed card — so the eye reads two separate runs rather than one
 * run at an angle, and the deeper one sits higher for free because depth is
 * worth height under this camera. Nothing here needed a diagonal to say two
 * paths.
 */
const FRK_DEAD_H = 0.82;
const FRK_LIVE_H = 1.62;

/**
 * The old critical path. Runs in from the left edge and ends.
 *
 * EMPTY, and that is the comparison — it carries nothing where the one behind it
 * carries five. It is also the nearest object on the card, which puts it lowest
 * in the frame: the thing you used to depend on, down at the front, with nothing
 * on it.
 */
const FRK_DEAD: Piece = [
	box(-3.6, 0.3, -0.18, 0.18, FRK_DEAD_H, FRK_DEAD_H + 0.16),
	...[-3.0, -1.8, -0.6].map((e) => box(e - 0.07, e + 0.07, -0.09, 0.09, 0, FRK_DEAD_H))
];

/**
 * The plate bolted over its end, and the single most important small object on
 * the card: it is the difference between a line somebody CAPPED and a line that
 * broke.
 *
 * Wider and taller than the beam it stops, because square on we see its edge
 * rather than its face — a plate whose normal runs east presents a sliver to a
 * camera looking down north. Overhanging the beam on all four sides is what
 * turns that sliver into a legible buffer stop.
 */
const FRK_CAP: Piece = [box(0.3, 0.52, -0.32, 0.32, 0.58, 1.22)];

/**
 * The bypass. Full width, no end in frame, and two legs only.
 *
 * Legs at the outside positions and none in the middle: uprights at the pitch
 * this beam would really need would cross the building, the Architect and the
 * dead line's terminus, and a card whose subject is two clear runs cannot afford
 * three more verticals through the middle of it.
 */
const FRK_LIVE: Piece = [
	box(-3.8, 3.8, -0.2, 0.2, FRK_LIVE_H, FRK_LIVE_H + 0.16),
	...[-2.5, 2.2].map((e) => box(e - 0.08, e + 0.08, -0.1, 0.1, 0, FRK_LIVE_H))
];

/** What is on it. Five, evenly pitched, sitting on top of the beam — the load is
 *  the only thing on this card that says "critical path", and one parcel is a
 *  delivery where five is a route. */
const FRK_LOAD: Piece = [-2.15, -1.05, 0.05, 1.15, 2.25].map((e) =>
	box(e - 0.24, e + 0.24, -0.22, 0.22, FRK_LIVE_H + 0.16, FRK_LIVE_H + 0.5)
);

/** The diverter. Top at 0.6 for the reason every work surface in this file has
 *  its height: `work` drops a standing brute's hands to about 0.55, and a
 *  console any higher is one the pose cannot reach. */
const FRK_DIVERTER: Piece = [
	box(-0.34, 0.34, -0.26, 0.26, 0, 0.52),
	box(-0.4, 0.4, -0.3, 0.3, 0.52, 0.6)
];
/** Upright on the front face, not lying on the deck — a flat face foreshortens
 *  to a sixth of its width at this tilt, which is the lesson `ca`'s writ paid
 *  for. The only lit thing on the card. */
const FRK_LAMP: Piece = [box(-0.16, 0.16, -0.31, -0.27, 0.6, 0.74)];

/**
 * ── THE PATCH FRAME ──────────────────────────────────────────────────────────
 * Two hundred and sixteen sockets, four of them in use.
 *
 * The EMPTINESS is the object. An allowlist is defined by what is not on it, and
 * the only honest way to draw an absence is at a scale where it dwarfs what is
 * present — so the grid runs off three edges and the four cables occupy about a
 * fiftieth of it. Nothing on this card states the ratio; the ratio is the card.
 *
 * Every dimension is set by the smallest mark that survives 136px: the frame
 * shows about 29 pixels to the pace, so a port at 0.11 is three pixels and a
 * column pitch of 0.30 is nine. Under that the field turns to flat tone and
 * stops being countable, which is the one thing it must remain.
 */
const EGR_COLS = Array.from({ length: 24 }, (_, i) => -3.45 + 0.3 * i);
const EGR_ROWS = Array.from({ length: 9 }, (_, i) => 0.55 + 0.38 * i);
/** Which row is patched. The second, not the first — a lead leaving the bottom
 *  row runs level to the floor machine and reads as one more rail. It needs a
 *  slope to read as a cable. */
const EGR_PATCHED_H = EGR_ROWS[1];
const EGR_NAMED_AT = [1.05, 1.35, 1.65, 1.95];

const EGR_PORTS: Piece = EGR_ROWS.flatMap((h) =>
	EGR_COLS.map((e) => box(e - 0.055, e + 0.055, -0.04, 0.04, h, h + 0.13))
);

/** The channel rails. Nine boxes, and they are what stop the field reading as
 *  perforated sheet: a grid of holes is a material, and a grid of holes in
 *  horizontal runs is equipment somebody installed. */
const EGR_RAILS: Piece = EGR_ROWS.map((h) => box(-3.62, 3.62, -0.03, 0.03, h - 0.09, h - 0.045));

/** Collars on the four that are used. The brightest marks on the card, and the
 *  literal content of "name every host" — four sockets out of the field with
 *  something in them. */
const EGR_NAMED: Piece = EGR_NAMED_AT.map((e) =>
	box(e - 0.075, e + 0.075, -0.07, -0.04, EGR_PATCHED_H - 0.02, EGR_PATCHED_H + 0.15)
);

/**
 * The four permitted routes.
 *
 * `beam` because nothing in `pieces` can make a diagonal, and a cable that is
 * not diagonal is a rail. They fan from a wide pitch at the board to a narrow
 * one at the machine, which is what makes four separate lines read as one bundle
 * going to one place — parallel they would be four unrelated wires.
 */
const EGR_LEADS: Piece = EGR_NAMED_AT.map((e, i) =>
	beam({ e, h: EGR_PATCHED_H + 0.06 }, { e: -1.48 + i * 0.12, h: 0.52 }, 0.04)
);

/**
 * The thing on the end of them.
 *
 * Small, matte, and deliberately unremarkable — it is the workload, not a
 * threat, and the card is about what it is allowed rather than what it is. The
 * vent band does the same job as `sweep`'s louvres: a plain box is a crate, and
 * a box with a stack of slots in it is a machine that could be talking to
 * something.
 */
const EGR_LOAD: Piece = [
	box(-0.36, 0.36, -0.26, 0.26, 0, 0.62),
	...[0.14, 0.24, 0.34].map((h) => box(-0.26, 0.06, -0.29, -0.26, h, h + 0.05))
];
const EGR_LOAD_LAMP: Piece = [box(0.1, 0.28, -0.29, -0.26, 0.44, 0.5)];

/** The board itself. Tall enough to run off the top of the frame — a wall that
 *  ends inside the card is a cabinet, and this one has to feel like it has no
 *  top. */
const EGR_FRAME: Piece = [box(-5, 5, -0.07, 0.07, 0, 4.6)];

/**
 * ── THE BOUND KEY ────────────────────────────────────────────────────────────
 * A reader with a key in it, held to the desk by an arm a hand long, and a
 * sign-in page across the room that the arm does not reach.
 *
 * THE ARM IS THE CARD and every other dimension serves it. Origin binding is a
 * credential that works at exactly one place, and a thing that works at exactly
 * one place is a thing on a tether — so the security property becomes a LENGTH,
 * which is a quantity a picture can carry. The arm is 0.46 and the gap to the
 * page is 2.9: one to seven, and nobody has to be told what that means.
 *
 * The station is deliberately not a screen. `takeover` is two identical pages
 * and a man who cannot tell them apart; the answer to it cannot be a third page.
 * Origin binding lives in the device rather than in what is displayed, so the
 * real end of this card is hardware — a slot in a desk — and the only screen in
 * the frame is the fake one.
 */
const WAN_DESK_H = 0.78;

/** Waist height, and the one surface in this file whose height is NOT set by a
 *  pose — nobody touches it. It is set by the key instead: the reader and the
 *  thing standing out of it have to clear the desk edge and still sit below the
 *  walking figure's shoulder, or the card's one bright mark is lost against a
 *  body. */
const WAN_DESK: Piece = [
	box(-0.7, 0.7, -0.3, 0.3, 0, WAN_DESK_H - 0.08),
	box(-0.78, 0.78, -0.36, 0.36, WAN_DESK_H - 0.08, WAN_DESK_H)
];

/** The reader, and the slot in its face. The slot is a separate dark solid
 *  rather than a hole: the renderer has no apertures, and at this size a recess
 *  drawn as a dark bar reads exactly as well as one that is really there. */
const WAN_READER: Piece = [
	box(-0.2, 0.2, -0.18, 0.18, WAN_DESK_H, WAN_DESK_H + 0.2),
	box(-0.12, 0.12, -0.21, -0.18, WAN_DESK_H + 0.05, WAN_DESK_H + 0.12)
];

/** What is in the slot. Small, and the only saturated blue on the card — a
 *  credential doing its job silently should be the brightest object and the
 *  least dramatic one. */
const WAN_KEY: Piece = [box(-0.1, 0.1, -0.07, 0.07, WAN_DESK_H + 0.2, WAN_DESK_H + 0.36)];

/**
 * The tether: a plate bolted to the desk and a rigid arm off it.
 *
 * `beam` because the arm has to be DIAGONAL — a horizontal link reads as a shelf
 * and a vertical one as a stalk, and neither says restraint. Nothing in `pieces`
 * extrudes off-axis, which is the whole reason that helper exists.
 *
 * Short on purpose and no shorter than legible: 0.46 is about fourteen pixels at
 * card size, enough to read as a connector and small enough that the gap it
 * cannot cross is obviously an order of magnitude bigger.
 */
const WAN_ANCHOR: Piece = [box(-0.62, -0.44, -0.14, 0.14, WAN_DESK_H, WAN_DESK_H + 0.06)];
const WAN_ARM: Piece = [
	beam({ e: -0.53, h: WAN_DESK_H + 0.05 }, { e: -0.07, h: WAN_DESK_H + 0.23 }, 0.05)
];

/**
 * The page he is walking to.
 *
 * The same object `takeover` uses, at the same size, with the same four rows.
 * Quoted deliberately: the deck should be able to see that this is the answer to
 * that card, and the way to say so is to put its bait in this frame unchanged
 * and have it not work.
 *
 * Its own constants rather than a reuse of `PAGE_W`/`PAGE_H`, so a future retune
 * of one card cannot silently restage the other.
 */
const WAN_PAGE_W = 0.56;
const WAN_PAGE_H = 0.82;
const WAN_PAGE: Piece = [box(-WAN_PAGE_W, WAN_PAGE_W, -0.02, 0.02, 0, WAN_PAGE_H)];
const WAN_PAGE_ROWS: Piece = [
	box(-WAN_PAGE_W + 0.1, WAN_PAGE_W - 0.28, -0.06, -0.03, 0.63, 0.71),
	box(-WAN_PAGE_W + 0.1, WAN_PAGE_W - 0.1, -0.06, -0.03, 0.42, 0.52),
	box(-WAN_PAGE_W + 0.1, WAN_PAGE_W - 0.1, -0.06, -0.03, 0.26, 0.36),
	box(-WAN_PAGE_W + 0.1, -WAN_PAGE_W + 0.42, -0.06, -0.03, 0.08, 0.19)
];

/** Its stand. Tall enough to put the page at a standing figure's eye line, which
 *  is what makes it a thing somebody walks up to rather than a thing lying
 *  about. */
const WAN_STAND: Piece = [
	box(-0.09, 0.09, -0.09, 0.09, 0, 1.2),
	box(-0.34, 0.34, -0.26, 0.26, 0, 0.06)
];

const WAN_WALL: Piece = [box(-5, 5, -0.07, 0.07, 0, 3.6)];
/** One course, hung above the hat line and below the badge band. A wall with no
 *  horizontal has no size; one that runs through the corner badges has no
 *  manners. */
const WAN_COURSE: Piece = [box(-5, 5, -0.16, 0.16, 1.95, 2.1)];

/**
 * ── THE REBUILD BENCH ────────────────────────────────────────────────────────
 * The same crate twice: once sealed, once made of parts you can see through.
 *
 * `RBD_CRATE_W` and `RBD_CRATE_H` are shared by both, and that sharing is the
 * card. An artifact and its rebuild are the same object to the millimetre — what
 * differs is whether you can see into it — so the two shapes are authored off
 * one pair of constants and any edit that changes one changes both. Two crates
 * that drifted apart in size would quietly turn a comparison into two objects.
 *
 * The crate is quoted from `divergence` on purpose. That card is the unit you
 * cannot watch — cold in, hot out, the swap behind a building. This is the same
 * unit answered without ever opening one.
 */
const RBD_CRATE_W = 0.36;
const RBD_CRATE_H = 0.42;
const RBD_CRATE_D = 0.25;

/** The artifact. One solid, and the only object on this card with no gaps and no
 *  light — which is the whole of what "artifact" means here. */
const RBD_CRATE: Piece = [box(-RBD_CRATE_W, RBD_CRATE_W, -RBD_CRATE_D, RBD_CRATE_D, 0, RBD_CRATE_H)];

/** Two straps, standing proud of the faces so they catch their own edge. Flush
 *  they are stripes painted on a box; proud they are the reason it is shut. */
const RBD_BANDS: Piece = [
	box(-0.2, -0.13, -RBD_CRATE_D - 0.03, RBD_CRATE_D + 0.03, 0, RBD_CRATE_H),
	box(0.13, 0.2, -RBD_CRATE_D - 0.03, RBD_CRATE_D + 0.03, 0, RBD_CRATE_H)
];

/**
 * The cross on it. `beam` twice, because nothing built from `box` can make a
 * diagonal and a cross is two of them.
 *
 * CHALK, not a warning lamp — see the shot's colour. Nobody has established that
 * this crate is dangerous. Somebody has established that it is not going to be
 * used, which is a far cheaper finding and the one this card actually relies on.
 */
const RBD_MARK: Piece = [
	beam({ e: -0.24, h: 0.09 }, { e: 0.24, h: 0.34 }, 0.026),
	beam({ e: -0.24, h: 0.34 }, { e: 0.24, h: 0.09 }, 0.026)
];

/**
 * The same crate, made again out of members.
 *
 * Four corner posts and four rails, sized so the outer envelope matches
 * `RBD_CRATE` exactly. Eight solids where the artifact is one, and the gaps
 * between them are the point: "whatever was hiding in it does not survive the
 * trip" is a claim about VOLUME, and this shape has none to hide in.
 *
 * The members are 0.1 across, about three pixels on a printed card. That is
 * deliberately at the edge of what resolves — an open frame that reads as a
 * solid box would say the opposite of the card, so if it goes mushy the members
 * want to be thinner and fewer rather than thicker.
 */
const RBD_LATTICE: Piece = [
	...[-0.31, 0.31].flatMap((e) =>
		[-0.2, 0.2].map((n) => box(e - 0.05, e + 0.05, n - 0.05, n + 0.05, 0, RBD_CRATE_H))
	),
	...[-0.2, 0.2].flatMap((n) =>
		[0, RBD_CRATE_H - 0.05].map((h) =>
			box(-RBD_CRATE_W, RBD_CRATE_W, n - 0.04, n + 0.04, h, h + 0.05)
		)
	)
];

/**
 * The bench. One surface, and that is its job.
 *
 * Both crates stand on it at one height, which is the only arrangement in which
 * they are comparable — the artifact on the floor and the rebuild on a table
 * would be a card about a promotion. Top at 0.58 because `work` drops a brute's
 * hands to about 0.56 and a surface his pose cannot reach is furniture he is
 * loitering beside.
 *
 * Panelled on the FAR side only and open toward the camera, so the spares
 * stacked against it in front read as being on the floor rather than inside it.
 */
const RBD_BENCH: Piece = [
	box(-2.4, 2.4, -0.42, 0.42, 0.5, 0.58),
	box(-2.4, 2.4, 0.3, 0.42, 0, 0.5),
	box(-2.4, -2.26, -0.42, 0.42, 0, 0.5),
	box(2.26, 2.4, -0.42, 0.42, 0, 0.5)
];

/**
 * Source stock on the wall: a rail with reels hung off it.
 *
 * Two jobs and both matter. It is the thing being rebuilt FROM, which the card
 * otherwise only implies through the lattice; and it fills the upper band, which
 * on a bench-height subject in a nearly square window is otherwise half the card
 * of bare wall. Hung at 1.78 rather than higher so it clears the cost gem.
 */
const RBD_REELS: Piece = [
	box(-1.5, 1.5, -0.06, 0.06, 0.34, 0.4),
	...[-1.15, -0.575, 0, 0.575, 1.15].map((e) => box(e - 0.16, e + 0.16, -0.09, 0.09, 0, 0.34))
];

const RBD_WALL: Piece = [box(-4.6, 4.6, -0.07, 0.07, 0, 3.4)];

/**
 * ── THE READING ROOM ─────────────────────────────────────────────────────────
 * A lit table with one archive box open on it, and the rack it came off behind.
 *
 * The inversion of `sweep`, and every dimension serves it. That card is WIDE and
 * FLAT — a rank of four cabinets under one pass, `wide: true`, power 1 RGN. This
 * one is NARROW and DEEP: one box, opened, in front of thirty more that are not.
 * It costs twice as much for a single site, and the rack is what says why.
 *
 * The light is the other half. `sweep` waits for its targets to emit and sorts
 * them by whether they do; here the light is the INSTRUMENT and the material is
 * laid on top of it. Nothing on this card is asked to announce itself.
 */
const RTH_TABLE_H = 0.72;

/** The table. A frame on two end legs, so the light has an inside to be in — a
 *  solid pedestal is a plinth and reads as furniture rather than as apparatus. */
const RTH_TABLE: Piece = [
	box(-1.1, 1.1, -0.55, 0.55, RTH_TABLE_H - 0.12, RTH_TABLE_H),
	box(-1.1, -0.96, -0.5, 0.5, 0, RTH_TABLE_H - 0.12),
	box(0.96, 1.1, -0.5, 0.5, 0, RTH_TABLE_H - 0.12)
];

/**
 * The seam the light gets out of, on the table's FRONT FACE.
 *
 * Not the top surface, which is where a light table's light actually comes from
 * — a horizontal lit plane foreshortens to about a sixth of its own width at
 * this camera's tilt, the lesson `ca`'s writ paid for. A lit vertical is a mark
 * and a lit horizontal is a sliver, so the glow goes where it can be seen and
 * the top is left to be the surface things sit on.
 */
const RTH_TABLE_SEAM: Piece = [box(-1.02, 1.02, -0.57, -0.53, RTH_TABLE_H - 0.09, RTH_TABLE_H - 0.03)];

/**
 * An archive box, open. Base and four low walls, no top.
 *
 * The walls stop at 0.2 because what is inside has to clear them. Any deeper and
 * this is a container with something hidden in it, which is a picture of the
 * problem rather than of the answer.
 */
const RTH_BOX: Piece = [
	box(-0.42, 0.42, -0.3, 0.3, 0, 0.04),
	box(-0.42, 0.42, -0.3, -0.26, 0.04, 0.2),
	box(-0.42, 0.42, 0.26, 0.3, 0.04, 0.2),
	box(-0.42, -0.38, -0.3, 0.26, 0.04, 0.2),
	box(0.38, 0.42, -0.3, 0.26, 0.04, 0.2)
];

/** Its lid, off and lying flat beside it. One prop, one job: a box that arrived
 *  open is a delivery, and a box with its lid next to it was opened by somebody. */
const RTH_LID: Piece = [box(-0.44, 0.44, -0.32, 0.32, 0, 0.035)];

/** How high the rack stands, and where its boards sit. Topped out at 2.2 so the
 *  cost gem's corner is clear — the rack runs the full width of the card and a
 *  taller one puts a shelf board straight through the badge. */
const RTH_RACK_H = 2.2;
const RTH_SHELVES = [0.38, 0.82, 1.26, 1.7];

const RTH_RACK: Piece = [
	...[-2.9, -1.45, 0, 1.45, 2.9].map((e) => box(e - 0.07, e + 0.07, -0.4, 0.4, 0, RTH_RACK_H)),
	...RTH_SHELVES.map((h) => box(-2.9, 2.9, -0.4, 0.4, h, h + 0.07))
];

/**
 * What is stored on it — thirty-one identical closed boxes, and one gap.
 *
 * The gap is the card's price. One box is off the shelf and open on the table;
 * everything else is still up there unread, and that is ap 2 for a single site
 * against `sweep`'s ap 1 for a whole region. A method that works and does not
 * scale has to show both halves, and an empty slot is the cheapest way to say
 * the second one.
 *
 * Uniform on purpose, unlike `shortlived`'s jittered heap. That pile is
 * accumulation and wants to look tipped in; this is somebody's filing, and what
 * makes it filing is that every one of them is squared up and the same.
 */
const RTH_STORED: Piece = RTH_SHELVES.flatMap((h, row) =>
	[-2.55, -2.0, -1.1, -0.55, 0.35, 0.9, 1.8, 2.35]
		// The slot the open box came out of. Second shelf, left of centre — high
		// enough to be seen against the rack rather than lost at floor level, and
		// not on the top row where the frame is already crowded.
		.filter((e) => !(row === 1 && e === -0.55))
		.map((e) => box(e - 0.24, e + 0.24, -0.32, 0.28, h + 0.07, h + 0.43))
);

const RTH_WALL: Piece = [box(-5, 5, -0.07, 0.07, -1, 3.6)];

/**
 * ── THE CHAIN OF CUSTODY ─────────────────────────────────────────────────────
 * A run of sealed tags on one unbroken line, from a stack of source to the crate
 * that came out of it.
 *
 * The THREAD is the piece that matters. Seven seals are seven separate facts;
 * seven seals threaded on one continuous line are a chain, and a chain has the
 * property this card is about — take one link out and it stops being one. It is
 * authored as a single long solid rather than as segments between the tags for
 * exactly that reason: a line assembled from gaps could have a gap.
 *
 * Everything stands UPRIGHT. A tag lying flat foreshortens to about a sixth of
 * its own width at this tilt. At card size a lit horizontal is nothing and a lit
 * vertical is a mark.
 */
const ATT_STEPS = 7;
const ATT_PITCH = 0.53;
/**
 * Bench height, set by the POSE rather than by furniture. `work` swings a
 * standing brute's arms about 53° forward off a shoulder at 0.82, putting the
 * hands near 0.55 — a bench at a plausible 0.7 is one the figure cannot touch,
 * and a man whose hands hover above his own work is a man standing next to it.
 */
const ATT_BENCH_H = 0.55;
const ATT_TAG_H = 0.28;

/** Centre of step `i`, measured out from the middle so the run stays symmetric
 *  whatever `ATT_STEPS` is set to. */
const attAt = (i: number) => (i - (ATT_STEPS - 1) / 2) * ATT_PITCH;

const ATT_TAGS: Piece = Array.from({ length: ATT_STEPS }, (_, i) => {
	const e = attAt(i);
	return box(e - 0.14, e + 0.14, -0.04, 0.04, ATT_BENCH_H, ATT_BENCH_H + ATT_TAG_H);
});

/** The lit face of each. On the camera side of its own tag, so the tag is the
 *  object and the seal is what the object is showing you. */
const ATT_SEALS: Piece = Array.from({ length: ATT_STEPS }, (_, i) => {
	const e = attAt(i);
	return box(e - 0.1, e + 0.1, -0.075, -0.04, ATT_BENCH_H + 0.09, ATT_BENCH_H + 0.19);
});

/**
 * The line they all sit on.
 *
 * BEHIND the tags, not in front. `paint` sorts by facet centroid and the tags
 * are the nearer object, so it passes behind each one and shows in the gaps —
 * which is what makes it read as running the whole length rather than as a rail
 * the tags are standing on.
 */
const ATT_THREAD: Piece = [box(-2.05, 2.05, -0.02, 0.02, ATT_BENCH_H + 0.115, ATT_BENCH_H + 0.145)];

/** What was written. Stepped rather than square: a stack that narrows is a pile
 *  of things and a box is a box. */
const ATT_SOURCE: Piece = [
	box(-0.3, 0.3, -0.24, 0.24, 0, 0.09),
	box(-0.27, 0.27, -0.21, 0.21, 0.09, 0.17),
	box(-0.24, 0.24, -0.18, 0.18, 0.17, 0.24)
];

/** What shipped. `divergence`'s crate on purpose — that card is the attack this
 *  one answers, and the artifact at the end of the line should be recognisably
 *  the same object it loses track of. */
const ATT_ARTIFACT: Piece = [box(-0.32, 0.32, -0.28, 0.28, 0, 0.5)];

/** The seal on either end. Same treatment as the ones along the run, because the
 *  two ends are steps like any other — that is the whole of "from source to
 *  artifact". */
const ATT_END_SEAL: Piece = [box(-0.13, 0.13, -0.03, 0.03, 0, 0.12)];

/** The bench. Runs off both edges, and it is what hides his legs — a card whose
 *  subject is a row of eight-pixel objects cannot spend a third of its height on
 *  somebody's boots. */
const ATT_BENCH: Piece = [
	box(-3.4, 3.4, -0.42, 0.42, 0, ATT_BENCH_H - 0.08),
	box(-3.5, 3.5, -0.5, 0.5, ATT_BENCH_H - 0.08, ATT_BENCH_H)
];

const ATT_WALL: Piece = [box(-5, 5, -0.07, 0.07, 0, 3.4)];
/** One course, hung twice. Two horizontals stop the biggest surface on the card
 *  being a flat field with no size, and shelving is what a registry has. Both
 *  sit above the head, so neither crosses a face. */
const ATT_SHELF: Piece = [box(-4.4, 4.4, -0.2, 0.2, 0, 0.13)];

/**
 * ── THE SEAL ─────────────────────────────────────────────────────────────────
 * A ring of standing light around a building that has gone dark.
 *
 * It is a PALISADE and not a dome or a wall, and the `fx` file is where that
 * came from: the board animation for a throw into a quarantine is "a barrier
 * snaps up over the region partway through the roll". Snaps UP. So it rises out
 * of the ground, and the lit pads at the foot of each bar are the half of that a
 * still frame can show.
 *
 * Sixteen uprights rather than eight. The bars are three pixels wide on a
 * printed card and what has to survive that size is not any one of them but the
 * ENCLOSURE — and an enclosure needs the near arc to read as a fence rather than
 * as four posts somebody left out.
 */
const QAR_R = 1.7;
const QAR_H = 3.4;
const QAR_N = 16;

/** Where each bar stands on the circle. Shared by the bars and their pads so the
 *  two can never drift apart. */
const QAR_RING: [number, number][] = Array.from({ length: QAR_N }, (_, i) => {
	const a = (i / QAR_N) * Math.PI * 2;
	return [QAR_R * Math.sin(a), QAR_R * Math.cos(a)];
});

const QAR_CAGE: Piece = QAR_RING.map(([e, n]) =>
	box(e - 0.055, e + 0.055, n - 0.055, n + 0.055, 0, QAR_H)
);

/** Light on the ground at the foot of each bar. Dimmer than the bars by a wide
 *  margin — a floor is lit BY a thing, and a pad as bright as its own source
 *  reads as a hole in the ground rather than as a reflection. */
const QAR_FOOT: Piece = QAR_RING.map(([e, n]) =>
	box(e - 0.11, e + 0.11, n - 0.11, n + 0.11, 0, 0.025)
);

/**
 * The one window still lit, and the whole of what stops this being a card about
 * a problem being solved.
 *
 * Small, red, emitting, and BEHIND the near arc so the bars cross in front of
 * it. Drawn in the same red the live implants on `sweep` are drawn in, because
 * in this deck a red emitter means a hostile thing that is switched on — and the
 * point of a quarantine is that it still is.
 */
const QAR_HELD: Piece = [box(-0.22, 0.22, -0.02, 0.02, 0, 0.3)];

/**
 * ── THE LONG JOB ─────────────────────────────────────────────────────────────
 * A wall that already stands, a low band of new work along the foot of it, and a
 * pallet holding most of what is still to come.
 *
 * The wall is SEVEN BAYS rather than one slab, and that is a depth-sort
 * requirement before it is a design one. `paint` orders by facet centroid, and
 * at the deck's bearing east counts as distance as well as height counting as
 * nearness — so one slab five paces tall spanning eleven paces of east has a
 * single facet whose centroid buys it enough false nearness to paint over a
 * pallet standing a pace and a half in front of it. Cut into bays, each facet's
 * centroid is local and the sort comes out right — and a long wall with a
 * vertical rhythm reads as masonry rather than as a colour field, which is
 * `exception`'s piers earning their keep a second time.
 */
const HRD_H = 5.2;
const HRD_BAY = 1.6;
const HRD_BAYS = [-4.8, -3.2, -1.6, 0, 1.6, 3.2, 4.8];

const HRD_WALL: Piece = HRD_BAYS.map((e) =>
	box(e - HRD_BAY / 2, e + HRD_BAY / 2, -0.5, 0.5, 0, HRD_H)
);

/** The joints, standing proud. Butted bays alone are one flat plane with
 *  invisible seams; a strip at each join is what makes the rhythm visible. */
const HRD_PIERS: Piece = [-5.6, -4, -2.4, -0.8, 0.8, 2.4, 4, 5.6].map((e) =>
	box(e - 0.09, e + 0.09, -0.62, -0.5, 0, HRD_H)
);

/**
 * What has been laid so far.
 *
 * Deliberately SHORT. It runs a third of the visible wall and stops, and the
 * stopping is the card — a skin that ran the full width would be a finished job,
 * which is the one thing this card is not about.
 */
const HRD_SKIN: Piece = [
	box(-1.6, 0.15, -0.22, 0.22, 0, 0.58),
	box(-1.6, 0.15, -0.25, -0.22, 0.19, 0.23),
	box(-1.6, 0.15, -0.25, -0.22, 0.39, 0.43)
];

/**
 * The course he is actually on: five blocks with joints between them, ending a
 * block short of the skin below.
 *
 * The gaps are three pixels on a printed card and will not survive on their own.
 * They are not what carries it — the row STOPPING before the course under it
 * does, and that reads at any size.
 */
const HRD_COURSE: Piece = [-1.42, -0.88, -0.34, 0.2, 0.74].map((e) =>
	box(e - 0.22, e + 0.22, -0.2, 0.2, 0, 0.2)
);

/**
 * The pallet, and it is the argument rather than the scenery.
 *
 * Five courses, the top one broken into — this is where the blocks in the wall
 * came from, and the amount missing from it is the amount of progress made. Two
 * blocks per layer rather than one slab, because a stack of slabs is a crate and
 * a stack of blocks is materials.
 */
const HRD_PALLET: Piece = [
	box(-0.52, 0.52, -0.42, 0.42, 0, 0.13),
	...[0.13, 0.35, 0.57, 0.79].flatMap((h) => [
		box(-0.48, -0.02, -0.38, 0.38, h, h + 0.2),
		box(0.02, 0.48, -0.38, 0.38, h, h + 0.2)
	]),
	// The top course, one block gone.
	box(-0.48, -0.02, -0.38, 0.38, 1.01, 1.21)
];

/** The delivery note on the side of it. The only object here that says this was
 *  BOUGHT — the yaml is explicit that on a third party this card is a cheque or
 *  a contract clause rather than a config change, and a pallet nobody paid for
 *  would make it a picture of labour instead. */
const HRD_DOCKET: Piece = [box(-0.16, 0.16, -0.45, -0.42, 0.52, 0.78)];

/** One work light on a stand. Nothing else on the card is lit, and a single lamp
 *  is the cheapest way to say the rest of the site has gone home. */
const HRD_LAMP: Piece = [
	box(-0.05, 0.05, -0.05, 0.05, 0, 1.18),
	box(-0.26, 0.26, -0.14, 0.14, 1.18, 1.34)
];
const HRD_LAMP_GLOW: Piece = [box(-0.22, 0.22, -0.16, -0.14, 1.2, 1.32)];

/**
 * ── THE MILL FLOOR ───────────────────────────────────────────────────────────
 * Two piles of the same thing, and the only difference between them is that
 * somebody has already been through one of them.
 *
 * Every unit here is the identical solid and both piles hold sixteen. That is
 * not economy, it is the argument: an inventory does not change what you ship,
 * it changes whether what you ship is addressable. So the counted pile is not
 * cleaner, smaller, newer or a different colour — same sacks, same quantity, in
 * courses instead of a heap. If the two ever stop being obviously equal in mass
 * the card has started saying something else.
 */
const INV_UNIT_W = 0.22;
const INV_UNIT_D = 0.17;
const INV_UNIT_H = 0.28;
const invSack = (e: number, n: number, h: number) =>
	box(e - INV_UNIT_W, e + INV_UNIT_W, n - INV_UNIT_D, n + INV_UNIT_D, h, h + INV_UNIT_H);

/**
 * As it arrived. Five, four, three, two, one — jittered in all three axes,
 * because a stack is a thing somebody put away and a HEAP is a thing that
 * accumulated. The sixteenth is on the floor at the foot of it, off the pile
 * entirely: one unit that has rolled clear is what stops a tidy triangle reading
 * as deliberate.
 */
const INV_MOUND: Piece = (
	[
		[-0.82, -0.06, 0],
		[-0.39, 0.08, 0],
		[0.02, -0.09, 0],
		[0.41, 0.05, 0],
		[0.79, -0.04, 0],
		[-0.58, 0.04, 0.235],
		[-0.21, -0.07, 0.24],
		[0.19, 0.06, 0.23],
		[0.61, -0.03, 0.245],
		[-0.42, -0.05, 0.475],
		[0.01, 0.07, 0.465],
		[0.42, -0.02, 0.48],
		[-0.19, 0.03, 0.71],
		[0.22, -0.06, 0.7],
		[0.01, -0.01, 0.945],
		[-1.06, 0.14, 0]
	] as [number, number, number][]
).map(([e, n, h]) => invSack(e, n, h));

/** The same sixteen, in four courses of four. No jitter anywhere — the total
 *  absence of it is the only thing distinguishing this pile from the other one,
 *  so a "natural" offset here would cost the card its subject. */
const INV_COURSE_E = [-0.69, -0.23, 0.23, 0.69];
const INV_COURSE_H = [0.12, 0.42, 0.72, 1.02];
const INV_STACK: Piece = INV_COURSE_H.flatMap((h) => INV_COURSE_E.map((e) => invSack(e, 0, h)));

/**
 * One mark on each counted sack, in the Hunter's own green.
 *
 * Four pixels wide on a printed card, which is the right size: sixteen of them
 * do not read as sixteen marks, they read as a TEXTURE the other pile does not
 * have. That is the correct amount of information — the player needs to know
 * these have been through something, not to be able to count the ticks.
 */
const INV_TICKS: Piece = INV_COURSE_H.flatMap((h) =>
	INV_COURSE_E.map((e) =>
		box(e - 0.08, e + 0.08, -INV_UNIT_D - 0.02, -INV_UNIT_D, h + 0.1, h + 0.17)
	)
);

/** The counted bay. The ordered pile stands on a pallet and the heap is on the
 *  floor, which is the one difference between them that is NOT the sacks — and
 *  it is what separates the two silhouettes at the base. */
const INV_PLINTH: Piece = [box(-1.02, 1.02, -0.52, 0.52, 0, 0.12)];

/**
 * The chute, still delivering.
 *
 * `panel` rather than boxes, because the one line that makes a hopper a hopper
 * is the taper. It hangs over the heap and not over the stack: the mill has not
 * stopped, the pile keeps growing, and an inventory is a practice rather than a
 * morning's work.
 */
const INV_CHUTE: Piece = [
	panel(
		[
			[-0.26, 1.55],
			[0.26, 1.55],
			[0.62, 2.55],
			[-0.62, 2.55]
		],
		0.34
	)
];
const INV_CHUTE_LIP: Piece = [box(-0.32, 0.32, -0.38, 0.38, 1.47, 1.55)];

/** A roof beam. Hung twice at two depths — one is a bar, two is a ceiling — and
 *  it fills the upper third, which two knee-high piles otherwise leave bare. */
const INV_GANTRY: Piece = [box(-3.4, 3.4, -0.15, 0.15, 0, 0.2)];

/** Its instrument. A frame with one lit bar in it: a READING, not a page. Rows
 *  of text would make this the fourth document in the deck and would put the list
 *  back into a card whose whole design is to keep it out. */
const INV_SLATE: Piece = [box(-0.17, 0.17, -0.03, 0.03, 0, 0.21)];
const INV_SLATE_READ: Piece = [box(-0.12, 0.12, -0.045, -0.03, 0.05, 0.12)];

const INV_WALL: Piece = [box(-5.5, 5.5, -0.07, 0.07, -1, 3.6)];

/**
 * ── THE RECORDS WALL ─────────────────────────────────────────────────────────
 * A rack of filed documents, a dead device above it, and one empty holder at the
 * front waiting for a replacement.
 *
 * The quantity is the subject and the rack is how it gets counted. Fifteen cells,
 * filled, in order, and NOTHING HAS MOVED — which is the whole difference between
 * this and a picture of a mess. Paper on the floor says somebody came in and made
 * a scene; a complete catalogue sitting exactly where it was filed and worth
 * nothing is what actually happens when a root leaves a trust store.
 *
 * The document size is one pair of numbers used twice, and that is load-bearing:
 * the plate on the post at the front is built to the same `RVK_DOC_W/H` as the
 * fifteen in the rack, so the eye can see the new one is the same kind of object
 * as the dead ones.
 */
const RVK_COLS = [-1.44, -0.72, 0, 0.72, 1.44];
const RVK_ROWS = [1.0, 1.44, 1.88];
const RVK_DOC_W = 0.26;
const RVK_DOC_H = 0.29;
/** Where the top shelf caps out. Named because three separate solids have to
 *  agree about it or the carcass grows a step. */
const RVK_TOP = RVK_ROWS[2] + RVK_DOC_H;

/** Shelves and dividers. The dividers are what make it a rack rather than three
 *  planks: fifteen slabs on three open shelves read as a pile with gaps, and the
 *  card cannot afford ambiguity about whether the set is complete. */
const RVK_RACK: Piece = [
	...RVK_ROWS.map((h) => box(-1.86, 1.86, -0.18, 0.18, h - 0.06, h)),
	box(-1.86, 1.86, -0.18, 0.18, RVK_TOP, RVK_TOP + 0.07),
	...[-1.8, -1.08, -0.36, 0.36, 1.08, 1.8].map((e) =>
		box(e - 0.06, e + 0.06, -0.18, 0.18, RVK_ROWS[0] - 0.06, RVK_TOP)
	)
];

/** Fifteen of them, one per cell, standing proud of the carcass front. The 0.08
 *  of clearance is not styling — `paint` sorts by facet centroid, and a document
 *  at the rack's own depth has almost exactly the rack's own centroid depth.
 *  Flush, the sort between them is a coin toss and the row flickers. */
const RVK_FILED: Piece = RVK_ROWS.flatMap((h) =>
	RVK_COLS.map((e) => box(e - RVK_DOC_W, e + RVK_DOC_W, -0.03, 0.03, h, h + RVK_DOC_H))
);

/** The post the new one goes on. Top at 0.58 for the reason every work surface in
 *  this file has its height: `work` drops a standing brute's hands to about 0.55,
 *  and a lectern at a plausible 0.9 is one the pose cannot reach. */
const RVK_POST: Piece = [
	box(-0.22, 0.22, -0.2, 0.2, 0, 0.5),
	box(-0.3, 0.3, -0.26, 0.26, 0.5, 0.58)
];

/** The holder, empty. Four thin members round a gap the size of a filed document
 *  — the renderer has no apertures, so an empty frame is a shape you leave out,
 *  the same way every window in this file is built. */
const RVK_FRAME: Piece = [
	box(-RVK_DOC_W - 0.04, RVK_DOC_W + 0.04, -0.28, -0.24, 0.58, 0.62),
	box(-RVK_DOC_W - 0.04, RVK_DOC_W + 0.04, -0.28, -0.24, 0.62 + RVK_DOC_H, 0.66 + RVK_DOC_H),
	box(-RVK_DOC_W - 0.04, -RVK_DOC_W, -0.28, -0.24, 0.58, 0.66 + RVK_DOC_H),
	box(RVK_DOC_W, RVK_DOC_W + 0.04, -0.28, -0.24, 0.58, 0.66 + RVK_DOC_H)
];

/** What goes into it when the card is played. Nearer than the frame so it sorts
 *  in front of it rather than into it. */
const RVK_PIN: Piece = [box(-RVK_DOC_W, RVK_DOC_W, -0.31, -0.27, 0.62, 0.62 + RVK_DOC_H)];

/** A ready-light on the post. The only thing lit before the card is played —
 *  without it the rest state has no emitter at all, and a card with no light in
 *  it reads as unfinished rather than as dark. */
const RVK_LAMP: Piece = [box(-0.09, 0.09, -0.21, -0.19, 0.28, 0.36)];

/**
 * The wall coming back, low and wide, on play only.
 *
 * `n 4.2` and not the wall's own 4.6, which looks like an error and is not: the
 * facet-centroid sort gives a four-pace wall a large depth bonus from its height,
 * so a knee-high wash at the same depth loses to it and never draws. Far enough
 * forward to win, and it costs a tenth of a pace of drop on screen.
 */
const RVK_BLOOM: Piece = [box(-4.6, 4.6, -0.02, 0.02, 0.05, 0.95)];

const RVK_WALL: Piece = [box(-5, 5, -0.07, 0.07, -1, 3.8)];

/**
 * ── THE SHADOW BOARD ─────────────────────────────────────────────────────────
 * Painted silhouettes with a tool on each, and one tool hanging in clear space.
 *
 * A diff is not two things side by side — the deck has spent that arrangement
 * three times over. A diff is one thing laid OVER another, where the answer is
 * the part that fails to coincide. A shadow board is that operation as furniture:
 * the paint is the source, the tools are what shipped, and an item with nothing
 * painted behind it is a file in the tarball with no counterpart in the tree.
 * That is the xz finding exactly, and it is an object rather than a diagram.
 *
 * EVERYTHING IS AUTHORED FROM ONE ORIGIN. Board, paint, items, caliper and lamp
 * are all placed at the same `e/n/h` and carry their offsets in their own
 * geometry, because the card's entire subject is whether things line up. Two
 * placements that had to agree would be two numbers that could stop agreeing.
 *
 * The `n` offsets are a depth-sort ladder, not styling: board 3.45, paint 3.225,
 * items 3.05, caliper 2.90. A small mark at the same depth as a tall board loses
 * to it — the `exception` seep bug.
 */
const DIF_COLS = [-1.15, -0.55, 0.05];
const DIF_ROWS = [0.45, 1.05];
/** Where the one with no paint behind it hangs. Off the grid in `e` — clear to
 *  the right of the last column, in space that was never allocated. */
const DIF_ODD_E = 0.85;
const DIF_ODD_H = 0.75;

const DIF_BOARD: Piece = [box(-1.55, 1.55, -0.05, 0.05, 0, 1.55)];

/** The paint. The source, and the only reason the board can be read at all. */
const DIF_MARKS: Piece = DIF_ROWS.flatMap((h) =>
	DIF_COLS.map((e) => box(e - 0.26, e + 0.26, -0.25, -0.2, h - 0.22, h + 0.22))
);

/** What shipped. Six of them, and the seventh is the SAME piece at the same size
 *  in the same colour — nothing about the object is different, which is the whole
 *  claim. */
const DIF_ITEMS: Piece = DIF_ROWS.flatMap((h) =>
	DIF_COLS.map((e) => box(e - 0.22, e + 0.22, -0.45, -0.35, h - 0.16, h + 0.16))
);
const DIF_ODD: Piece = [
	box(DIF_ODD_E - 0.22, DIF_ODD_E + 0.22, -0.45, -0.35, DIF_ODD_H - 0.16, DIF_ODD_H + 0.16)
];

/**
 * Two jaws either side of it.
 *
 * The marker is EXTERNAL and that is the point of it. On `sweep` the odd one
 * tells itself apart by not emitting — the instrument is passive and the object
 * gives itself away. Here the object gives nothing away; something else had to
 * measure it against a reference and say so.
 *
 * Flanking bars rather than a four-cornered box: at this size a corner bracket is
 * four two-pixel marks and reads as noise, where two verticals read as a pair
 * pointing at what is between them.
 */
const DIF_CALIPER: Piece = [
	box(DIF_ODD_E - 0.36, DIF_ODD_E - 0.27, -0.58, -0.52, DIF_ODD_H - 0.22, DIF_ODD_H + 0.22),
	box(DIF_ODD_E + 0.27, DIF_ODD_E + 0.36, -0.58, -0.52, DIF_ODD_H - 0.22, DIF_ODD_H + 0.22)
];

/** A strip under the board. Without it the board is a dark rectangle on a dark
 *  wall; with it the board is a thing somebody switched a light on to look at. */
const DIF_LAMP: Piece = [box(-1.4, 1.4, -0.3, -0.26, -0.1, -0.05)];

/** What the drone hovers over. It has no job but that one — a legless figure with
 *  nothing beneath it is legless, and one with a surface a clear gap below is
 *  flying. */
const DIF_BENCH: Piece = [
	box(-1.8, 1.8, -0.42, 0.42, 0, 0.78),
	box(-1.86, 1.86, -0.46, 0.46, 0.78, 0.85)
];

const DIF_WALL: Piece = [box(-4.5, 4.5, -0.07, 0.07, 0, 3.6)];

/**
 * The building a card is played AGAINST, when the card does not name one.
 *
 * `targets` first, because a card that names its targets has told us exactly
 * where it happens. Failing that the KIND is the next best answer. Never
 * nothing — an empty plot is a portrait again.
 */
const SETTING: Record<Ability['kind'], string> = {
	strike: 'forge',
	implant: 'archive',
	recon: 'observatory',
	control: 'checkpoint',
	econ: 'forum',
	utility: 'hut'
};

function stage(ability: Ability): string {
	for (const id of ability.targets ?? []) {
		const s = structureById(id);
		if (s) return s.piece;
	}
	return SETTING[ability.kind] ?? 'hut';
}

/**
 * How the crew is standing, from how the card says they arrive.
 *
 * Depth (`n`) is doing most of the work: a card is a shallow window and a crew
 * spread only sideways reads as a police line-up.
 */
function formation(vector: CardFx['vector'], i: number): { e: number; n: number } {
	switch (vector) {
		// A file at an angle to the building — a column reads as movement in a way
		// a row never does.
		case 'trace':
			return { e: -0.75 - i * 0.62, n: -0.3 - i * 0.5 };
		// Spread wide and apart. The distance between them is the tell: people who
		// do not want to be seen together.
		case 'seep':
			return { e: -1.15 - i * 0.95, n: 0.45 + i * 0.3 };
		case 'sweep':
			return { e: i % 2 ? 1.15 + i * 0.3 : -1.15 - i * 0.3, n: 0.2 + i * 0.55 };
		default:
			return { e: -0.7 - i * 0.85, n: 0.15 + i * 0.2 };
	}
}

/** Facing, for the derived shot: everyone looks at the building, which is what
 *  makes it the subject rather than a backdrop they happen to be near. */
const LOOK = -0.5;

/** A card's own patch of planet. Any stable spread of the key does; this one is
 *  a string hash, so adding a card never reshuffles the ground under the others. */
const seedOf = (key: string): number => {
	let h = 2166136261;
	for (let i = 0; i < key.length; i++) h = Math.imul(h ^ key.charCodeAt(i), 16777619);
	return h >>> 0;
};

/** The camera the whole deck is shot on. A card whose crew is spread wide must
 *  not get zoomed out to contain them while a card with one figure gets zoomed
 *  in — that draws the same character at three sizes across three cards. */
// The pitch is set by the GROUND, not by taste. A horizontal plane seen from a
// level camera projects to a sliver, so at the 0.08 this used to run at the
// terrain was technically present and optically absent. Enough tilt to give the
// ground some width, and not a degree more — the further the camera looks down,
// the more the place reads as a tabletop with pieces standing on it.
export const CAMERA = { pitch: 0.26, look: { e: 0.15, n: 1.4, h: 1.5, width: 4.3 } };

/** Scenery: well back from the cast in tone as well as in depth. A building lit
 *  as brightly as the people competes with them, and the people are the
 *  subject — the building is where the subject IS. */
export const BACKDROP = { tint: 0.42, size: 1.6, e: 1.9, n: 3.4, face: 0.42 };

/**
 * A card's own shot, overriding the derivation.
 *
 * Everything is optional and everything wins over the derived value. `cast` is
 * how many people are actually in the picture, which is deliberately NOT
 * `squad.count`: the squad is what the board animates crossing to a building
 * during resolution, and a card face is a different question — one person alone
 * is the strongest thing some of these cards can show, and the board still
 * sends three.
 */
export interface Shot {
	cast?: number;
	doing?: Doing;
	/** What the extras are doing, if it is not what the lead is doing. */
	crewDoing?: Doing;
	setting?: string;
	/**
	 * The lead, overriding the derivation. `h` because a figure is not always on
	 * the planet — put one in an upstairs room and the floor it is standing on is
	 * a number, not the ground.
	 *
	 * `Partial<Actor>` and not four coordinates, for the same reason `backdrop`
	 * is `Partial<Prop>`: the lead is dressed by `sceneFor` as the card's owner
	 * in their own kit, trim and plate colour, and a card whose whole subject is
	 * that you CANNOT tell the owner from the people around them has to be able
	 * to take that costume back off.
	 *
	 * `who` is a PARTIAL over the owner rather than a replacement, because the
	 * lead is the owner by definition — a figure who is somebody else is an
	 * authored `figure`. What it is for is repainting one: the key and the build
	 * stay whoever the card belongs to, which is what `wakes` finds them by and
	 * what keeps them the same silhouette they are on every other card.
	 */
	lead?: Partial<Omit<Actor, 'who'>> & { who?: Partial<CharacterSkin> };
	/**
	 * Whose eyes are not what they look like: the actor — by `who.key` — whose
	 * visor goes hostile the moment the card is PLAYED.
	 *
	 * A key rather than an index because the cast is assembled from three
	 * sources (the lead, the derived crew, the authored figures) and an index
	 * into that pile would silently point at somebody else the day a card's
	 * `cast` changes.
	 *
	 * WHICH one it is belongs to the card; WHETHER it has woken up does not —
	 * see `sceneFor`'s `played`. That split is the whole reason this is a field
	 * and not a second lamp baked into `figures`.
	 */
	wakes?: string;
	backdrop?: Partial<Prop>;
	/**
	 * A backdrop family painted UNDER the scene — see `$lib/backdrop`.
	 *
	 * CSS rather than geometry, and that is the whole reason it is worth having:
	 * the thing behind everything else on a card is a surface with no shape, and
	 * modelling one costs a solid, a depth sort and a decision about how big
	 * "big enough to never show an edge" is. Six of them are already written and
	 * tuned; a card that wants a milled plate behind it should use the milled
	 * plate, not a rectangle pretending to be one.
	 *
	 * Only `free`-cost families belong here. A card is drawn forty at a time.
	 */
	texture?: BackdropId;
	/** Custom properties for the texture layer — see `Backdrop`'s `styles`. */
	textureStyle?: string;
	/** Anything else in the shot — a bench, a crate, a sign. */
	extras?: Prop[];
	/**
	 * Props that are only in the shot once the card is PLAYED.
	 *
	 * The prop half of `wakes`. That field can turn one visor and nothing else,
	 * which covers a card whose play is a person changing their mind and no card
	 * whose play is the WORLD changing — a crack that starts letting go, a light
	 * that comes on, a door that opens.
	 *
	 * Appended after `extras` and never replacing them: playing a card adds to
	 * the picture, it does not redraw it. A card that looked like a different
	 * card once played would be two cards.
	 */
	whenPlayed?: Prop[];
	/**
	 * People the derivation would never produce.
	 *
	 * `cast` bends the CREW — the same shape, the same formation, dimmed. That
	 * covers "three of them arriving" and nothing else, and several cards are
	 * about somebody who is not on your side standing in a specific place doing
	 * a specific thing to you. Those are authored, one at a time, the same way
	 * a prop is: the crew is who came WITH you, and this is everyone else.
	 */
	figures?: Actor[];
	ground?: Partial<SceneSpec['ground']>;
	yaw?: number;
	pitch?: number;
	look?: SceneSpec['look'];
}

/**
 * Playing the scene — the same clips the Outfitter turns the mannequin with,
 * driving the people on a card.
 *
 * Deliberately NOT part of `Shot`: which frame of a walk a card is showing is
 * not a property OF the card, it is a property of the moment you are looking at
 * it. A card that stored its own frame would be a card that has to be re-saved
 * to animate.
 */
export interface SceneAnim {
	clip: ClipId;
	/** Where in the cycle, 0..1. Quantise it — see the note in `poses.ts`. */
	t: number;
	opts?: ClipOpts;
}

/**
 * How far out of step each extra is, in cycles.
 *
 * A crew all handed the same `t` walks in lockstep, which reads as a drill
 * squad rather than as several people who happen to be going the same way.
 * Irrational-ish spacing so nobody lands back in phase at a small crew size.
 */
const OFF_BEAT = 0.37;

const SHOT: Record<string, Shot> = {
	// ── Earnest Contribution ──────────────────────────────────────────────────
	// "Fix real bugs for real people. This is the majority of the attack and it
	// is not an attack."
	//
	// TWO WINDOWS AND THE WIRE BETWEEN THEM.
	//
	// Left: a house at night, and through its window a person sat at a desk,
	// typing. Right: a data centre at night, the SAME window at the SAME size,
	// and through it a rack — no people, just ports blinking in an empty room.
	// Down the middle, in the foreground, a telephone pole with its wire running
	// off both edges of the card.
	//
	// The rhyme is the card. He fixed something at his own desk and it ended up
	// running on a machine he will never see, for people he will never meet —
	// which is a sentence no pose can act out, and which two identical windows
	// with different things behind them say in one glance. Every earlier attempt
	// here was one scene with a figure in it, and one scene has one subject; this
	// has two and a relationship, and the relationship is the verb.
	//
	// It is the first card shot SQUARE ON (`yaw: 0`). The deck's three-quarter
	// bearing is right for a place you are standing in and wrong for two windows
	// you are meant to compare — off-axis, one wall is nearer than the other and
	// the comparison stops being a comparison.
	contribution: {
		cast: 1,
		doing: 'sit',
		yaw: 0,
		// Turned 45° with the desk. Square to the window he was a passport photo
		// of a man behind glass; at an angle he is somebody working at a desk that
		// happens to be under a window, which is the difference between a portrait
		// and a scene. It also swings `sit`'s legs off the camera axis, so they
		// clear the wall in front of him instead of coming out through it.
		lead: { e: 0.85, n: 1.1, h: -0.1, face: 0.78 },
		// His house takes the BACKDROP slot rather than a catalogue building, so it
		// still gets `fx.hue` and the card keeps its colour from its largest
		// surface. It is also the NEAR building now: the seam is its roofline, and
		// a roofline can only cut the thing standing behind it.
		backdrop: { piece: HOUSE_WALL, size: 1, e: 0, n: HOUSE_N, face: 0, tint: 0.4 },
		extras: [
			// ── His side. Warm, near, below the seam. ────────────────────────
			{ piece: ROOM, color: '#FFC46B', emits: true, e: 0.85, n: 1.6, h: -0.13 },
			// Solid to the floor, because `sit` has no knees and the desk is what
			// hides that — see the pose. Only its top and a sliver of front show
			// above the sill; a desk you can see under puts four horizontal
			// artefacts across the bottom of the window at thumbnail size.
			{ piece: DESK, color: '#5A4A38', tint: 0.6, e: 0.85, n: 0.85, h: -0.38, face: 0.78 },
			// The laptop, as the L it has to be to read at all: a dark deck lying on
			// the desk and a lit lid off the back of it. As one bright slab it was
			// invisible — a rectangle of light against a body reads as the body.
			{ piece: DECK, color: '#2B3038', tint: 0.8, e: 0.85, n: 0.7, h: 0.24, face: 0.78 },
			{ piece: SCREEN, color: '#7FB8D8', emits: true, tint: 0.82, e: 0.85, n: 0.7, h: 0.24, face: 0.78 },
			// Lighter than its wall and standing PROUD of it. Flush and same-toned
			// is a drawing of a frame; forward and lighter gives every member a lit
			// edge, and the sill is the only part of a window that reads as solid.
			{ piece: HOUSE_FRAME, color: '#C8A97A', tint: 0.62, e: 0.85, n: 0.1 },

			// ── The wire. Behind his roof, in front of theirs. ───────────────
			{ piece: POLE, color: '#20242C', tint: 0.85, e: -0.58, n: WIRE_N },
			{ piece: WIRE, color: '#6FA8C4', emits: true, tint: 0.3, e: 0, n: WIRE_N },

			// ── The other side. Cold, far, above the seam. ───────────────────
			// Five paces further off and drawn exactly the same size, because the
			// camera is orthographic — which is the whole trick this card runs on.
			// Distance costs it nothing in scale and buys it everything in height:
			// the far building simply sits higher in the frame, on the other side
			// of his roof.
			//
			// Its glazing is a STRIP where his is a punch, and that shape
			// difference is what says "not a house" at the size a card is held at.
			// It runs off the left edge on purpose: a hall that continues past the
			// frame is a hall, and a hall with two visible ends is a room.
			{ piece: WINDOW_WALL, color: '#7E8CA3', tint: 0.3, e: -1.15, n: 5 },
			{ piece: HALL_LIGHT, color: '#8FD4FF', emits: true, e: -1.15, n: 6.2, h: 1.4 },
			// Standing on the sill line, filling three quarters of the glazing's
			// height. The band of light left above them is what makes it a hall you
			// are looking INTO rather than cabinets you are looking AT.
			{ piece: HALL, color: '#2E3540', tint: 0.62, e: -1.15, n: 5.7, h: 1.589 },
			{ piece: HALL_PORTS, color: '#6EE7B7', emits: true, e: -1.15, n: 5.6, h: 1.589 },
			{ piece: HALL_FRAME, color: '#A9B6C4', tint: 0.5, e: -1.15, n: 4.9 }
		],
		// Barely there. The walls are the floor reference on this card, so the
		// ground's only job is to stop the two of them hanging in a void — and its
		// horizon has to land BELOW the sills, or it draws a line across both
		// windows and turns the card into a landscape again.
		ground: { tint: 0.09, relief: 0.1, cells: 20, far: 2.4 },
		// The one card that overrides the deck camera, and only in height and
		// width — a shot composed of two flat walls has nothing at the top of a
		// 4.3 window but sky, and the ground eats a third of the card if the
		// horizon sits where the deck's does.
		look: { e: 0, n: 0, h: 2.25, width: 4 }
	},

	// ── Co-maintainer Pressure ────────────────────────────────────────────────
	// "Sock-puppets complain the project is unmaintained until the owner shares
	// commit rights."
	//
	// ONE MAN, BURIED IN HIS OWN INBOX, WITH TWO OF THEM STANDING OVER HIM.
	//
	// Behind and around him a curtain of falling text — the pull requests, the
	// issues, the "any update on this?" — pouring down past his shoulders and
	// running off both edges of the card. In front, nearer the camera and lower
	// in the frame, two hooded figures squared up at him with red visors.
	//
	// The card is not about the harassment and it is not about the workload; it
	// is about the two of them TOGETHER, which is the only reason the tactic
	// works. Volume alone is a burnout card. Two people alone is a mugging. A
	// man drowning in a queue while two strangers stand between him and the door
	// is somebody about to hand over commit rights to make it stop, and that is
	// the sentence on the card.
	//
	// Square on (`yaw: 0`), like `contribution` and for a related reason: the
	// curtain is a flat plane and the shot is a confrontation. Off-axis, the
	// text turns into a receding wall and the two figures stop being either side
	// of him.
	pressure: {
		cast: 1,
		doing: 'sink',
		yaw: 0,
		// Facing the camera, dead centre, and standing FURTHER OFF than the pair
		// in front — which under an orthographic camera costs him no size at all
		// and only lifts him up the frame. He is not smaller than them; he is
		// behind them, and that is a harder thing to draw than it sounds.
		lead: { e: 0.05, n: 2.45, h: 0, face: 0 },
		// The mass takes the backdrop slot, so the card's hue lands on the text
		// rather than on a building it does not have. A card whose subject is a
		// feed has no site to be at — the feed IS the location.
		backdrop: {
			piece: FEED_MID,
			size: 1,
			e: 0,
			n: 3.2,
			face: 0,
			tint: 0.42,
			emits: true,
			// Just off. Enough that the eye stops trying to read a word and starts
			// reading a quantity, which is what the card is about — and not so much
			// that the marks lose their shape and the wall turns to fog.
			blur: 0.011
		},
		// Long Scan, because the plate it paints is MILLED — irregular hatching
		// under a light that rakes across it once every forty seconds. Behind a
		// feed that is the right surface: the flat slab this replaces said the
		// text was falling through empty space, and this says it is falling down
		// something. The other free family, Ash Drift, is air; this card wants a
		// wall.
		texture: 'long-scan',
		// Its own dark, mixed with the card's hue, rather than the theme's — a
		// card is a lit object on a dark table in every theme, and `--backdrop-
		// ground` is cream under the light one.
		textureStyle: `--backdrop-ground: color-mix(in srgb, #F472B6 9%, #06070b);
			--backdrop-line: rgba(244, 114, 182, 0.13);
			--scan-sweep: rgba(244, 114, 182, 0.1);`,
		extras: [
			// Duller and deeper, and softer again — the far layer is where the
			// depth of field is doing most of its work, because two curtains of the
			// same text at the same focus are one curtain.
			{ piece: FEED_FAR, color: '#9C4E73', emits: true, tint: 0.16, e: -0.35, n: 4.4, blur: 0.032 },
			// Brighter than the text it stands in, and off to one side rather than
			// behind him — centred it becomes a spine growing out of his head. The
			// RIGHT side, because the cost gem owns the top-left corner: a graph
			// running under it reads as something the gem is the head commit of.
			{ piece: GIT_GRAPH, color: '#F9A8D4', emits: true, tint: 0.5, e: 0.92, n: 3.05, blur: 0.006 },
			// Nearer than he is standing, and hotter. See `FEED_NEAR`.
			//
			// Softer than the layer BEHIND him, which is the tell that this is a
			// lens and not a haze: focus falls off in both directions from the
			// person the shot is on. Foreground blur is also what stops a layer
			// drawn over the cast from competing with them.
			{ piece: FEED_NEAR, color: '#F9A8D4', emits: true, tint: 0.52, e: 0.15, n: 0.25, blur: 0.024 }
		],
		// The two of them. Ghost-shaped because that is what `fx.squad.shape` says
		// a sock-puppet is on this card, and the build was drawn for exactly this:
		// narrow and hooded, no gap of light through the silhouette.
		//
		// `extra` dims them toward the background, which is the wrong word for
		// where they are and the right treatment for what they are — dark bodies
		// with the only two hard reds on the card where the eyes go. A lit
		// foreground figure would out-read the man the card is about.
		figures: [
			{
				who: { key: 'puppet-l', name: '', color: '#64748B', shape: 'ghost' },
				extra: true,
				lamp: statusById('hostile').lamp,
				pose: DOING.guard,
				e: -0.72,
				n: 0.35,
				// Turned in at him, but only far enough to lean. Any further and the
				// visor swings off the camera — and a menacing figure whose eyes you
				// cannot see is a coat stand.
				face: -0.5
			},
			{
				who: { key: 'puppet-r', name: '', color: '#64748B', shape: 'ghost' },
				extra: true,
				lamp: statusById('hostile').lamp,
				pose: DOING.guard,
				e: 0.7,
				n: 0.35,
				face: 0.5
			}
		],
		// Almost nothing. The void wall is the horizon on this card, so the
		// ground's only job is to give three figures something to stand on.
		ground: { tint: 0.1, relief: 0.12, cells: 20, far: 2.6 },
		// Tighter than the deck's window and cropped at the pair's ankles. The
		// only depth cue an orthographic camera gives away for free is HEIGHT in
		// the frame, and a shot loose enough to show three complete figures spends
		// that cue on floor: the pair stop being in front of him and become two
		// people standing beside him.
		look: { e: 0, n: 0, h: 2.2, width: 3.25 }
	},

	// ── Release Divergence ────────────────────────────────────────────────────
	// "The build script in the release tarball is not the one in the repo. Only
	// an artifact-to-source diff can see it."
	//
	// ONE CONVEYOR, RUNNING BEHIND A BUILDING, AND IT COMES OUT A DIFFERENT
	// COLOUR THAN IT WENT IN.
	//
	// Identical crates at an unbroken pitch, on one bed, receding away to the
	// left. Cold going in, hot coming out, and the station where it changed is
	// the one the Forge is standing in front of.
	//
	// Everything about this card is in that arrangement rather than in any one
	// object. A card that showed the tampered artifact would be a card about a
	// bad crate, and the text is explicit that there is nothing to see on the
	// crate — "only an artifact-to-source diff can see it". What a diff sees is
	// a DIFFERENCE, which needs two things and cannot be drawn with one, so the
	// picture is the comparison: same geometry, same pitch, same bed, and the
	// only variable is the colour on either side of a thing you cannot see past.
	//
	// Shot on the deck's own bearing, unlike the other two authored cards. Those
	// are both square-on because both are comparisons of flat things; this is a
	// place with a line running through it, and a line square-on is a row.
	divergence: {
		cast: 1,
		doing: 'work',
		// BEHIND the line, at the output end, and bent to it.
		//
		// A person is 1.6 paces and a crate is 0.34, so anybody standing upright in
		// the near foreground of this shot is the tallest thing in it and takes a
		// third of the comparison with them — which on a card whose entire subject
		// is a comparison is the one cost that cannot be paid. Put behind the
		// conveyor he is occluded to the waist by the thing the card is about,
		// which is the right relationship anyway: he works here.
		lead: { e: 2.55, n: 3.0, h: 0, face: 0.9 },
		// The Forge, moved IN FRONT of the line rather than behind it. Every other
		// card puts its building at the back because a building is where the
		// subject is; here the building is what the subject goes through, and the
		// only way to say "it changed where you could not watch" is to put an
		// opaque object between the camera and the moment.
		// `e` is negative and the swap station's is zero, which looks wrong until
		// you work the frame: depth is worth −0.58 of a pace of screen width, so a
		// prop that must line up with something 1.55 paces further away has to sit
		// nearly a pace and a half WEST of it to land on the same column.
		backdrop: { size: 1.4, e: -1.11, n: 1.15, face: 0.5, tint: 0.28, blur: 0.008 },
		// Dust in a yard at night. A different family from `pressure`'s milled
		// plate on purpose — two cards wearing the same texture would read as one
		// treatment applied to the deck rather than as two places.
		texture: 'ash-drift',
		textureStyle: `--backdrop-ground: color-mix(in srgb, #F472B6 6%, #06070b);
			--ash-tint: rgba(244, 114, 182, 0.08);
			--ash-tint-2: rgba(126, 150, 163, 0.05);
			--ash-grain: 0.42;`,
		extras: [
			{ piece: BED, color: '#2B3038', tint: 0.62, e: 0, n: 2.7 },
			{ piece: BED_LAMP, color: '#7FB8D8', emits: true, tint: 0.22, e: 0, n: 2.7 },
			// Matte, cold, lit by the scene like anything else. What was committed.
			{ piece: SOURCE_CRATES, color: '#7E8CA3', tint: 0.5, e: 0, n: 2.7, blur: 0.013 },
			{ piece: SWAP_CRATE, color: '#7E8CA3', tint: 0.5, e: 0, n: 2.7, blur: 0.013 },
			// Emitting, and the card's hue. What shipped. Same crate — the colour
			// is the only thing that is not the same, and it is not a property the
			// crate would show you if you opened it.
			{ piece: SHIPPED_CRATES, color: '#F472B6', emits: true, tint: 0.34, e: 0, n: 2.7 }
		],
		// Barely lit and barely modelled. The yard under a conveyor is the one part
		// of this card with nothing on it, and at any brightness worth looking at
		// it takes a quarter of the picture to say "concrete".
		ground: { tint: 0.06, relief: 0.09, cells: 16, far: 5 },
		// Flatter than the deck camera, and closer. The subject of this card is a
		// metre off the ground and four paces long; at the deck's tilt the floor
		// in front of it eats a third of the picture, and there is nothing on that
		// floor. Every pace of tilt taken out is a pace of dead yard taken out.
		pitch: 0.18,
		// The window is nearly square and the subject is a horizontal band, so the
		// spare height has to go somewhere. It goes UP: the Forge is sized to fill
		// it, because the one thing on this card that is allowed to be large is
		// the thing you cannot see past.
		// Panned west of the swap station rather than centred on it: three crates
		// each side is the fewest that reads as a RUN, and a run either side is
		// the whole comparison. Centred, the building ate one of the three.
		look: { e: -0.13, n: 2.4, h: 1.38, width: 4.2 }
	},

	// ── Sleeper Implant ───────────────────────────────────────────────────────
	// "Dormant and inert. Cannot be found by a sweep — there is nothing running
	// to find."
	//
	// THREE MEN AT A CUBICLE BANK, AND NOTHING TO SEE.
	//
	// Same build, same slump, same grey, same monitor, one bay each, in a row,
	// in front of more rows of the same. Every other card in the deck is a
	// picture of something HAPPENING; this one is deliberately a picture of
	// nothing happening, because that is the literal rule text — a sweep walks
	// this floor and finds three guys at their desks.
	//
	// The card only becomes a card when it is PLAYED: one visor goes hostile,
	// and it is not the one you were looking at. See `wakes`, and the note on
	// `sceneFor`'s `played` about why that is a fact about the MOMENT and not
	// about the card.
	//
	// The three are drawn IDENTICALLY, which every other card in this file goes
	// out of its way not to do — `extra` exists precisely so a crowd never
	// competes with its subject. Here the crowd IS the subject: the card is
	// unreadable the instant one of the three is lit as the one to look at,
	// because then a sweep would find it too. So the lead is stripped of its kit
	// and its trim (`lead`), the two beside it are authored to match, and
	// nothing in the shot ranks them.
	//
	// Square on (`yaw: 0`). A row of bays on the deck's three-quarter bearing is
	// a receding bank — the near face of it fills the card and the far seats
	// turn away, and this card cannot afford a single face pointing off-camera.
	sleeper: {
		cast: 1,
		doing: 'sit',
		yaw: 0,
		// The middle bay. Undressed to match the two beside it — see `Shot.lead`.
		//
		// Every one of these five fields is a costume being taken off, and the card
		// does not work until all five are gone — the Handler wears their colour in
		// five separate places and any one left on nominates the middle seat before
		// the card is even played. `who` is repainted rather than swapped so the
		// key survives, which is what `wakes` finds them by.
		lead: {
			who: { color: OFFICE },
			e: 0,
			n: 2.35,
			h: 0,
			face: 0,
			worn: [],
			trim: OFFICE,
			lamp: OFFICE
		},
		wakes: 'state',
		// The floor takes the backdrop slot. There is no building on this card and
		// there cannot be one: the rule text is about a machine that is INDOORS,
		// on a floor somebody works on, and the establishing shot of a target
		// building would say the opposite — that the implant is somewhere else.
		// `color` is set, and it is the only card in the deck that sets it. The
		// backdrop slot carries `fx.hue` by default because scenery is normally the
		// largest surface on a face and is therefore what makes the card orange —
		// but here the scenery is a rank of partitions standing directly behind
		// three heads, and in the card's own hue its dividers become bright
		// vertical bars either side of every face. The hue is spent on the screens
		// instead, which is where the only light in this room is coming from.
		//
		// What it IS set to is a warm dark, not a neutral one, and that is the
		// deck talking rather than the card. Printed cold, this is the one page in
		// a wall of forty Handler cards that does not look like a Handler card —
		// every other one is a big orange building, and a blue-grey face among
		// them reads as somebody else's faction before it reads as an office at
		// night. The far surfaces carry the warmth; the bay the cast is sitting in
		// stays near-neutral, so the visor still has something to be red against.
		backdrop: {
			piece: FAR_ROW,
			color: '#6B5645',
			size: 1,
			e: 0,
			n: 5.2,
			face: 0,
			tint: 0.22,
			blur: 0.02
		},
		// Shear weave, and the third free family — `pressure` has the milled plate
		// and `divergence` the yard dust, and a deck where two cards wear one
		// texture reads as a treatment applied to the deck rather than as two
		// places. An off-square lattice is also the one pattern in the set that is
		// already ceiling tile and carpet grid, which is the whole of what an
		// office floor looks like once the lights are off.
		texture: 'shear-weave',
		textureStyle: `--backdrop-ground: color-mix(in srgb, #FB923C 9%, #06070b);
			--shear-pool: rgba(251, 146, 60, 0.06);
			--shear-line: rgba(203, 176, 148, 0.045);
			--shear-period: 90s;`,
		extras: [
			// A third bank, between the backdrop's and theirs, so the depth reads as
			// a floor that keeps going rather than as one row and a wall behind it.
			// Two is a pair; three is "more of these".
			{ piece: FAR_ROW, color: '#7A6250', tint: 0.32, e: 0, n: 3.9, blur: 0.011 },
			// Dim, and grey rather than the card's hue. A ceiling tube is the one
			// light in this room that is NOT a screen, and the colour story only
			// works if the warm light all comes from the machines.
			// `tint` is the only dimmer an emitter has, and it is not optional here.
			// `lamp()` adds a flat 112 to every channel at full tint, so a tube
			// authored in a dark slate still paints near-white — and a ceiling
			// fitting that reads as lit is the brightest object on a card whose
			// subject is a face. Turned down until they are structure, not light.
			// Hung LOW — a pace over the heads rather than at any honest ceiling
			// height. The two badges own the top corners of every card in the deck,
			// and a tube at a plausible height runs straight through both of them.
			{ piece: CEILING_STRIP, color: '#8A6D52', emits: true, tint: 0.13, e: 0, n: 3.9, h: 1.62 },
			{ piece: CEILING_STRIP, color: '#9A7A5C', emits: true, tint: 0.18, e: 0, n: 2.6, h: 1.62 },

			// Their own bay. Warmed a shade off neutral and no further — this is the
			// surface the three heads are actually seen against, and it is the last
			// place on the card that can afford to be a colour.
			{ piece: BACK_WALL, color: '#4C4740', tint: 0.85, e: 0, n: 2.74 },
			{ piece: DIVIDERS, color: '#433D36', tint: 0.6, e: 0, n: 2.06 },
			{ piece: COUNTER, color: '#544C41', tint: 0.68, e: 0, n: 1.68 },
			{ piece: LIDS, color: '#20242C', tint: 0.85, e: 0, n: 1.48 },
			// The only warm light in the room, and it is the card's own hue rather
			// than a screen white: three laptops are what is keeping this floor lit
			// at this hour, so they are what the card should be coloured by. Tinted
			// for that reason — at full emission `lamp()` washes the orange out to
			// a pale peach and the card loses the colour it is supposed to have.
			{ piece: LID_GLOW, color: '#FB923C', emits: true, tint: 0.5, e: 0, n: 1.48 }
		],
		// The two beside him. Identical to the lead in build, pose, colour and
		// bearing — and NOT `extra`, which is the one deliberate breach of the
		// house rule in this file. Dimming them would nominate the middle seat,
		// and the middle seat is not the answer.
		figures: [
			{
				who: { key: 'desk-l', name: '', color: OFFICE, shape: 'ghost' },
				trim: OFFICE,
				lamp: OFFICE,
				pose: DOING.sit,
				e: -BAY,
				n: 2.35,
				face: 0
			},
			{
				who: { key: 'desk-r', name: '', color: OFFICE, shape: 'ghost' },
				trim: OFFICE,
				lamp: OFFICE,
				pose: DOING.sit,
				e: BAY,
				n: 2.35,
				face: 0
			}
		],
		// Nearly out. The aisle carpet is below the counter's front edge on every
		// pixel of this card, so all the ground can do is stop the bank floating.
		ground: { tint: 0.05, relief: 0.06, cells: 14, far: 2.6 },
		// Cropped at the counter's front edge. The subject of this card is a band
		// of three heads two thirds of a pace tall; a window loose enough to show
		// the aisle spends the card's height on carpet and shrinks the visors to a
		// pixel — and the visor is the entire payload of the play state.
		look: { e: 0, n: 0, h: 1.88, width: 3.6 }
	},

	// ── Bought Access ─────────────────────────────────────────────────────────
	// "Cheaper than a zero-day, and it comes with a badge."
	//
	// A WEAPONS DEAL, AND THE CASE IS FULL OF BADGES.
	//
	// A loading dock at night. A roller door standing open with the building's
	// own light coming out of it. A crate in the gap, a case open on the crate,
	// and a man either side of it — one who works here and one who does not.
	//
	// The staging is quoted deliberately and exactly: the van parked off to one
	// side, the crate at waist height, the case open with the lid up, the two of
	// them squared over it. Everybody has seen this picture, and the whole point
	// of borrowing it is that the eye finishes the sentence before it reads the
	// card — this is an arms deal — and then finds the merchandise glowing.
	//
	// Nothing in the case is a weapon. It is a row of lit rectangles, which is
	// the rule text as an object: cheaper than a zero-day, and it comes with a
	// badge. The lit doorway behind them is the same fact one level up — what is
	// being sold is not a thing, it is the way in, and it is standing open in the
	// middle of the frame while the two of them do business in front of it.
	//
	// Square on (`yaw: 0`), and the reason is different from the other two that
	// are. `contribution` and `sleeper` are square on because they are
	// comparisons of flat things; this one is because an exchange is a SYMMETRY.
	// Off-axis, one party is nearer the camera and therefore lower in the frame,
	// and a shot where one man stands over another is a mugging. The objects
	// inside it are turned instead — the van, the crate — which is what keeps a
	// square-on shot from being a row of flat cards.
	insider: {
		cast: 1,
		doing: 'work',
		yaw: 0,
		// The buyer, bent to the case. `work` is the pose that needs something
		// under the hands, and this is the card in the deck it was described for.
		lead: { e: 1.08, n: 2.46, h: 0, face: 0.85 },
		// The dock wall, in the card's own hue and at the card's own size — the
		// one authored card so far that wants the backdrop slot doing exactly its
		// default job. It is much the largest surface in the shot, so it is what
		// makes this an orange card, and it is a WALL being orange rather than a
		// wash behind an icon.
		backdrop: { piece: DOCK_WALL, size: 1, e: 0.1, n: 4.6, face: 0, tint: 0.3 },
		extras: [
			// Cold, and dimmer than it wants to be. This is the building's own
			// light, not the deal's — the colour story is one warm source (the
			// goods) in a cold place, and a doorway bright enough to be the subject
			// turns both men into silhouettes with nothing between them.
			{ piece: DOOR_LIGHT, color: '#9CC9E8', emits: true, tint: 0.22, e: 0.1, n: 4.72 },
			// Fainter than the doorway itself — light on tarmac is a reflection, and
			// a spill as bright as its source reads as a hole in the floor.
			{ piece: DOOR_SPILL, color: '#7FA8C4', emits: true, tint: 0.1, e: 0.1, n: 3.5 },

			// The van. Mostly off the left edge and soft — it is the thing you
			// recognise the picture BY, and it has about a fifth of the card to do
			// that in. Any further in and it is the subject.
			{ piece: VAN, color: '#2A2F38', tint: 0.62, e: -2.75, n: 3.6, face: 0.42, blur: 0.008 },
			{
				piece: VAN_LAMP,
				color: '#C8A97A',
				emits: true,
				tint: 0.3,
				e: -2.75,
				n: 3.6,
				face: 0.42,
				blur: 0.008
			},

			// The deal itself. Turned off the axis so it has a corner — a crate
			// square to the camera is a rectangle, and the only object on this card
			// that both men are touching cannot be the flattest thing in it.
			{ piece: CRATE, color: '#634E36', tint: 0.8, e: 0.1, n: 2.26, face: 0.34 },
			{ piece: CASE_TRAY, color: '#23282F', tint: 0.85, e: 0.1, n: 2.26, face: 0.34 },
			{ piece: CASE_LID, color: '#1B1F25', tint: 0.9, e: 0.1, n: 2.26, face: 0.34 },
			// The merchandise, and the only warm light on the card. Tinted well
			// down: `lamp()` adds a flat 112 to every channel, and at full emission
			// the row goes to white paper and stops being anything anybody would buy.
			{
				piece: CASE_GOODS,
				color: '#FFC46B',
				emits: true,
				tint: 0.62,
				e: 0.1,
				n: 2.26,
				face: 0.34
			},

			// Nearest the camera, and last in the list so they sort over the ankles
			// they are supposed to stand in front of.
			{ piece: YARD_CRATES, color: '#59462F', tint: 0.66, e: -0.35, n: 1.02, face: 0.26 }
		],
		// The seller. A brute, because that is what `fx.squad.shape` says this
		// card's other party is, and because the man across a crate in this picture
		// has always been a big one.
		//
		// NOT `extra`, which is the rule this file otherwise keeps. A deal has two
		// parties; dim one of them and it is a robbery. They are told apart by
		// BUILD and by which side of the case they are on rather than by strength
		// — the Handler is a ghost and this is a brute, and at card size those are
		// two obviously different silhouettes.
		figures: [
			{
				who: { key: 'broker', name: '', color: '#8A94A6', shape: 'brute' },
				trim: '#8A94A6',
				lamp: statusById('alert').lamp,
				pose: DOING.guard,
				e: -1.14,
				n: 2.52,
				face: -0.85
			}
		],
		// A yard, and barely. The floor between a van and a doorway has nothing on
		// it, and at any brightness worth looking at it takes a quarter of the card
		// to say "tarmac".
		ground: { tint: 0.07, relief: 0.09, cells: 18, far: 4 },
		// Centred on the case rather than between the two men. The case is what
		// they are both looking at and the lit doorway is directly behind it, so
		// the card has one vertical spine of light with a silhouette either side —
		// and a window centred on the gap between two figures puts that spine off
		// to one edge for no gain.
		look: { e: 0.1, n: 0, h: 1.92, width: 3.85 }
	},

	// ── Quiet Exfil ───────────────────────────────────────────────────────────
	// "The payload has what it came for. All that is left is a DNS query nobody
	// reads."
	//
	// A MAN WALKING OUT THROUGH THE GATE, CARRYING IT, AND THE LIGHT IS GREEN.
	//
	// He is already past the detector and still walking. The gate is on. The
	// guard is at his post, turned, looking directly at him. Nothing is
	// happening.
	//
	// Every other strike card in the deck is a picture of force arriving. This
	// one had to be a picture of a control WORKING and being irrelevant, which is
	// what the rule text says and what the real incidents behind it look like:
	// nobody broke the gate, nobody ran, and the only record of it is a log line
	// on a machine nobody is reading. So the composition is deliberately calm —
	// one stride, one head turned, three lights — and the whole tension is that
	// three separate controls are all pointing at the same object and none of
	// them is stopping it.
	//
	// The colour does the argument. Green on the gate, green on the guard's
	// visor: two independent all-clears. Orange in his hand: the card's own hue,
	// the only warm thing in the frame, at hip height in the open. A player does
	// not have to be told the controls passed — they can see both of them saying
	// so, about a thing they can also see.
	//
	// Square on (`yaw: 0`), and here it is forced rather than chosen. See
	// `DETECTOR`: a portal has no opening except down its own axis.
	exfil: {
		cast: 1,
		doing: 'stride',
		yaw: 0,
		// Out of the gate and coming at the camera, barely off square. `stride` is
		// the deliberate extreme of a walk rather than a frame sampled from one —
		// see `DOING` — and it is the only pose in the set that says a person is
		// GOING somewhere, which is the entire verb of this card.
		//
		// Well forward of everything else. Depth is worth height in an
		// orthographic frame and nothing else, so putting him nearest the camera
		// is how he ends up low in the picture with the gate, the guard and the
		// lobby stacked up behind him — a man leaving, with the place he is
		// leaving above and behind him.
		lead: { e: 0.88, n: 1.62, h: 0, face: 0.55 },
		backdrop: { piece: LOBBY_WALL, size: 1, e: 0, n: 5.4, face: 0, tint: 0.26 },
		extras: [
			// The floor he came from, lit. Dim and cool: a lobby at this hour is lit
			// by nobody being in it.
			{ piece: LOBBY_BAND, color: '#8FB6D4', emits: true, tint: 0.24, e: 0, n: 5.34 },

			// The gate. Two of them, because a single arch in the middle of a wall
			// is a doorway — what makes it screening is a LINE of them, and the
			// second one running off the right edge says the line continues.
			{ piece: DETECTOR, color: '#39414E', tint: 0.62, e: 0.05, n: 3.6 },
			{ piece: DETECTOR_LAMP, color: '#34D399', emits: true, tint: 0.34, e: 0.05, n: 3.6 },
			{ piece: DETECTOR, color: '#39414E', tint: 0.5, e: 1.85, n: 3.6, blur: 0.006 },
			{
				piece: DETECTOR_LAMP,
				color: '#34D399',
				emits: true,
				tint: 0.26,
				e: 1.85,
				n: 3.6,
				blur: 0.006
			},

			{ piece: PODIUM, color: '#3E4552', tint: 0.7, e: -1.35, n: 2.6, face: 0.3 },

			// In his hand, at hip height, on the side the camera can see. Placed as
			// a prop rather than worn: nothing in `wearables` is a thing a figure
			// CARRIES, and a held object is a different relationship from a hat.
			{ piece: PAYLOAD, color: '#FB923C', emits: true, tint: 0.3, e: 1.24, n: 1.5, h: 0.66 }
		],
		// The guard. Turned toward him and doing nothing about it.
		//
		// `watch` — "Weight on one leg, arms almost still. Present, not acting."
		// That pose was written for a bystander and this is the card it was
		// written for: the failure being drawn is not absence, it is attention
		// without consequence, and an empty post would have said the opposite.
		//
		// Not `extra`. He is half the sentence; dimmed he becomes scenery near the
		// gate, and the card stops being about anybody watching.
		figures: [
			{
				who: { key: 'guard', name: '', color: '#7E8CA3', shape: 'runner' },
				trim: '#7E8CA3',
				// The same green the gate is showing. Two all-clears, from two
				// independent controls, about one object.
				lamp: '#34D399',
				pose: DOING.watch,
				e: -1.35,
				n: 3.02,
				// Turned at him, and only that far. Any further and the visor swings
				// off the camera — and a guard whose eyes you cannot see is not
				// watching anything, which is the one thing this card cannot say.
				face: -0.62
			}
		],
		// A polished floor takes the light off the band above it, so this one is
		// allowed slightly more presence than the yards and offices get.
		ground: { tint: 0.07, relief: 0.05, cells: 16, far: 3.4 },
		// Panned left of him, not centred on him. He is walking OUT — toward the
		// bottom-right corner — and a subject centred in the frame is a subject
		// standing still. The space the composition gives him is the space he is
		// heading into.
		look: { e: 0.25, n: 0, h: 2, width: 3.95 }
	},

	// ── Credential Phish ──────────────────────────────────────────────────────
	// "No years of patches. One convincing login page and a code the owner reads
	// aloud."
	//
	// THE SAME PAGE TWICE, AND THE MAN AT ONE OF THEM IS WEARING THE OTHER
	// TEAM'S COLOURS.
	//
	// `contribution`'s seam, borrowed on purpose and used to say the opposite
	// thing. There the two halves were a house and a data centre — two places
	// that look nothing alike, and the card was the RELATIONSHIP between them.
	// Here both halves are the same flat wall with the same sign-in page on it,
	// and the card is the failure to find any relationship at all: two servers
	// render one page, and nothing in the picture distinguishes them.
	//
	// So every difference on this card is carried by the two figures, and there
	// are exactly two of them:
	//
	//   BUILD.  The one up the frame is a brute, which is what an Architect is.
	//           The one down the frame is a runner. Same colour, wrong shape —
	//           a thing you could have checked and did not.
	//   LAMP.   The suit is Architect blue and the eyes are Maintainer pink. A
	//           costume is the outside of somebody; the visor is the one surface
	//           on this model that is not being lit by anything else, and it is
	//           still his.
	//
	// The depths do the composition without being asked. The camera is
	// orthographic, so distance costs no size and buys pure height — the real
	// one, standing further off, simply sits up the frame above the seam, and
	// the impostor, nearer, sits below it. Nobody had to be posed into a half.
	//
	// Square on (`yaw: 0`), for `contribution`'s reason exactly: this is a
	// comparison of two flat things, and off-axis one wall is nearer than the
	// other and the comparison stops being one.
	takeover: {
		cast: 1,
		doing: 'watch',
		yaw: 0,
		// The impostor. Two fields repainted and one left alone, and which is which
		// is the entire card.
		//
		// `who.color` is the PLATE — boots, chest, pauldrons, hood — and `trim` is
		// the hue his own kit flies. BOTH go Architect blue. The first cut left
		// trim pink on the argument that a costume should show a seam, and it was
		// wrong on the render: the hat is the largest single item on the model, so
		// a pink hat made him a pink character standing near some blue, and the
		// disguise never read at all. A disguise that is visibly a disguise is a
		// picture of a man in a bad wig.
		//
		// `lamp` is the one thing that stays his. The visor is the only surface on
		// this model that is not being lit by something else — it is the one part
		// that is not a surface he chose to present — and leaving it pink says the
		// whole card in one colour: everything you can see is theirs, and he is
		// still behind it.
		// And it is wearing the wrong man's LOADOUT, in the wrong man's SIZE.
		//
		// `worn` is the Architect's kit off `KIT` — top hat, crown emblem — not the
		// Maintainer's beanie and chevron. That is the impersonation stated in the
		// game's own vocabulary: every seat is known at the table by its hat, and
		// he has put on somebody else's.
		//
		// `wornFit: 'brute'` is the part that makes it a phish rather than a
		// costume change. The anchors are a third wider on a brute than on a
		// runner and its crown sits a tenth lower, so the hat overhangs his skull
		// on both sides and is jammed down over it, and the brow band has slipped
		// under his own visor. Nothing is hidden and nothing is subtle: it is
		// obviously the right hat and obviously not his head. That is what a
		// convincing login page is — the correct logo, at the wrong address.
		lead: {
			who: { color: '#38BDF8' },
			trim: '#38BDF8',
			lamp: '#F472B6',
			worn: [...kitFor('architect'), 'hat.visor'],
			wornFit: 'brute',
			e: 0.95,
			n: 1.8,
			h: 0,
			face: 0.12
		},
		// The far wall. It takes the backdrop slot rather than a building because
		// there is no building on this card — the location IS the page, and a
		// target site behind it would be a third thing to compare.
		backdrop: { piece: PHISH_FAR, size: 1, e: 0, n: 6.6, face: 0, tint: 0.16 },
		extras: [
			// ── The real one. Far, and therefore up the frame. ────────────────
			// Offset from its figure rather than behind it. Squarely behind, the
			// page is a rectangle a person is standing in front of; beside them it
			// is a page they are AT, and both objects survive at card size.
			{ piece: PAGE, color: '#CFE3F2', emits: true, tint: 0.72, e: -0.45, n: 6, h: 0.72 },
			{ piece: PAGE_ROWS, color: '#1C2430', tint: 0.9, e: -0.45, n: 6, h: 0.72 },

			// ── The near wall, its top cut by the seam. ───────────────────────
			// The card's own hue, and the same hue the far wall is — dimmer only by
			// the distance. Two walls painted two colours would be the card telling
			// you which one to trust.
			{ piece: PHISH_NEAR, color: '#F472B6', tint: 0.4, e: 0, n: 2.6 },

			// ── The copy. Identical geometry, identical light, nearer. ────────
			{ piece: PAGE, color: '#CFE3F2', emits: true, tint: 0.72, e: 1.75, n: 2.5, h: 0.72 },
			{ piece: PAGE_ROWS, color: '#1C2430', tint: 0.9, e: 1.75, n: 2.5, h: 0.72 }
		],
		// The account holder, at his own login. A brute in Architect blue with a
		// blue visor — everything about him agrees with everything else about him,
		// which is what the figure below him is imitating and not quite managing.
		//
		// Not `extra`. He is the half of the card the other half is a copy OF, and
		// dimming him would rank the two — on a card whose entire claim is that
		// they cannot be ranked by looking.
		figures: [
			{
				who: { key: 'architect-real', name: '', color: '#38BDF8', shape: 'brute' },
				trim: '#38BDF8',
				// The same three items, and no `wornFit` — so they are cut for the
				// body wearing them, which is the whole of what makes him the real
				// one. The two figures differ in nothing a list could show; they
				// differ in whether the clothes are the right size.
				worn: [...kitFor('architect'), 'hat.visor'],
				pose: DOING.watch,
				e: -1.3,
				n: 5.4,
				face: 0.12
			}
		],
		// Almost nothing. The two walls are the only vertical reference on this
		// card and the ground's one job is to stop the near figure hanging.
		ground: { tint: 0.06, relief: 0.06, cells: 16, far: 2.8 },
		look: { e: 0.3, n: 0, h: 2.16, width: 4.5 }
	},

	// ── Trusted Extension ─────────────────────────────────────────────────────
	// "It was a good plugin with fifty thousand installs. Then somebody bought
	// it."
	//
	// A BANK, FROM THE TELLER'S SIDE. THERE IS SOMEBODY SERVING AT THE WINDOW
	// AND SOMEBODY ELSE ON THE FLOOR BEHIND THE COUNTER.
	//
	// Through the glass, a customer, waiting to be served, entirely satisfied.
	// They are looking at the same window they have always looked at. It is the
	// right bank, the right counter, the right till, and there is a person at it.
	//
	// The card is the point of view and nothing else. Every other implant card in
	// the deck hides something; this one hides nothing — the impostor is in his
	// own colours, wearing his own hat, and it changes nothing, because what the
	// customer is trusting is the POSITION and not the person in it. Fifty
	// thousand installs trusted a package name.
	//
	// It is also the one card in the deck that deliberately does NOT use the
	// `takeover` trick of a costume that does not fit. There is no disguise here
	// to inspect. That is the harder half of the same lesson: an impersonation
	// you could have caught by looking, and an ownership transfer you could not.
	//
	// Square on (`yaw: 0`). The window is a hole you look THROUGH, and a hole
	// only exists down its own axis — the same constraint `exfil`'s gate has.
	extension: {
		cast: 1,
		doing: 'work',
		yaw: 0,
		// At the counter, bent to it, three-quarter REAR. We get his back and the
		// edge of his visor, which is the correct amount of him: from this side he
		// is a man doing a job, and the card is not asking you to identify him. He
		// is off to the right of the window rather than square in it, or he stands
		// between the camera and the only person on this card whose face matters.
		lead: { e: 1.28, n: 1.85, h: 0, face: 2.45 },
		// The screen wall takes the backdrop slot, so the card's hue lands on much
		// the largest surface in the shot — and it is the FIXTURE being pink, which
		// is the argument: the furniture is the attacker's now.
		backdrop: { piece: TELLER_SCREEN, size: 1, e: -0.1, n: 2.85, face: 0, tint: 0.3 },
		extras: [
			// ── The hall, beyond. ─────────────────────────────────────────────
			{ piece: HALL_WALL, color: '#4A4053', tint: 0.2, e: 0, n: 7.4 },
			{ piece: HALL_BAND, color: '#C9A8D8', emits: true, tint: 0.14, e: 0, n: 7.34 },

			// ── The window. ───────────────────────────────────────────────────
			{ piece: SCREEN_GLASS, color: '#9FC4DE', emits: true, tint: 0.2, e: -0.1, n: 2.88 },
			{ piece: SCREEN_FRAME, color: '#C0A9B8', tint: 0.55, e: -0.1, n: 2.78 },

			// ── The counter, and his station on it. ───────────────────────────
			{ piece: BANK_COUNTER, color: '#5A4550', tint: 0.66, e: 0, n: 2.42 },
			{ piece: SCREEN_TRAY, color: '#C0A9B8', tint: 0.6, e: -0.1, n: 2.78 },
			{ piece: TILL, color: '#241F28', tint: 0.85, e: 0.6, n: 2.34 },
			// Turned to the staff side, so the glow is on our face of it. A screen
			// the customer could read would be a screen the customer is using.
			{ piece: TILL_GLOW, color: '#F472B6', emits: true, tint: 0.4, e: 0.6, n: 2.34 }
		],
		figures: [
			// ── The man on the floor. ─────────────────────────────────────────
			// `sit` at ground level, which is already somebody on the floor with
			// their legs out in front of them: the pose drops the whole body 0.34
			// and swings the legs flat, and without a desk under it that is not a
			// person at a desk, it is a person down.
			//
			// `down` for the visor — "not a colour so much as an absence… the visor
			// stops being the brightest thing on the model". Every other figure in
			// this deck is lit by its own face. He is the one who is not, and at
			// card size that reads before any of the geometry does.
			//
			// He is the reason the counter height is what it is. Below its line
			// from the hall, above it from here — the same object, hiding him from
			// one side and not the other, which is the entire card in one solid.
			{
				who: { key: 'teller-real', name: '', color: '#8892A6', shape: 'runner' },
				trim: '#8892A6',
				lamp: statusById('down').lamp,
				pose: DOING.felled,
				e: -1.02,
				n: 2.45,
				// Near profile, so the legs run ACROSS the frame. Turned to the
				// camera they foreshorten into the body and he reads as kneeling,
				// which is a man doing something.
				face: 1.15
			},

			// ── The customer, through the glass. ──────────────────────────────
			// Facing us square, because facing us is facing the window. The only
			// fully visible face on the card belongs to the person who cannot see
			// anything — and being deeper, they ride up the frame and land inside
			// the opening without being posed into it.
			{
				who: { key: 'customer', name: '', color: '#38BDF8', shape: 'brute' },
				trim: '#38BDF8',
				pose: DOING.watch,
				e: -0.14,
				n: 5.3,
				face: 0
			}
		],
		// Floor, barely. The counter is the horizon on this card.
		ground: { tint: 0.07, relief: 0.06, cells: 16, far: 3 },
		look: { e: 0.12, n: 0, h: 2.15, width: 4.3 }
	},

	// ── Silent Exception ──────────────────────────────────────────────────────
	// "One waiver, filed correctly, and the map stops showing the thing that is
	// there."
	//
	// A CRACK RUNNING DOWN A DAM, WITH A NOTICE BESIDE IT AND PEOPLE PADDLING
	// ABOUT ON THE WATER ABOVE.
	//
	// The card that had to be a place rather than a person. Every other implant
	// in the deck is somebody doing something; this one is a CONDITION — nothing
	// is happening, nothing is going to happen today, and the whole content of it
	// is that a severe failure is sitting in the open being ignored.
	//
	// The notice is the card and not the crack. A crack alone is a picture of
	// something nobody has found yet, which is bad luck; the rule text is about
	// something that WAS found, was written up correctly, and is now invisible
	// because of the write-up. So there is a tidy lit placard bolted to the face
	// a pace from the fissure, and it is the warmest, most legible, most
	// obviously official object in the frame. The paperwork is the payload.
	//
	// The kayakers are the stakes and they are deliberately tiny and cheerful.
	// They are the only figures in the deck drawn as `extra` who are not a threat
	// and not a crowd — they are bystanders in the literal sense, sitting on
	// several thousand tons of water with their backs to the reason it is there.
	//
	// Shot from DOWNSTREAM, below, square on. The one bearing that gets the face,
	// the crack and the water into one frame — and it only works because the
	// camera is orthographic, which puts anything deeper higher up the picture.
	// The reservoir is below the crest in the world and above it on the card.
	exception: {
		cast: 1,
		doing: 'stride',
		yaw: 0,
		// The one person who knows, walking out of frame at the foot of it.
		//
		// He is the scale reference the dam cannot do without — a concrete wall
		// with nothing beside it has no size — and he is the only figure here
		// facing the camera. `stride`, because he is finished: the waiver is
		// filed, and the card is what he is leaving behind.
		lead: { e: -2.05, n: 1.25, h: 0, face: 0.35 },
		// Played, his visor goes hostile — and it is the only thing on the card
		// that changes about a PERSON. Everything else the play does happens to the
		// dam. Read together: more water is coming through, and the one man who
		// knew about it has stopped pretending he did not.
		wakes: 'state',
		backdrop: { piece: DAM, size: 1, e: 0, n: 4.2, face: 0, tint: 0.34 },
		extras: [
			// ── The water, and what is on it. ─────────────────────────────────
			// Well back and dim. It is the biggest surface on the card after the
			// dam and it has nothing to say except that it is deep.
			{ piece: RESERVOIR, color: '#5D7A8C', emits: true, tint: 0.1, e: 0, n: 12, h: 4.1 },

			// ── The face. ─────────────────────────────────────────────────────
			{ piece: DAM_PIERS, color: '#C4B39C', tint: 0.9, e: 0, n: 4.2 },
			// Near-black and standing proud of the concrete, so it sorts in front
			// of the face rather than z-fighting with it.
			{ piece: CRACK, color: '#0E0B0A', tint: 1, e: 0, n: 3.6 },
			// ── A note on the `n` here, because it looks wrong and is not ─────
			// The face of the dam is at 3.65 and the water runs down it, so 3.6 is
			// the honest depth — and at 3.6 most of it vanished behind the wall it
			// was supposed to be running down.
			//
			// `paint` sorts by FACET CENTROID, one depth per face, and the camera
			// is tilted. Tilt makes height count as nearness: the dam's front face
			// is one enormous facet whose centroid sits half way up a five-pace
			// wall, which buys it a large depth bonus, while a trickle ending at the
			// apron has a centroid down at knee height and gets none. The tall
			// streams beat the wall and the short ones lost to it — which is
			// exactly, and only, the ones that disappeared.
			//
			// So they stand well off the face. Under an orthographic camera that
			// costs a fifth of a pace of drop on screen and nothing else, which is
			// three pixels at card size and cheaper than splitting the dam into
			// bands to lower its centroid.
			{ piece: SEEP, color: '#A8C4D4', emits: true, tint: 0.42, e: 0, n: 2.95 },

			// ── The waiver. ───────────────────────────────────────────────────
			// A pace and a half from the fissure, at eye height, lit and square.
			{ piece: WAIVER, color: '#F5C88A', emits: true, tint: 0.5, e: 2.2, n: 3.56, h: 2.5 },
			{ piece: WAIVER_ROWS, color: '#2A1D12', tint: 0.9, e: 2.2, n: 3.56, h: 2.5 },

			// ── Three hulls. Warm, small, and the only cheerful marks here. ───
			{ piece: KAYAK, color: '#F5B942', tint: 0.9, e: -1.72, n: 8, h: 4.1, face: 0.2 },
			{ piece: PADDLE, color: '#2E3540', tint: 0.8, e: -1.72, n: 8, h: 4.3, face: 0.2 },
			{ piece: KAYAK, color: '#D96C5A', tint: 0.9, e: 1.15, n: 9, h: 4.1, face: -0.32 },
			{ piece: PADDLE, color: '#2E3540', tint: 0.8, e: 1.15, n: 9, h: 4.3, face: -0.32 },
			{ piece: KAYAK, color: '#7FC4B8', tint: 0.9, e: -0.4, n: 10, h: 4.1, face: 0.12 },
			{ piece: PADDLE, color: '#2E3540', tint: 0.8, e: -0.4, n: 10, h: 4.3, face: 0.12 }
		],
		// Four more runs down the face, and a wash joining them at the toe. Same
		// colour and same treatment as the one that was always there — this is not
		// a new event, it is the same event, more of it.
		whenPlayed: [
			{ piece: SEEP_MORE, color: '#A8C4D4', emits: true, tint: 0.5, e: 0, n: 2.95 }
		],
		// The paddlers. `sit` because the hull hides the legs, which is the pose's
		// documented condition — "only ever use it with something in front".
		//
		// `extra` on all three, and this is the one card where that dimming is the
		// literal subject rather than a compositional convenience: they are not
		// participants, they have no idea, and a card that lit them as brightly as
		// the thing under them would be a card about a day out.
		figures: [
			{
				who: { key: 'paddler-a', name: '', color: '#8FA3B8', shape: 'runner' },
				extra: true,
				trim: '#8FA3B8',
				pose: DOING.sit,
				e: -1.72,
				// Must match its hull above, or the paddler sits in open water two
				// and a half paces in front of the boat.
				n: 8,
				h: 4.1,
				face: 0.2
			},
			{
				who: { key: 'paddler-b', name: '', color: '#8FA3B8', shape: 'runner' },
				extra: true,
				trim: '#8FA3B8',
				pose: DOING.sit,
				e: 1.15,
				n: 9,
				h: 4.1,
				face: -0.32
			},
			{
				who: { key: 'paddler-c', name: '', color: '#8FA3B8', shape: 'runner' },
				extra: true,
				trim: '#8FA3B8',
				pose: DOING.sit,
				e: -0.4,
				n: 10,
				h: 4.1,
				face: 0.12
			}
		],
		// The spillway floor. Flatter and duller than most — the apron is concrete
		// and the card cannot afford a textured field competing with the face.
		ground: { tint: 0.06, relief: 0.05, cells: 14, far: 4 },
		look: { e: 0, n: 0, h: 4.3, width: 8.6 }
	},

	// ── Certificate Pressure ──────────────────────────────────────────────────
	// "A cooperative authority signs. The Checkpoint loses 4 hardening this
	// round: the traffic is valid."
	//
	// AN OFFICIAL BRINGING A SEAL DOWN ON A DOCUMENT, AND THE MAN IT IS FOR IS
	// STANDING THERE WITH HIS HANDS EMPTY.
	//
	// The obvious picture is the Checkpoint: a gate, some traffic, something
	// slipping past. That is a card about a control failing, and this deck
	// already has two of those. Nothing fails here. The gate is going to work
	// perfectly, on a certificate that is genuinely valid, because the only
	// building that can testify has testified.
	//
	// So the shot moves upstream to the Attestation Court and stages the
	// TRANSACTION. Everything in it is legitimate: a registrar in the defender's
	// own blue, at his own bench, under his own seal, doing his job correctly.
	// The attacker is a bystander at his own attack — he carries nothing, touches
	// nothing, and is the only figure on the card with nothing in his hands. That
	// is what `skill: social` and `impact: bloom` mean here; the fx file writes
	// the second one down as "a control was bought, not thrown".
	//
	// `watch` on the lead, which is the pose `exfil`'s guard wears, used for the
	// opposite meaning. There it is a man who will not act. Here it is a man who
	// does not need to.
	//
	// Square on (`yaw: 0`), and the reason is this card's own: a court is a room
	// built to be FACED. Bench, bar and seal are arranged on one axis so that
	// everyone in the chamber addresses the same point, and off that axis it is
	// an office with a desk in it. The objects are turned instead — see the rail
	// and the drones — so a frontal room does not become a row of flat cards.
	ca: {
		cast: 1,
		doing: 'watch',
		yaw: 0,
		// At the end of the bench, turned in at the registrar. Near profile: any
		// squarer and he is addressing the camera instead of the transaction, any
		// further round and the visor goes with him.
		lead: { e: 1.5, n: 2.9, h: 0, face: 0.95 },
		backdrop: { piece: COURT_WALL, size: 1, e: 0, n: 4.75, face: 0, tint: 0.32 },
		extras: [
			// The device, directly over the bench and over the man behind it. It is
			// the largest single object on the card and the only one nobody is
			// touching, which is the arrangement the card is about.
			{ piece: COURT_SEAL, color: '#FB923C', emits: true, tint: 0.22, e: -0.7, n: 4.6, h: 2.42 },

			{ piece: COURT_DAIS, color: '#4A3B33', tint: 0.6, e: -0.55, n: 3.85 },
			{ piece: COURT_BENCH, color: '#6B4E3A', tint: 0.72, e: -0.55, n: 3.2 },

			// The paper, and the press standing on it. The only warm light at floor
			// level, and the reason it is warm is that on this card the paperwork is
			// the weapon.
			{ piece: WRIT, color: '#FFD9A8', emits: true, tint: 0.75, e: -0.7, n: 3.32, h: BENCH_H },
			{ piece: WRIT_ROWS, color: '#2A1D12', tint: 0.9, e: -0.7, n: 3.32, h: BENCH_H },
			{ piece: SEAL_PRESS, color: '#A8998A', tint: 0.9, e: -0.14, n: 3.28, h: BENCH_H },

			// The bar, turned a little off square so the chamber has a corner.
			{ piece: COURT_RAIL, color: '#6B5140', tint: 0.55, e: 0, n: 0.85, face: 0.06 }
		],
		figures: [
			// The registrar. Blue, because this is the defender's own institution
			// and it is the only cool thing in an orange room — the one object here
			// that belongs to the people being robbed.
			//
			// `emblem.ring` on his chest is the device on the wall behind him at
			// one twentieth the size. Nothing has to say he speaks for the court.
			{
				who: { key: 'registrar', name: '', color: '#38BDF8', shape: 'runner' },
				trim: '#38BDF8',
				worn: ['hat.cap', 'emblem.ring'],
				pose: DOING.work,
				e: -0.7,
				n: 3.75,
				h: DAIS_H,
				face: 0
			}

			// CUT: two drones behind the bar, waiting to be certified — `fx.squad`
			// on this card is `{2, drone}` and taking it literally gave the shot the
			// traffic as well as the transaction.
			//
			// They were four objects doing one word of work, in the same corner as
			// the seal and the registrar, and they cost the card the thing it is
			// actually about: two men and a document, one of them working and one of
			// them with nothing in his hands. A third party in the frame turns a
			// comparison into a scene with some people in it.
		],
		// A floor, barely. The bench and the rail are the horizons on this card.
		ground: { tint: 0.07, relief: 0.05, cells: 16, far: 3.2 },
		look: { e: -0.2, n: 0, h: 2.14, width: 4.4 }
	},

	// ── Living off the Land ───────────────────────────────────────────────────
	// "Every tool used is one the estate installed itself. Nothing to detect,
	// because nothing is foreign."
	//
	// HIM AT HIS LAPTOP, AND AN EMPTY OFFICE WITH AN OLD BOX HUMMING UNDER THE
	// DESK, AND NOTHING GOING BETWEEN THEM.
	//
	// `contribution`'s seam, borrowed a second time and made to say something it
	// has not said yet. There, the diagonal joins two places: he fixed something
	// at his own desk and it ended up running on a machine he will never see, and
	// the WIRE crossing the middle of the card is the relationship. Here there is
	// no wire, and its absence is the card — `fx.vector` on this one is `none`,
	// which the file glosses as "does not travel at all: it was already inside".
	//
	// So the two halves are furnished identically on purpose. A desk and a
	// machine on his side; a desk and a machine on theirs. Nothing about the
	// picture distinguishes the attacker's equipment from the estate's, because
	// there is no distinction to draw: the tool he is using is the one they
	// bought, installed and inventoried themselves.
	//
	// The two LIGHTS are the tell, and they are the same colour. The glow on his
	// face is the glow off the front of their server. `word: 'inhabits'`,
	// `icon: 'home'` — the vocabulary this card ships with is dwelling, not
	// arrival.
	//
	// The chair is empty and that is a prop with one job. Nobody is in that
	// office; the machine is working anyway; and it is doing exactly what it was
	// installed to do.
	//
	// Square on (`yaw: 0`) for `contribution`'s reason, which is the same reason:
	// a comparison of two flat halves, and off-axis one of them is nearer and
	// stops being comparable.
	lotl: {
		cast: 1,
		doing: 'sit',
		yaw: 0,
		// Below the seam, in front of his own wall. Turned a little off square so
		// the screen has a face to light rather than the back of a head.
		lead: { e: 0.85, n: 1.62, h: 0, face: 0.34 },
		// His wall takes the backdrop slot and the card's hue with it, exactly as
		// `contribution`'s house does. It is also the NEAR object, so the seam is
		// its own top edge rather than a line ruled over the card.
		backdrop: { piece: LOTL_WALL, size: 1, e: 0, n: 2.4, face: 0, tint: 0.45 },
		extras: [
			// ── Their side. Far, and therefore up the frame and past the seam. ──
			{ piece: OFFICE_WALL, color: '#FB923C', tint: 0.17, e: -1.5, n: 9.9 },
			{ piece: OFFICE_BAND, color: '#C9A882', emits: true, tint: 0.3, e: -1.5, n: 9.84 },
			{ piece: OFFICE_CHAIR, color: '#4E4E44', tint: 0.78, e: -1.12, n: 9.2, face: 0.42 },
			{ piece: OFFICE_DESK, color: '#7A6250', tint: 1, e: -0.95, n: 5.6, face: 0 },
			{ piece: LEGACY, color: '#9E937E', tint: 1, e: -0.68, n: 5.72 },
			{ piece: LEGACY_LEDS, color: '#B8D4DC', emits: true, tint: 0.5, e: -0.68, n: 5.72 },

			// ── His side. Near, below the seam. ─────────────────────────────────
			{ piece: LOTL_DESK, color: '#332A24', tint: 0.9, e: 0.85, n: 1.05 },
			// The same laptop `contribution` built, for the same reason it was built
			// as two solids: a lit slab standing on a desk in front of a body has no
			// silhouette, and what makes a laptop a laptop is the L.
			{ piece: DECK, color: '#2B3038', tint: 0.8, size: 1.25, e: 0.85, n: 0.95, h: 0.44 },
			// Identical to the LEDs on their server, and that is the one deliberate
			// coincidence on the card.
			{ piece: SCREEN, color: '#242A33', tint: 0.85, size: 1.25, e: 0.85, n: 0.95, h: 0.44 },
			// Identical to the LEDs on their server, and that is the one deliberate
			// coincidence on the card: the light on his face is coming off the front
			// of a machine the estate bought.
			{ piece: LOTL_GLOW, color: '#B8D4DC', emits: true, tint: 0.5, e: 0.85, n: 1, h: 0.855 }
		],
		// Almost nothing. Two walls are the reference on this card and the floor's
		// only job is to stop the near desk hanging.
		ground: { tint: 0.06, relief: 0.06, cells: 16, far: 3 },
		look: { e: -0.19, n: 0, h: 1.63, width: 3.15 }
	},

	// ── Sweep ─────────────────────────────────────────────────────────────────
	// "Reveal every active implant in one territory. Sleepers are inert and stay
	// hidden — that is the point of them."
	//
	// FOUR IDENTICAL CABINETS UNDER ONE SWEEP. THREE OF THEM HAVE SOMETHING ON
	// THEM THAT IS LIT UP AND FOUND. THE FOURTH HAS THE SAME THING ON IT, AND IT
	// IS NOT DOING ANYTHING.
	//
	// The obvious picture is a beam travelling across a room, with the drama in
	// where the light has got to. That is a card about coverage and it says the
	// wrong thing — that the sleeper was missed because the search did not reach
	// it. `wide: true`; the search reached everything. The wash here runs the
	// full width under all four and nothing is outside it.
	//
	// What separates found from missed is EMISSION, and that is why this card
	// needed no invented visual language: `emits` is already how this renderer
	// says a thing is switched on. The three that are running are drawn as
	// lights. The fourth is drawn as a shape. Behavioural detection finds things
	// by their behaviour, and the one with none is not hiding — it is simply not
	// giving the instrument anything to read.
	//
	// It is `sleeper`'s counterpart and should be recognisable as one. That card
	// is a row of identical bodies where you cannot tell which is the implant;
	// this is a row of identical machines where you can, three times out of four.
	// Deliberately not another cubicle bank: machines rather than people,
	// waist-height rather than head-height, and a figure HOVERING over the row,
	// which `sleeper` has no equivalent of. The Hunter is the deck's first
	// `drone` build and the first figure in it with nothing underneath.
	//
	// NO PLAY STATE, and that is a statement rather than an omission. Playing
	// Sweep is precisely the thing that does not reveal the fourth. A `wakes` on
	// it would contradict the rules text in the most direct way the file allows.
	//
	// Square on (`yaw: 0`), and this card's own reason: a sweep is a symmetric
	// field, and the boundary of what a search covered is only legible square to
	// its source — off-axis, one end of the rank is nearer than the other and a
	// miss is indistinguishable from a thing further away.
	sweep: {
		cast: 1,
		doing: 'creep',
		yaw: 0,
		// In the air, over the lit floor, leaning along the row. `creep` is "low
		// and reaching, weight forward" — on a build with no legs that is not a
		// crouch, it is a search posture. The `h` is the whole of what makes it
		// hover: a legless figure standing on the ground is a legless figure, and
		// one with a lit floor visible underneath is flying.
		lead: { e: 1.75, n: 1.9, h: 0.6, face: -0.75 },
		backdrop: { piece: SWEEP_WALL, size: 1, e: 0, n: 5.6, face: 0, tint: 0.24 },
		extras: [
			{ piece: SWEEP_DUCT, color: '#5E7A6E', tint: 0.5, e: 0, n: 4.7, h: 2.2 },
			{ piece: SWEEP_DUCT, color: '#5E7A6E', tint: 0.62, e: 0, n: 2.6, h: 2.35 },

			// The sweep. Authored in the Hunter's own saturated green and it painted
			// a solid stripe: `lamp()` is `0.62·colour + 112·tint`, so on a
			// saturated hex the COLOUR term dominates and turning `tint` down does
			// not dim it, it only stops adding white. A wash has to be desaturated
			// in the hex before it can be dim at all.
			{ piece: SWEEP_WASH, color: '#1E4A38', emits: true, tint: 0.26, e: 0, n: 1.8 },

			{ piece: SWEEP_RACKS, color: '#3E4A52', tint: 0.66, e: 0, n: 3.4 },
			{ piece: SWEEP_VENTS, color: '#2A333A', tint: 0.85, e: 0, n: 3.4 },

			// ── Three found. ──────────────────────────────────────────────────
			// The deck's hostile red, and they are lit for the only reason anything
			// on this card is lit: they are running.
			{
				piece: SWEEP_IMPLANT,
				color: '#EF4444',
				emits: true,
				tint: 0.55,
				e: -2.3,
				n: 2.98,
				h: 0.88
			},
			{
				piece: SWEEP_IMPLANT,
				color: '#EF4444',
				emits: true,
				tint: 0.55,
				e: 0,
				n: 2.98,
				h: 0.88
			},
			{
				piece: SWEEP_IMPLANT,
				color: '#EF4444',
				emits: true,
				tint: 0.55,
				e: 1.15,
				n: 2.98,
				h: 0.88
			},

			// ── And one that was swept and returned nothing. ──────────────────
			// Same piece, same place on its cabinet, same size. Not emitting, and
			// therefore not red — `emits` is the only difference between this prop
			// and the three above it, which is exactly the difference the card is
			// about.
			//
			// Lighter than the cabinet it is clamped to rather than darker, and that
			// is a deliberate compromise: a genuinely hidden object would be
			// invisible, and a card whose lesson cannot be seen has not taught it.
			// The eye finds the three lights first and this second, which is the
			// order the sentence wants.
			//
			// Second from the left, INTERLEAVED with the found ones rather than at
			// an end. At an end it reads as the one the sweep has not got to yet.
			{ piece: SWEEP_IMPLANT, color: '#8A8578', tint: 0.95, e: -1.15, n: 2.98, h: 0.88 }
		],
		// Barely lit. The wash is the only floor interest this card wants, and a
		// textured slab under a light slab is two floors.
		ground: { tint: 0.07, relief: 0.05, cells: 16, far: 3.4 },
		// Panned right of centre because the Hunter is at the right and moving
		// further that way — the space the composition gives is the space it is
		// heading into.
		look: { e: -0.35, n: 0, h: 2.12, width: 4.6 }
	},

	// ── Two-Person Review ─────────────────────────────────────────────────────
	// "Nothing lands on the say-so of one account. The helpful newcomer needs a
	// second helpful newcomer."
	//
	// A DOOR THAT WILL NOT OPEN, AND TWO KEYS SO FAR APART THAT NOBODY CAN TURN
	// BOTH.
	//
	// The first blue face in the deck, and the first card here whose subject is
	// arithmetic rather than sight. Every defensive idea the game has drawn so
	// far is about noticing something; this one notices nothing. It would pass a
	// good attacker on the merits — the rules text says so outright, since the
	// second reviewer is allowed to be exactly as helpful and exactly as fooled
	// as the first. What changes is the price: one compromised account becomes
	// two independent ones.
	//
	// So the obvious picture is wrong. Two people at a screen reading a diff
	// together is a photograph of diligence, and diligence is the one thing this
	// control does not rely on. What it relies on is a measured distance, and
	// that is a thing you can build: two stations 3.3 paces apart, a reach of
	// 0.47, and a person in the middle who is not close to either.
	//
	// Neither figure is `extra`, which is `insider`'s argument in another key.
	// Dimming one would nominate a real reviewer and a spare, and the claim is
	// that neither is sufficient. They are deliberately DIFFERENT builds in
	// different kit — the exact inverse of `sleeper`, where sameness is the
	// threat. Two identical figures here would read as one person twice, which is
	// the failure the control exists to prevent.
	//
	// Square on (`yaw: 0`), and the reason is this card's own: its content is a
	// MEASUREMENT. How far apart the two keys are is the security property, and a
	// measurement shown at an angle is not one — off-axis, one station is nearer
	// than the other and "out of reach from the middle" stops being visible.
	review: {
		cast: 1,
		doing: 'work',
		yaw: 0,
		// At his own station and turned out at it, which puts him in near profile.
		// Both of them face AWAY from each other on purpose: a two-man rule is not
		// a conversation, and two people conferring over one key is the picture of
		// the control being defeated rather than applied.
		lead: { e: -1.15, n: 2.3, h: 0, face: 1.0 },
		backdrop: { piece: STRONG_WALL, size: 1, e: 0, n: 3.7, face: 0, tint: 0.26 },
		extras: [
			{ piece: STRONG_COURSE, color: '#5E6C7A', tint: 0.5, e: 0, n: 3.62 },
			{ piece: STRONG_DOOR, color: '#5E6C7A', tint: 0.85, e: 0, n: 3.6 },
			{ piece: STRONG_WHEEL, color: '#8A97A6', tint: 0.9, e: 0, n: 3.6 },

			// The two stations, and the only two lit things on the card. Identical
			// in every respect and as far apart as the frame allows: at card size
			// the whole argument survives as two matched blue marks at opposite
			// edges with a shut door between them.
			{ piece: KEY_POST, color: '#3E4A57', tint: 0.8, e: -1.65, n: 2.7 },
			{ piece: KEY_LAMP, color: '#38BDF8', emits: true, tint: 0.5, e: -1.65, n: 2.7 },
			{ piece: KEY_POST, color: '#3E4A57', tint: 0.8, e: 1.65, n: 2.7 },
			{ piece: KEY_LAMP, color: '#38BDF8', emits: true, tint: 0.5, e: 1.65, n: 2.7 }
		],
		figures: [
			// The second account. A runner where he is a brute, a muted slate where
			// he is the saturated blue, one emblem and no hat — junior, ordinary,
			// and entirely sufficient. The control does not ask for a better person,
			// it asks for another one.
			{
				who: { key: 'second-signer', name: '', color: '#6E7F94', shape: 'runner' },
				trim: '#6E7F94',
				worn: ['emblem.star'],
				pose: DOING.work,
				e: 1.15,
				n: 2.3,
				face: -1.0
			}
		],
		// A hall floor, and barely. The door and the course are the horizons here.
		ground: { tint: 0.07, relief: 0.05, cells: 16, far: 3 },
		// Centred, because the card is symmetric and its subject is the gap in the
		// middle. Width is set by the two stations at ±1.99 including their decks;
		// the door is then sized to fill the height it leaves.
		look: { e: 0, n: 0, h: 2.14, width: 4.2 }
	},

	// ── Short-Lived Credentials ───────────────────────────────────────────────
	// "The token is minted for this job and dead before the next one. Stealing it
	// buys ninety seconds."
	//
	// A MACHINE THAT MINTS ONE CREDENTIAL AT A TIME, WITH A HEAP OF DEAD ONES IN
	// THE TRAY UNDERNEATH IT.
	//
	// The subject of this card is TIME, which a single frame cannot show, and the
	// first idea is always a clock — this card's own `icon` is `clock`, which is
	// exactly why it must not be the picture. An icon promoted to art is the
	// bullet point this whole file exists to replace.
	//
	// So time is a DIRECTION instead, and the only direction a still frame gets
	// for free is down. A mouth at the top, one live token part way between, a
	// heap at the bottom: how far the live one has fallen is how much of it is
	// left. `pressure` already established the half of this that matters —
	// columns pour, rows sit there.
	//
	// The device is the value gradient read downward. Brightest at the slot,
	// dimmer at the token, dark at the heap. A decay curve drawn in light, which
	// needs no animation and survives being forty pixels tall.
	//
	// And the heap is the argument. One expiring credential is a countdown; a
	// tray full of spent ones is a machine that has been doing this all day, and
	// the card's real claim is not that this token dies but that a stolen one is
	// worth nothing by the time you have it. `pairs` lists `harvest` and
	// `insider` — two cards about successfully stealing a credential. Against
	// this both still succeed, and both get that.
	//
	// He is at a console and not at the machine, because the whole point of
	// workload identity is that no human touches the token. He built it; it runs
	// without him.
	//
	// Square on (`yaw: 0`), and the reason is this card's own: the subject is a
	// VERTICAL. The content is the order of three things stacked over each other,
	// and off-axis they stop being stacked and become three objects in three
	// places. The objects are turned instead — see the console and the base.
	shortlived: {
		cast: 1,
		doing: 'work',
		yaw: 0,
		// Left, turned in at the machine, hands on his own console. Far enough off
		// square that the visor still reads: past about a half radian a brute's
		// face goes with the shoulders.
		lead: { e: -1.05, n: 3.5, h: 0, face: -0.45 },
		// The wall keeps `fx.hue`, so this reads as a blue card in a row of red
		// ones without anything else having to be blue. It is also the only large
		// surface here, and a machine silhouetted against its own building is the
		// arrangement this card wants.
		backdrop: { piece: FORGE_WALL, size: 1, e: 0, n: 4.6, face: 0, tint: 0.3 },
		extras: [
			{ piece: FORGE_SKIRT, color: '#7FA8C4', tint: 0.3, e: 0, n: 4.55 },

			{ piece: MINT_CONSOLE, color: '#454C56', tint: 0.8, e: -0.9, n: 3.28, face: -0.3 },
			// Small, bright, and pushed to the far end of his own console. At the
			// size and value it started at it was a mid-grey slab standing across
			// his chest — a panel has to read as LIT or it is furniture in front of
			// a face.
			{ piece: CONSOLE_PANEL, color: '#9FC4DE', emits: true, tint: 0.55, e: -0.42, n: 3.28 },

			// ── The machine. Warm-neutral dark, so it reads AGAINST the blue
			//    rather than dissolving into it. ────────────────────────────────
			{ piece: MINT_BASE, color: '#3A3F47', tint: 0.72, e: 0.45, n: MINT_N, face: 0.18 },
			// LIGHTER than the tray, not darker. Authored dark on the argument that
			// spent is dim, and it made the heap invisible in a dark tray — which
			// costs the card the bottom of its own gradient and the only object
			// saying this has been running all day. It stays dead by not EMITTING:
			// the two above it glow and this does not, which is the distinction
			// that matters and the one the renderer actually draws.
			{ piece: SPENT_HEAP, color: '#5A6472', tint: 0.95, e: 0.45, n: MINT_N },
			{ piece: MINT_RAILS, color: '#4A515B', tint: 0.85, e: 0.45, n: MINT_N },
			{ piece: MINT_HEAD, color: '#3A3F47', tint: 0.78, e: 0.45, n: MINT_N },

			// ── The three steps of the gradient, top to bottom. ────────────────
			// The slot: the brightest thing on the card, and the only one at full
			// value. `tint` is an emitter's only dimmer — the hex sets the hue and
			// nothing else, so all three steps are one tint scale.
			{ piece: MINT_MOUTH, color: '#CFE8F5', emits: true, tint: 0.62, e: 0.45, n: MINT_N },
			// The live one, below the midpoint between slot and heap — over half
			// gone. Nearer than the rails so it draws between them rather than
			// behind, and a deeper hue than the slot so the value step reads:
			// `lamp()` adds a flat 112·tint, which compresses two pale colours
			// toward each other.
			{
				piece: TOKEN,
				color: '#7FB8D8',
				emits: true,
				tint: 0.46,
				e: 0.45,
				n: MINT_N - 0.06,
				h: 1.0
			}
		],
		ground: { tint: 0.07, relief: 0.06, cells: 16, far: 3.2 },
		look: { e: -0.28, n: 0, h: 2.02, width: 3.55 }
	},

	// ── Harden ────────────────────────────────────────────────────────────────
	// "Spend budget on one building: +3 hardening, permanently. Slow,
	// unglamorous, and how the game is actually won."
	//
	// A MAN ADDING ONE COURSE TO THE FOOT OF A WALL FOUR TIMES HIS HEIGHT, WITH
	// THE PALLET BESIDE HIM STILL NEARLY FULL.
	//
	// The one card in the deck with no `# real:` citation, and that is not an
	// omission — it models no incident because it is the aggregate of all the
	// spending that meant there was no incident. It has no `targets` either.
	// Generic by design, so the picture must not be anywhere identifiable.
	//
	// The trap is its own icon. `icon: 'shield'`, and a shield — or a barrier
	// going up, or anyone standing back to admire one — makes it an achievement,
	// which the rules text goes out of its way to deny. So he is not RAISING a
	// wall, he is thickening one that already stands and already works. Raising
	// is visible progress; thickening is a job that when finished will look
	// exactly like the thing did before it started.
	//
	// The docket on the pallet does real work: the yaml says that on a third
	// party this card buys a contract clause or a cheque rather than a config
	// change, and without something that was paid for this is a picture of labour
	// instead of budget.
	//
	// NO PLAY STATE — the purest standing condition in the deck. A reveal would
	// invent a moment on the one card whose entire claim is that there is not one.
	//
	// The DECK's own bearing, `yaw` omitted, and only `divergence` shares it. The
	// reason is this card's: the subject is THICKNESS. A wall square on is a flat
	// field with no depth, and the whole point is that this one is being made
	// deeper. Off-axis it shows a face and a return, so a course being added has
	// somewhere to go.
	harden: {
		cast: 1,
		doing: 'work',
		// At the leading edge, turned along the line rather than into the wall —
		// how the job is actually done, and what keeps him three-quarter to camera
		// instead of presenting a back.
		lead: { e: 0.6, n: 2.05, h: 0, face: -0.75 },
		backdrop: { piece: HRD_WALL, size: 1, e: 0, n: 3.4, face: 0, tint: 0.22 },
		extras: [
			{ piece: HRD_PIERS, color: '#5E7386', tint: 0.42, e: 0, n: 3.4 },

			// The new work. One step lighter and greyer than the wall it is going
			// onto — close enough to be the same masonry, different enough to be
			// findable. That near-match is the sentence in two values.
			{ piece: HRD_SKIN, color: '#7E8CA3', tint: 0.5, e: 0, n: 2.66 },
			{ piece: HRD_COURSE, color: '#8A97A6', tint: 0.62, e: 0, n: 2.66, h: 0.58 },

			// Well forward of the wall, and the distance is a sorting requirement as
			// much as a staging one — see `HRD_WALL`. A pallet stood against the
			// face loses the depth sort to the bay behind it.
			{ piece: HRD_PALLET, color: '#4A3B33', tint: 0.7, e: 1.85, n: 1.35, face: 0.3 },
			{ piece: HRD_DOCKET, color: '#D8CFC0', tint: 0.9, e: 1.85, n: 1.35, face: 0.3 },

			{ piece: HRD_LAMP, color: '#2E3540', tint: 0.8, e: 1.05, n: 1.15 },
			{ piece: HRD_LAMP_GLOW, color: '#CFE0E8', emits: true, tint: 0.4, e: 1.05, n: 1.15 }
		],
		// A site floor, and barely. The wall is the horizon on this card.
		ground: { tint: 0.06, relief: 0.05, cells: 16, far: 3.2 },
		// Derived at the DECK bearing, where the projection is two-term in both
		// axes — `screenAt` only holds at yaw 0, so this one could not use it.
		look: { e: 0.61, n: 2.2, h: 2.05, width: 6.4 }
	},

	// ── Egress Policy ─────────────────────────────────────────────────────────
	// "Name every host this thing may talk to. There will be four, and it will
	// hate you."
	//
	// A PATCH FRAME THE SIZE OF A WALL WITH FOUR CABLES IN IT, AND THE MACHINE ON
	// THE END OF THEM.
	//
	// The obvious picture is a gate with something being turned back at it.
	// `exfil` already owns that shot and it is the wrong mechanism anyway: a
	// blocklist turns things back, an allowlist never sees them, because they were
	// never on it. An allowlist is defined by WHAT IS NOT ON IT — the hard thing
	// to draw, and the only honest answer is a scale where the absence dwarfs the
	// presence.
	//
	// So: two hundred and sixteen dead sockets filling the frame, and four lit
	// cables at the bottom running out to one small machine. Nothing states the
	// ratio. The ratio is the card, and it is the joke drawn rather than captioned
	// — the emptiness towers over the four little wires.
	//
	// It sorts a set by `emits`, which is `sweep`'s mechanism, and the difference
	// is worth naming. There it is four large objects and lit means CAUGHT; here
	// it is two hundred small ones and lit means PERMITTED. Same channel, opposite
	// meaning, two orders of magnitude apart in density.
	//
	// No play state. `vector: 'none'`, `leaves: 'garrison'` — a standing
	// condition, in force before it was played and after.
	//
	// Square on (`yaw: 0`), and this card's own reason: YOU CANNOT COUNT A GRID
	// YOU ARE LOOKING AT EDGEWISE. Off-axis the rows foreshorten into a receding
	// plane and "four out of a regular many" collapses into a perspective effect.
	egress: {
		cast: 1,
		doing: 'work',
		yaw: 0,
		// At the board, in near profile, and standing well clear of the port field
		// in depth: he has to sort in front of it, and a tall wall's facet centroid
		// sits high enough to beat anything standing close to it.
		lead: { e: 2.1, n: 3.2, h: 0, face: 1.15 },
		backdrop: { piece: EGR_FRAME, size: 1, e: 0, n: 4.0, face: 0, tint: 0.16 },
		extras: [
			// Stood a quarter of a pace off the board, and that is not decoration.
			// A 4.6-tall board carries a large depth bonus from its centroid, so a
			// port at knee height flush against it sorts BEHIND the thing it is set
			// into.
			//
			// LIGHTER than the board behind them, which is the whole point: the
			// empty sockets are the subject, and a subject you cannot see has not
			// been drawn.
			{ piece: EGR_RAILS, color: '#33465A', tint: 0.8, e: 0, n: 3.74 },
			{ piece: EGR_PORTS, color: '#4A6076', tint: 0.85, e: 0, n: 3.72 },

			{ piece: EGR_NAMED, color: '#38BDF8', emits: true, tint: 0.55, e: 0, n: 3.7 },

			// Dimmer than the collars, so the sockets read as the source and the
			// cables as the consequence.
			{ piece: EGR_LEADS, color: '#7FB8D8', emits: true, tint: 0.44, e: 0, n: 3.25 },

			{ piece: EGR_LOAD, color: '#3A4450', tint: 0.8, e: -1.3, n: 3.1 },
			{ piece: EGR_LOAD_LAMP, color: '#9FC4DE', emits: true, tint: 0.4, e: -1.3, n: 3.1 }
		],
		ground: { tint: 0.06, relief: 0.05, cells: 16, far: 3 },
		look: { e: 0.45, n: 0, h: 2.8, width: 4.45 }
	},

	// ── Phishing-Resistant MFA ────────────────────────────────────────────────
	// "The key will not sign for a domain it has never seen. There is no code to
	// read aloud."
	//
	// A KEY BOLTED TO A DESK BY AN ARM A HAND LONG, AND THE MAN IT BELONGS TO
	// WALKING AWAY FROM IT TOWARD A SIGN-IN PAGE ACROSS THE ROOM.
	//
	// The direct answer to `takeover`, and the reason it is not smug: he has
	// fallen for it completely. That is the real incident — one campaign hit
	// Twilio, Okta's supplier and Cloudflare with the same fake pages, and
	// Cloudflare's people went to the page and typed their credentials in like
	// everybody else. It did not matter.
	//
	// So the claim is not that a key cannot be phished. It is that the human's
	// judgement was taken out of the loop BEFORE the human failed, which is what
	// the second sentence of the rules text is about: there is nothing to say, so
	// there is nothing to be tricked into saying.
	//
	// The mechanism is made physical because the alternatives are all icons. A
	// credential that works at exactly one place is a thing on a short tether, so
	// the security property is a LENGTH — 0.46 of arm against 2.9 of gap.
	//
	// And the real station is deliberately NOT a screen. The answer to two
	// identical pages cannot be a third page; origin binding lives in the device
	// rather than in what is displayed. The only page in this frame is the fake
	// one, quoted from `takeover` unchanged, sitting here doing nothing.
	//
	// The floor between the two stations is empty on purpose. That gap is the
	// object, and anything standing in it is standing in the only measurement the
	// card makes.
	//
	// Square on (`yaw: 0`), and this card's own reason: a tether seen at an angle
	// is a tether of unknown length, and "cannot reach" becomes indistinguishable
	// from "is pointing away".
	webauthn: {
		cast: 1,
		doing: 'stride',
		yaw: 0,
		// Mid-step, turned left, most of the way to the page and nowhere near the
		// desk. `stride` is the only pose in the set that says a person is GOING
		// somewhere, and where he is going is the wrong place.
		lead: { e: -0.6, n: 2.4, h: 0, face: 1.05 },
		backdrop: { piece: WAN_WALL, size: 1, e: 0, n: 4.2, face: 0, tint: 0.24 },
		extras: [
			{ piece: WAN_COURSE, color: '#6E8CA8', tint: 0.42, e: 0, n: 4.15 },

			// The bait. The same `#CFE3F2` `takeover`'s pages wear. Not sinister,
			// nothing wrong with it — which is why it works and why it does not
			// matter here.
			{ piece: WAN_STAND, color: '#3E4A57', tint: 0.72, e: -1.5, n: 2.7 },
			{ piece: WAN_PAGE, color: '#CFE3F2', emits: true, tint: 0.7, e: -1.5, n: 2.7, h: 1.2 },
			{ piece: WAN_PAGE_ROWS, color: '#1C2430', tint: 0.9, e: -1.5, n: 2.7, h: 1.2 },

			{ piece: WAN_DESK, color: '#4A4F5A', tint: 0.7, e: 1.4, n: 3.0 },
			{ piece: WAN_ANCHOR, color: '#8A97A6', tint: 0.9, e: 1.4, n: 3.0 },
			{ piece: WAN_ARM, color: '#8A97A6', tint: 0.95, e: 1.4, n: 3.0 },
			{ piece: WAN_READER, color: '#2A313A', tint: 0.85, e: 1.4, n: 3.0 },
			// The one saturated mark on the card, and the smallest object in it.
			{ piece: WAN_KEY, color: '#38BDF8', emits: true, tint: 0.6, e: 1.4, n: 3.0 }
		],
		ground: { tint: 0.07, relief: 0.05, cells: 16, far: 3.2 },
		look: { e: 0.05, n: 0, h: 1.91, width: 4.0 }
	},

	// ── Revoke and Re-Pin ─────────────────────────────────────────────────────
	// "Distrust the authority, not the certificate. Everything it ever signed is
	// unsigned, and the wall goes back up."
	//
	// A RACK OF FILED DOCUMENTS WITH THE LIGHT GONE OUT OF ALL OF THEM, THE DEAD
	// SEAL STILL HANGING ABOVE IT, AND ONE NEW ONE LIT ON A POST AT THE FRONT.
	//
	// This is `ca`'s answer and the deck should be able to see that it is. That
	// card is `COURT_SEAL` glowing over a registrar pressing a stamp onto a lit
	// writ; this one draws the identical constant DARK, and the paper that device
	// made is the same warm colour with nothing in it. The whole palette falls out
	// of that: everything warm here is something the old authority produced and
	// none of it is lit, and the only blue light is the one we put up ourselves.
	//
	// The obvious picture — a certificate torn up, a stamp crossed out — is a card
	// about ONE document, and the rules text is explicit that the document is not
	// the target. The other obvious picture is a mess, drawers out, paper on the
	// floor, and that is worse: it says a person went through them.
	//
	// Nothing here has moved. The catalogue is complete, in order, filed exactly
	// where it was, and worth nothing. That is what a root leaving a trust store
	// looks like from the artifacts' end — no visit, no sorting, and the only
	// thing anybody touched was one entry somewhere else.
	//
	// PLAYING IT MAKES THINGS BETTER, which no other card in this deck does.
	// `whenPlayed` is additive and suits that exactly: the revocation is already
	// the base state, and playing the card fills the empty holder and brings a
	// wash back onto the wall. `sleeper` wakes a threat with the same mechanism
	// and `exception` worsens a failure with it; this is the third meaning.
	//
	// Square on (`yaw: 0`), and this card's own reason: a grid seen off-axis is a
	// rhombus. The content is a complete set filed in order, and "all of them,
	// without exception" only reads square.
	revoke: {
		cast: 1,
		doing: 'work',
		yaw: 0,
		// At the post, turned toward the rack so the two halves of the card are
		// connected by where he is looking.
		lead: { e: 1.8, n: 3.05, h: 0, face: 0.55 },
		backdrop: { piece: RVK_WALL, size: 1, e: 0, n: 4.6, face: 0, tint: 0.26 },
		extras: [
			// `ca`'s device, and deliberately the same constant rather than a copy
			// at a new size — the callback is only worth anything if it is provably
			// the same object. Dark, warm, not emitting: on that card it is the
			// brightest thing in the room.
			{ piece: COURT_SEAL, color: '#5A4A3E', tint: 0.62, e: -0.9, n: 4.45, h: 2.62 },

			{ piece: RVK_RACK, color: '#2E3742', tint: 0.72, e: -0.9, n: 4.2 },
			// Warm grey, and the brightest NON-emitting thing on the card. Paper
			// stays the colour paper is; what it has lost is its light.
			{ piece: RVK_FILED, color: '#9E9484', tint: 0.82, e: -0.9, n: 3.94 },

			{ piece: RVK_POST, color: '#3E4A57', tint: 0.8, e: 1.62, n: 2.62 },
			{ piece: RVK_FRAME, color: '#5E6C7A', tint: 0.9, e: 1.62, n: 2.62 },
			{ piece: RVK_LAMP, color: '#38BDF8', emits: true, tint: 0.3, e: 1.62, n: 2.62 }
		],
		// The new one, and the room coming back with it. The plate is the same
		// `RVK_DOC_W/H` as the fifteen dead ones behind it: the wall goes back up
		// out of the same kind of object that just stopped working.
		whenPlayed: [
			{ piece: RVK_PIN, color: '#38BDF8', emits: true, tint: 0.6, e: 1.62, n: 2.62 },
			// Desaturated in the HEX, not just the tint — the colour term dominates
			// and a saturated blue paints a solid stripe however low the tint goes.
			{ piece: RVK_BLOOM, color: '#22485E', emits: true, tint: 0.26, e: 0, n: 4.2 }
		],
		ground: { tint: 0.07, relief: 0.05, cells: 16, far: 3.2 },
		// The rack runs off the left edge on purpose — a catalogue that continues
		// past the frame is a catalogue, and one with both ends visible is a shelf.
		look: { e: 0, n: 0, h: 2.33, width: 4.55 }
	},

	// ── Fork and Vendor ───────────────────────────────────────────────────────
	// "You cannot fix their project. You can stop it being on the critical path."
	//
	// A DEAD LINE THAT RUNS IN FROM THE EDGE AND STOPS AT A BLANK PLATE, AND A
	// LOADED ONE RUNNING PAST BEHIND IT — WITH THEIR BUILDING DARK BETWEEN THE
	// TWO.
	//
	// The obvious picture is somebody repairing something, and it says the exact
	// opposite of the card. Nothing is repaired here and nothing can be: `on:
	// [neutral]` means this is only ever played on somebody else's estate, and the
	// rules text is explicit that their project stays exactly as it was. What
	// changed is routing, and routing is a fact about ENDS.
	//
	// So one line comes in from the edge and terminates against a plate somebody
	// bolted on, and another runs the full width behind it with the load on it.
	// Their building stands between the two, unlit and shut, and nobody is
	// touching it. It is not damaged in this picture. It is simply no longer in
	// the way of anything.
	//
	// NOT `sweep`'s device, though both cards have a live thing and a dead one.
	// There the difference is emission across identical objects in a row; here the
	// lines are not identical and not in a row, and they differ in TOPOLOGY — one
	// has an end — and in load.
	//
	// NOT `divergence`'s conveyor either. That is one line at floor level whose
	// subject is what changed along it. This is two lines at two heights whose
	// subject is that one of them stops.
	//
	// No play state. A reveal would imply something changes, when the card's whole
	// claim is that the broken thing does not.
	//
	// Square on (`yaw: 0`), and this card's own reason: the subject is a TERMINUS.
	// Off-axis, one end is nearer than the other and "this one stops" degrades
	// into "this one stops closer".
	vendorfork: {
		cast: 1,
		doing: 'work',
		yaw: 0,
		// At the diverter, turned in at it, standing UNDER the bypass. The
		// clearance is deliberate: he is beneath the thing that now carries
		// everything, and beside the thing that carries nothing.
		lead: { e: 1.15, n: 2.0, h: 0, face: -0.4 },
		// Theirs, and dark. The backdrop keeps `stage()`'s default piece — the
		// Maintainer Circle is the first of this card's targets and the building the
		// rules text is about. It also keeps `fx.hue`, which is the strongest use of
		// the colour available: their project, in the card's own blue, lights off.
		backdrop: { size: 1.2, e: -1.55, n: 4.2, face: 0.35, tint: 0.2 },
		extras: [
			{ piece: FRK_LIVE, color: '#6B7C8C', tint: 0.72, e: 0, n: 2.9 },
			// Cool rather than warm. A rust-coloured load on a blue card reads as
			// the red side's hue in the deck row.
			{ piece: FRK_LOAD, color: '#5E7E96', tint: 0.9, e: 0, n: 2.9 },

			{ piece: FRK_DEAD, color: '#4A4640', tint: 0.62, e: 0, n: 1.5 },
			// The palest non-emitting thing on the card, because the whole weight of
			// the sentence rests on this being a plate somebody FITTED.
			{ piece: FRK_CAP, color: '#A8AFB8', tint: 0.95, e: 0, n: 1.5 },

			{ piece: FRK_DIVERTER, color: '#454C56', tint: 0.8, e: 1.15, n: 2.0, face: -0.4 },
			{ piece: FRK_LAMP, color: '#38BDF8', emits: true, tint: 0.5, e: 1.15, n: 2.0 }
		],
		ground: { tint: 0.07, relief: 0.06, cells: 16, far: 3.4 },
		look: { e: -0.35, n: 0, h: 1.98, width: 4.15 }
	},

	// ── Rebuild From Source ───────────────────────────────────────────────────
	// "Throw the artifact away and make it again from readable source. Whatever
	// was hiding in it does not survive the trip."
	//
	// TWO CRATES THE SAME SIZE ON ONE BENCH. ONE IS A SEALED BOX WITH A CROSS ON
	// IT THAT NOBODY HAS OPENED. THE OTHER IS THE SAME BOX BUILT OUT OF PARTS YOU
	// CAN SEE THROUGH.
	//
	// The obvious picture is somebody at a screen finding the malware, and it is
	// the exact opposite of what this card does. NOTHING IS DISCOVERED HERE. The
	// artifact is not opened, not scanned and not proven bad — it is untrusted,
	// which is a far cheaper standard than guilty, and being able to act on it is
	// the whole economy of the card.
	//
	// So the picture is a comparison of OPACITY. An artifact is a thing you cannot
	// see into and source is a thing you can, so the same object appears twice at
	// the same size on the same surface: once sealed and matte, once as an open
	// frame that emits. "Whatever was hiding in it does not survive the trip" is a
	// claim about volume, and the second one has none to hide in.
	//
	// The crate is quoted from `divergence` and the deck should read the pair.
	// That card is the unit you cannot watch — cold in, hot out, the swap behind a
	// building. This is the same unit answered without anybody ever looking inside
	// one. Emphatically not another conveyor: no line, no direction, nothing
	// moving. The counter to a process you cannot observe is not a better view of
	// it.
	//
	// NO PLAY STATE, and that is load-bearing. A reveal on the sealed crate would
	// say "and then they found it", which is the thing that never happens here.
	//
	// Square on (`yaw: 0`), and this card's own reason: the two crates must be the
	// SAME SIZE on the card. Under the deck's bearing two objects at different `e`
	// present different faces at different angles, and "identical" stops being
	// something you can check by looking.
	rebuild: {
		cast: 1,
		doing: 'work',
		yaw: 0,
		// Behind the bench, offset from the new crate rather than behind it. A prop
		// at his own `e` stands across his chest and his visor — the mistake `ca`'s
		// press and `shortlived`'s console panel both paid for.
		lead: { e: 1.6, n: 3.75, h: 0, face: -0.25 },
		backdrop: { piece: RBD_WALL, size: 1, e: 0, n: 4.5, face: 0, tint: 0.24 },
		extras: [
			{ piece: RBD_REELS, color: '#7FB8D8', emits: true, tint: 0.2, e: -0.2, n: 4.4, h: 1.78 },

			{ piece: RBD_BENCH, color: '#3E4650', tint: 0.7, e: 0, n: 3.2 },

			// Warm grey, matte, and the only object here that neither emits nor has
			// a gap in it. Dull rather than sinister: nothing has been proven.
			{ piece: RBD_CRATE, color: '#6E6A60', tint: 0.72, e: -1.25, n: 3.15, h: 0.58 },
			{ piece: RBD_BANDS, color: '#3A362E', tint: 0.85, e: -1.25, n: 3.15, h: 0.58 },
			// Chalk. Stood forward of the crate's front face so it sorts over it — a
			// mark at the same depth as the face it is on has no reliable answer.
			{ piece: RBD_MARK, color: '#C8C2B0', tint: 0.95, e: -1.25, n: 2.86, h: 0.58 },

			// Identical envelope, eight members instead of one solid, and lit. The
			// only difference between this and the crate a pace to its left is
			// whether you can see into it.
			{
				piece: RBD_LATTICE,
				color: '#38BDF8',
				emits: true,
				tint: 0.42,
				e: 0.62,
				n: 3.15,
				h: 0.58
			},

			// You do not discard one suspect artifact, you discard everything you
			// cannot reproduce — and two more on the floor is what stops the bottom
			// fifth of this card being bare.
			{ piece: RBD_CRATE, color: '#6E6A60', tint: 0.55, e: -1.85, n: 2.4, face: 0.24 },
			{ piece: RBD_BANDS, color: '#3A362E', tint: 0.7, e: -1.85, n: 2.4, face: 0.24 },
			{ piece: RBD_CRATE, color: '#6E6A60', tint: 0.5, e: -1.15, n: 2.35, face: -0.15 },
			{ piece: RBD_BANDS, color: '#3A362E', tint: 0.65, e: -1.15, n: 2.35, face: -0.15 }
		],
		ground: { tint: 0.07, relief: 0.05, cells: 16, far: 3.2 },
		look: { e: -0.05, n: 0, h: 2.05, width: 4.1 }
	},

	// ── Provenance Attestation ────────────────────────────────────────────────
	// "Sign the whole chain from source to artifact. Any divergence between the
	// two is revealed outright."
	//
	// A ROW OF SEALED TAGS ON ONE UNBROKEN LINE OF LIGHT, RUNNING FROM A STACK OF
	// SOURCE TO THE CRATE THAT CAME OUT OF IT.
	//
	// The obvious picture is a signature, and `ca` already owns a seal coming down
	// on a document. It is also the wrong object: a single signature says nothing
	// about a chain, since you can sign a thing you never watched being made. This
	// card's text is about EVERY step, so the subject is a sequence with no gap —
	// and the only way one still frame says "no gap" is an even rhythm the eye can
	// run along and find nothing missing.
	//
	// The thread is what makes it a chain rather than seven facts. It is one
	// solid, not segments between the tags, because a line assembled out of gaps
	// could have a gap; and it passes BEHIND them so it shows through the spaces.
	//
	// This is `divergence`'s answer and the crate at the right-hand end is
	// `divergence`'s crate. That card's whole subject is the single station nobody
	// can see past. This one has no such station. `diff` and `rebuild` answer the
	// same attack by acting on the artifact; this never touches it, and instead
	// removes the place the substitution had to hide in.
	//
	// He is READING, not signing. The signing already happened at each step, by
	// whoever did that step. `kind: recon` — what this card does is make the
	// record legible, and a figure applying a seal would be `ca`'s picture.
	//
	// NO PLAY STATE. Every seal is lit at rest because the chain is already
	// signed; lighting them on play would make the base state an unsigned chain.
	//
	// Square on (`yaw: 0`), and the reason is this card's own rather than
	// `review`'s. That card is square on because a DISTANCE is its property. This
	// one is because an evenly spaced series is only countable along its own axis:
	// off-angle the tags bunch toward the far end and the eye can no longer tell
	// whether one is missing.
	attest: {
		cast: 1,
		doing: 'work',
		yaw: 0,
		// Behind the bench, barely off square. Behind, so the bench takes his legs
		// and the card keeps its height for a row of eight-pixel objects; barely,
		// because past about a fifth of a radian a brute's visor goes with its
		// shoulders and the only face on the card stops reading.
		lead: { e: -0.15, n: 3.15, h: 0, face: 0.18 },
		backdrop: { piece: ATT_WALL, size: 1, e: 0, n: 4.4, face: 0, tint: 0.28 },
		extras: [
			{ piece: ATT_SHELF, color: '#5B7488', tint: 0.5, e: 0, n: 4.3, h: 2.5 },
			{ piece: ATT_SHELF, color: '#5B7488', tint: 0.58, e: 0, n: 4.3, h: 1.75 },

			{ piece: ATT_BENCH, color: '#4A4740', tint: 0.72, e: 0, n: 2.6 },

			// The two ends the rules text names. Warm-neutral bone so they
			// silhouette against a blue wall rather than dissolving into it.
			{ piece: ATT_SOURCE, color: '#B8AE99', tint: 0.9, e: -1.92, n: 2.5, h: ATT_BENCH_H },
			{ piece: ATT_ARTIFACT, color: '#7A6F5E', tint: 0.85, e: 1.92, n: 2.5, h: ATT_BENCH_H },

			{ piece: ATT_THREAD, color: '#7FD4F5', emits: true, tint: 0.42, e: 0, n: 2.54 },
			{ piece: ATT_TAGS, color: '#C4BCA8', tint: 0.95, e: 0, n: 2.5 },
			{ piece: ATT_SEALS, color: '#7FD4F5', emits: true, tint: 0.42, e: 0, n: 2.5 },

			// Both ends sealed, at exactly the tint the run is. A card whose
			// signatures were different brightnesses would say some steps are better
			// attested than others.
			{
				piece: ATT_END_SEAL,
				color: '#7FD4F5',
				emits: true,
				tint: 0.42,
				e: -1.92,
				n: 2.29,
				h: ATT_BENCH_H + 0.24
			},
			{
				piece: ATT_END_SEAL,
				color: '#7FD4F5',
				emits: true,
				tint: 0.42,
				e: 1.92,
				n: 2.25,
				h: ATT_BENCH_H + 0.5
			}
		],
		ground: { tint: 0.06, relief: 0.05, cells: 16, far: 3 },
		look: { e: 0, n: 0, h: 2.07, width: 4.5 }
	},

	// ── Diff the Tarball ──────────────────────────────────────────────────────
	// "Compare what shipped against what was written. Reveals Release Divergence
	// outright, wherever it hides."
	//
	// A SHADOW BOARD. EVERY TOOL SITTING ON ITS OWN PAINTED SILHOUETTE, AND ONE
	// HANGING IN CLEAR SPACE WITH NOTHING PAINTED BEHIND IT.
	//
	// This card is a comparison and the deck has spent every comparison device it
	// owns: the 45° seam three times, `divergence`'s run of crates that change
	// colour past an occluder, `sweep`'s rank of machines where one is dark. A
	// fourth two-things-side-by-side would be a treatment applied to the deck
	// rather than an argument made by a card.
	//
	// So the third way is REGISTRATION. A diff is not two things next to each
	// other, it is one thing laid over another where the answer is the part that
	// fails to coincide — and a shadow board is that operation as furniture. The
	// paint is the source. The tools are what shipped. An item with nothing
	// painted behind it is a file in the tarball with no counterpart in the tree,
	// which is precisely how xz was caught. Nobody read it and found it bad.
	//
	// It is `sweep`'s sibling and the mechanism differs on purpose. There the odd
	// one is told apart by its OWN emission — dark because it is not running, and
	// the instrument is passive. Here every item is identical, matte and silent,
	// and the odd one is told apart by the absence of something BEHIND it. One
	// card looks at the objects; this one looks at the register.
	//
	// Square on (`yaw: 0`), and this card's own reason: registration is only
	// visible square to the board. Off-axis every item is displaced from its own
	// backing by parallax and they all look wrong, which destroys the single
	// distinction the card exists to draw.
	diff: {
		cast: 1,
		doing: 'creep',
		yaw: 0,
		// Hovering off the right-hand end, turned in at the board and reaching.
		// `creep` is "low and reaching, weight forward", which on a legless build
		// is a reach — and it is what `sweep` uses, which is consistent
		// characterisation rather than a repeated device. `work` was the first
		// choice and is wrong: its condition is something under the hands.
		//
		// `h` is set by the bench. At 1.15 the underside clears the bench's far top
		// edge by a fifth of a pace of screen, and that strip of daylight is the
		// only thing that makes a legless figure read as flying.
		lead: { e: 1.95, n: 3.0, h: 1.15, face: 0.9 },
		backdrop: { piece: DIF_WALL, size: 1, e: 0, n: 4.3, face: 0, tint: 0.18 },
		extras: [
			{ piece: DIF_BENCH, color: '#2E3A36', tint: 0.62, e: 0, n: 2.9 },

			// Mid-slate rather than dark: the odd item is the same near-black as the
			// six on their marks, and on a dark board it would have no contrast at
			// all. The six read against their pale paint; this one has to read
			// against the board itself.
			{ piece: DIF_BOARD, color: '#4A5C56', tint: 0.75, e: 0, n: 3.45, h: 0.95 },
			{ piece: DIF_LAMP, color: '#BFD9CE', emits: true, tint: 0.3, e: 0, n: 3.45, h: 0.95 },
			{ piece: DIF_MARKS, color: '#8FA79C', tint: 0.95, e: 0, n: 3.45, h: 0.95 },
			{ piece: DIF_ITEMS, color: '#191F22', tint: 1, e: 0, n: 3.45, h: 0.95 },
			// Same shape, size, colour and tint as the six above. Every field
			// identical on purpose — the only difference in the world is that
			// `DIF_MARKS` has nothing at this position.
			{ piece: DIF_ODD, color: '#191F22', tint: 1, e: 0, n: 3.45, h: 0.95 },
			{ piece: DIF_CALIPER, color: '#34D399', emits: true, tint: 0.55, e: 0, n: 3.45, h: 0.95 }
		],
		ground: { tint: 0.06, relief: 0.05, cells: 16, far: 3 },
		look: { e: 0.25, n: 0, h: 2.04, width: 4.0 }
	},

	// ── Retro-Hunt ────────────────────────────────────────────────────────────
	// "Not what is running — what is there. A sleeper is inert, and inert things
	// sit still for a scanner."
	//
	// ONE ARCHIVE BOX OPEN ON A LIT READING TABLE WITH THE THING SITTING IN IT,
	// AND A RACK OF THIRTY MORE BOXES BEHIND, ONE SLOT EMPTY.
	//
	// This is the card that finds what `sweep` walked past, and the obvious
	// version of it — that same rank of cabinets with the last light switched on —
	// is the one picture it must not be. Switching the light on would say the
	// dormant thing finally started doing something. It never does. That is the
	// point of it, and it stopped mattering.
	//
	// What changed is where the light comes from. `sweep` waits for its targets to
	// emit and sorts them by whether they do; that card is `emits` and nothing
	// else. Here the light is the INSTRUMENT — a table lit from inside with the
	// material laid on top of it — and nothing is asked to announce itself.
	// Something was taken off a shelf and looked at.
	//
	// The thing in the box is `sweep`'s own piece, in the same posture, RED and
	// NOT EMITTING. That is the reveal and the reason to reuse the solid rather
	// than author a second one: there it was matte grey because nothing
	// distinguished it, and here it is plainly the same object as the three that
	// were found. Same thing, same stillness, different instrument.
	//
	// And the empty slot is the price. One box open, thirty-one unread — ap 2 for
	// a single SITE against `sweep`'s ap 1 for a whole region. A method that works
	// and does not scale has to show both halves.
	//
	// Square on (`yaw: 0`), and the reason is adequate rather than exciting: a
	// shelf seen square on shows you its face, and one seen at an angle shows you
	// its end. The subject is a store's contents.
	retrohunt: {
		cast: 1,
		doing: 'work',
		yaw: 0,
		// At the END of the table rather than behind it, so the gap under the body
		// is not occluded — the one thing that makes a legless build read as
		// airborne rather than merely legless.
		lead: { e: 1.45, n: 2.15, h: 0.5, face: 0.95 },
		backdrop: { piece: RTH_WALL, size: 1, e: 0, n: 5.2, face: 0, tint: 0.22 },
		extras: [
			{ piece: RTH_RACK, color: '#4A5058', tint: 0.6, e: -0.1, n: 3.5 },
			{ piece: RTH_STORED, color: '#8A8272', tint: 0.72, e: -0.1, n: 3.5 },

			{ piece: RTH_TABLE, color: '#33393F', tint: 0.8, e: -0.35, n: 1.9 },
			// The brightest object on the card, and deliberately so: here the light
			// is the method. Pale rather than the roster's saturated green — the
			// colour term dominates `lamp()`, and this has to read as a light you
			// work BY rather than as a green sign.
			{ piece: RTH_TABLE_SEAM, color: '#B8DCC8', emits: true, tint: 0.42, e: -0.35, n: 1.9 },
			// Turned off square so it reads as put down rather than placed.
			{
				piece: RTH_LID,
				color: '#8A8272',
				tint: 0.85,
				e: 0.42,
				n: 1.78,
				h: RTH_TABLE_H,
				face: 0.35
			},
			{ piece: RTH_BOX, color: '#9A9082', tint: 0.9, e: -0.35, n: 1.9, h: RTH_TABLE_H },

			// `SWEEP_IMPLANT`, on purpose. Red because the light is on it; NOT
			// emitting, because it still is not doing anything and never will be.
			{
				piece: SWEEP_IMPLANT,
				color: '#EF4444',
				tint: 1,
				e: -0.35,
				n: 1.9,
				h: RTH_TABLE_H + 0.04
			}
		],
		ground: { tint: 0.07, relief: 0.05, cells: 16, far: 3 },
		look: { e: 0.1, n: 0, h: 1.8, width: 3.5 }
	},

	// ── Know What You Ship ────────────────────────────────────────────────────
	// "An SBOM is boring until the morning somebody asks whether you are running
	// it."
	//
	// TWO PILES OF THE SAME SACKS. ONE IS A HEAP. THE OTHER IS IN COURSES, AND
	// EVERY SACK IN IT HAS A MARK ON IT.
	//
	// The obvious picture is the document — a manifest, a lit page with rows on
	// it. That is the bullet point this file exists to replace, and three cards
	// already spend the lit-slab-with-dark-rows treatment; a fourth would be a
	// house style rather than a picture.
	//
	// So the card is the COUNTING and not the paper, and the strongest available
	// statement of "counted" is order. Sixteen sacks in a heap and sixteen in
	// courses: identical objects, identical quantity, and the only difference is
	// that one of them can be asked a question. That is what an SBOM is. It does
	// not change what you ship — which is why both piles are the same colour, and
	// why a tidier or cleaner counted pile would be a lie.
	//
	// Deliberately NOT `sweep`. There the rank has one machine that differs and
	// the subject is the anomaly. Here nothing differs and nothing is discovered —
	// the subject is that two identical quantities can be in two different states
	// of knowledge. The silhouettes carry it: a sloped mass against a rectilinear
	// block, which is the one channel that survives being 136 pixels wide.
	//
	// The chute is still running, over the heap. The mill has not stopped and the
	// pile keeps growing, which is also why there is NO PLAY STATE: the inventory
	// existed before the card was played, and that is its entire virtue.
	//
	// Square on (`yaw: 0`), and this card's own reason: the two piles are a
	// comparison of MASSES. Off-axis one is nearer, a further heap looks smaller,
	// and "the same amount of stuff twice" stops being checkable.
	inventory: {
		cast: 1,
		doing: 'work',
		yaw: 0,
		// In the gap between the piles with floor underneath it, turned in at the
		// counted side. The `h` is what makes it hover.
		lead: { e: 0.05, n: 2.7, h: 0.78, face: -0.55 },
		// An interior wall rather than the Mill itself, which is what `stage()`
		// would pick. We are inside the building, and a card cannot be in a place
		// and looking at it at the same time.
		backdrop: { piece: INV_WALL, size: 1, e: 0, n: 5.2, face: 0, tint: 0.24 },
		extras: [
			{ piece: INV_GANTRY, color: '#4E6B60', tint: 0.44, e: 0, n: 4.8, h: 2.6 },
			{ piece: INV_GANTRY, color: '#4E6B60', tint: 0.58, e: 0, n: 4.0, h: 2.55 },

			{ piece: INV_CHUTE, color: '#3E4A46', tint: 0.7, e: -1.15, n: 3.7 },
			{ piece: INV_CHUTE_LIP, color: '#59665F', tint: 0.85, e: -1.15, n: 3.7 },

			// Same colour, same tint, same solid. Only the arrangement differs.
			{ piece: INV_MOUND, color: '#8A7F6B', tint: 0.82, e: -1.15, n: 3.2 },
			{ piece: INV_PLINTH, color: '#3A4038', tint: 0.7, e: 1.15, n: 3.4 },
			{ piece: INV_STACK, color: '#8A7F6B', tint: 0.82, e: 1.15, n: 3.4 },
			// The only marks on the card, in the Hunter's own green so they read as
			// HIS rather than as something the sacks came with.
			{ piece: INV_TICKS, color: '#34D399', emits: true, tint: 0.42, e: 1.15, n: 3.4 },

			{ piece: INV_SLATE, color: '#242C28', tint: 0.85, e: 0.05, n: 2.45, h: 1.0 },
			{ piece: INV_SLATE_READ, color: '#8FD9B8', emits: true, tint: 0.4, e: 0.05, n: 2.45, h: 1.0 }
		],
		ground: { tint: 0.06, relief: 0.05, cells: 16, far: 3.2 },
		// Width is set by the two piles — they are the content, and the card fails
		// the moment either is cropped, because a partial pile cannot be weighed
		// against a whole one.
		look: { e: -0.14, n: 0, h: 2.19, width: 4.4 }
	},

	// ── Quarantine ────────────────────────────────────────────────────────────
	// "A building goes dark for 2 rounds. Anything held inside it cannot advance
	// the chain."
	//
	// A DARK BUILDING INSIDE A RING OF STANDING VIOLET LIGHT, WITH ONE RED WINDOW
	// STILL BURNING INSIDE IT, AND THE HUNTER OUTSIDE THE RING NOT GOING IN.
	//
	// The obvious picture is a threat being destroyed, and the yaml forbids it in
	// as many words: "contains rather than removes, which is the honest limit of
	// it". So the thing inside is still ON. One red window in an unlit building is
	// the entire argument, and it is deliberately the same red the live implants
	// on `sweep` wear — in this deck a red emitter is a hostile thing that is
	// running, and a quarantine does not change that. It changes what it can
	// reach.
	//
	// THE HUE IS NOT THE OWNER'S, and this is the only card in the deck where that
	// is true. `PING_STYLE.sealed` in `fx.ts` is `#A78BFA` — the identical violet
	// — because violet is what this game already paints a sealed building in.
	// Every other card flies the colour of who played it; this one flies the
	// colour of the condition it puts on the board. So the backdrop's default
	// `fx.hue` is overridden to a dark slate and the violet goes on the cage: the
	// building has gone dark, which means it has no colour left to be.
	//
	// The building is left to the derivation rather than chosen, which also comes
	// from the record — `quarantine` carries no `targets` and its note says
	// isolation "applies to anything you can put a wall around".
	//
	// Nobody is drawn entering, and the posted `garrison` is not drawn at all. The
	// shield badge already says it, and two more figures would crowd a card whose
	// subject is a building nobody is standing near.
	//
	// Square on (`yaw: 0`), and this card's own reason: a containment is a
	// PERIMETER, and a perimeter is only legible when both sides of it are in view
	// at once. Square on, the near arc crosses in front of the building and the
	// far arc rises behind it, so the thing is visibly inside.
	quarantine: {
		cast: 1,
		doing: 'watch',
		yaw: 0,
		// Outside the ring, hovering, turned in at it. `watch` is "present, not
		// acting", which here is not a compromise but the rules text: the wall is up
		// and there is nothing further to do for two rounds.
		lead: { e: 2.25, n: 2.3, h: 0.55, face: 0.9 },
		// `piece` deliberately unset — see the header. Colour overridden to a dark
		// slate because the one thing the rules text says about this building is
		// that it has gone dark.
		backdrop: { color: '#2A2E3A', size: 1.4, e: -0.15, n: 4.2, face: 0.35, tint: 0.5 },
		extras: [
			// Under the bars, and much dimmer. Desaturated in the HEX rather than
			// turned down with `tint`: on a saturated violet the colour term
			// dominates and a low tint stops it adding white without dimming it.
			{ piece: QAR_FOOT, color: '#4A3F70', emits: true, tint: 0.3, e: -0.15, n: 4.2 },

			// Still on. Behind the near arc, so the bars cross in front of it.
			{ piece: QAR_HELD, color: '#EF4444', emits: true, tint: 0.5, e: -0.15, n: 3.55, h: 1.15 },

			// The seal. The card's hue, and the only tall lit thing in the frame.
			{ piece: QAR_CAGE, color: '#A78BFA', emits: true, tint: 0.42, e: -0.15, n: 4.2 }
		],
		ground: { tint: 0.06, relief: 0.05, cells: 16, far: 3.6 },
		look: { e: 0.45, n: 0, h: 2.77, width: 4.7 }
	}
};

/** What a card is shot as today, before anybody edits it. Exported so an editor
 *  can open on the real thing rather than on an empty form. */
export const shotFor = (key: string): Shot => SHOT[key] ?? {};

export function sceneFor(
	ability: Ability,
	owner: Klass,
	fx: CardFx,
	over?: Partial<Shot>,
	anim?: SceneAnim,
	/**
	 * The card is being PLAYED, not read.
	 *
	 * A parameter and not a `Shot` field, on the same argument `SceneAnim` makes:
	 * a card in a hand and the same card hitting the table are the same card, and
	 * a face that stored which of the two it was would have to be re-saved to be
	 * played. What it does is wake whoever the shot named in `wakes`.
	 */
	played = false
): SceneSpec {
	const shot = { ...shotFor(ability.key), ...over };
	const piece = ALL_PIECES[shot.setting ?? stage(ability)] ?? ALL_PIECES.hut;

	// A clip beats the authored still, and `still` IS the authored still rather
	// than the rest pose — otherwise stopping the animation throws away the card
	// and leaves a mannequin standing where the picture was.
	const moving = anim && anim.clip !== 'still';
	const posed = (i: number): Pose =>
		moving ? poseAt(anim.clip, (anim.t + i * OFF_BEAT) % 1, anim.opts) : DOING[shot.doing ?? 'watch'];

	// The one the card belongs to, lit at full strength. No crest: the crest is
	// the HUD's device for a figure standing THROUGH a plate, and in a scene the
	// character is standing on ground — the plate reads as a hoop round their
	// waist and nothing else.
	const lead: Actor = {
		worn: kitFor(owner.key),
		trim: owner.color,
		pose: posed(0),
		...formation(fx.vector, 0),
		face: LOOK,
		...shot.lead,
		// After the spread and merged rather than replaced — see `Shot.lead`. A
		// card may repaint the owner; it may not cast somebody else as them.
		who: { ...(owner as CharacterSkin), ...shot.lead?.who }
	};

	// The rest of the squad, dimmed. `count` includes the lead, so this is one
	// short of it.
	const size = shot.cast ?? Math.min(fx.squad.count, 4);
	const crew: Actor[] = Array.from({ length: Math.max(0, size - 1) }, (_, i) => ({
		who: { key: `crew-${fx.squad.shape}`, name: '', color: owner.color, shape: fx.squad.shape },
		extra: true,
		pose: moving ? posed(i + 1) : DOING[shot.crewDoing ?? shot.doing ?? 'watch'],
		...formation(fx.vector, i + 1),
		face: LOOK
	}));

	// Applied on the way OUT, over the whole cast at once, so a card names the
	// one that wakes without caring whether it ended up in the lead slot, the
	// derived crew or the authored figures.
	const HOSTILE = statusById('hostile');
	const woken = (a: Actor): Actor =>
		played && shot.wakes === a.who.key ? { ...a, lamp: HOSTILE.lamp } : a;

	return {
		// Authored figures last, so a card that puts somebody between the lead and
		// the camera does not also have to think about the crew it displaced.
		actors: [lead, ...crew, ...(shot.figures ?? [])].map(woken),
		// The globe's own elevation field, seeded off the card so no two cards are
		// the same square metre. Dark and low-contrast: it is the thing the cast is
		// standing on, not a thing to look at.
		ground: { color: fx.hue, tint: 0.2, seed: seedOf(ability.key), ...shot.ground },
		props: [
			// Scenery in the card's own hue rather than the character's. It is the
			// largest surface on the face, so this is what actually sets the card's
			// colour — and it is a BUILDING being that colour, not a rectangle
			// behind an icon.
			{ piece, color: fx.hue, ...BACKDROP, ...shot.backdrop },
			...(shot.extras ?? []),
			...(played ? (shot.whenPlayed ?? []) : [])
		],
		yaw: shot.yaw,
		pitch: shot.pitch ?? CAMERA.pitch,
		look: shot.look ?? CAMERA.look
	};
}
