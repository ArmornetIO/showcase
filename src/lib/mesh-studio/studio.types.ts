/**
 * The mesh's domain vocabulary — the node and edge shapes every mesh surface
 * speaks in.
 *
 * These lived in `MeshStudio.svelte`'s script block, which made them cost an
 * 1,800-line component import to name a type, and created a cycle: `MeshStudio`
 * value-imports `./mesh-metrics.js` while `mesh-metrics.ts` type-imported
 * `StudioNode` back out of `MeshStudio.svelte`. A component is a poor home for
 * types that 16 other modules need, so they live here instead.
 *
 * Mirrors the `canvas.types.ts` convention next door in `primitives/`.
 */
import type { MeshNodeType, NodeState, EdgeStyle, Port } from '../primitives/canvas/canvas.types.js';
import type { TangentFrame } from '../physics/sphere.js';

export interface StudioNode {
	id: string;
	type: MeshNodeType;
	state: NodeState;
	label: string;
	x: number;
	y: number;
	r?: number;
	value?: string;
	valueLabel?: string;
	liveSlot?: string;
	portFlow?: Record<string, { active: boolean; flowRate: number }>;
	popDelay?: number;
	customShapeId?: string;
	iconMarkup?: string;
	iconKey?: string;
	/** Whether the glyph IS the node body (sampled to a silhouette that edges
	 *  ray-cast onto), or sits nested inside a plain disc.
	 *  Body is reserved for the two *container* glyphs — the mesh-server crest
	 *  and the multi-mode agent plate; a container's shape carries meaning, so
	 *  it earns its own outline. Leaf icons (single modes, tools) are ringed:
	 *  the disc is the boundary and the glyph is just cargo.
	 *  Defaults to false; multi-mode agents are promoted automatically. */
	glyphAsBody?: boolean;
	strokeColor?: string;
	fillColor?: string;
	/** Overrides the type's default port template (e.g. a per-spoke hub ring). */
	ports?: Port[];
	/** Ports terminate edges but are not drawn and cannot be dragged from. For a node
	 *  that STANDS FOR several others (a collapsed stack): each thing it represents
	 *  keeps its own port and its own line, but there is no single peer behind any
	 *  one of them to link to, so drawing from one would be ambiguous. Unfold it
	 *  first. Their angles are offsets from the far end's bearing, so the fan faces
	 *  whatever each line links to. */
	portsLocked?: boolean;
	/** Modes this agent runs. >1 → renders as the agent container (glyph should
	 *  be AGENT_GLYPH) with the individual modes shown as facets around it. */
	modes?: string[];
	/** The agent's mode, rendered inside the disc beneath the glyph — what the
	 *  node *does*, where `label` is what it's *called*. Singular and display-only;
	 *  `modes` above is the fan-out set. */
	mode?: string;
	/** Multi-mode fan-out state: false = mode icons collapsed onto the node,
	 *  true = spread out as satellites with spokes. */
	expanded?: boolean;
	/** Radius of ONE fanned-out mode satellite, in the same pre-scale units as
	 *  `r`. A fan-out is the agent's modes shown as the nodes they would be if
	 *  they stood on the mesh alone, so a caller with single-mode nodes on the
	 *  same canvas passes their radius and the two match. Defaults to a fraction
	 *  of the plate, which is only right when nothing else is there to compare. */
	facetR?: number;
	/** Per-mode traffic level (0..1), parallel to `modes`. Drives the spoke flow
	 *  when expanded and the outline energy-trace when collapsed. */
	modeFlows?: number[];
	/** Overall node traffic level (0..1). Drives the outline energy-trace for
	 *  ANY node (single- or multi-mode) that's handling traffic. */
	flow?: number;
	/** When this node rolls up multiple things, render offset silhouette "planes"
	 *  behind it — one per colour — to convey layered multiplicity. */
	stackColors?: string[];
	/** How many things this node STANDS FOR. Read only when connection arcs are
	 *  off: the arcs convey multiplicity by drawing one ring + dot per link, which
	 *  is legible at a handful and a solid halo at a hundred. With them off the
	 *  node states the number instead — one numeral regardless of size, so the
	 *  cost of saying "78" is the same as saying "3". */
	count?: number;
	/** The node is a fold of several others and draws a "+" toggle; clicking it
	 *  calls MeshStudio's `onFoldToggle` so the caller can unfold it. Replaces the
	 *  multi-mode fan toggle — with `onFoldToggle` set, that one reports too. */
	foldable?: boolean;
	/** The node this one came out of (the fold it was unfolded from). A new node
	 *  naming one starts on that node's last position instead of a fresh seed. */
	bornFrom?: string;
	/** How many of those `count` things are in a bad state. Drawn as a dedicated
	 *  always-on-top pip, NOT as a share of the ratio ring: 3-of-78 is a 14° arc
	 *  nobody sees, and "something here is broken" is the highest-priority fact
	 *  the node can carry. Proportion and alarm are different questions, so they
	 *  get different channels — only one of them is allowed to be subtle. */
	fault?: number;
	/** Drawn, but not clickable or hoverable — the pointer passes straight
	 *  through to whatever is behind it.
	 *
	 *  For a node the viewer can SEE but should not be able to reach: on the mesh
	 *  globe, the far side of the sphere is visible through the surface, and
	 *  clicking a node that is behind a solid object should not select it. Being
	 *  visible and being reachable are different things, and depth is not the
	 *  only reason they might part company — hence a plain flag rather than
	 *  anything the layer infers for itself. */
	inert?: boolean;
	/** Draw this node as a SOLID standing on the mesh instead of a disc lying on
	 *  it — a token on a board. Names a shape in `pieces.ts`.
	 *
	 *  A piece replaces the whole body: silhouette, fill, glyph, port arcs. Those
	 *  are all ways of decorating a flat marker, and a marker is exactly what this
	 *  stops being. The rings, label and readout around it are untouched, so a
	 *  piece is a change of body and not a change of node. */
	piece?: string;
	/** The local frame a `piece` stands in — see physics/sphere `tangentFrame`.
	 *  Supplied by whoever knows the geometry (MeshCanvas on the globe); without
	 *  one there is no up, so the piece is skipped and the disc is drawn. */
	frame?: TangentFrame;
	/** The ground around a `piece`, as screen offsets from the node, each
	 *  flagged nearer to the viewer than the node or not. The near side draws
	 *  OVER the piece, which is what buries its footings. */
	ground?: { x: number; y: number; near: boolean }[];
	/** How deep a `piece` sits in that ground, in node radii. */
	sink?: number;
	/** Colour of the land a `piece` stands in, so its lines can leave the ground
	 *  as ground before becoming its own. */
	groundColor?: string;
	/** Fade this node, 0..1. MULTIPLIED with whatever the layer's own dimming
	 *  decides (flow steps, selection), never replacing it.
	 *
	 *  For a caller that knows something about distance the layer can't: on the
	 *  mesh globe, the far side has to recede or the globe reads as a flat ring
	 *  of discs — no fill behind the nodes can achieve that, because the thing
	 *  that needs to be occluded is the nodes themselves. */
	opacity?: number;
	/** Blur this node, in world px (so it scales with zoom, like everything else
	 *  the layer draws).
	 *
	 *  Depth of field: fading alone says a node is faint, blur says it is not on
	 *  the plane you are looking at. Together they read as distance rather than
	 *  as a styling choice. Dropped on low perf tiers — a blur per node is the
	 *  most expensive thing here, and it is the first thing worth losing. */
	blur?: number;
}

/**
 * The land on the NEAR side of a globe, as it stands between the eye and the
 * lines running through the sphere's interior — in world coordinates, the same
 * space nodes are placed in.
 *
 * Every link on a globe is a chord through the interior, which is where the
 * crest sits; this is what lets the lines be buried by terrain the way the crest
 * is, instead of drawing through solid ground.
 */
export interface LandOcclusion {
	/** Each near-side region at the outer edge of its shore. */
	outer: [number, number][][];
	/** Each near-side region where it is fully land. */
	inner: [number, number][][];
	/**
	 * Where a front-facing node stands. A line is clear this close to its node
	 * whatever it passes under: every node stands on land, so without these the
	 * last stretch of every link would be buried and the mesh would read as
	 * disconnected.
	 */
	clear: { x: number; y: number; r: number }[];
}

export interface StudioEdge {
	id: string;
	from: string;
	fromPort?: string;
	to: string;
	toPort?: string;
	dataType?: string;
	/** Transmission-status treatment — colour + dash + motion. */
	style?: EdgeStyle;
	/** Health of the link. */
	edgeState?: NodeState;
	/** Enables particle stream when no explicit style is set. */
	active?: boolean;
	particleCount?: number;
	/** Signal strength 0..1. Drives the node's connection-arc length, and the
	 *  line's weight/opacity — a strong link reads heavier than a trickle. */
	sig?: number;
	/** Protocol / purpose shown in a pill on the line (e.g. `Agent Line · config.push`).
	 *  A link's colour says what kind it is; this says what's actually crossing it. */
	label?: string;
}
