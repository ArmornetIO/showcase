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
	sink: { legL: -0.03, legR: 0.05, armL: 0.24, armR: 0.17, bob: -0.16 }
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
 * ── THE SEAM ─────────────────────────────────────────────────────────────────
 * The 45° is his ROOFLINE, and that is the whole difference between this cut and
 * the last one. A diagonal ruled over the top of two buildings is a graphic
 * device sitting on the card; a diagonal that is the edge of the near building
 * is the line where one world stops and the other starts, and it cuts across
 * them because it is made of them.
 *
 * `SEAM` is written in SCREEN terms — `up = e + 3.6` — because that is the only
 * frame in which it is 45°. The world slope is 1.035, since the camera's tilt
 * makes a pace of height 0.966 of a pace of width, and every wall on this card
 * converts the same line into its own `n` with the same two constants.
 */
const SEAM = 2.25;
const HOUSE_N = 0.2;
/** The seam, as a height on a wall standing at `n`. */
const seamAt = (e: number, n: number) => (e + SEAM - 0.257 * n) / 0.966;

/**
 * His house: the near building, its top cut by the seam, with a hole for the
 * window. Four convex panels, because a shape with a hole in it is not one
 * solid and `paint` culls per solid.
 */
const HOUSE_WALL: Piece = [
	panel([
		[-2.3, -0.8],
		[0.15, -0.8],
		[0.15, seamAt(0.15, HOUSE_N)],
		[-2.3, seamAt(-2.3, HOUSE_N)]
	]),
	panel([
		[0.15, -0.8],
		[1.55, -0.8],
		[1.55, 0.232],
		[0.15, 0.232]
	]),
	panel([
		[0.15, 1.836],
		[1.55, 1.836],
		[1.55, seamAt(1.55, HOUSE_N)],
		[0.15, seamAt(0.15, HOUSE_N)]
	]),
	panel([
		[1.55, -0.8],
		[2.3, -0.8],
		[2.3, seamAt(2.3, HOUSE_N)],
		[1.55, seamAt(1.55, HOUSE_N)]
	])
];

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
		{ e: -2.3, h: seamAt(-2.3, WIRE_N) + 0.62 },
		{ e: 1.5, h: seamAt(1.5, WIRE_N) + 0.62 },
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
	/** Where the lead stands, overriding the formation. `h` because a figure is
	 *  not always on the planet — put one in an upstairs room and the floor it is
	 *  standing on is a number, not the ground. */
	lead?: { e?: number; n?: number; h?: number; face?: number };
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
	anim?: SceneAnim
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
		who: owner as CharacterSkin,
		worn: kitFor(owner.key),
		trim: owner.color,
		pose: posed(0),
		...formation(fx.vector, 0),
		face: LOOK,
		...shot.lead
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

	return {
		// Authored figures last, so a card that puts somebody between the lead and
		// the camera does not also have to think about the crew it displaced.
		actors: [lead, ...crew, ...(shot.figures ?? [])],
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
			...(shot.extras ?? [])
		],
		yaw: shot.yaw,
		pitch: shot.pitch ?? CAMERA.pitch,
		look: shot.look ?? CAMERA.look
	};
}
