// ── CANDIDATE: standard ──────────────────────────────────────────────────────
// One concept for the `posture` mode's piece, owned by exactly one author.
// Do not edit any other file in this directory — the catalogue wiring is already
// done and six of these are being built in parallel.
//
// STANDARD — a graduated scale and the mark that is being read against it.
//
// The mode's whole output is a QUANTITY: continuous posture assessment answers
// "how far along are you", not "did something happen". Pointer-against-
// graduations is the universal grammar for that, and this is the smallest solid
// that carries it — a chisel-headed spine, three teeth cantilevered off its east
// face, and a blunt pointer on the west face standing level with one of them.
//
// WHY THE SPINE EXISTS, since it is the whole difference between this and the
// attempt it replaces. `sweep` set three tick marks in space with nothing
// joining them, and three unattached bars at 40px are not a scale — they are
// DEBRIS, and the eye reads them as a piece that has come apart. A graduation is
// only a graduation because it is fixed to the thing being graduated. The spine
// is that thing.
//
// WHY THE INDICATOR IS A WEDGE AND NOT A NEEDLE. A needle is the obvious answer
// and it fails twice: at node size a hairline is below the width where the
// renderer's shading can hold it, and turned edge-on it disappears entirely. The
// mark has to be a VOLUME — chunky enough to survive both — so it is a prism
// three times the thickness of the teeth it points at, and the only thing in the
// piece that comes to a point, which is what keeps it from reading as a fourth
// graduation on the wrong side.
//
// WHY IT IS NOT ON THE MIDDLE TOOTH. A symmetric object states a range; an
// asymmetric one states a VALUE. Level with the bottom tooth the piece says
// "currently here" rather than "this is a scale", and it puts the mass low and
// the bare spine high, so the top silhouette is one thin element rather than a
// crossbar — a wedge and a long tooth level with each other at the top made a
// hammer.
import { plate, type Face } from './pieces-glyphs.js';
import { box, type Piece } from './pieces.js';

const STANDARD: Piece = (() => {
	// The spine. Twice the teeth's depth, so that turned oblique it stays the
	// member they hang off rather than one more bar in the stack.
	const SPINE_E0 = -0.08;
	const SPINE_E1 = 0.08;
	const SPINE_N = 0.11;
	// It HANGS, and it takes ALL the height the box allows. Measured off the
	// studio, east projects at ~250 px/unit and height at ~111 — the view is
	// plan-dominant, so every vertical distance in this piece is more than halved
	// on screen while every horizontal one is not. A scale read up a column is
	// therefore competing on the squashed axis, and the answer is to spend the
	// whole of `0.2 < h <= 2` rather than to turn the reading sideways.
	const FOOT = 0.24;
	const HEAD = 1.96;

	/** Graduation heights, and the one the mark stands level with (index 0).
	 *
	 *  The spacing is an arithmetic result, not a taste. Height projects at ~0.45
	 *  of east, and NORTH projects to screen-VERTICAL at nearly full scale — so a
	 *  tooth 0.10 deep occupies twice as much screen height as its own 0.10
	 *  thickness does, and the two together eat 0.30 radii of apparent height per
	 *  graduation. Anything under about 0.45 radii of pitch therefore closes up
	 *  and the scale silts into one slab. 0.60 leaves the gaps wider than the
	 *  teeth at every zoom, which is the condition for reading as three marks
	 *  rather than as a fringe. */
	const RUNGS = [0.52, 1.12, 1.72];
	const READING = 0;
	const RUNG_HH = 0.05;
	/** Teeth are BLADES, not beams. Depth is the axis that ruins the oblique
	 *  bearings: extruded as deep as they are thick they turn into three parallel
	 *  girders crossing the spine at 45° and the piece reads as scaffolding. Half
	 *  the thickness again is enough to catch a shading band and no more. */
	const RUNG_N = 0.05;
	/** Tooth lengths. The one being read is the major graduation and the other two
	 *  are equal and minor — three equal arms off a spine is a bookshelf. The
	 *  contrast is deliberately small: given a third again the others' length the
	 *  major tooth became the longest thing in the piece, and at 45° a long bar
	 *  off a short column is a HANDLE. The reading is carried by the mark's
	 *  height, not by the tooth's length. */
	const RUNG_E = [0.42, 0.36, 0.3];
	/** Teeth start INSIDE the spine. A tooth whose west face is flush with the
	 *  spine's east face is two coplanar faces, and a painter's sort with no
	 *  depth buffer has no honest way to order them. */
	const ROOT = 0.02;

	// The mark. Its apex stops 0.03 short of the spine — invisible at node size,
	// and it keeps the wedge and the spine from sharing a plane the way the teeth
	// deliberately do not.
	const TIP = SPINE_E0 - 0.03;
	const TAIL = -0.56;
	/** Where the nose starts. The mark is a flat-backed pointer, NOT a triangle,
	 *  and that is the correction that made it read. A pure wedge tapers all the
	 *  way from its tip to its back edge, so beside a column with three bars
	 *  coming off it the piece read as a MEGAPHONE — a horn flaring away from a
	 *  stem is a stronger cue than any of the ones intended. A body of constant
	 *  height with a short nose has no flare to misread: it is the marker on a
	 *  fader, which is the object this is trying to be. */
	const SHOULDER = -0.33;
	const MARK_HH = 0.17;
	const MARK_N = 0.14;

	const mark = (ch: number): Face => [
		[TAIL, ch - MARK_HH],
		[SHOULDER, ch - MARK_HH],
		[TIP, ch],
		[SHOULDER, ch + MARK_HH],
		[TAIL, ch + MARK_HH],
	];

	/** The head is CHISELLED — one slanted cut rising toward the graduations, not
	 *  a symmetric chamfer. Two reasons, and the second is why it is free.
	 *
	 *  A symmetric chamfer taken to a narrow flat turned the column into a pencil:
	 *  a tapered point on a vertical shaft is a stationery noun and it beat the
	 *  instrument one. A single slant has no apex to misread, and a slant is the
	 *  strongest mark available at 40px — nothing else in the catalogue but
	 *  `namebar`'s strike owns one, and that one is horizontal.
	 *
	 *  And it costs nothing: four profile corners is what a box already has. */
	const spine: Face = [
		[SPINE_E0, FOOT],
		[SPINE_E1, FOOT],
		[SPINE_E1, HEAD],
		[SPINE_E0, HEAD - 0.28],
	];

	return [
		plate(spine, -SPINE_N, SPINE_N),
		...RUNGS.map((ch, i) =>
			box(ROOT, RUNG_E[i], -RUNG_N, RUNG_N, ch - RUNG_HH, ch + RUNG_HH),
		),
		plate(mark(RUNGS[READING]), -MARK_N, MARK_N),
	];
})();

export const PIECE: Piece = STANDARD;
