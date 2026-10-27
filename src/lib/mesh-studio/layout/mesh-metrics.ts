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

/** Caption floor: the smallest a node's name is ever set, and the tightest gap
 *  ever left between the rim and its first baseline. Above that floor both grow
 *  with the node — a fixed 9px caption under a 60px disc reads as a footnote to
 *  the thing it names. */
export const LABEL_FS_MIN = 9;
export const LABEL_GAP_MIN = 18;

/** The caption's font size and its gap below the rim, for a node of radius `r`.
 *
 *  These ARE the numbers MeshStudio draws with — it calls them rather than
 *  restating them, because the layout pass sizing a node off a different caption
 *  from the one that gets drawn is precisely the drift this module exists to
 *  stop. `r` is the already-scaled disc radius. */
export function captionFS(r: number, labelScale = 1): number {
	return Math.max(LABEL_FS_MIN, r * 0.24) * labelScale;
}
export function captionGap(r: number): number {
	return Math.max(LABEL_GAP_MIN, r * 0.42);
}
/** The caption wraps to this multiple of the node's radius — MeshStudio's own
 *  `r * 2.6` chord — and stops at this many lines. */
export const LABEL_CHORD_MUL = 2.6;
export const LABEL_MAX_LINES = 3;
/** Value and live-slot lines, as multiples of the caption they stack under. */
export const VALUE_FS_MUL = 1.3;
export const LIVE_FS_MUL = 0.78;
/** Baseline-to-baseline step in the stack, in caption sizes. */
export const STACK_STEP_MUL = 1.4;

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
export function satelliteGeom(
	r: number,
	modeCount: number,
	/** The satellite radius the node asked for, already scaled. A caller with
	 *  single-mode nodes on the same canvas passes theirs so a fanned-out mode is
	 *  the same size as the same mode standing alone. */
	facetROverride?: number
): { facetR: number; ringR: number } {
	const facetR = facetROverride ?? Math.min(r, 40);
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
export function labelBox(
	n: StudioNode,
	opts: { radiusScale?: number; labelScale?: number } = {}
): { halfW: number; reach: number } {
	const r = nodeR(n, opts.radiusScale ?? 1);
	const fs = captionFS(r, opts.labelScale ?? 1);
	const gap = captionGap(r);
	const line = (s: string | undefined, size: number) => (s ? s.length * size * MONO_ADVANCE : 0);
	const valueText = n.value ? `${n.value}${n.valueLabel ? ` ${n.valueLabel}` : ''}` : undefined;
	// MeshStudio WRAPS the caption to this chord, so a long name is never drawn
	// as one wide line. Measuring the unwrapped string reserved width that never
	// appears — which on a ring pushes every neighbour away from a node whose only
	// crime is a three-word name.
	const chord = r * LABEL_CHORD_MUL;
	const capped = (s: string | undefined, size: number) => Math.min(line(s, size), chord);
	const halfW =
		Math.max(
			capped(n.label, fs),
			capped(valueText, fs * VALUE_FS_MUL),
			capped(n.liveSlot, fs * LIVE_FS_MUL)
		) / 2;
	// …and what wrapping costs instead is DEPTH: one more baseline per extra line,
	// capped at the renderer's own 3-line limit.
	const rows = Math.min(LABEL_MAX_LINES, Math.max(1, Math.ceil(line(n.label, fs) / chord)));
	const drop = (rows - 1) * fs * 1.15;
	// The stack MeshStudio draws: caption at `gap`, then each further line one
	// STACK_STEP below the last, plus the descent of whichever line is last.
	const next = gap + drop + fs * STACK_STEP_MUL;
	const reach = n.liveSlot
		? next + (n.value ? fs * STACK_STEP_MUL : 0) + fs * LIVE_FS_MUL * 0.4
		: n.value
			? next + fs * VALUE_FS_MUL * 0.4
			: gap + drop + fs * 0.4;
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
 *  overlaps at another is worse than one that reserves the worst case.
 *
 *  This number IS the piece-to-globe ratio: it is only ever spent on inflating
 *  the footprint, which grows the sphere, which `globeFill` then fits back to
 *  the same viewport — so raising it shrinks every building on screen. The full
 *  worst case (2, a piece at its tallest, leaned, seen along its diagonal) buys
 *  a clearance that is empty at almost every bearing and costs the buildings
 *  their presence at all of them. 1.6 reserves the case that actually occurs and
 *  lets a neighbour's crest pass behind a tall piece, which is what a skyline
 *  does anyway. Below ~1.4 they start to interpenetrate on the bearings where
 *  two tall pieces line up. */
export const PIECE_REACH = 1.6;

export interface MetricOpts {
	/** MeshTuning.radiusScale — live-adjustable, so layout must re-solve when it moves. */
	radiusScale?: number;
	/** Links held by this node; drives the connection-ring stack. */
	connCount?: number;
	/** MeshTuning.connArcs, minus the control-plane exemption. */
	showArcs?: boolean;
	/** MeshStudio's `labelScale` — captions grow with it, so a layout solved
	 *  against the default would under-reserve for a canvas that raised it. */
	labelScale?: number;
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
	const { facetR, ringR } = satelliteGeom(
		r,
		n.modes!.length,
		n.facetR != null ? n.facetR * radiusScale : undefined
	);
	// The satellites carry captions of their own, which hang OUTSIDE the ring the
	// satellites sit on — so the envelope is the ring, the satellite, and the text
	// under it. Left out, a fan-out's labels land on whatever is next to it.
	return Math.max(arcs, ringR + facetR + captionGap(facetR) + captionFS(facetR, opts.labelScale));
}

/** The radius a layout must reserve for this node: its silhouette, widened by the
 *  caption when the caption is wider than the body.
 *
 *  Captions hang below, so their reach is already inside the silhouette for any
 *  node whose body is taller than its text — it's the WIDTH that escapes, and on
 *  a ring the neighbours a node crowds are the ones beside it. */
export function packingR(n: StudioNode, opts: MetricOpts = {}): number {
	const { halfW, reach } = labelBox(n, {
		radiusScale: opts.radiusScale,
		labelScale: opts.labelScale
	});
	const body = silhouetteR(n, opts);
	const r = nodeR(n, opts.radiusScale ?? 1);
	const rim = outerR(r, opts.connCount ?? 0, opts.showArcs ?? false);
	return Math.max(body, halfW, rim + reach);
}
