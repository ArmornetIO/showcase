// ── Live tuning knobs for the mesh studio ──────────────────────────────────
// Every animated / styled parameter added to the nodes, exposed so the demo
// page's tuning cog can drive them in real time.

export interface MeshTuning {
	// ── Global ──
	animate: boolean; // master motion switch
	glow: boolean; // master glow/blur switch
	/** How opaque a node's BODY is, 0..1.
	 *
	 *  A node normally paints an opaque surface under its tint so the mesh's own
	 *  lines can't show through the disc — right for an instrument face laid on a
	 *  canvas. On a holographic globe it is exactly wrong: an opaque disc is a
	 *  sticker on the projection, and the scene stops being one object. Turning it
	 *  down lets the terrain read through the nodes standing on it. */
	bodyOpacity: number;
	// ── Outline energy trace (flow along the node's own outline) ──
	trace: boolean;
	traceSpeed: number; // base seconds per loop — higher = slower (3..16)
	traceFlowBoost: number; // how much port flow-rate speeds it up (0..6)
	traceWidth: number; // stroke width (1..5)
	traceGap: number; // dash-gap multiplier (0.4..3)
	traceOpacity: number; // 0..1
	traceColorMode: 'auto' | 'fixed';
	traceColor: string;
	// ── Edge particles ──
	particles: boolean;
	particleSpeed: number; // multiplier — higher = faster (0.3..3)
	particleCount: number; // 1..6
	particleSize: number; // 1..5
	// ── Edges ──
	edgeWidth: number; // 1..4
	edgeOpacity: number; // multiplier 0.2..1
	arrowheads: boolean;
	edgeLabels: boolean; // protocol + signal pill on each labelled link
	// ── Connection arcs ──
	connArcs: boolean; // nested per-link rings + orbit dots outside the rim
	// ── Ports ──
	// The rim dots an operator drags FROM to draw a link. Four elements each and an
	// interactive <g> per port, so they are the largest single population on a big
	// mesh — and the least useful there, since dragging between two nodes in a crowd
	// of hundreds is not a real interaction. Geometry is unaffected: edges still
	// terminate on the same points, they just aren't drawn or draggable.
	ports: boolean;
	// ── Port arcs + dots ──
	arcWidth: number; // active arc stroke (1..5)
	arcPulseSpeed: number; // seconds (0.5..5)
	dotSize: number; // active port dot radius (2..6)
	// ── Node chrome ──
	radiusScale: number; // 0.6..1.5
	glyphWidth: number; // icon / outline base stroke (1..3.5)
	popIn: boolean;
	hoverScale: number; // 1..1.15
	// ── Palette ──
	energyColor: string;
	degradedColor: string;
	offlineColor: string;
	/** One hue every HEALTHY node draws in, or '' to keep each node's own.
	 *
	 *  This is the palette collapse, as a knob. Identity by colour costs the whole
	 *  budget — seventeen mode hues plus a hue per territory — and leaves nothing
	 *  to say "this one is broken" with, which is why a failing node needed an
	 *  opaque badge pasted over the scene to be noticed at all.
	 *
	 *  Set it and hue stops meaning WHICH and starts meaning HOW IT IS: one cold
	 *  world, with degraded and offline the only saturated things on screen and
	 *  therefore impossible to miss. Identity moves to the silhouette, which is the
	 *  only other channel that survives at 40px from an arbitrary bearing — see
	 *  `piece-catalogue.ts`, and note this knob is only honest on an arrangement
	 *  where every node has a building to be identified by. */
	worldHue: string;
}

export const DEFAULT_TUNING: MeshTuning = {
	animate: true,
	glow: true,
	bodyOpacity: 1,
	trace: true,
	traceSpeed: 10,
	traceFlowBoost: 4,
	traceWidth: 2.4,
	traceGap: 1,
	traceOpacity: 0.95,
	traceColorMode: 'auto',
	traceColor: '#22D3EE',
	particles: true,
	particleSpeed: 1,
	particleCount: 3,
	particleSize: 2.4,
	edgeWidth: 1.6,
	edgeOpacity: 1,
	arrowheads: true,
	edgeLabels: true,
	connArcs: true,
	ports: true,
	arcWidth: 3,
	arcPulseSpeed: 2,
	dotSize: 3.5,
	radiusScale: 1,
	glyphWidth: 1.8,
	popIn: true,
	hoverScale: 1.05,
	energyColor: '#22D3EE',
	degradedColor: '#FDE68A',
	offlineColor: '#F87185',
	// Off by default: the flat arrangements still identify a node by its tint, and
	// collapsing the palette where nothing has a silhouette to be known by would
	// leave them saying nothing at all.
	worldHue: '',
};

export function cloneTuning(t: MeshTuning): MeshTuning {
	return { ...t };
}
