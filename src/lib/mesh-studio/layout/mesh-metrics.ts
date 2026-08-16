// ── mesh-metrics — the single source of a node's rendered size ────────────────
// MeshStudio draws a node as a disc, then hangs chrome off it: connection rings
// outside the rim, a caption stack below, mode satellites on their own ring. The
// disc is the smallest of those — what a node actually OCCUPIES is the envelope
// around all of it.
//
// Layout needs that envelope to place nodes without overlapping, and the renderer
// needs it to draw them. When each side computes its own, they drift and nodes
// overlap in exactly the cases the two disagree on. So both read from here.
//
// Pure geometry: no Svelte, no reactivity. `radiusScale` and arc visibility come
// from MeshTuning, but are passed in rather than imported, so these stay callable
// from a layout pass that has no component context.
import type { StudioNode } from '../studio.types.js';

/** First connection ring's clearance outside the rim. */
export const ARC_GAP = 7;
/** Spacing between stacked connection rings when there's room. */
export const ARC_STEP_MAX = 6;
/** Orbit dot: r=3.5 with a 2px stroke, centred ON the outermost ring. */
export const ARC_DOT_REACH = 4.5;

/** Caption baselines below the rim, and their font sizes. Mirrors the text stack
 *  in MeshStudio's ringed/icon branch. */
export const LABEL_DY = 14;
export const LABEL_FS = 9;
export const VALUE_DY = 28;
export const VALUE_FS = 12;
export const LIVE_DY = 39;
export const LIVE_FS = 7;

/** Mono advance as a fraction of font size. The canvas text is monospace, so a
 *  character count is an exact width — no measurement pass needed. */
export const MONO_ADVANCE = 0.6;

/** Radius of a node's disc, before any chrome. */
export function nodeR(n: StudioNode, radiusScale = 1): number {
	const base = n.r ?? (n.type === 'control-plane' ? 56 : n.type === 'daemon' ? 42 : 50);
	return base * radiusScale;
}

/** Ring geometry for a node's links. The band is bounded relative to the node
 *  rather than growing per link, so rings tighten as the count climbs instead of
 *  spilling over neighbours. */
export function arcGeom(count: number, r: number): { step: number; outerR: number } {
	if (count === 0) return { step: 0, outerR: r };
	const band = r * 0.5;
	const step = count > 1 ? Math.min(ARC_STEP_MAX, Math.max(2.4, band / (count - 1))) : 0;
	return { step, outerR: r + ARC_GAP + step * (count - 1) };
}

/** The rim the caption stack sits below — the disc, or the outermost connection
 *  ring when the node shows them. */
export function outerR(r: number, connCount: number, showArcs: boolean): number {
	return showArcs ? arcGeom(connCount, r).outerR : r;
}

/** Where a multi-mode agent's satellites land when fanned out. Grows with the
 *  mode count so the satellites never overlap each other or the hub. */
export function satelliteGeom(r: number, modeCount: number): { facetR: number; ringR: number } {
	const facetR = Math.min(r, 40);
	const ringR = Math.max(r + facetR + 22, (facetR + 12) / Math.sin(Math.PI / modeCount));
	return { facetR, ringR };
}

/** True when the node fans its modes out as satellites — the dominant sizing term
 *  when it does. */
export function isFannedOut(n: StudioNode): boolean {
	return !!(n.expanded && n.modes && n.modes.length > 1);
}

/** Half-width of the widest caption line, and how far the stack reaches below the
 *  rim. Descent padding keeps the last baseline from touching a neighbour. */
export function labelBox(n: StudioNode): { halfW: number; reach: number } {
	const line = (s: string | undefined, fs: number) => (s ? s.length * fs * MONO_ADVANCE : 0);
	const valueText = n.value ? `${n.value}${n.valueLabel ? ` ${n.valueLabel}` : ''}` : undefined;
	const halfW =
		Math.max(line(n.label, LABEL_FS), line(valueText, VALUE_FS), line(n.liveSlot, LIVE_FS)) / 2;
	const reach = n.liveSlot
		? LIVE_DY + LIVE_FS * 0.4
		: n.value
			? VALUE_DY + VALUE_FS * 0.4
			: LABEL_DY + LABEL_FS * 0.4;
	return { halfW, reach };
}

/** How far a standing SOLID reaches from its node's centre, in node radii.
 *
 *  `pieces.spec.ts` pins every building inside |e|,|n| ≤ 1 and 0 ≤ h ≤ 2, so a
 *  disc's own radius is not close: the height is the dominant term, and once the
 *  frame leans it becomes reach ACROSS the screen rather than straight up it.
 *
 *  A constant rather than a per-piece measurement, deliberately. Layout is solved
 *  before any tangent frame exists, so the true projected extent is not knowable
 *  at the moment the packing needs it — and a node that fits at one bearing and
 *  overlaps at another is worse than one that reserves the worst case. */
export const PIECE_REACH = 2;

export interface MetricOpts {
	/** MeshTuning.radiusScale — live-adjustable, so layout must re-solve when it moves. */
	radiusScale?: number;
	/** Links held by this node; drives the connection-ring stack. */
	connCount?: number;
	/** MeshTuning.connArcs, minus the control-plane exemption. */
	showArcs?: boolean;
	/** Whether this arrangement stands its nodes up as SOLIDS.
	 *
	 *  Only a relief globe does. The flat arrangements withhold the tangent frame
	 *  rather than stripping `piece` off the node, so a piece is inert there and
	 *  reserving for one would spread a flat mesh out to clear buildings that are
	 *  never drawn. */
	solids?: boolean;
}

/** Everything the node draws, as a radius about its centre — disc, connection
 *  rings and their orbit dots, and satellites when fanned out. Captions are NOT
 *  included: they hang in one direction and are handled separately, so folding
 *  them in here would inflate every node in every direction at once. */
export function silhouetteR(n: StudioNode, opts: MetricOpts = {}): number {
	const { radiusScale = 1, connCount = 0, showArcs = false, solids = false } = opts;
	const r = nodeR(n, radiusScale);
	const arcs = showArcs && connCount > 0 ? arcGeom(connCount, r).outerR + ARC_DOT_REACH : r;
	// A building occupies roughly four times the area the disc it replaced did,
	// and nothing here used to know that — so seventeen of them on one globe
	// overlapped exactly the way this module exists to prevent.
	if (solids && n.piece) return Math.max(arcs, r * PIECE_REACH);
	if (!isFannedOut(n)) return arcs;
	const { facetR, ringR } = satelliteGeom(r, n.modes!.length);
	return Math.max(arcs, ringR + facetR);
}

/** The radius a layout must reserve for this node: its silhouette, widened by the
 *  caption when the caption is wider than the body.
 *
 *  Captions hang below, so their reach is already inside the silhouette for any
 *  node whose body is taller than its text — it's the WIDTH that escapes, and on
 *  a ring the neighbours a node crowds are the ones beside it. */
export function packingR(n: StudioNode, opts: MetricOpts = {}): number {
	const { halfW, reach } = labelBox(n);
	const body = silhouetteR(n, opts);
	const r = nodeR(n, opts.radiusScale ?? 1);
	const rim = outerR(r, opts.connCount ?? 0, opts.showArcs ?? false);
	return Math.max(body, halfW, rim + reach);
}
