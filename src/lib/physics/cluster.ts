// ── physics/cluster — group-aware placement ──────────────────────────────────
// Places bodies so that bodies sharing a group end up together.
//
// The obvious approach — give same-group bodies an attraction and let the solver
// pull them into clumps — does not work, and it is worth saying why, because the
// reason rules out a whole family of fixes.
//
// Relaxation is a LOCAL method: it nudges bodies along the line between them. But
// getting two same-group bodies adjacent, when three others sit between them,
// requires those others to move out of the way and swap — a PERMUTATION. No
// amount of attraction produces one, because every intermediate state overlaps,
// and separation is precisely what forbids that. Attraction pulls until it is
// balanced by the bodies in the way, and stops. Measured on a real mesh, the
// clustering was identical at attraction 0 and at 1.2.
//
// So grouping is decided where it CAN be decided: when choosing which position
// each body takes. Place the groups first, then place each group's members around
// their own group's centre. The ordering problem is solved by construction, and
// the solver is left doing what it is actually good at — resolving overlap.
//
// Two levels, same primitives at each: a group is packed as though it were one
// body, then unpacked into its members.
//
// Pure: no Svelte, no dependencies, no knowledge of what a body stands for.
import { packRing } from './ring.js';
import { packSunflower } from './sunflower.js';

export interface ClusterOpts {
	/** Clear space between two bodies inside a group. */
	margin?: number;
	/** Clear space between one group and the next. Wider than `margin` is what
	 *  makes a group read AS a group: what separates clumps is that the space
	 *  between them beats the space within them. */
	groupMargin?: number;
	/** Radius of the hub at the centre — groups must clear it. */
	hubR?: number;
	/** Clear space between the hub and the nearest group. */
	hubMargin?: number;
	/** Rotation of the whole layout, in degrees. */
	startAngle?: number;
}

export interface ClusterPlacement {
	/** Offset from the centre, index-aligned with the input radii. */
	points: { x: number; y: number }[];
	/** Distance from the centre to the outermost body's edge. */
	radius: number;
	/** Where each group settled, keyed by group. For callers that want to label a
	 *  cluster or draw a hull around it. */
	centers: Map<string | number, { x: number; y: number; r: number }>;
}

/** Lay bodies out in groups around a hub.
 *
 *  Groups are laid on a phyllotactic spiral — they are the things that must not
 *  crowd each other, and the spiral fills the annulus rather than ringing it.
 *  Members are laid on a ring inside their group, which for the two- and
 *  three-member groups a real mesh is mostly made of is simply the tightest
 *  arrangement there is.
 *
 *  Deterministic: groups are ordered by first appearance, so the same mesh lays
 *  out the same way every time rather than shuffling with Map iteration.
 *
 *  Feasible by construction — a sound seed for `packInward`. */
export function packClusters(
	radii: number[],
	groups: (string | number)[],
	opts: ClusterOpts = {},
): ClusterPlacement {
	const { margin = 0, groupMargin, hubR = 0, hubMargin = 0, startAngle = -90 } = opts;
	const gap = groupMargin ?? margin * 2;
	if (!radii.length) {
		return { points: [], radius: Math.max(hubR + hubMargin, 1), centers: new Map() };
	}

	// Partition by group, in order of first appearance.
	const members = new Map<string | number, number[]>();
	for (let i = 0; i < radii.length; i++) {
		const g = groups[i];
		const list = members.get(g);
		if (list) list.push(i);
		else members.set(g, [i]);
	}

	// Lay out each group internally, and measure what it occupies as a whole.
	const keys = [...members.keys()];
	const local = new Map<string | number, { x: number; y: number }[]>();
	const groupRadii = keys.map((k) => {
		const idx = members.get(k)!;
		if (idx.length === 1) {
			// A group of one IS its member — no ring, no needless offset.
			local.set(k, [{ x: 0, y: 0 }]);
			return radii[idx[0]];
		}
		const inner = packRing(
			idx.map((i) => radii[i]),
			{ margin, startAngle },
		);
		local.set(k, inner.points);
		return Math.max(...inner.points.map((p, j) => Math.hypot(p.x, p.y) + radii[idx[j]]));
	});

	// Then place the groups themselves, each as one body of that size.
	const outer = packSunflower(groupRadii, { margin: gap, hubR, hubMargin, startAngle });

	const points: { x: number; y: number }[] = new Array(radii.length);
	const centers = new Map<string | number, { x: number; y: number; r: number }>();
	keys.forEach((k, gi) => {
		const c = outer.points[gi];
		centers.set(k, { x: c.x, y: c.y, r: groupRadii[gi] });
		members.get(k)!.forEach((i, j) => {
			const o = local.get(k)![j];
			points[i] = { x: c.x + o.x, y: c.y + o.y };
		});
	});

	const radius = Math.max(...points.map((p, i) => Math.hypot(p.x, p.y) + radii[i]));
	return { points, radius, centers };
}
