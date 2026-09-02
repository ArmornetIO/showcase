/**
 * The shape a Line takes between two points.
 *
 * Lifted out of `MeshStudio.svelte`, which owned this geometry privately, so
 * that anything drawing an edge draws the SAME curve. That mattered the moment
 * a second consumer appeared: `Edge.svelte` had straight and elbow routes of its
 * own invention, which meant the mesh and everything else disagreed about what
 * a link looks like — and the mesh's answer is the considered one.
 */

export interface EdgePoint {
	x: number;
	y: number;
}

/**
 * How a link is routed.
 *
 *   line    — direct. Honest, and the right answer when the two ends are
 *             already obviously related.
 *   bezier  — horizontal-first cubic. Reads as flow: it leaves one side and
 *             arrives at the other, so it says which way the thing travels.
 *   bow     — a single arc bulging off the straight run. The mesh's default,
 *             and the reason is bundling: two links between the same pair, or a
 *             fan converging on one node, land on top of each other as straight
 *             lines and are individually unreadable. A bow gives each one its
 *             own arc to occupy.
 *   elbow   — out along one axis, then the other. Not a mesh curve: it is for
 *             rails and buses, where a diagonal would imply a distance nothing
 *             is actually travelling.
 */
export type EdgeCurve = 'line' | 'bezier' | 'bow' | 'elbow';

/**
 * Control point for a `bow`, offset along the unit normal of the run.
 *
 * The offset is clamped to 12–46px rather than being a flat fraction of the
 * length: proportional alone makes a short link almost straight (so bundled
 * short links still overlap, which is the case the bow exists for) and bends a
 * long one into a semicircle that no longer reads as a connection.
 */
export function bowControl(a: EdgePoint, b: EdgePoint): { cx: number; cy: number } {
	const dx = b.x - a.x;
	const dy = b.y - a.y;
	const len = Math.hypot(dx, dy) || 1;
	const bow = Math.max(12, Math.min(46, len * 0.12));
	return { cx: (a.x + b.x) / 2 + (-dy / len) * bow, cy: (a.y + b.y) / 2 + (dx / len) * bow };
}

/** The unit normal of a run — the direction a bow bulges, and the direction a
 *  label has to move to get off the line. */
export function edgeNormal(a: EdgePoint, b: EdgePoint): { nx: number; ny: number } {
	const dx = b.x - a.x;
	const dy = b.y - a.y;
	const len = Math.hypot(dx, dy) || 1;
	return { nx: -dy / len, ny: dx / len };
}

/**
 * Pull the ends of a run back along its own direction.
 *
 * A line that stops at a node's CENTRE runs underneath the node and out the
 * other side; what you want is for it to stop at the boundary, so the node
 * reads as the thing the line arrives at rather than something dropped on top
 * of it. MeshStudio does this per node shape via `boundaryPoint`; this is the
 * same idea for callers whose node is just a known radius.
 *
 * The pull-back is along the CHORD even when the curve is a bow. The bow is
 * re-solved from the trimmed ends, so the arc stays smooth and still meets the
 * boundary — solving it against the curve's own tangent would be more correct
 * and completely invisible at these radii.
 */
export function trimSegment(
	a: EdgePoint,
	b: EdgePoint,
	startGap = 0,
	endGap = 0
): { a: EdgePoint; b: EdgePoint } {
	const dx = b.x - a.x;
	const dy = b.y - a.y;
	const len = Math.hypot(dx, dy) || 1;
	const ux = dx / len;
	const uy = dy / len;
	return {
		a: { x: a.x + ux * startGap, y: a.y + uy * startGap },
		b: { x: b.x - ux * endGap, y: b.y - uy * endGap }
	};
}

/** An SVG path `d` between two points, in the given shape. */
export function edgePathBetween(a: EdgePoint, b: EdgePoint, curve: EdgeCurve = 'bow'): string {
	if (curve === 'bow') {
		const { cx, cy } = bowControl(a, b);
		return `M ${a.x} ${a.y} Q ${cx} ${cy} ${b.x} ${b.y}`;
	}
	if (curve === 'bezier') {
		// Horizontal-first: the handles leave along x, so the curve departs and
		// arrives flat and the direction of travel is legible at the ends, which
		// is where an arrowhead or a port would sit.
		const dx = (b.x - a.x) * 0.4;
		return `M ${a.x} ${a.y} C ${a.x + dx} ${a.y} ${b.x - dx} ${b.y} ${b.x} ${b.y}`;
	}
	if (curve === 'elbow') {
		return `M ${a.x} ${a.y} H ${b.x} V ${b.y}`;
	}
	return `M ${a.x} ${a.y} L ${b.x} ${b.y}`;
}
