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
	/** Whether a node's body is PAINTED at all — the opaque under-surface plus
	 *  the hue tint over it.
	 *
	 *  Off leaves the outline and the glyph standing on the canvas itself: the
	 *  node becomes a ring around its picture rather than a filled token. What
	 *  you lose is the guarantee that mesh lines cannot show through the disc;
	 *  what you gain is every bit of contrast the fill was taking from the glyph
	 *  and the caption inside it. */
	bodyFill: boolean;
	/** A pattern laid inside the node's silhouette — the thing an unfilled disc
	 *  has none of. Neutral (white at low alpha) rather than per-node hue: one
	 *  <pattern> in the defs serves every node, where a tinted one needs a
	 *  pattern per colour and seventeen of them is a repaint, not a texture. */
	bodyTexture: 'none' | 'hatch' | 'grid';
	/** A short arc travelling the rim, like an instrument sweep. Speed follows the
	 *  node's own flow, so motion means traffic rather than decoration. */
	rimSweep: boolean;
	/** The off-centre highlight painted over a node body — the glassy sheen that
	 *  makes a disc read as a lens.
	 *
	 *  A knob because it competes with everything INSIDE the disc: at mesh size
	 *  the gradient sits directly over the glyph and the inset caption, and the
	 *  contrast it eats is exactly the contrast small text needed. Worth keeping
	 *  for a hero node at full size; worth killing on a canvas of forty. */
	bodyGloss: boolean;
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
	/** Repeat a failing link's status icon where it lands on its `to` node, so a
	 *  node can say which of its links are down without recolouring itself. */
	portStatus: boolean;
	// ── Connection arcs ──
	connArcs: boolean; // nested per-link rings + orbit dots outside the rim
	/** The roll-up badge's track — the faint ring plus the healthy-share arc it
	 *  draws around the node.
	 *
	 *  Separable from the badge itself because a ringed node already HAS an
	 *  outline: put a second circle just outside it and the two read as a pair of
	 *  rings rather than as a node and a gauge. The numeral costs nothing and is
	 *  the part anyone actually reads. */
	countRing: boolean;
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
	radiusScale: number; // 0.6..2.2
	/** How much of the disc the glyph spans, as a multiple of the house fraction
	 *  (0.41 of the diameter — the mockup's 64px glyph in a 156px disc).
	 *
	 *  Separate from `radiusScale` on purpose: growing the node grows the gaps
	 *  between nodes too, and on a crowded mesh the thing that is too small is
	 *  what is INSIDE the disc, not the disc. */
	glyphScale: number; // 0.7..2.2 (×0.41 of the diameter)
	glyphWidth: number; // icon / outline base stroke (1..3.5)
	popIn: boolean;
	hoverScale: number; // 1..1.15
	// ── Palette ──
	energyColor: string;
	degradedColor: string;
	offlineColor: string;
	/** The hologram powered down — see `NodeState`'s `dormant`. */
	dormantColor: string;
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
	bodyFill: true,
	bodyTexture: 'none',
	rimSweep: false,
	bodyGloss: true,
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
	portStatus: false,
	connArcs: true,
	countRing: true,
	ports: true,
	arcWidth: 3,
	arcPulseSpeed: 2,
	dotSize: 3.5,
	radiusScale: 1,
	glyphScale: 1,
	glyphWidth: 1.8,
	popIn: true,
	hoverScale: 1.05,
	energyColor: '#22D3EE',
	degradedColor: '#FDE68A',
	offlineColor: '#F87185',
	// The world hue's family, pushed toward blue and down in lightness and
	// saturation — the same hologram with the power off rather than a second
	// signal. It has to carry the dimming on its own on the GPU globe, where a
	// piece's colour is the only thing its state reaches, so it is genuinely darker
	// rather than merely cooler.
	dormantColor: '#557A9E',
	// Off by default: the flat arrangements still identify a node by its tint, and
	// collapsing the palette where nothing has a silhouette to be known by would
	// leave them saying nothing at all.
	worldHue: '',
};

export function cloneTuning(t: MeshTuning): MeshTuning {
	return { ...t };
}
