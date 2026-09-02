// ── mesh-studio/pieces-works — the infrastructure & defence quarter ──────────
// Eight buildings for the eight agent modes that keep the settlement standing:
// the gate that vets every name, the forge that builds, the redoubt that holds
// untrusted work, the keep that commands, and the survey, archive, stores and
// precinct that keep everyone honest.
//
// They are written as ONE civilisation, not eight ideas. Four rules run through
// every piece, and they are the reason a stranger can tell these belong together
// before they can tell them apart:
//
//  1. THE PLINTH. Every building starts on a low slab, 0 → ~0.14, a little wider
//     than what it carries. It is also where `min(h) === 0` comes from in all
//     eight — the ground contract is met by the same element every time, so no
//     piece can quietly float or sink by a rounding error.
//  2. BATTERED WALLS. Load-bearing masses lean IN as they rise (`taper`, ~0.85–
//     0.94). A vertical wall and a battered wall are the same silhouette from
//     the front, but the battered one catches two shading bands on one face
//     where the vertical catches one — it is free relief at 40 pixels.
//  3. NEVER FLUSH. Where one mass ends and the next begins, the next either
//     oversails it or is inset from it by ~0.06–0.10. A flush join is invisible
//     and a stack of flush boxes reads as one tall box; the step is what makes
//     the parts count as parts.
//  4. ONE BREAK. Each building puts exactly one element through the top
//     silhouette, and it is a DIFFERENT element each time — a blade, a kiln, a
//     periscope, a spike, a fin, a lantern, a cone, a spire. The eye reads the
//     top edge first, so that one element is doing more identifying work than
//     everything below it combined.
//
// Sizes obey the same reasoning as `pieces.ts`: footprints stay inside the disc
// the node would have drawn, and nothing here is shorter than ~1.7 — below about
// 1.4 the slant gives you too thin a band of side and two silhouettes converge
// into "a lump".

import type { ModeKey } from '../modes.gen.js';
import { box, gable, type Piece, type PieceVert, type Solid } from './pieces.js';

// ── Local primitives ─────────────────────────────────────────────────────────
// `box` and `gable` cover the rectangular and the pitched case. Everything else
// this quarter needs — battered walls, drums, cones, cross-ridges — is one of
// two ideas: extrude a footprint, or extrude it and shrink the top.

/** A footprint in the surface plane: a ring of (east, north) corners. */
type Foot = [number, number][];

/** The corners of a rectangle, in the order the rest of this file assumes. */
function rect(e0: number, e1: number, n0: number, n1: number): Foot {
	return [
		[e0, n0],
		[e1, n0],
		[e1, n1],
		[e0, n1],
	];
}

/** A regular polygon — the drum. Six or eight sides is the whole useful range:
 *  fewer and it is a prism, more and the facets fall under the width where the
 *  shading bands stop being distinguishable and the thing turns back into the
 *  lump a cylinder always is. */
function ngon(sides: number, r: number, ce = 0, cn = 0, rot = 0): Foot {
	return Array.from({ length: sides }, (_, i): [number, number] => {
		const a = rot + (2 * Math.PI * i) / sides;
		return [ce + r * Math.cos(a), cn + r * Math.sin(a)];
	});
}

/** Force a footprint counter-clockwise seen from above.
 *
 *  Not a convenience — a footprint written the other way round turns every face
 *  of the solid it generates inside-out, and the failure mode is a hole you only
 *  see on the half of the spin that points it at you. Cheaper to fix the input
 *  here once than to read winding off six faces later. */
function ccw(foot: Foot): Foot {
	let twiceArea = 0;
	for (let i = 0; i < foot.length; i++) {
		const [e0, n0] = foot[i];
		const [e1, n1] = foot[(i + 1) % foot.length];
		twiceArea += e0 * n1 - e1 * n0;
	}
	return twiceArea < 0 ? [...foot].reverse() : foot;
}

function centre(foot: Foot): [number, number] {
	const k = foot.length;
	return [
		foot.reduce((a, [e]) => a + e, 0) / k,
		foot.reduce((a, [, n]) => a + n, 0) / k,
	];
}

/** A footprint carried up and shrunk about its own axis by `s`.
 *
 *  This is the workhorse of the quarter: `s === 1` is a plain prism, `s ≈ 0.88`
 *  is a battered wall, `s ≈ 0.45` is a bottle kiln. It stays convex because the
 *  solid is the hull of two homothetic convex polygons, and — less obviously —
 *  every side quad stays PLANAR, because scaling about a common centre moves
 *  both ends of an edge by parallel amounts. That planarity is what lets the
 *  renderer take one normal per face and the contour pass assume a horizontal
 *  plane cuts a face exactly twice. */
function taper(foot: Foot, h0: number, h1: number, s: number): Solid {
	const f = ccw(foot);
	const k = f.length;
	const [ce, cn] = centre(f);
	const verts: PieceVert[] = [
		...f.map(([e, n]) => ({ e, n, h: h0 })),
		...f.map(([e, n]) => ({ e: ce + (e - ce) * s, n: cn + (n - cn) * s, h: h1 })),
	];
	const faces: number[][] = [
		f.map((_, i) => i).reverse(), // floor — backwards, its outside faces down
		f.map((_, i) => i + k), // roof
	];
	for (let i = 0; i < k; i++) {
		const j = (i + 1) % k;
		faces.push([i, j, k + j, k + i]);
	}
	return { verts, faces };
}

/** A footprint carried straight up. */
function prism(foot: Foot, h0: number, h1: number): Solid {
	return taper(foot, h0, h1, 1);
}

/** A footprint gathered to a single point above its centre — the cone/pyramid.
 *
 *  Kept for the ONE place a piece needs a top that comes to nothing. A cone is
 *  the most emphatic full stop available to a silhouette, so spending it twice
 *  in eight buildings would waste it. */
function spire(foot: Foot, h0: number, hTop: number): Solid {
	const f = ccw(foot);
	const k = f.length;
	const [ce, cn] = centre(f);
	return {
		verts: [...f.map(([e, n]) => ({ e, n, h: h0 })), { e: ce, n: cn, h: hTop }],
		faces: [f.map((_, i) => i).reverse(), ...f.map((_, i) => [i, (i + 1) % k, k])],
	};
}

/** A pitched roof whose ridge runs EAST, the cross-grain twin of `gable`.
 *
 *  `gable` puts the ridge north, which is right for a hall you walk into; a
 *  building whose long axis lies across the view needs the other one. Having
 *  both means a roof direction is a design choice rather than an accident of
 *  which primitive existed. */
function ridge(e0: number, e1: number, nc: number, hw: number, h0: number, h1: number): Solid {
	return {
		verts: [
			{ e: e0, n: nc - hw, h: h0 },
			{ e: e1, n: nc - hw, h: h0 },
			{ e: e1, n: nc + hw, h: h0 },
			{ e: e0, n: nc + hw, h: h0 },
			{ e: e0, n: nc, h: h1 },
			{ e: e1, n: nc, h: h1 },
		],
		faces: [
			[0, 3, 2, 1], // underside
			[0, 1, 5, 4], // south slope
			[2, 3, 4, 5], // north slope
			[0, 4, 3], // gable end, west
			[1, 2, 5], // gable end, east
		],
	};
}

/** The shared foundation slab. Rule 1: it is the only part of any of these
 *  buildings that touches the ground, and it is always a touch wider than what
 *  stands on it — a building whose walls run straight into the terrain reads as
 *  pushed in, one on a plinth reads as founded. */
function plinth(he: number, hn: number, h = 0.14): Solid {
	return box(-he, he, -hn, hn, 0, h);
}

// ── The buildings ────────────────────────────────────────────────────────────

/** CHECKPOINT — DNS proxy. Every name lookup has to come through here.
 *
 *  The only building in the quarter with a HOLE in it, and that is the entire
 *  design: two battered piers, a gap you pass through, a lintel across the top.
 *  At 40 pixels the eye does not read "two towers", it reads the void between
 *  them, and a void is the one silhouette feature nothing else here owns. The
 *  gap is 0.72 radii wide and about 0.9 tall — big enough to survive the slant,
 *  because a checkpoint you cannot see through is just a wall. */
const CHECKPOINT: Piece = (() => {
	const pierTop = 1.24;
	const deck = 1.56;
	return [
		plinth(0.88, 0.44),
		// A raised threshold in the opening. It closes the gate visually at ground
		// level without closing it — the thing being inspected still gets through.
		box(-0.4, 0.4, -0.3, 0.3, 0.14, 0.34),
		taper(rect(-0.82, -0.36, -0.38, 0.38), 0.14, pierTop, 0.84),
		taper(rect(0.36, 0.82, -0.38, 0.38), 0.14, pierTop, 0.84),
		// The lintel oversails both piers. Battered piers pull away from it as
		// they rise, so the overhang is bigger than it is drawn and the shadow
		// line under it does the work of separating span from support.
		box(-0.86, 0.86, -0.34, 0.34, pierTop, deck),
		// One blade standing on the span, thin east-west and broad north-south:
		// edge-on from the front, a full plane in three-quarter view. It reads as
		// the aerial of a control post rather than as a chimney.
		box(-0.09, 0.09, -0.3, 0.3, deck, 1.94),
	];
})();

/** FORGE — GitHub runner. Where things are made, under supervision.
 *
 *  A long sealed hall with a bottle kiln at the far end. The hall runs
 *  north-south so it is seen end-on and stays narrow; all the width in the
 *  silhouette is spent on the kiln, which tapers hard from 0.38 to 0.17 radii.
 *  A FAT tapering stack is deliberately not the thin chimney a factory gets —
 *  same vocabulary, different sentence: a factory vents, a forge contains. */
const FORGE: Piece = (() => {
	const wall = 0.86; // where the hall's walls stop and its roof starts
	return [
		plinth(0.56, 0.94),
		taper(rect(-0.48, 0.48, -0.88, 0.24), 0.14, wall, 0.9),
		// Ridge running north, eaves out past the walls — the overhang is what
		// makes roof-and-hall two things rather than one stepped column.
		gable(0.54, -0.92, 0.28, wall, 1.34),
		taper(ngon(6, 0.38, 0, 0.55), 0.14, 1.52, 0.46),
		// The crown ring: wider than the kiln's throat, so the stack finishes on a
		// lip instead of trailing off. It also clears the ridge by 0.38 radii,
		// which is the margin at which a stack stops reading as a roof vent.
		prism(ngon(6, 0.24, 0, 0.55), 1.52, 1.72),
	];
})();

/** REDOUBT — hardened agent. Untrusted work, held at arm's length.
 *
 *  The only building here that is WIDEST at the ground: a steep glacis skirt
 *  from 0.90 down to 0.59 radii, then a squat drum, then a casemate lid that
 *  oversails the drum by a quarter of a radius. Sloped-out-then-overhung is the
 *  profile of everything ever built to take a hit, and it inverts the batter
 *  every other building in the quarter uses — same grammar, read backwards,
 *  which is exactly the relationship containment has to construction. */
const REDOUBT: Piece = (() => {
	const skirt = 0.6;
	const drum = 1.16;
	return [
		plinth(0.95, 0.95, 0.12),
		taper(rect(-0.9, 0.9, -0.9, 0.9), 0.12, skirt, 0.66),
		// Eight sides, not four: a drum has no corner to attack, and the extra
		// facets give the shading bands somewhere to step round the curve.
		taper(ngon(8, 0.58, 0, 0, Math.PI / 8), skirt, drum, 0.94),
		box(-0.7, 0.7, -0.7, 0.7, drum, 1.32),
		// Periscope, off the axis. Centred it would read as a spire and make the
		// whole thing look ceremonial; offset it reads as equipment, and the
		// asymmetry is what tells the redoubt from the bastion at a glance.
		box(0.16, 0.4, -0.12, 0.12, 1.32, 1.8),
	];
})();

/** KEEP — the control plane. It commands the others, so it is the tallest.
 *
 *  Strictly vertical where the rest of the quarter spreads: a low ward wall, one
 *  battered shaft, a corbelled gallery that steps OUT, a crown that steps back
 *  IN, and a spike. Out-then-in in the top third is the machicolated profile of
 *  every keep ever built, and it is the reason this silhouette cannot be
 *  confused with a plain tower — the outline changes direction twice in the last
 *  quarter of its height, where the eye is already looking. */
const KEEP: Piece = (() => {
	const shaft = 1.26;
	const gallery = 1.44;
	const crown = 1.66;
	return [
		plinth(0.86, 0.72, 0.16),
		// The ward: low, battered, wrapped right round. It gives the tower a base
		// to rise out of, so the height is a decision rather than a proportion.
		taper(rect(-0.8, 0.8, -0.66, 0.66), 0.16, 0.58, 0.9),
		taper(rect(-0.4, 0.4, -0.36, 0.36), 0.16, shaft, 0.86),
		box(-0.5, 0.5, -0.46, 0.46, shaft, gallery),
		box(-0.34, 0.34, -0.3, 0.3, gallery, crown),
		// The mast, tapered to a point at 1.96 — as close to the ceiling as this
		// quarter goes, and nothing else is allowed within 0.16 of it. Precedence
		// on a skyline is the cheapest way to say which building is in charge.
		taper(rect(-0.11, 0.11, -0.11, 0.11), crown, 1.96, 0.34),
	];
})();

/** BASTION — posture. Measuring the settlement against a standard.
 *
 *  Three terraces, each stepped back from the one below, each battered. It is
 *  the only stepped mass in the quarter, and steps are literally what a
 *  benchmark is: levels you are either at or not at. The outline is a staircase
 *  seen from the side and cannot be mistaken for a tower or a shed.
 *
 *  The fin on top is offset east and broad north-south, so the top edge is
 *  lopsided — the deliberate opposite of the checkpoint's centred blade, which
 *  is the only other piece here finished with a plane. */
const BASTION: Piece = (() => {
	const t1 = 0.56;
	const t2 = 1.02;
	const t3 = 1.42;
	return [
		plinth(0.92, 0.8),
		taper(rect(-0.86, 0.86, -0.74, 0.74), 0.14, t1, 0.92),
		taper(rect(-0.62, 0.62, -0.52, 0.52), t1, t2, 0.9),
		taper(rect(-0.38, 0.38, -0.32, 0.32), t2, t3, 0.88),
		// The observation deck oversails the top terrace: the one outward step in
		// a silhouette that has been stepping inward, which is what stops the
		// stack reading as a plain ziggurat and starts it reading as occupied.
		box(-0.44, 0.44, -0.38, 0.38, t3, 1.54),
		box(0.02, 0.34, -0.3, 0.3, 1.54, 1.94),
	];
})();

/** ARCHIVE — codebase analysis. The whole corpus, held still and read.
 *
 *  A wide hall under TWIN parallel ridges running east, with a lantern tower
 *  punching up through the roof at one end. Two ridges give an M along the top
 *  edge — no other piece in the quarter has more than one peak, and a repeated
 *  peak is what says "stacks, in rows" rather than "a building".
 *
 *  The valley between the two naves is where the roof is lowest, which is what
 *  makes the tower emerging beside it read as emerging rather than as a box
 *  parked on a roof. */
const ARCHIVE: Piece = (() => {
	const eave = 0.78;
	return [
		plinth(0.94, 0.62),
		taper(rect(-0.88, 0.88, -0.56, 0.56), 0.14, eave, 0.94),
		// Half-depths overlap by a hair at the valley: a gap between two abutting
		// roofs is a crack you can see straight through at some angles, and the
		// fix costs nothing because overlapping convex parts sort fine.
		ridge(-0.94, 0.94, -0.3, 0.33, eave, 1.22),
		ridge(-0.94, 0.94, 0.3, 0.33, eave, 1.22),
		// The lantern: narrow, at the east end, rising from the hall's own deck so
		// it belongs to the building rather than sitting on it.
		box(0.56, 0.82, -0.2, 0.2, eave, 1.62),
		box(0.5, 0.88, -0.26, 0.26, 1.62, 1.76),
	];
})();

/** SILOS — dependency analysis. Not one store but many, and the links between.
 *
 *  Three drums of three heights on one plinth, tied at mid-height by a gantry.
 *  The only clustered silhouette in the quarter: everything else resolves to a
 *  single mass, and this deliberately does not, because a dependency tree is a
 *  thing you cannot draw as one object without lying about it.
 *
 *  Heights descend 1.46 / 1.02 / 0.82 rather than stepping evenly — an even
 *  ladder reads as decoration, an uneven one reads as three separate buildings
 *  that happen to stand together, which is the point. */
const SILOS: Piece = (() => {
	const tallTop = 1.46;
	return [
		plinth(0.9, 0.62),
		taper(ngon(6, 0.34, -0.52, -0.1), 0.14, 1.02, 0.96),
		taper(ngon(6, 0.38, 0.02, 0.16, Math.PI / 6), 0.14, tallTop, 0.96),
		taper(ngon(6, 0.3, 0.54, -0.14), 0.14, 0.82, 0.96),
		// The gantry, landing on the shorter drums' heads. A horizontal running
		// clean through three vertical masses is the cheapest legible statement
		// that they are one system and not three neighbours.
		box(-0.72, 0.72, -0.04, 0.16, 0.86, 1.02),
		// The one cone in the quarter, and it belongs to the tallest drum. It
		// oversails the throat slightly, so the roof has an eave rather than
		// growing straight out of the wall.
		spire(ngon(6, 0.4, 0.02, 0.16, Math.PI / 6), tallTop, 1.86),
	];
})();

/** PRECINCT — editor policy. Where the rules for writing are kept and applied.
 *
 *  A walled compound, open toward the viewer: two side walls, a hall closing the
 *  far side, a corner turret, and a threshold bar across the opening. It is the
 *  only piece here with a COURTYARD — a void at ground level, enclosed on three
 *  sides — and enclosure is precisely what a policy is. You are inside it or you
 *  are not, and the bar across the entrance is the line.
 *
 *  Walls at 0.62 are just tall enough to survive the slant. Lower and they
 *  flatten into the plinth; higher and the compound becomes a bunker and starts
 *  arguing with the redoubt. */
const PRECINCT: Piece = (() => {
	const wallTop = 0.62;
	const hallTop = 0.92;
	const turretTop = 1.34;
	return [
		plinth(0.94, 0.86, 0.12),
		box(-0.88, -0.64, -0.8, 0.3, 0.12, wallTop),
		box(0.64, 0.88, -0.8, 0.3, 0.12, wallTop),
		// The threshold: low, across the open side. It never blocks the view into
		// the yard, which is the whole reason the compound is open to the south —
		// a precinct you cannot see into is a vault.
		box(-0.64, 0.64, -0.8, -0.62, 0.12, 0.34),
		taper(rect(-0.88, 0.88, 0.3, 0.82), 0.12, hallTop, 0.92),
		ridge(-0.94, 0.94, 0.56, 0.32, hallTop, 1.4),
		// The turret sits on a corner of the wall, not on the hall — the corner is
		// where an enclosure is watched from, and putting it there keeps the top
		// break off the axis of symmetry the hall would otherwise impose.
		taper(rect(0.56, 0.92, -0.88, -0.5), 0.12, turretTop, 0.8),
		spire(rect(0.54, 0.94, -0.9, -0.48), turretTop, 1.78),
	];
})();

/** Every building this quarter contributes, by shape name. */
export const WORKS_PIECES: Record<string, Piece> = {
	checkpoint: CHECKPOINT,
	forge: FORGE,
	redoubt: REDOUBT,
	keep: KEEP,
	bastion: BASTION,
	archive: ARCHIVE,
	silos: SILOS,
	precinct: PRECINCT,
};

/** Which agent mode stands in which building.
 *
 *  Kept separate from the shapes on purpose: a mode is a product fact that gets
 *  renamed and re-bucketed, a building is a drawing. One table changing should
 *  never force the other to. */
// `satisfies`, not a `Record<string, string>` annotation. The annotation erased
// the literal keys into an index signature, which is what let the merged
// `MODE_PIECES` claim to be total while missing a mode: TypeScript could not see
// through the spread to know which keys this half actually contributes.
// `satisfies` checks every key is a real mode AND keeps the exact key set, so
// the completeness check downstream has something to count.
export const WORKS_MODE_PIECES = {
	dns_proxy: 'checkpoint',
	github_runner: 'forge',
	hardened_agent: 'redoubt',
	posture: 'bastion',
	codebase_analysis: 'archive',
	vscode_enforcement: 'precinct',
} satisfies Partial<Record<ModeKey, string>>;
