// ── Territory anchors ────────────────────────────────────────────────────────
// Where a REGION is on screen, right now.
//
// `BoardFx` already does this for a single building: read `[data-node="<id>"]`
// out of the live SVG and use its box. Presence needs the same trick at one
// level up, because the fog rule says a presence mark lands on a territory and
// never on a structure. A region has no element of its own, so its anchor is
// the centroid of the buildings standing in it — which has the useful property
// of being wrong in the right direction: as a region rotates away, its visible
// buildings drop out one by one and the centroid drifts to the ones still
// facing you, instead of snapping to the far side of the sphere.
//
// One sampler, many renderers. `PlayerPresence` runs this once a frame and
// hands the result down, so three world-layer modes cost one rAF loop and one
// pass of getBoundingClientRect, not three of each.

import { cssZoom } from 'showcase';
import { CORE_ID, STRUCTURES, TERRITORY_ORDER, type TerritoryKey } from '../internal/rules.js';

export interface TerritoryAnchor {
	territory: TerritoryKey;
	x: number;
	y: number;
	/** Radius covering the region's visible spread, clamped so a region the
	 *  camera has flown into cannot paint the whole window. */
	r: number;
	/** How much of the region is facing the viewer, 0–1. Renderers fade with
	 *  this rather than popping, so a mark on ground turning away recedes. */
	facing: number;
}

/** The globe's own box, for stage-layer modes that need to sit around its rim
 *  rather than on a building. */
export interface StageBox {
	x: number;
	y: number;
	w: number;
	h: number;
	/** Centre. */
	cx: number;
	cy: number;
	/** Radius of the largest circle that fits — the globe is fitted to its box,
	 *  so this is the limb. */
	r: number;
}

/** Live box of one drawn node, in `host`'s coordinates. Null when the node is
 *  missing or on the far side — the renderer fades back-face nodes rather than
 *  removing them, so their boxes still exist and would otherwise place a mark
 *  in the middle of the sphere. */
function nodeBox(host: HTMLElement, id: string) {
	const el = host.parentElement?.querySelector(`[data-node="${CSS.escape(id)}"]`);
	if (!el) return null;
	const o = Number((el as HTMLElement).style.opacity || '1');
	if (o < 0.35) return null;
	const r = (el as SVGGraphicsElement).getBoundingClientRect();
	if (r.width === 0 && r.height === 0) return null;
	const h = host.getBoundingClientRect();
	// Rects answer in visual px; every renderer downstream draws in the host's
	// layout px. The two agree until something up the tree sets `zoom`, and then
	// each mark lands at the zoom factor of where it belongs — see `cssZoom`.
	const z = cssZoom(host);
	return {
		x: (r.left + r.width / 2 - h.left) / z,
		y: (r.top + r.height / 2 - h.top) / z,
		o
	};
}

/** Sample every territory. Regions with nothing facing the viewer are omitted
 *  rather than returned at zero — a renderer should not have to filter. */
export function sampleTerritories(host: HTMLElement | null): TerritoryAnchor[] {
	if (!host) return [];
	const out: TerritoryAnchor[] = [];

	for (const territory of TERRITORY_ORDER) {
		const ids = STRUCTURES.filter((s) => s.territory === territory).map((s) => s.id);
		const boxes = ids.map((id) => nodeBox(host, id)).filter((b): b is NonNullable<typeof b> => !!b);
		if (!boxes.length) continue;

		const x = boxes.reduce((a, b) => a + b.x, 0) / boxes.length;
		const y = boxes.reduce((a, b) => a + b.y, 0) / boxes.length;
		// Spread, not extent: the distance the furthest visible building sits from
		// the centroid, floored so a one-building region is still a target.
		const spread = Math.max(...boxes.map((b) => Math.hypot(b.x - x, b.y - y)), 0);

		out.push({
			territory,
			x,
			y,
			r: Math.max(26, Math.min(150, spread + 22)),
			// Both how MANY of its buildings face you and how squarely they do.
			facing:
				(boxes.length / ids.length) * (boxes.reduce((a, b) => a + b.o, 0) / boxes.length)
		});
	}

	return out;
}

/**
 * The GLOBE's box — not the overlay's.
 *
 * This distinction is the whole function. The overlay spans the stage, but the
 * globe is fitted inside the HUD insets and shrinks further whenever the camera
 * pulls back, so half the overlay's width is nowhere near the limb: seat
 * markers hung off it end up in the far corners of the screen, or off it.
 *
 * So the radius is MEASURED, from the furthest drawn building rather than from
 * the container — which has the useful side effect of tracking the camera for
 * free. Fly in and the limb expands under the markers; fit the theatre and they
 * close back in.
 */
export function sampleStage(host: HTMLElement | null): StageBox | null {
	if (!host) return null;
	const h = host.getBoundingClientRect();
	if (h.width === 0 || h.height === 0) return null;

	// The host's own size, in the layout px `nodeBox` now answers in — mixing the
	// two spaces here would put the fallback centre and the fit limit on a
	// different ruler from the measured spread they are compared against.
	const z = cssZoom(host);
	const hw = h.width / z;
	const hh = h.height / z;

	// The core sits at the centre of the board by construction, which makes it a
	// better centre than the host rectangle whenever the camera has moved.
	const core = nodeBox(host, CORE_ID);
	const cx = core?.x ?? hw / 2;
	const cy = core?.y ?? hh / 2;

	const boxes = STRUCTURES.map((s) => nodeBox(host, s.id)).filter(
		(b): b is NonNullable<typeof b> => !!b
	);
	const spread = boxes.length
		? Math.max(...boxes.map((b) => Math.hypot(b.x - cx, b.y - cy)))
		: Math.min(hw, hh) / 2.4;

	// Buildings do not reach the silhouette. A structure near the limb is turned
	// far enough away that the renderer has already faded it below the cut-off
	// above, so the furthest MEASURABLE building sits inside the true edge — by
	// about this much, which is a property of that fade threshold and not of any
	// particular board. Without the correction the markers land on the terrain
	// instead of around it.
	//
	// The alternative is a radius handle out of MeshCanvas. That is the better
	// fix and it is a change to the library, not to this example.
	const LIMB = 1.15;
	const measured = spread * LIMB;

	// Whatever the globe is doing, the ring around it has to stay on screen.
	// `RIM` is the furthest any presence mode reaches past the limb.
	const RIM = 1.22;
	const fits = Math.min(cx, hw - cx, cy, hh - cy) / RIM;

	return {
		x: 0,
		y: 0,
		w: hw,
		h: hh,
		cx,
		cy,
		r: Math.max(56, Math.min(measured, fits))
	};
}
