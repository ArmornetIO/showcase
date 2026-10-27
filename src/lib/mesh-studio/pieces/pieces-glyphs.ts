// ── mesh-studio/pieces-glyphs — the mode's own icon, as an object ────────────
// A third quarter, and a deliberate departure from the first two. `pieces-works`
// and `pieces-civic` answer "what BUILDING is this mode?" — they invent a
// settlement and put each mode in it. This one answers a different question:
// "what does this mode's ICON look like from the side?"
//
// The argument for trying it: a mode already HAS a silhouette, hand-authored in
// `icons/mode-tool-icons.ts` and shown in every list, drawer and button. When
// the globe stopped colour-coding modes and moved identity onto shape, it moved
// it onto a shape that has nothing to do with the one the rest of the product
// teaches. A user who has learnt that a struck-through address bar means DNS
// Proxy learns nothing from a gatehouse. Extruding the glyph makes the thing on
// the map and the thing in the list ONE drawing, which is the same argument
// `PieceCrest` makes about icons — carried one step further.
//
// THE HONEST COST, stated up front because the turntable will show it: a glyph
// is a drawing in a plane, so an extruded glyph is a PLATE. Face-on it is
// unmistakable; edge-on it is a slab. A building is solid from every bearing and
// this is not, and the globe turns. Two things soften it and neither removes it:
// the plate is thick (0.28 radii, not a wafer), and the elements that carry the
// meaning stand PROUD of the face in both directions, so something diagonal
// survives when the face is lost. Judge it on the turntable at 40px, from a
// bearing you did not choose.
//
// The grammar of this quarter, so a second glyph piece matches the first:
//
//  1. ONE PLANE. The glyph's own 24×24 viewBox maps to the piece's east–height
//     plane, `e = (x − 12) / S`, `h = top − (y − y0) / S`. One scale for the
//     whole icon; no element gets resized to look better on its own.
//  2. IT IS SUSPENDED. Nothing here touches the ground, and nothing here has a
//     pad, a post or a plinth.
//
//     That is a REVERSAL of what this file said first, and the first version is
//     worth recording because the reasoning was wrong in an instructive way. The
//     other two quarters require `min(h) === 0` — the ground contract — so the
//     glyphs were given a pad and a post to meet it, on the assumption that the
//     contract was a property of the catalogue. It is not. It is a property of
//     BUILDINGS, which are founded on terrain and would otherwise float or sink
//     by a rounding error. These are not buildings. They are projections, and a
//     projection that has been bolted to a plinth is a chess piece: the base and
//     the contact shadow under it are the two strongest cues the eye has for
//     "solid object resting on a surface", and no amount of material work
//     upstream can outvote them.
//
//     So the contract forks. `SUSPENDED_PIECES` names the pieces that hang, and
//     `piece-catalogue.spec.ts` requires those to float CLEAR of the ground —
//     `min(h) > 0` — rather than exempting them from a check. An unfounded
//     building and a hovering hologram must not be the same state.
//  3. STROKES BECOME RELIEF, TOWARD −n. What the icon draws as a line inside the
//     outline becomes a bar standing proud of the face by ~0.06. Coplanar detail
//     is invisible to a renderer with no depth test — it has to have thickness
//     or it is not there.
//
//     The SIGN is the trap, and it cost this file a rebuild: `+n` is north,
//     which `pieces.ts` defines as *away from the viewer at rest*. Relief put at
//     +n is therefore relief on the BACK, and it does not read as missing — the
//     parts are all still drawn, sorted behind the face, so the piece looks
//     merely muddled rather than inside-out and you go looking for the fault in
//     the shapes. Every raised element here runs toward −n. `plate` still wants
//     `n0 < n1`, so the viewer-facing extreme is the one that goes in `n0`.
//  4. THE BREAK IS THE GLYPH'S OWN. Rule 4 of the other quarters — exactly one
//     element through the top silhouette — is kept, but it is not invented: it
//     is whichever part of the icon already leaves the box.
//  5. DEPTH IS MEASURED IN ICON UNITS TOO, `u / S`, never as a loose decimal.
//     Depth is the one axis the glyph says nothing about, which makes it the one
//     axis that silently stops matching: retuning S to fix a proportion rescales
//     everything in the plane and leaves the relief where it was, so the marks
//     grow relative to the face they sit on and a dial turns into a cog. Writing
//     each depth as a fraction of S makes the piece scale as one object.

import type { Piece, PieceVert, Solid } from './pieces.js';
import { MODES, type ModeKey } from '../modes.gen.js';
import { glyphForMode } from '../../icons/mode-tool-icons.js';
import { ICONS } from '../../icons/Icon.svelte';
import { glyphStrokes, type GlyphStrokes } from './glyph-strokes.js';

/** A profile in the east–height plane: the glyph, as seen face-on. */
export type Face = [number, number][];

/** Extrude a face-on profile along NORTH — the primitive this whole quarter is
 *  built from, and the exact counterpart of `prism`.
 *
 *  `prism` extrudes a plan upward, which is right for a building: you author
 *  what it covers and carry it up. An icon is the other way round — you author
 *  what it LOOKS like and carry it back — and rounding a corner is the case that
 *  forces the distinction rather than a taste for symmetry. A rounded rectangle
 *  standing up has its corners in the east–height plane, and no amount of
 *  extruding a plan upward will put them there.
 *
 *  The profile must be convex and counter-clockwise in (e, h) — the same
 *  guarantee the rest of the catalogue makes, and what keeps culling exact. */
export function plate(face: Face, n0: number, n1: number): Solid {
	const k = face.length;
	const verts: PieceVert[] = [
		...face.map(([e, h]) => ({ e, n: n0, h })),
		...face.map(([e, h]) => ({ e, n: n1, h })),
	];
	// A loop counter-clockwise in (e, h) has normal e × h, and e × h = −n in this
	// right-handed frame — so the BACK cap is the one taken forward and the front
	// is reversed. Worth stating because it is the reverse of `prism`, where the
	// roof is forward, and getting it backwards renders the glyph inside-out in a
	// way that looks like bad profile data rather than a winding mistake.
	const backCap = face.map((_, i) => i);
	const frontCap = face.map((_, i) => 2 * k - 1 - i);
	const sides = face.map((_, i) => {
		const j = (i + 1) % k;
		return [k + i, k + j, j, i];
	});
	return { verts, faces: [backCap, frontCap, ...sides] };
}

/** A rounded rectangle, face-on — the glyph vocabulary's most common shape, and
 *  the one `octagon` cannot supply because it works in the plan. Same idea as
 *  `octagon` and the same reasoning about `cut`: eight sides is what separates
 *  "moulded" from "cut out with scissors", and it costs four triangles. */
export function pill(ce: number, ch: number, w: number, hh: number, r: number): Face {
	return [
		[ce - w + r, ch - hh],
		[ce + w - r, ch - hh],
		[ce + w, ch - hh + r],
		[ce + w, ch + hh - r],
		[ce + w - r, ch + hh],
		[ce - w + r, ch + hh],
		[ce - w, ch + hh - r],
		[ce - w, ch - hh + r],
	];
}

/** One span of an annulus — a slice of BEZEL, which is what an instrument has
 *  where this file first put a filled half-disc.
 *
 *  The filled dial was the wrong answer to a real constraint and it is worth
 *  recording which part was which. The constraint is true: a full annulus is not
 *  convex, so a rim cannot be one solid. The conclusion was not — filling it
 *  gave the piece a solid half-disc of MASS, and mass plus a horizontal chord
 *  plus a skirt is a mound. On the turntable it read as a bunker with studs on
 *  the roof, which is the "carved out of blocks" look the dial was supposed to
 *  be the sophisticated alternative to. An instrument is mostly AIR: what makes
 *  a gauge look machined is a thin ring with nothing inside it but the needle.
 *
 *  A span is convex where the whole ring is not, so the ring is built as a few
 *  of these. The inner edge is a single straight CHORD rather than an arc, and
 *  that is what keeps each span convex — an arc there would bow inward and turn
 *  the reflex corner the whole shape was split to avoid. The band therefore
 *  comes out slightly deeper at the middle of a span than at its ends, which is
 *  a taper the eye reads as machined rather than as an error.
 *
 *  The outer edge, being the one the silhouette is made of, is the one that gets
 *  the vertices — `step` is the largest facet it will show. */
function arcBand(
	ce: number,
	ch: number,
	rIn: number,
	rOut: number,
	a0: number,
	a1: number,
	step = Math.PI / 10,
): Face {
	const n = Math.max(2, Math.ceil((a1 - a0) / step));
	const outer = Array.from({ length: n + 1 }, (_, i): [number, number] => {
		const a = a0 + ((a1 - a0) * i) / n;
		return [ce + rOut * Math.cos(a), ch + rOut * Math.sin(a)];
	});
	return [
		[ce + rIn * Math.cos(a0), ch + rIn * Math.sin(a0)],
		...outer,
		[ce + rIn * Math.cos(a1), ch + rIn * Math.sin(a1)],
	];
}

/** A regular polygon face-on — the icon vocabulary's dot. */
export function disc(ce: number, ch: number, r: number, sides = 8, rot = Math.PI / 8): Face {
	return Array.from({ length: sides }, (_, i): [number, number] => {
		const a = rot + (2 * Math.PI * i) / sides;
		return [ce + r * Math.cos(a), ch + r * Math.sin(a)];
	});
}

/** A stroke between two points, given width — the icon's `<path d="M… L…">`.
 *
 *  Square-capped rather than round: a cap is four more sides on a shape 0.15
 *  radii wide, which is below the width where the renderer's shading bands can
 *  tell them apart, and this quarter pays for its faces in a CPU cull per frame.
 *  Returned counter-clockwise by construction — the perpendicular is taken to
 *  the LEFT of the run, so the corners come out in order whichever way the
 *  stroke is drawn. */
function stroke(e0: number, h0: number, e1: number, h1: number, w: number): Face {
	return blade(e0, h0, e1, h1, w, w);
}

/** A stroke that TAPERS — the same quad with a half-width at each end.
 *
 *  Rule 1 forbids drawing an element fatter than the glyph draws it, which is
 *  read here as a rule about how much room an element takes, not about it being
 *  a constant width along its length. A needle that is the same width at the tip
 *  as at the hub is a stick; every real pointer narrows, and the narrowing is
 *  most of what separates an instrument from a hand of a clock cut out of card.
 *  It is also free — a taper is the same four corners. */
export function blade(
	e0: number,
	h0: number,
	e1: number,
	h1: number,
	w0: number,
	w1: number,
): Face {
	const de = e1 - e0;
	const dh = h1 - h0;
	const len = Math.hypot(de, dh) || 1;
	const ue = -dh / len;
	const uh = de / len;
	return [
		[e0 - ue * w0, h0 - uh * w0],
		[e1 - ue * w1, h1 - uh * w1],
		[e1 + ue * w1, h1 + uh * w1],
		[e0 + ue * w0, h0 + uh * w0],
	];
}

// ── The objects ──────────────────────────────────────────────────────────────

/** NAMEBAR — DNS proxy. The mode's own icon, stood up and given depth.
 *
 *  The glyph is `Block domain`: a rounded address bar, a dot, the name, and a
 *  diagonal struck through the lot. Its whole meaning is in that last stroke —
 *  a bar with a name in it is a lookup, and the same bar with a line through it
 *  is a lookup REFUSED, which is the one thing this mode does.
 *
 *  So the strike gets the job rule 4 reserves: it is the only element that
 *  leaves the outline, and it leaves it at BOTH ends, top-left and bottom-right.
 *  A diagonal through a horizontal is the strongest reading available at 40px —
 *  nothing else in the catalogue owns a slant — and it is also the element that
 *  survives the plate turning edge-on, being the one thing here that is not
 *  parallel to something else.
 *
 *  Sized off the icon and nothing else. `S` is the only scale in the piece: the
 *  bar is 18 icon units wide and lands 1.70 radii wide, and every other number
 *  below is whatever the glyph says divided by the same S. Tuning one element to
 *  "look right" independently is how an extruded icon stops being the icon. */
/** Namebar's cut, shared with every generated icon piece so the set stays one
 *  material. Icon units per radius; the body's two faces (−n toward the
 *  viewer); how far front relief stands proud; how far a through-stroke
 *  overshoots both faces. */
const NAMEBAR_S = 10.6;
const NAMEBAR_FRONT = -0.14;
const NAMEBAR_BACK = 0.14;
const NAMEBAR_RELIEF = 0.06;
const NAMEBAR_THROUGH = 0.08;

const NAMEBAR: Piece = (() => {
	const S = NAMEBAR_S;
	/** Where the bar's top edge (icon y = 8.5) sits, in radii. Chosen so the
	 *  strike's upper corner lands at ~1.78 — the quarter below which two
	 *  silhouettes converge into "a lump". */
	const TOP = 1.58;
	const e = (x: number) => (x - 12) / S;
	const h = (y: number) => TOP - (y - 8.5) / S;
	/** The icon's own stroke-width, as a half-width. Raised detail is drawn at
	 *  the weight the glyph draws it, or the two stop being one drawing. */
	const W = 0.75 / S;

	// Depths. The bar is the body; the dot and the name stand proud of its FRONT
	// only, the way relief on a sign does. The strike stands proud of both faces
	// — it is the element that has to survive the piece turning away.
	// −n is toward the viewer; see rule 3. `front` is the smaller number.
	const barFront = NAMEBAR_FRONT;
	const barBack = NAMEBAR_BACK;

	return [
		// The bar itself — icon `<rect x=3 y=8.5 width=18 height=7 rx=2>`.
		plate(pill(0, h(12), e(21), (h(8.5) - h(15.5)) / 2, 2 / S), barFront, barBack),
		// The dot — `<circle cx=6.5 cy=12 r=1.2>`. Drawn a touch fuller than the
		// icon: a 1.2-unit disc is 0.11 radii, and below about 0.12 a raised detail
		// stops casting a shading band and goes back to being a mark on a face.
		plate(disc(e(6.5), h(12), 1.3 / S), barFront - 0.07, barFront),
		// The name — `<path d="M9.5 12h9">`.
		plate(stroke(e(9.5), h(12), e(18.5), h(12), W), barFront - NAMEBAR_RELIEF, barFront),

		// The strike — `<path d="M5 7 19 17">`. Through both faces, and out of the
		// outline at both ends. This is the piece.
		plate(
			stroke(e(5), h(7), e(19), h(17), W),
			barFront - NAMEBAR_THROUGH,
			barBack + NAMEBAR_THROUGH,
		),
	];
})();

/** GAUGE — posture. The mode's own icon as an INSTRUMENT: an open bezel, a
 *  graduated break in it, and a needle that runs out through the graduation.
 *
 *  The glyph is `Gauge`: a half-dial, five ticks, a needle at about 51° and a
 *  filled hub. It is the one mode whose whole output is a READING — a posture
 *  check answers "how far along are you", not "did something happen" — and a
 *  dial is the only instrument in the catalogue that says a quantity rather than
 *  a fact.
 *
 *  THE REBUILD, because the first version failed in a way worth naming. It drew
 *  the dial as a filled half-disc with a skirt and set the five ticks on it as
 *  relief. Every constraint in this file was satisfied and the result read as a
 *  BUNKER: a solid mound with studs along the roofline, which is to say it read
 *  as built out of blocks — the exact register the catalogue is trying to avoid.
 *  Three faults, and they compound:
 *
 *   · MASS. A filled disc is a hill. Real instruments are hollow, and the hollow
 *     is not a detail of them — it is the whole reason a bezel reads as machined
 *     rather than moulded. `arcBand` replaces the fill with a thin ring, and
 *     what is now inside the dial is nothing but the needle.
 *   · STUDS. Five short bars standing off a rim are crenellations, whatever
 *     depth they are given; the file had already caught this once and answered
 *     it by making them shallower, which treats a symptom. The fix is that a
 *     tick is not an object at all. The icon's graduations become GAPS CUT IN
 *     THE BEZEL — the ring is broken at the tick angles the glyph already draws
 *     — so the marks are subtractive, they cost nothing, and there is no longer
 *     anything for the silhouette to snag on. It is also the more faithful
 *     reading: the icon's ticks and its rim were always one instrument scale.
 *   · NO DIAGONAL. `namebar` works at 40px because of one long slant that leaves
 *     the outline at both ends, and this piece had no equivalent — its needle
 *     was a stub buried well inside the rim. So the needle grew a counterweight
 *     tail, sweeps across the open dial, and comes to rest just clear of the
 *     bezel — the slant that survives the plate turning edge-on.
 *
 *     It grew too far first, and that correction is the one worth keeping. Given
 *     a third of the dial's radius as overshoot and a blade wider than the bezel
 *     itself, it stopped being a needle and became a spear: the piece read as a
 *     seven, an arrow, anything but an instrument. A gauge is read by its ARC,
 *     and the needle is subordinate to it — shorter than the dial is wide, and
 *     THINNER than the scale it points at. Both are now true, and it is the arc
 *     that tops the silhouette, which is the honest answer to rule 4 for this
 *     glyph: a dial's distinctive top edge is the curve itself.
 *
 *     It also needs no gap to get out. The needle already lies wholly in front
 *     of the band, so it simply passes OVER the scale the way a real pointer
 *     does, and the bezel keeps its curve unbroken underneath.
 *
 *  The one liberty taken with the glyph is the needle's taper (see `blade`).
 *  Everything else is the icon's own angles through one scale. */
const GAUGE: Piece = (() => {
	/** Icon units per node radius — TWO of them, and this is the one place this
	 *  quarter's rule 1 is knowingly bent. It is bent because rule 1's purpose is
	 *  to stop an element being resized to look better on its own, and this is
	 *  the opposite: a single anisotropy applied to every element at once, so the
	 *  whole piece stretches as one drawing.
	 *
	 *  The globe looks DOWN at the tangent plane, so height is foreshortened on
	 *  screen by about half while east is not. `namebar` does not care — it is a
	 *  horizontal bar, and a squashed bar is a bar. A dial cares completely: a
	 *  true semicircle in local coordinates projects to a flat arch, and a flat
	 *  arch is not an instrument. The filled disc got away with it because a
	 *  squashed solid still reads as a solid; the moment the dial was opened into
	 *  a ring, the outline was all there was and it read as a slumped arc.
	 *
	 *  So the piece is authored as an ellipse taller than it is wide, sized so it
	 *  PROJECTS round. That the numbers below therefore describe a shape no icon
	 *  ever drew is the point — what has to match the glyph is what the viewer
	 *  sees, not what the source array says.
	 *
	 *  It also settles the width complaint the previous build was still carrying:
	 *  taking the correction out of the horizontal leaves the piece 1.05 radii
	 *  wide against the old 1.72, which is finally compact-and-vertical like the
	 *  buildings it stands among rather than a wide low thing. */
	// Measured off the turntable rather than derived: at SH 11 the arc still came
	// out three-quarters as tall as it was wide, which is a slumped dial, not a
	// round one. The view's height compression is nearer 0.48 than the 0.65 the
	// first correction assumed.
	const SE = 17;
	const SH = 8.3;
	/** Height of the dial's CENTRE — the hub, icon (12, 16.5) — not its base,
	 *  which the open ring no longer has. Set so the bezel's apex lands at 1.78,
	 *  the height the rest of the catalogue tops out at. */
	const CENTRE = 0.708;
	const rad = (d: number) => (d * Math.PI) / 180;

	/** Icon-plane → node-local. Every face below is built in the glyph's own
	 *  units about the hub and then passed through here exactly once, which is
	 *  what keeps the anisotropy a property of the PIECE rather than a number
	 *  each element is trusted to remember. Affine and positive on both axes, so
	 *  winding and convexity carry through untouched. */
	const project = (f: Face): Face => f.map(([x, y]): [number, number] => [x / SE, CENTRE + y / SH]);
	/** Polar in icon units about the hub — the frame the glyph's ticks are really
	 *  drawn in, and the natural one for an instrument. */
	const polar = (r: number, a: number): [number, number] => [r * Math.cos(a), r * Math.sin(a)];

	/** The icon draws its rim at radius ~8 and its ticks between 5.5 and 8.4, so
	 *  the band sits in the annulus the glyph used for rim-and-graduations
	 *  together — but at the SLENDER end of it. Given the full 2.1 units the
	 *  segments came out as deep as they were long and the ring read as four
	 *  bricks laid in an arch. A bezel has to be thin enough that the eye reads
	 *  the curve rather than the blocks it is made of. */
	const R_IN = 7.3;
	const R_OUT = 8.9;

	/** The needle's own angle, `M12 16.5 15.6 12` — 51.3° above the horizontal.
	 *  Taken from the icon's vector rather than written as a number so it cannot
	 *  drift away from the gap that is centred on it. */
	const NEEDLE = Math.atan2(4.5, 3.6);

	// Depths. Rule 5: icon units over a scale throughout — and over SE
	// specifically, because SE is the tighter of the two. Depth has to lose
	// against the NARROWEST way an element is seen, and every element here is
	// narrowest across its east extent.
	//
	// The band is WIDER THAN IT IS DEEP, and by a good margin — 1.6 units across
	// the ring against 1.0 through it. That ordering is the rule the previous
	// build broke twice (once with a 0.30-deep rim that read as a rampart, once
	// with ticks deeper than their own width that read as posts): anything on
	// this piece that is deeper than it is wide stops being part of a face and
	// becomes a post standing on one.
	//
	// The margin is what the OBLIQUE bearings want. Turned away from the viewer
	// a ring shows its extruded side walls, and at equal width and depth those
	// walls read as a pipe bent round a curve — at 45° the piece came out as a
	// hockey stick. A ribbon has no walls worth speaking of, so it stays a
	// ribbon. −n is toward the viewer; see rule 3.
	const bandFront = -0.5 / SE;
	const bandBack = 0.5 / SE;
	/** Clear of the band's front face rather than flush with it. A tie in depth
	 *  has no honest answer in a painter's sort with no z-buffer, and the needle
	 *  crosses the band on its way out — flush, the crossing would flicker
	 *  between over and under with the bearing. */
	const needleBack = bandFront - 0.2 / SE;
	const needleFront = bandFront - 1.4 / SE;
	/** Proudest, and the reason is unchanged from the first build: the hub caps
	 *  the needle's butt, which otherwise ends in mid-air at the one point the
	 *  eye goes to first. */
	const hubFront = needleFront - 0.8 / SE;

	/** Where the bezel is BROKEN, in degrees — the icon's own graduations, as
	 *  gaps rather than as bars.
	 *
	 *  The glyph ticks at 0°, 48°, 90°, 133° and 180°. The two at the ends are
	 *  where the ring simply stops, so they need nothing; these are the 48° and
	 *  133° ones.
	 *
	 *  THEY ARE SLITS, four degrees of arc, and that width is the whole
	 *  difference between a graduated ring and three separate objects. Cut wide
	 *  enough to see comfortably at detail size, the spans stopped belonging to a
	 *  common circle — the eye joins a curve across a nick and refuses to across
	 *  a gap, so the piece read as a seven with a stick through it. A graduation
	 *  is a mark ON a ring; the instant it is large enough to be a feature in its
	 *  own right the ring has been destroyed to draw it. At globe size they close
	 *  up entirely, which is correct: what survives to 40px should be the arc.
	 *
	 *  THE 90° ONE IS NOT CUT EITHER, for the sharper version of the same reason.
	 *  Taking the glyph's ticks literally put a gap at the apex — the one point
	 *  on a semicircle that proves it is one. A graduation may interrupt a curve
	 *  anywhere except where the curve is proved, so the top span runs unbroken
	 *  from 50° to 131° and carries the whole apex. */
	const gaps: [number, number][] = [
		[rad(47), rad(49.5)],
		[rad(132), rad(134.5)],
	];
	/** The sweep stops SHORT of the horizontal, at 8° and 172°, and that is the
	 *  fix for the worst thing the turntable found. Run all the way down to 0°
	 *  and 180° the two end spans stand almost vertically under the ring, and
	 *  from an oblique bearing they stop reading as the ends of an arc and start
	 *  reading as LEGS — at 45° the piece was a walking stick. Tucking the ends
	 *  up turns them back into the termination of a curve. It is also what a real
	 *  instrument does: a bezel that reaches its own baseline has nowhere to be
	 *  mounted, which is why almost none of them do.
	 *
	 *  30°, and the number was walked all the way down and back up again. The
	 *  argument for keeping the sweep long is real — a dial needs enough arc to
	 *  imply its own centre — but it is outweighed by where the arc STOPS. At the
	 *  horizontal the ring's tangent is vertical, so each end presents as an
	 *  upright stub and the piece reads as a hood on two legs; 8° and 12° both
	 *  did. Ending at 30° the terminations are still leaning outward, which reads
	 *  as a curve that was cut, and 120° of sweep is more than enough centre.
	 *
	 *  It is also the arc every dashboard uses, for the same reason. */
	const cuts = [rad(30), ...gaps.flat(), rad(150)];

	const [tailX, tailY] = polar(-2, NEEDLE);
	const [tipX, tipY] = polar(9.6, NEEDLE);

	return [
		// The bezel — three spans of ring between the cuts. `step` is finer than
		// its default here because the outer edge IS the silhouette: a facet the
		// eye can pick out individually is the difference between a machined ring
		// and a polygon someone drew with too few sides.
		...Array.from({ length: cuts.length / 2 }, (_, i) =>
			plate(
				project(arcBand(0, 0, R_IN, R_OUT, cuts[2 * i], cuts[2 * i + 1], rad(15))),
				bandFront,
				bandBack,
			),
		),

		// The needle. Out to 9.6 against a rim at 8.9 — clear of the bezel, so it
		// still breaks the outline on the diagonal, but only just: it POINTS at
		// the scale rather than through it. Back to −2 for the counterweight,
		// enough to make it a diagonal rather than a spoke. Half-widths 0.7→0.25,
		// so the blade stays narrower than the 1.6-unit scale it sweeps over —
		// the ring has to out-weigh the needle or the arc stops being the subject.
		plate(project(blade(tailX, tailY, tipX, tipY, 0.7, 0.25)), needleFront, needleBack),
		// The hub — `<circle cx=12 cy=16.5 r=1.2>`, filled in the icon and so a
		// solid here. Round in the icon plane, so an ellipse once projected, so
		// round again on screen.
		plate(project(disc(0, 0, 1.5)), hubFront, needleBack),
	];
})();

// ── Two candidates for posture, built from scratch ───────────────────────────
// `gauge` was rebuilt several times and kept not landing, so these do not
// inherit a line of it. They start from a different premise about what was
// actually wrong, and they disagree with each other, which is the point — they
// are meant to be looked at side by side rather than merged.
//
// THE PREMISE. `gauge` chased fidelity to the glyph: a ring, because the icon
// strokes a rim; graduations, because the icon has ticks; a needle at the
// icon's own angle. Each was individually defensible and the result was a
// caterpillar — because this renderer draws EVERY edge, and a curve is not one
// line to it but a dozen. `namebar` is the piece in this file that works, and
// it is four solids of big flat plane. The cost of detail here is not faces, it
// is EDGES, and a ring spends them faster than anything else a glyph can ask
// for.
//
// So neither candidate below has a ring in it. `SWEEP` keeps the radial idea
// and throws away the rim; `PANEL` keeps the rim's job — bounding the dial —
// and gives it to one flat plate, which is `namebar`'s recipe applied to a
// different glyph.

/** SWEEP — posture as a radar sweep: a solid wedge on a three-mark scale.
 *
 *  The wedge is the reading AND the needle at once, and collapsing those two
 *  into one element is what buys the silhouette. A pointer thin enough to look
 *  like a pointer is a stick; widened until it is a sector it becomes a shape,
 *  and a sector against three marks is not something else in the catalogue.
 *  Nothing here is a curve except the hub, so the whole piece is five solids of
 *  straight edge.
 *
 *  The scale is three blocks and no rim. A tick standing off a rim is a
 *  crenellation — `gauge` proved that twice — but a tick with no rim to stand
 *  off is just a mark floating at a known angle, and three of them at 30°, 90°
 *  and 150° state the arc without anyone having to draw it. */
const SWEEP: Piece = (() => {
	/** Height of the pivot everything is measured from. */
	const HUB = 0.5;
	/** The dial's radius, east and up — and they differ ON PURPOSE.
	 *
	 *  The globe looks down at the tangent plane, so height arrives on screen at
	 *  roughly half scale while east arrives whole. A dial laid out on equal
	 *  radii is therefore a dial the viewer never sees: it projects as a squashed
	 *  fan. These are the radii that come out ROUND, which is the only place
	 *  roundness matters. */
	const RE = 0.62;
	const RH = 1.15;
	const rad = (d: number) => (d * Math.PI) / 180;
	/** Polar about the pivot, in fractions of the dial's radius. */
	const pt = (r: number, a: number): [number, number] => [
		r * RE * Math.cos(a),
		HUB + r * RH * Math.sin(a),
	];
	/** A quad bounded by two radii and two angles — the scale's mark, and the
	 *  only shape the marks need. Counter-clockwise by construction: out along
	 *  `a0`, round to `a1`, back in. */
	const mark = (a: number, r0: number, r1: number, half: number): Face => [
		pt(r0, a - half),
		pt(r1, a - half),
		pt(r1, a + half),
		pt(r0, a + half),
	];

	/** Where the sweep points — the icon's own needle angle, near enough that the
	 *  two read as the same instrument. */
	const READING = rad(55);
	/** Half the wedge's opening. Wide enough to be a shape rather than a stick;
	 *  narrow enough that it still points. */
	const SPREAD = rad(13);

	const front = -0.06;
	const back = 0.06;

	return [
		// The sweep. Apex at the pivot, three points across the arc — the whole
		// element is four vertices, and it is the thing the eye lands on.
		plate(
			[pt(0, 0), pt(0.86, READING - SPREAD), pt(0.86, READING), pt(0.86, READING + SPREAD)],
			front - 0.05,
			back,
		),
		// The scale, at 40° / 90° / 140° and not the 30° / 150° it was first given.
		// Spread that wide the two outer marks sit low and far out to the sides,
		// nowhere near the wedge, and three marks that share no visible arc are
		// three unrelated blocks rather than a scale. Pulled in, they read as the
		// arc the wedge is pointing along — which is the whole trick this piece is
		// relying on, since it never draws that arc.
		//
		// SLENDER, too. At the stubby proportion they started with each mark was
		// as deep as it was wide and came out a cube; a graduation has to be
		// longer than it is thick or it is not a mark, it is a lump.
		...[40, 90, 140].map((d) =>
			plate(mark(rad(d), 0.9, 1.1, rad(3.5)), front + 0.025, back - 0.025),
		),
		// The pivot. The one round thing here, and it earns it: a wedge with no
		// hub reads as a shard rather than as something hinged.
		plate(
			Array.from({ length: 8 }, (_, i): [number, number] => pt(0.13, (i * Math.PI) / 4)),
			front - 0.09,
			back,
		),
	];
})();

/** PANEL — posture as an instrument face: one plate, one diagonal, three marks.
 *
 *  This is `namebar`'s recipe with a different glyph in it, and it is here
 *  because `namebar` is the piece in this file that survives being looked at.
 *  What that piece gets right is a big uninterrupted plane with a small number
 *  of things standing on it, and one long diagonal that leaves the outline at
 *  BOTH ends. None of that is specific to an address bar.
 *
 *  So the dial's rim is not drawn. The plate bounds the instrument instead —
 *  the job a rim was doing — and the dial is stated by what sits on the plate:
 *  a pivot low and centre, three marks on an arc above it, and the needle
 *  through the lot. A rim would add a dozen edges to say what the plate's own
 *  outline already says. */
const PANEL: Piece = (() => {
	/** The pivot the dial is drawn around — low and central on the plate, where
	 *  an instrument's is. */
	const PE = 0;
	const PH = 0.78;
	const rad = (d: number) => (d * Math.PI) / 180;
	/** Same anisotropy as `SWEEP`, and for the same reason: the marks have to sit
	 *  on an arc that reads as an arc after the globe has flattened it.
	 *
	 *  Less of it here, though, and that is the compromise this candidate makes.
	 *  A dial drawn INSIDE a plate can only be as tall as the plate, so the
	 *  stretch that makes the arc perfectly round would push the top mark off the
	 *  face — which is exactly what the first attempt did, leaving a graduation
	 *  hanging in the air above the instrument. The plate is the boundary; the
	 *  dial gives way to it. */
	const RE = 0.6;
	const RH = 0.85;
	const pt = (r: number, a: number): [number, number] => [
		PE + r * RE * Math.cos(a),
		PH + r * RH * Math.sin(a),
	];
	const mark = (a: number, r0: number, r1: number, half: number): Face => [
		pt(r0, a - half),
		pt(r1, a - half),
		pt(r1, a + half),
		pt(r0, a + half),
	];

	/** Thinner than `namebar`'s bar even though it is the same idea, because it
	 *  is a different SHAPE of the same idea: that bar is long and low, so 0.28
	 *  through it still reads as a card. This face is nearly square, and a nearly
	 *  square plate that thick is a crate. −n is toward the viewer; see rule 3. */
	const faceFront = -0.08;
	const faceBack = 0.08;

	/** The needle, as a run through the pivot rather than a pair of endpoints —
	 *  so the tail and the overshoot are stated as lengths and the pivot cannot
	 *  drift off the line it is supposed to be the centre of. Through `pt`, so it
	 *  takes the same anisotropy as the scale and therefore still LOOKS like it
	 *  points at 45° once the globe has flattened it. */
	const AIM = rad(45);
	const tail = pt(-0.45, AIM);
	const tip = pt(1.6, AIM);

	return [
		// The face — `namebar`'s pill, stood up and squared off. One plane, eight
		// edges, and it is most of what the piece is.
		plate(pill(0, 1.1, 0.62, 0.52, 0.12), faceFront, faceBack),

		// The scale — three marks in relief, shallow. Interior to the plate, so
		// unlike `gauge`'s they have an outline to sit inside rather than one to
		// stick out of, which is the whole reason they are allowed to exist here.
		...[30, 90, 150].map((d) =>
			plate(mark(rad(d), 0.75, 0.95, rad(4)), faceFront - 0.05, faceFront),
		),

		// The needle. Through BOTH faces and out of the outline at both ends —
		// bottom-left and top-right — because that is the one thing `namebar`
		// does that no amount of surface detail substitutes for.
		plate(blade(tail[0], tail[1], tip[0], tip[1], 0.07, 0.028), faceFront - 0.07, faceBack + 0.04),
		// The pivot, capping the needle's butt.
		plate(disc(PE, PH, 0.08), faceFront - 0.11, faceFront - 0.01),
	];
})();

/** DIAL — posture as a whole instrument: a closed ring, graduation lines, and
 *  one arrow.
 *
 *  This is the piece the other three were circling, and the premise it corrects
 *  is not geometric. `gauge`, `sweep` and `panel` were each an argument about
 *  cost — how few edges a curve could be drawn in, how to keep a ring off the
 *  face budget — and the icon was whatever survived that argument. Which is
 *  backwards. Posture is the mode that answers "how are you doing, right now",
 *  and a dial is the instrument for exactly that: a bounded scale with a mark
 *  moving along it. If it takes a closed circle to say so, it takes a closed
 *  circle.
 *
 *  CLOSURE IS ALSO WHAT MAKES IT READ, and this is the thing four rebuilds took
 *  to find. The globe looks down, so height lands on screen at about half
 *  scale. An ARC that has been squashed is genuinely ambiguous — the eye has no
 *  way to tell a flattened semicircle from a shallow arch, which is why every
 *  open version came out slumped and why each fix was another guess at the
 *  stretch. A squashed CIRCLE is not ambiguous: a closed outline reads as a
 *  round thing seen at an angle, because that is the only thing it can be. The
 *  full ring did not just make the instrument clearer; it retired the problem
 *  the previous three were all losing to.
 *
 *  Three elements and nothing else, because the ring costs enough that anything
 *  decorative has to justify itself against it:
 *
 *   · THE RING, eight segments. An octagon and not a pretence at smoothness —
 *     at this size it reads round, and a bezel that admits its facets looks
 *     machined where one that almost hides them looks low-poly.
 *   · THE LINES, four, INSIDE the ring. Inside is the whole point: a mark
 *     standing off a rim is a crenellation, which is what turned the first
 *     `gauge` into a cog, but a mark that grows inward from a rim has an
 *     outline to sit within and reads as graduation. A closed ring is what
 *     makes that possible — there is no "outside" left to stick into.
 *   · THE ARROW, one, and an arrow rather than a needle. A tapered blade is a
 *     stick at 40px and it read as one; a head is the cheapest mark that says
 *     "this end means something", which is the only thing distinguishing a
 *     gauge from a clock.
 *
 *  It does not break its own top silhouette, so rule 4 is not met here. That is
 *  deliberate: the rule exists so the top edge is distinctive, and for this
 *  piece the distinctive thing IS the unbroken circle. A tick poked through it
 *  to satisfy the letter of the rule would spoil the one property the shape is
 *  built on. */
const DIAL: Piece = (() => {
	/** Height of the dial's centre, and the radii it is drawn on.
	 *
	 *  RH against RE is the same height-foreshortening correction the rest of
	 *  this quarter needs, but it is deliberately PARTIAL here — corrected all
	 *  the way to a screen-perfect circle the ring has to shrink to about 0.8
	 *  radii wide to stay under the height ceiling, and a small round dial reads
	 *  worse on the globe than a slightly tipped larger one. Closure buys that
	 *  latitude: the outline still reads as a circle at an angle. */
	const CH = 1.08;
	const RE = 0.48;
	const RH = 0.76;
	const rad = (d: number) => (d * Math.PI) / 180;

	/** Unit-circle space → node-local. Everything below is authored on a circle
	 *  of radius one and mapped through here exactly once, so the anisotropy is a
	 *  property of the dial rather than a number each element has to remember. */
	const at = ([x, y]: [number, number]): [number, number] => [x * RE, CH + y * RH];
	const polar = (r: number, a: number): [number, number] => [r * Math.cos(a), r * Math.sin(a)];
	/** A quad bounded by two radii and two angles — one segment of the ring, and
	 *  one graduation, are the same shape at different scales. Counter-clockwise
	 *  by construction: out along `a0`, round to `a1`, back in. */
	const band = (a0: number, a1: number, r0: number, r1: number): Face =>
		[polar(r0, a0), polar(r1, a0), polar(r1, a1), polar(r0, a1)].map(at);

	/** Where the arrow points. Up and to the right, near the icon's own needle
	 *  angle — high on the scale, which is the reading posture wants to be at. */
	const AIM = rad(58);
	const dir = polar(1, AIM);
	/** Perpendicular to the aim, for the arrowhead's base. */
	const side: [number, number] = [-dir[1], dir[0]];
	const along = (r: number, w: number): [number, number] => [
		dir[0] * r + side[0] * w,
		dir[1] * r + side[1] * w,
	];

	// Depths. Everything here is THINNER than it is wide, which for a ring is the
	// binding constraint: the band is only 0.077 radii across its east extent, so
	// anything approaching that in depth stops being a bezel and becomes a wall.
	// −n is toward the viewer; see rule 3.
	const ringFront = -0.035;
	const ringBack = 0.035;
	/** The arrow stands well clear of the ring's own front face. It is the one
	 *  element that must survive the piece being small, so it gets the depth
	 *  separation as well as the size. */
	const arrowFront = -0.11;
	const arrowBack = -0.05;

	return [
		// The ring.
		...Array.from({ length: 8 }, (_, i) =>
			plate(band(rad(i * 45), rad((i + 1) * 45), 0.86, 1), ringFront, ringBack),
		),
		// The graduations, growing inward off the ring at the quarters.
		...[0, 90, 180, 270].map((d) =>
			plate(band(rad(d - 3.5), rad(d + 3.5), 0.58, 0.8), -0.025, 0.025),
		),

		// The arrow — shaft and head as two solids, because an arrow is not
		// convex and the barbs are the entire reason it is an arrow.
		//
		// SIZED OFF THE GLOBE SHOT, not off the detail view. Drawn at the weight a
		// needle wants — slim, reaching half way out — it looked correct at 12×
		// and vanished entirely at node size, leaving a ring with a smudge in it.
		// A dial whose reading cannot be seen is just a washer. So the arrow runs
		// nearly to the graduations and the head is wide enough to be a shape of
		// its own: at the size this is actually used, the arrow IS the piece and
		// the ring is the thing it is read against.
		plate(
			[along(-0.2, -0.075), along(0.4, -0.075), along(0.4, 0.075), along(-0.2, 0.075)].map(at),
			arrowFront,
			arrowBack,
		),
		plate([along(0.36, -0.2), along(0.8, 0), along(0.36, 0.2)].map(at), arrowFront, arrowBack),
		// The pivot, so the arrow reads as hinged rather than as laid on.
		plate(
			Array.from({ length: 6 }, (_, i): [number, number] => polar(0.14, (i * Math.PI) / 3)).map(at),
			-0.12,
			-0.05,
		),
	];
})();

// ── Every other mode, extruded straight from its icon ───────────────────────
// The objects above are CUT: each one read its glyph and decided what depth,
// relief and break the icon should become. That produces the best object and
// it does not scale — two pieces in, fifteen modes still stood as buildings
// from a settlement that teaches nothing the rest of the product uses.
//
// So every remaining mode with a glyph gets the mechanical version of the same
// grammar: its own strokes, read from the markup the icon set already stores,
// cut the way namebar is — see `iconPiece`. Rules 1, 2, 3 and 5 are all
// mechanical and are kept exactly — one scale, suspended, strokes as relief,
// depth in icon units. Rule 4 (the one element through the silhouette) is kept
// for free: whatever part of the icon leaves the box, leaves the box.
//
// What is given up is judgement. Namebar's depths are assigned by WHERE a mark
// sits, not by what it means, so a glyph whose meaning is not where the rule
// looks for it can still come out flat. Any mode can graduate to a cut
// piece by being added to HAND_CUT — the generated one then drops out of the
// map, the same way a displaced building does.
//
// Modes whose glyph is EMPTY are deliberately not here. They fall back to
// Terminal, the shared fallback — extruding them would stand four modes in
// one shape, which is the exact ambiguity this quarter exists to remove. They
// keep their buildings until they have an icon of their own.

const HAND_CUT = {
	posture: 'dial',
} satisfies Partial<Record<ModeKey, string>>;

const ICON_MODES = MODES.filter((m) => m.glyph && !(m.key in HAND_CUT)).map((m) => m.key);
const ICON_STROKES: [ModeKey, GlyphStrokes][] = ICON_MODES.map((k) => [
	k,
	glyphStrokes(glyphForMode(k)),
]);

/** Named icons stood up the same way, for globe nodes that are NOT a mode — a
 *  collection standing for a whole set (the vendor estate, the evidence library)
 *  has no glyph of its own, and was drawn as a bare disc beside a field of
 *  objects.
 *
 *  Declared here because the globe builds its meshes from this catalogue at load
 *  and cannot extrude an icon it was never told about; WHICH icon stands for
 *  which collection is the caller's decision, not this file's. Add a name to
 *  offer it. */
export const EXTRUDED_ICONS = ['users', 'clipboard-list', 'fingerprint', 'table'] as const;
export type ExtrudedIcon = (typeof EXTRUDED_ICONS)[number];
/** The catalogue id of a named icon's piece. */
export const iconPieceId = (name: ExtrudedIcon) => `glyph-${name}`;
const NAMED_STROKES: [ExtrudedIcon, GlyphStrokes][] = EXTRUDED_ICONS.map((n) => [
	n,
	glyphStrokes(ICONS[n]),
]);

/** The icon set's 1.5 stroke, in icon units. Half of it, since `stroke` takes a
 *  half-width. */
const ICON_HALF_W = 0.75;
/** How far past any stroke centre-line the solid can reach: the half-width, plus
 *  the square cap carried along the run, on a diagonal. */
const ICON_PAD = 1.1;
const ICON_FLOOR = 0.25;

/** ONE scale for every generated piece: namebar's, unless a glyph in the set
 *  reaches far enough that it would break the bounds.
 *
 *  One scale across the SET, not a fit per icon: the icons were drawn on a
 *  shared 24-unit grid so that a small mark reads as small, and fitting each to
 *  its own bounds would inflate a compact glyph to the size of a sprawling one.
 *
 *  This used to be fitted to a 1.6-radius span and the plate tipped 40° toward
 *  the camera. Face-on, the hologram's Fresnel term dims the plate to its
 *  floor, and the smaller scale thinned every bar — together that was the
 *  grainy, underlit look beside namebar, which is upright at this S. */
const ICON_FIT = (() => {
	let x0 = 12;
	let x1 = 12;
	let y0 = Infinity;
	let y1 = -Infinity;
	// Modes and named icons together: they stand side by side on one globe, so
	// they are one set drawn at one scale.
	for (const [, { lines, dots }] of [...ICON_STROKES, ...NAMED_STROKES]) {
		for (const [x, y] of lines.flat()) {
			x0 = Math.min(x0, x);
			x1 = Math.max(x1, x);
			y0 = Math.min(y0, y);
			y1 = Math.max(y1, y);
		}
		for (const d of dots) {
			x0 = Math.min(x0, d.x);
			x1 = Math.max(x1, d.x);
			y0 = Math.min(y0, d.y);
			y1 = Math.max(y1, d.y);
		}
	}
	const halfReach = Math.max(12 - x0, x1 - 12) + ICON_PAD;
	const tall = y1 - y0 + 2 * ICON_PAD;
	const S = Math.max(NAMEBAR_S, halfReach / 0.98, tall / (2 - ICON_FLOOR - 0.1));
	// Hung from the set's lowest stroke, so every icon keeps the position it has
	// on the 24-unit grid relative to the others.
	return { S, h: (y: number) => ICON_FLOOR + 0.05 + (y1 + ICON_PAD - y) / S };
})();

/** Convex hull of a ring, counter-clockwise in (e, h) — monotone chain. */
function hull(pts: Face): Face {
	const p = [...pts].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
	const cross = (o: [number, number], a: [number, number], b: [number, number]) =>
		(a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
	const half = (src: Face): Face => {
		const out: Face = [];
		for (const q of src) {
			while (out.length >= 2 && cross(out[out.length - 2], out[out.length - 1], q) <= 1e-9)
				out.pop();
			out.push(q);
		}
		out.pop();
		return out;
	};
	return [...half(p), ...half(p.reverse())];
}

const area = (f: Face) =>
	Math.abs(
		f.reduce((s, [e, h], i) => {
			const [e1, h1] = f[(i + 1) % f.length];
			return s + e * h1 - e1 * h;
		}, 0),
	) / 2;

/** Inside a convex face, or within `tol` of it — a line drawn edge to edge of
 *  a ROUNDED rect ends just outside its cut corners, and without the slack it
 *  read as crossing the body and stood out through it as a shelf. */
const inside = (f: Face, [e, h]: [number, number], tol = 0) =>
	f.every(([e0, h0], i) => {
		const [e1, h1] = f[(i + 1) % f.length];
		const len = Math.hypot(e1 - e0, h1 - h0) || 1;
		return ((e1 - e0) * (h - h0) - (h1 - h0) * (e - e0)) / len >= -tol - 1e-6;
	});

/** Smallest closed shape that may become the body, in icon units². Below it a
 *  "body" is just a thick mark and the icon loses the sign it sits on. */
const BODY_MIN_AREA = 20;
/** A ring must fill this much of its own hull to be the body: a solid can only
 *  be convex, and a hull of a deeply concave outline would fill in what the
 *  glyph leaves open. */
const BODY_MIN_FILL = 0.9;

/** How much of its hull a glyph's strokes must trace for the hull to be read
 *  as the object's outline. Measured, not chosen: a real outline — a board, a
 *  frame, a window — traces all of it, while a composition (a scale and its
 *  pans, a doc beside its sync arrows) traces 84–91% and, filled, became a blob.
 *  Buildings traces 96% round its stepped roof and must stay two buildings. */
const OUTLINE_TRACED = 0.98;

const segDist = (
	[x, y]: [number, number],
	[x0, y0]: [number, number],
	[x1, y1]: [number, number],
) => {
	const dx = x1 - x0;
	const dy = y1 - y0;
	const t = Math.max(0, Math.min(1, ((x - x0) * dx + (y - y0) * dy) / (dx * dx + dy * dy || 1)));
	return Math.hypot(x - x0 - t * dx, y - y0 - t * dy);
};

/** The left offset at vertex `i` of a polyline where two segments meet, scaled
 *  so both bands keep half-width `w` — or null at a run's end, or at a bend so
 *  sharp the miter would spike, where the segment keeps its own square end. */
function miter(
	P: [number, number][],
	i: number,
	ring: boolean,
	w: number,
): [[number, number], number] | null {
	const n = P.length;
	const prev = i > 0 ? i - 1 : ring ? n - 2 : -1;
	const next = i < n - 1 ? i + 1 : ring ? 1 : -1;
	if (prev < 0 || next < 0) return null;
	const left = (a: [number, number], b: [number, number]): [number, number] => {
		const l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
		return [-(b[1] - a[1]) / l, (b[0] - a[0]) / l];
	};
	const n0 = left(P[prev], P[i]);
	const n1 = left(P[i], P[next]);
	const m: [number, number] = [n0[0] + n1[0], n0[1] + n1[1]];
	const ml = Math.hypot(...m);
	const cos = ml / 2;
	if (cos < 0.5) return null;
	return [[(m[0] / ml) * (w / cos), (m[1] / ml) * (w / cos)], 0];
}

/** A mode's icon, cut exactly as `namebar` is: the glyph's largest closed shape
 *  becomes a solid BODY, what lies on it stands proud of its front as relief,
 *  and what leaves it passes through both faces the way the strike does.
 *
 *  The body is what the earlier cage of bars lacked. Without it every stroke
 *  was a free-standing blade, and in additive light a pile of thin blades
 *  overlaps into bright knots and gaps — the "low resolution" beside namebar,
 *  whose relief has a surface to sit on. */
function iconPiece(strokes: GlyphStrokes): Piece {
	const { S, h } = ICON_FIT;
	const at = ([x, y]: [number, number]): [number, number] => [(x - 12) / S, h(y)];

	// The icon set draws a dot as a zero-length stroke (`h.01`); as a bar it is a
	// capped stub, so it becomes the dot it stands for.
	const runLen = (run: [number, number][]) =>
		run.reduce(
			(s, p, i) => (i ? s + Math.hypot(p[0] - run[i - 1][0], p[1] - run[i - 1][1]) : 0),
			0,
		);
	const lines = strokes.lines.filter((run) => runLen(run) >= 0.5);
	const dots = [
		...strokes.dots,
		...strokes.lines
			.filter((run) => runLen(run) < 0.5)
			.map((run) => ({ x: run[0][0], y: run[0][1], r: 0 })),
	];

	const closed = (run: [number, number][]) => {
		const a = run[0];
		const b = run[run.length - 1];
		return run.length > 3 && Math.hypot(a[0] - b[0], a[1] - b[1]) < 1e-3;
	};
	const W = ICON_HALF_W / S;
	const TOL = 2 * W;
	// Every mark's points, so a candidate body can ask whether it carries any.
	const marks: { run: [number, number][]; pts: [number, number][] }[] = [
		...lines.map((run) => ({ run, pts: run.map(at) })),
		...dots.map((d) => ({
			run: [] as [number, number][],
			pts: [at([d.x, d.y])],
		})),
	];
	// A body is a SIGN: a sizeable closed shape with something drawn on it, as
	// namebar's bar carries the name. Empty outlines stay outlines — filled, a
	// lens became a coin and a bell a lump. Largest first, so a shape drawn on
	// another stays relief on it, as the package does on the supply-chain shield.
	const candidates = lines
		.filter(closed)
		.map((run) => {
			const ring = run.slice(0, -1).map(at);
			return { run, ring, hl: hull(ring) };
		})
		.filter(
			({ ring, hl }) => area(hl) * S * S >= BODY_MIN_AREA && area(ring) >= BODY_MIN_FILL * area(hl),
		)
		.sort((a, b) => area(b.hl) - area(a.hl));
	const signs = candidates.filter(({ run, hl }) =>
		marks.some((m) => m.run !== run && m.pts.every((p) => inside(hl, p, TOL))),
	);
	// With no sign at all, the largest outline is the object itself — a speech
	// bubble, a bell — and reads better solid than as a ring of short bars.
	if (!signs.length && candidates.length) signs.push(candidates[0]);
	// The glyph's OUTER outline is a body even when no single path closes it — a
	// clipboard's board breaks where the clip sits, a table's frame is drawn in
	// four runs. As bars those came out as a cage of short capped segments round
	// every corner. If the strokes trace most of the glyph's hull, the hull is
	// the object.
	const segs = lines.flatMap((run) =>
		run.slice(1).map((p, i): [[number, number], [number, number]] => [at(run[i]), at(p)]),
	);
	const outer = hull(segs.flat());
	const onEdge = (f: Face, p: [number, number]) =>
		f.some((a, i) => segDist(p, a, f[(i + 1) % f.length]) <= TOL);
	const traced = (() => {
		if (outer.length < 3 || area(outer) * S * S < BODY_MIN_AREA) return 0;
		let hit = 0;
		let n = 0;
		for (let i = 0; i < outer.length; i++) {
			const a = outer[i];
			const b = outer[(i + 1) % outer.length];
			const k = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / (0.5 / S)));
			for (let j = 0; j < k; j++) {
				const p: [number, number] = [
					a[0] + ((b[0] - a[0]) * j) / k,
					a[1] + ((b[1] - a[1]) * j) / k,
				];
				n++;
				if (segs.some(([s0, s1]) => segDist(p, s0, s1) <= TOL)) hit++;
			}
		}
		return hit / n;
	})();
	const outerBody = traced >= OUTLINE_TRACED ? outer : null;

	const bodies: { run: [number, number][] | null; hl: Face }[] = outerBody
		? [{ run: null, hl: outerBody }]
		: [];
	for (const c of signs) {
		if (!bodies.some((b) => c.ring.every((p) => inside(b.hl, p)))) bodies.push(c);
	}

	// Namebar's three depths, by where a mark sits: ON a body it is relief on the
	// front; ACROSS a body's edge it passes through both faces, as the strike
	// does; OFF every body it is a free blade. The strike's depth on a mark
	// that crosses nothing is a slab — a keyboard base, a corner bracket.
	const FREE = NAMEBAR_RELIEF;
	const relief = (pts: [number, number][], proud: number): [number, number] => {
		const on = bodies.filter((b) => pts.some((p) => inside(b.hl, p)));
		if (bodies.some((b) => pts.every((p) => inside(b.hl, p, TOL))))
			return [NAMEBAR_FRONT - proud, NAMEBAR_FRONT];
		if (on.length) return [NAMEBAR_FRONT - NAMEBAR_THROUGH, NAMEBAR_BACK + NAMEBAR_THROUGH];
		return [-FREE, FREE];
	};

	const solids: Solid[] = bodies.map((b) => plate(b.hl, NAMEBAR_FRONT, NAMEBAR_BACK));
	const bodyRuns = new Set(bodies.map((b) => b.run));
	for (const run of lines) {
		// A body's own outline IS the body, as namebar's bar has no separate rim.
		if (bodyRuns.has(run)) continue;
		const P = run.map(at);
		const ring = closed(run);
		for (let i = 1; i < run.length; i++) {
			const [e0, h0] = P[i - 1];
			const [e1, h1] = P[i];
			const len = Math.hypot(e1 - e0, h1 - h0);
			if (len < 1e-6) continue;
			// Classified by the centre-line, not the capped quad: a stroke that ends
			// ON a body's edge would otherwise poke its cap out and go through.
			const mid: [number, number] = [(e0 + e1) / 2, (h0 + h1) / 2];
			// Drawn along the outer body's edge, it IS that edge.
			if (
				outerBody &&
				[[e0, h0], mid, [e1, h1]].every((p) => onEdge(outerBody, p as [number, number]))
			)
				continue;
			const depth = relief([[e0, h0], mid, [e1, h1]], NAMEBAR_RELIEF);
			// Mitered where the run bends, so a curve is one band rather than a chain
			// of capped bars overlapping into a knot at every joint. A run's own ends
			// get a square cap — except as relief, where a cap carries a line drawn
			// to the body's edge out past it.
			const cap = depth[1] === NAMEBAR_FRONT ? 0 : W;
			const a = miter(P, i - 1, ring, W);
			const b = miter(P, i, ring, W);
			const ue = (e1 - e0) / len;
			const uh = (h1 - h0) / len;
			const nL: [number, number] = [-uh * W, ue * W];
			const [la, ca] = a ?? [nL, cap];
			const [lb, cb] = b ?? [nL, cap];
			const A: [number, number] = [e0 - ue * ca, h0 - uh * ca];
			const B: [number, number] = [e1 + ue * cb, h1 + uh * cb];
			solids.push(
				plate(
					[
						[A[0] - la[0], A[1] - la[1]],
						[B[0] - lb[0], B[1] - lb[1]],
						[B[0] + lb[0], B[1] + lb[1]],
						[A[0] + la[0], A[1] + la[1]],
					],
					...depth,
				),
			);
		}
	}
	for (const d of dots) {
		// Namebar's dot is drawn a touch fuller than the icon, for the same reason.
		const r = Math.max(d.r, 1.3) / S;
		const c = at([d.x, d.y]);
		solids.push(plate(disc(...c, r), ...relief([c], NAMEBAR_RELIEF + 0.01)));
	}
	return solids;
}

const iconId = (k: ModeKey) => `icon-${k}`;
const ICON_PIECES: Record<string, Piece> = Object.fromEntries([
	...ICON_STROKES.map(([k, strokes]) => [iconId(k), iconPiece(strokes)]),
	...NAMED_STROKES.map(([n, strokes]) => [iconPieceId(n), iconPiece(strokes)]),
]);

/** The pieces that HANG — see rule 2.
 *
 *  A set rather than a flag on the piece, because a `Piece` is a list of solids
 *  and nothing else, and it is worth keeping it that way: the geometry says what
 *  the shape is, and whether that shape is founded or projected is a fact about
 *  how it is PRESENTED. `pieces.ts` would otherwise grow a rendering concern.
 *
 *  Exported so both the contract test and the renderer read one list. A piece
 *  that floats but is not named here fails the spec, which is the point — a
 *  building that has quietly come off the ground is a bug, and it must not be
 *  possible to silence that by accident. */
export const SUSPENDED_PIECES: ReadonlySet<string> = new Set([
	'namebar',
	'gauge',
	'sweep',
	'panel',
	'dial',
	// The `posture` candidates — see `pieces-candidates`. Listed by name rather
	// than imported from the barrel, so that the module holding this contract
	// stays a leaf and cannot be dragged into a cycle by a candidate reaching
	// back here for `plate` or `pill`.
	'standard',
	...Object.keys(ICON_PIECES),
]);

export const GLYPH_PIECES: Record<string, Piece> = {
	namebar: NAMEBAR,
	gauge: GAUGE,
	sweep: SWEEP,
	panel: PANEL,
	dial: DIAL,
	...ICON_PIECES,
};

/** The hand-cut pieces keep their literal keys; the generated ones are computed,
 *  so this cannot prove totality on its own — it does not have to, because
 *  `MODE_PIECES` spreads the building quarters first and those are total. */
export const GLYPH_MODE_PIECES: Partial<Record<ModeKey, string>> = {
	...HAND_CUT,
	...Object.fromEntries(ICON_MODES.map((k) => [k, iconId(k)])),
};
