<script lang="ts">
	// ── MeshStudio — interactive operational mesh canvas ────────────────────────
	// A layer inside a shared <Canvas> for EDITABLE meshes: drag nodes, draw links
	// from any port, closest-port auto-routing, parametric/glyph silhouettes,
	// multi-mode agent fan-out, and live tuning.
	//
	// For PASSIVE diagrams — architecture graphs, ambient/marketing mesh vizzes —
	// use `primitives/GraphLayer.svelte` instead. Both are sibling layers on the
	// same Canvas camera and share canvas.types + canvas-ports + glyph-sample; edge
	// COLOURS differ by design (MeshStudio live tuning, GraphLayer fixed palette).
	import { getContext, onMount } from 'svelte';
	import { CANVAS_CTX } from '../primitives/canvas-camera.js';
	import type { CanvasContextValue } from '../primitives/canvas-camera.js';
	import type { MeshNodeType, NodeState, EdgeStyle, Port } from '../primitives/canvas.types.js';
	import { MESH_NODE_COLOR, MESH_NODE_FILL, MESH_NODE_LABEL, DATA_TYPE_COLOR, EDGE_STYLE_DASH, EDGE_STATE_DASH } from '../primitives/canvas.types.js';
	import { getPortsForType, portSegments } from '../primitives/canvas-ports.js';
	import { shapeForType, withState, silhouettePath, boundaryPoint, shapeArcPath } from './node-shapes.js';
	import type { ShapeConcept, ShapeSpec } from './node-shapes.js';
	import { CUSTOM_SHAPES } from './custom-shapes.js';
	import { sampleOutline, sampleMarkup, boundaryFromBins, binsArcPath, binsSilhouette, type SampledShape } from './glyph-sample.js';
	import { glyphForMode, labelForMode } from '../icons/mode-tool-icons.js';
	import NodePiece from './pieces/NodePiece.svelte';
	import { ALL_PIECES } from './pieces/piece-catalogue.js';
	import type { TangentFrame } from '../physics/sphere.js';
	import { placeChips, CHIP_TS } from './layout/chip-placement.js';
	import type { ChipBox, ChipCandidate, Blocker } from './layout/chip-placement.js';
	import { flowDepthColor } from './flow-topology.js';
	import { perfBudget } from '../perf/budget.svelte.js';
	import { DEFAULT_TUNING, type MeshTuning } from './layout/mesh-tuning.js';
	import {
		ARC_GAP,
		arcGeom,
		labelBox,
		outerR as rimR,
		silhouetteR,
		nodeR as metricNodeR,
	} from './layout/mesh-metrics.js';
	import type { StudioNode, StudioEdge } from './studio.types.js';

	let {
		concept,
		nodes = $bindable([]),
		edges = $bindable([]),
		raisedEdgeIds = [],
		selectedId = $bindable(null),
		flowActive = false,
		flowStep = null,
		tuning = DEFAULT_TUNING,
		showGrid = true,
		allowNodeDrag = true,
		allowLinkDraw = true,
		edgeCurve = 'line',
		insetLeafLabels = false,
		unselectedDim = 0.62,
		glBodies = false,
		typeLabels = true,
		labelScale = 1,
		depthSortedParticles = false,
		onSelect,
		onLink,
		onFacetSelect,
		onNodeHover,
	}: {
		concept: ShapeConcept;
		nodes: StudioNode[];
		edges: StudioEdge[];
		/** Edges painted ABOVE the nodes instead of beneath them. Edges are otherwise
		 *  drawn first, so a link between two distant nodes disappears under every
		 *  node it passes; raising one keeps a link the operator just made visible
		 *  across the whole canvas. */
		raisedEdgeIds?: string[];
		selectedId?: string | null;
		flowActive?: boolean;
		flowStep?: number | null;
		tuning?: MeshTuning;
		/** Background grid. Off for ambient / marketing canvases. */
		showGrid?: boolean;
		/** Node dragging. Off for passive canvases that only select + hover. */
		allowNodeDrag?: boolean;
		/** Port-to-port link drawing. Off for read-only meshes. */
		allowLinkDraw?: boolean;
		/** 'line' = straight port-to-port · 'bezier' = horizontal-eased curve ·
		 *  'bow' = quadratic bowed perpendicular to the link, so two nodes joined by
		 *  several links fan apart instead of overprinting. */
		edgeCurve?: 'line' | 'bezier' | 'bow';
		/** For ringed leaf-icon nodes that carry a value, draw a smaller glyph and
		 *  stack the label + value INSIDE the disc instead of below it. Used by the
		 *  overview globe so every mode reads as a self-contained token. */
		insetLeafLabels?: boolean;
		/** How far a node unrelated to the selection is faded, 0..1.
		 *
		 *  1 leaves the mesh untouched. Low values make selection read as isolation:
		 *  right when the neighbours are context you are finished with, wrong when
		 *  they are the answer to "where am I" — which is what they are on a globe
		 *  the camera has just flown you across. */
		unselectedDim?: number;
		/** A GL layer is drawing the solids, so don't draw them here.
		 *
		 *  Only the BODY is withheld. The hit proxy, caption and beacon stay, because
		 *  they are the parts that must be pointed at, read by a screen reader, or
		 *  laid out against other text — none of which a GPU does for free. */
		glBodies?: boolean;
		/** Scale the node NAME relative to everything else in the disc.
		 *
		 *  The default sizing assumes a mesh label is a short code (`DEP·ANALYSIS`)
		 *  sitting above a readout that is the point of the node. A layer whose
		 *  labels ARE the content — a roadmap initiative — needs the opposite
		 *  emphasis, and scaling it here keeps the wrap, the chord and the readout
		 *  offsets all consistent with the new size. */
		labelScale?: number;
		/** Print the node's TYPE above its name (`AGENTIC`, `PROXY`, …).
		 *
		 *  That taxonomy is the mesh's own, so a layer borrowing these silhouettes
		 *  to stand for something else — a roadmap initiative, say — would be
		 *  labelling every node with a word that means nothing in its domain. */
		typeLabels?: boolean;
		/** Give edge particles the same paint depth as their line. By default the
		 *  particle stream is drawn ABOVE every node so energy is never occluded; on
		 *  the globe that floats back-of-sphere energy over the near nodes. When set,
		 *  base-edge particles paint behind the nodes (raised-edge particles still
		 *  ride on top), so energy weaves through depth like the static web does. */
		depthSortedParticles?: boolean;
		onSelect?: (id: string | null) => void;
		onLink?: (edge: StudioEdge) => void;
		/** A fanned-out mode facet was clicked. `index` is the facet's occurrence
		 *  among same-mode facets (0-based), for instance-precise targeting. */
		onFacetSelect?: (nodeId: string, mode: string, index: number) => void;
		/** Hover enter/leave with the cursor position in layer-local screen space,
		 *  so a parent can float a card next to it. Null on leave. */
		onNodeHover?: (id: string | null, screenPos: { x: number; y: number } | null) => void;
	} = $props();

	// ── Perf tiers × tuning switches ─────────────────────────────────────────────
	// The mesh is the heaviest thing on any page that hosts it, so it is also what
	// pays for the FPS sampling that sets its own quality tier. Reference-counted:
	// several canvases (or the perf panel) can hold it open at once.
	onMount(() => perfBudget.start());

	const tier = $derived(perfBudget.tier);
	const showFilters = $derived(tier === 'full' && tuning.glow);
	const showAnimate = $derived(tier !== 'minimal' && tuning.animate);
	const maxParticles = $derived(
		tier === 'minimal' || !tuning.animate || !tuning.particles ? 0 : tuning.particleCount,
	);

	// ── Camera (shared Canvas context) ───────────────────────────────────────────
	// MeshStudio is a layer inside <Canvas>: Canvas owns pan/zoom and publishes the
	// transform; this layer only reads it (and does node-drag / link-draw).
	const ctx = getContext<CanvasContextValue>(CANVAS_CTX);
	const transform = ctx.transform;
	let svgEl = $state<SVGSVGElement | undefined>();

	function toCanvas(clientX: number, clientY: number) {
		const rect = svgEl!.getBoundingClientRect();
		return {
			x: (clientX - rect.left - transform.tx) / transform.tk,
			y: (clientY - rect.top - transform.ty) / transform.tk,
		};
	}

	// Publish node positions + bounds so the shared camera (fit-to-view) and Minimap
	// work. Getters read live positions, so this only re-registers on add/remove.
	const boundsId = Symbol();
	$effect(() => {
		for (const n of nodes) ctx.nodePositions.set(n.id, () => {
			const nn = nodeById.get(n.id);
			return nn ? { x: nn.x, y: nn.y } : null;
		});
		ctx.boundsRegistry.set(boundsId, () => {
			if (!nodes.length) return null;
			let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
			for (const n of nodes) {
				const rr = nodeR(n) + 20;
				minX = Math.min(minX, n.x - rr); minY = Math.min(minY, n.y - rr);
				maxX = Math.max(maxX, n.x + rr); maxY = Math.max(maxY, n.y + rr);
			}
			return { minX, minY, maxX, maxY };
		});
		const ids = nodes.map((n) => n.id);
		return () => {
			ctx.boundsRegistry.delete(boundsId);
			for (const id of ids) ctx.nodePositions.delete(id);
		};
	});

	// ── Interaction state ───────────────────────────────────────────────────────
	let hoveredId = $state<string | null>(null);

	type DragState = { id: string; ox: number; oy: number; sx: number; sy: number; moved: boolean };
	let drag = $state<DragState | null>(null);

	type LinkState = { fromId: string; fromPort: string; cx: number; cy: number };
	let link = $state<LinkState | null>(null);

	const nodeById = $derived(new Map(nodes.map((n) => [n.id, n])));

	// Raised edges are lifted out of the base pass and re-rendered after the nodes,
	// so SVG paint order puts them on top. Both passes keep the source order of
	// `edges`, so raising an edge changes only its depth, never its styling.
	const raisedSet = $derived(new Set(raisedEdgeIds));
	const baseEdges = $derived(edges.filter((e) => !raisedSet.has(e.id)));
	const raisedEdges = $derived(edges.filter((e) => raisedSet.has(e.id)));

	// ── Edge label placement ────────────────────────────────────────────────────
	// The solver lives in ./chip-placement.ts — it is the most expensive thing this
	// component does and the only part of it that is pure, so it is tested there
	// against a naive reference rather than eyeballed here. What stays in the
	// component is the geometry only it knows: how wide a chip renders, and where a
	// node's body and caption sit.
	//
	// Resolved over `edges` (not per-pass), so a raised chip and a base chip cannot
	// collide.

	function chipWidth(e: StudioEdge): number {
		return `${e.label}  ${sigBars(edgeSig(e))}`.length * 3.9 + 12;
	}

	// Every node's body and caption, as obstacles. Sized from mesh-metrics, so a chip
	// dodges what the node actually DRAWS — rings, satellites and all — not its disc.
	const nodeBlockers = $derived.by((): Blocker[] => {
		const out: Blocker[] = [];
		for (const n of nodes) {
			const conns = (nodeConns.get(n.id) ?? []).length;
			const arcs = showConnArcs(n);
			out.push({
				kind: 'disc',
				x: n.x,
				y: n.y,
				r: silhouetteR(n, { radiusScale: tuning.radiusScale, connCount: conns, showArcs: arcs }),
			});
			const { halfW, reach } = labelBox(n);
			if (!halfW) continue;
			const rim = rimR(nodeR(n), conns, arcs);
			out.push({
				kind: 'box',
				box: { x: n.x, y: n.y + rim + reach / 2, w: halfW * 2, h: reach },
			});
		}
		return out;
	});

	const chipPlacements = $derived.by(() => {
		if (!tuning.edgeLabels) return new Map<string, ChipBox>();
		// The ladder tries every offset against the same handful of positions along
		// the line, so those points are resolved ONCE per edge here rather than up to
		// 56 times inside the solver.
		const candidates: ChipCandidate[] = [];
		for (const e of edges) {
			if (!e.label) continue;
			const nrm = edgeNormal(e);
			candidates.push({
				id: e.id,
				w: chipWidth(e),
				nx: nrm.nx,
				ny: nrm.ny,
				pts: CHIP_TS.map((t) => edgePointAt(e, t))
			});
		}
		return placeChips(candidates, nodeBlockers);
	});

	// Ports resolve from a per-node override when present, else the type template.
	function nodePorts(n: StudioNode): Port[] {
		return n.ports ?? getPortsForType(n.type);
	}
	function nodeFindPort(n: StudioNode, portId: string): Port | undefined {
		return nodePorts(n).find((p) => p.id === portId);
	}

	/** A ringed leaf icon's glyph spans this fraction of the disc DIAMETER —
	 *  the mockup's 64px glyph inside a 156px disc. */
	const GLYPH_FRAC = 0.41;

	/** Wrap a caption to the chord available at its baseline, greedily by word.
	 *  Approximates mono advance at ~0.6em. Never truncates — a mode name that
	 *  doesn't fit on one line stacks onto the next. */
	function wrapText(s: string, fontSize: number, chord: number, maxLines = 2): string[] {
		const max = Math.max(4, Math.floor(chord / (fontSize * 0.6)));
		if (s.length <= max) return [s];
		const lines: string[] = [];
		let cur = '';
		for (const w of s.split(' ')) {
			const next = cur ? `${cur} ${w}` : w;
			if (next.length <= max) { cur = next; continue; }
			if (cur) lines.push(cur);
			cur = w;
		}
		if (cur) lines.push(cur);
		if (lines.length <= maxLines) return lines;
		// Over budget: truncate the last line with an ellipsis rather than dropping
		// the tail. Stopping early is silent — "Federated mesh view" renders as
		// "Federated mesh", which is a DIFFERENT name and nothing on screen says so.
		const kept = lines.slice(0, maxLines);
		kept[maxLines - 1] = `${kept[maxLines - 1].slice(0, Math.max(1, max - 1)).trimEnd()}…`;
		return kept;
	}

	// Geometry lives in mesh-metrics so the layout pass sizes nodes exactly the way
	// this draws them; the local binding just closes over live tuning.
	function nodeR(n: StudioNode): number {
		return metricNodeR(n, tuning.radiusScale);
	}
	function specFor(n: StudioNode): ShapeSpec {
		// A ringed icon's disc is a container, not a signifier — the glyph inside
		// says what the node is, so the ring stays a true circle for every type
		// rather than picking up the type's squircle/facet/notch treatment.
		const base = isRingedIcon(n) ? { kind: 'disc' as const } : shapeForType(concept, n.type);
		return withState(base, n.state);
	}

	// ── Custom (arbitrary-SVG) silhouettes — sampled to angle→radius maps ─────────
	let sampled = $state<Record<string, SampledShape>>({});

	/** Container glyphs earn a sampled silhouette; leaf icons ride inside a disc.
	 *  A custom shape is a silhouette by definition, and a multi-mode agent is a
	 *  container whether or not the caller says so. */
	function glyphIsBody(n: StudioNode): boolean {
		if (n.customShapeId) return true;
		if (n.modes && n.modes.length > 1) return true;
		return n.glyphAsBody ?? false;
	}
	/** Leaf icon — glyph nested inside the disc rather than becoming it. */
	function isRingedIcon(n: StudioNode): boolean {
		return !!n.iconMarkup && !glyphIsBody(n);
	}
	// Only body glyphs get sampled — a ringed icon has no key, so every downstream
	// `cs ? sampled-path : shape-path` branch resolves to the plain disc for free.
	function shapeKey(n: StudioNode): string | undefined {
		return glyphIsBody(n) ? (n.customShapeId ?? n.iconKey) : undefined;
	}
	$effect(() => {
		if (typeof document === 'undefined') return;
		const next = { ...sampled };
		let changed = false;
		for (const n of nodes) {
			const key = shapeKey(n);
			if (key && !next[key]) {
				if (n.customShapeId && CUSTOM_SHAPES[n.customShapeId]) {
					next[key] = sampleOutline(CUSTOM_SHAPES[n.customShapeId].outline);
					changed = true;
				} else if (n.iconMarkup) {
					next[key] = sampleMarkup(n.iconMarkup);
					changed = true;
				}
			}
			// Multi-mode agents fan out to full-size mode nodes — sample each mode
			// glyph (shared with single-mode nodes' `glyph-<mode>` silhouettes).
			if (n.modes && n.modes.length > 1) {
				for (const m of n.modes) {
					const fk = `glyph-${m}`;
					if (next[fk]) continue;
					next[fk] = sampleMarkup(glyphForMode(m));
					changed = true;
				}
			}
		}
		if (changed) sampled = next;
	});
	function sampleFor(n: StudioNode): SampledShape | undefined {
		const key = shapeKey(n);
		return key ? sampled[key] : undefined;
	}
	function facetSample(mode: string): SampledShape | undefined {
		return sampled[`glyph-${mode}`];
	}
	/** Unified boundary point — works for parametric shapes and sampled outlines. */
	function boundaryFor(n: StudioNode, angleDeg: number, r: number): { dx: number; dy: number } {
		const s = sampleFor(n);
		if (s) return boundaryFromBins(s, angleDeg, r);
		return boundaryPoint(specFor(n), angleDeg, r);
	}
	function angleTo(from: StudioNode, px: number, py: number): number {
		return (Math.atan2(py - from.y, px - from.x) * 180) / Math.PI;
	}

	// ── Edge geometry — attaches on the silhouette boundary ──────────────────────
	function attachPort(n: StudioNode, port: Port): { x: number; y: number } {
		const off = boundaryFor(n, port.angle, nodeR(n));
		return { x: n.x + off.dx, y: n.y + off.dy };
	}
	function attach(nodeId: string, portId: string | undefined): { x: number; y: number } {
		const n = nodeById.get(nodeId);
		if (!n) return { x: 0, y: 0 };
		if (!portId) return { x: n.x, y: n.y };
		const port = nodeFindPort(n, portId);
		return port ? attachPort(n, port) : { x: n.x, y: n.y };
	}
	function attachTowards(n: StudioNode, px: number, py: number): { x: number; y: number } {
		const off = boundaryFor(n, angleTo(n, px, py), nodeR(n));
		return { x: n.x + off.dx, y: n.y + off.dy };
	}
	// Smallest absolute angle between two bearings (deg).
	function angGap(a: number, b: number): number {
		const d = Math.abs((((a - b) % 360) + 360) % 360);
		return Math.min(d, 360 - d);
	}
	// The control point on `n` closest to (px,py) — the port whose bearing best
	// lines up with the direction to the target. For connectivity, EVERY port is a
	// valid attachment base (in/out role is a data-flow concept, not a wiring one),
	// so all control points are eligible — not just the in- or out-facing ones.
	function nearestPort(n: StudioNode, px: number, py: number): Port | undefined {
		const ports = nodePorts(n);
		if (!ports.length) return undefined;
		const bearing = angleTo(n, px, py);
		let best = ports[0];
		let bestGap = angGap(best.angle, bearing);
		for (let i = 1; i < ports.length; i++) {
			const g = angGap(ports[i].angle, bearing);
			if (g < bestGap) {
				best = ports[i];
				bestGap = g;
			}
		}
		return best;
	}
	function edgeEndpoints(e: StudioEdge): { a: { x: number; y: number }; b: { x: number; y: number } } | null {
		const A = nodeById.get(e.from);
		const B = nodeById.get(e.to);
		if (!A || !B) return null;
		// An explicitly pinned port (e.g. a user-drawn line) stays put; otherwise
		// the endpoint snaps to whichever control point is closest to the other node
		// — so links re-route live as nodes move around the canvas.
		const aPort = e.fromPort ? nodeFindPort(A, e.fromPort) : nearestPort(A, B.x, B.y);
		const bPort = e.toPort ? nodeFindPort(B, e.toPort) : nearestPort(B, A.x, A.y);
		const a = aPort ? attachPort(A, aPort) : attachTowards(A, B.x, B.y);
		const b = bPort ? attachPort(B, bPort) : attachTowards(B, A.x, A.y);
		return { a, b };
	}
	/** Bow height as a fraction of the link's length — a constant would flatten long
	 *  links and over-arc short ones. Clamped so neither extreme runs away. */
	function bowControl(a: { x: number; y: number }, b: { x: number; y: number }) {
		const dx = b.x - a.x;
		const dy = b.y - a.y;
		const len = Math.hypot(dx, dy) || 1;
		const bow = Math.max(12, Math.min(46, len * 0.12));
		// unit normal to the link
		return { cx: (a.x + b.x) / 2 + (-dy / len) * bow, cy: (a.y + b.y) / 2 + (dx / len) * bow };
	}
	/** Four-slot signal meter, mirroring the mockup's ▮▯ bars. */
	function sigBars(sig: number): string {
		const on = Math.round(sig * 4);
		return '▮'.repeat(on) + '▯'.repeat(4 - on);
	}

	/** Unit normal of a link — used to push the label pill off the line so it
	 *  doesn't collide with the midpoint marker sitting there. */
	function edgeNormal(e: StudioEdge): { nx: number; ny: number } {
		const ep = edgeEndpoints(e);
		if (!ep) return { nx: 0, ny: -1 };
		const dx = ep.b.x - ep.a.x;
		const dy = ep.b.y - ep.a.y;
		const len = Math.hypot(dx, dy) || 1;
		return { nx: -dy / len, ny: dx / len };
	}

	/** A point along a link at parameter t. For a bow this evaluates the quadratic
	 *  properly, so anything pinned to the line actually sits on it. */
	function edgePointAt(e: StudioEdge, t: number): { x: number; y: number } | null {
		const ep = edgeEndpoints(e);
		if (!ep) return null;
		if (edgeCurve !== 'bow') {
			return { x: ep.a.x + (ep.b.x - ep.a.x) * t, y: ep.a.y + (ep.b.y - ep.a.y) * t };
		}
		const { cx, cy } = bowControl(ep.a, ep.b);
		const u = 1 - t;
		return {
			x: u * u * ep.a.x + 2 * u * t * cx + t * t * ep.b.x,
			y: u * u * ep.a.y + 2 * u * t * cy + t * t * ep.b.y,
		};
	}
	/** The point a midpoint badge should sit on. */
	function edgeMid(e: StudioEdge): { x: number; y: number } | null {
		return edgePointAt(e, 0.5);
	}
	function edgePath(e: StudioEdge): string {
		const ep = edgeEndpoints(e);
		if (!ep) return '';
		if (edgeCurve === 'bow') {
			const { cx, cy } = bowControl(ep.a, ep.b);
			return `M ${ep.a.x} ${ep.a.y} Q ${cx} ${cy} ${ep.b.x} ${ep.b.y}`;
		}
		if (edgeCurve === 'bezier') {
			const dx = (ep.b.x - ep.a.x) * 0.4;
			return `M ${ep.a.x} ${ep.a.y} C ${ep.a.x + dx} ${ep.a.y} ${ep.b.x - dx} ${ep.b.y} ${ep.b.x} ${ep.b.y}`;
		}
		return `M ${ep.a.x} ${ep.a.y} L ${ep.b.x} ${ep.b.y}`;
	}

	// ── Edge transmission-status treatment (ported from GraphLayer) ──────────────
	function edgeStroke(e: StudioEdge): string {
		if (e.style) {
			switch (e.style) {
				case 'energy':    return tuning.energyColor;
				case 'pulse':     return 'rgba(34,211,238,0.22)';
				case 'dashed':    return 'rgba(255,255,255,0.35)';
				case 'degraded':  return tuning.degradedColor;
				case 'blocked':   return tuning.offlineColor;
				case 'latent':    return 'rgba(255,255,255,0.18)';
				case 'scanning':  return 'rgba(56,189,248,0.5)';
				case 'encrypted': return 'rgba(110,231,183,0.5)';
			}
		}
		if (e.edgeState === 'degraded') return tuning.degradedColor;
		if (e.edgeState === 'offline')  return tuning.offlineColor;
		if (e.dataType) return DATA_TYPE_COLOR[e.dataType as keyof typeof DATA_TYPE_COLOR] ?? 'var(--border-strong)';
		return 'var(--border-strong)';
	}
	// A chip's ink is the edge's colour at FULL strength. edgeStroke bakes alpha into
	// several styles so a line can read as a trickle, but a label is text: inherit
	// that alpha and the chip renders as unreadable dim-on-dark. The line stays
	// translucent; only the pill that annotates it goes solid.
	function edgeChipColor(e: StudioEdge): string {
		if (e.style) {
			switch (e.style) {
				case 'pulse':     return 'rgb(34,211,238)';
				case 'dashed':    return 'rgba(255,255,255,0.9)';
				case 'latent':    return 'rgba(255,255,255,0.75)';
				case 'scanning':  return 'rgb(56,189,248)';
				case 'encrypted': return 'rgb(110,231,183)';
			}
		}
		return edgeStroke(e);
	}
	function edgeDash(e: StudioEdge): string {
		if (e.style) return EDGE_STYLE_DASH[e.style] ?? 'none';
		if (e.edgeState === 'degraded') return EDGE_STATE_DASH.degraded;
		if (e.edgeState === 'offline')  return EDGE_STATE_DASH.offline;
		return 'none';
	}
	function edgeClass(e: StudioEdge): string {
		if (!showAnimate) return '';
		if (e.style === 'degraded' || e.edgeState === 'degraded') return 'ms-edge-degraded';
		if (e.edgeState === 'offline') return 'ms-edge-offline';
		return '';
	}
	function isStateEdge(e: StudioEdge): boolean {
		return !!e.edgeState || e.style === 'degraded' || e.style === 'blocked';
	}
	function hasBadge(e: StudioEdge): boolean {
		return e.edgeState === 'degraded' || e.edgeState === 'offline' || e.style === 'degraded' || e.style === 'blocked';
	}
	function isParticleEdge(e: StudioEdge): boolean {
		return e.style === 'energy' || (!e.style && !!e.active && !e.edgeState);
	}
	function particleId(e: StudioEdge): string { return `ms-ep-${e.id.replace(/\W/g, '')}`; }
	function particleColor(e: StudioEdge): string {
		return e.dataType ? DATA_TYPE_COLOR[e.dataType as keyof typeof DATA_TYPE_COLOR] : '#22D3EE';
	}
	function particleDur(e: StudioEdge): number {
		const ep = edgeEndpoints(e);
		if (!ep) return 2.5;
		const dx = ep.b.x - ep.a.x, dy = ep.b.y - ep.a.y;
		return Math.max(1.8, Math.min(5, (Math.sqrt(dx * dx + dy * dy) * 1.6) / 120)) / tuning.particleSpeed;
	}
	function needsMotionPath(e: StudioEdge): boolean {
		return e.style === 'energy' || e.style === 'scanning' || e.style === 'pulse' || isParticleEdge(e);
	}

	// ── Flow topology (longest-path BFS over the current edges) ──────────────────
	const flow = $derived.by(() => {
		if (!flowActive) return null;
		const inDeg = new Map<string, number>();
		nodes.forEach((n) => inDeg.set(n.id, 0));
		edges.forEach((e) => inDeg.set(e.to, (inDeg.get(e.to) ?? 0) + 1));
		const depth = new Map<string, number>();
		const rem = new Map(inDeg);
		const q: string[] = [];
		for (const [id, d] of inDeg) if (d === 0) { depth.set(id, 0); q.push(id); }
		while (q.length) {
			const c = q.shift()!;
			const cd = depth.get(c) ?? 0;
			for (const e of edges.filter((e) => e.from === c)) {
				if (cd + 1 > (depth.get(e.to) ?? -1)) depth.set(e.to, cd + 1);
				const r = (rem.get(e.to) ?? 1) - 1;
				rem.set(e.to, r);
				if (r <= 0) q.push(e.to);
			}
		}
		nodes.forEach((n) => { if (!depth.has(n.id)) depth.set(n.id, 0); });
		const edgeDepth = new Map<string, number>();
		edges.forEach((e) => edgeDepth.set(e.id, depth.get(e.from) ?? 0));
		const sources = new Set(nodes.filter((n) => (inDeg.get(n.id) ?? 0) === 0).map((n) => n.id));
		return { depth, edgeDepth, sources };
	});

	// ── Node chrome helpers ──────────────────────────────────────────────────────
	function aggFlowRate(n: StudioNode): number {
		const a = Object.values(n.portFlow ?? {}).filter((s) => s.active);
		const portAvg = a.length ? a.reduce((s, x) => s + (x.flowRate ?? 0.5), 0) / a.length : 0;
		// A multi-mode agent's overall flow is the busiest mode it runs; any node can
		// also carry a direct `flow` (its own traffic level).
		const modeMax = n.modeFlows?.length ? Math.max(...n.modeFlows) : 0;
		return Math.max(portAvg, modeMax, n.flow ?? 0);
	}
	function sweepColor(n: StudioNode): string {
		return n.state === 'degraded' ? 'rgba(250,204,21,0.35)' : n.state === 'offline' ? 'rgba(248,113,113,0.25)' : 'rgba(95,234,213,0.4)';
	}
	/** Colour of the energy that flows along the node's own outline. */
	function activePortColor(n: StudioNode): string {
		for (const p of nodePorts(n)) {
			if (n.portFlow?.[p.id]?.active) return DATA_TYPE_COLOR[p.dataType];
		}
		return stroke(n);
	}
	function traceColor(n: StudioNode): string {
		if (n.state === 'degraded') return tuning.degradedColor;
		if (tuning.traceColorMode === 'fixed') return tuning.traceColor;
		return activePortColor(n);
	}
	function traceDur(n: StudioNode): number {
		// slow, gentle travel — higher flow = a little faster
		return Math.max(2, tuning.traceSpeed - aggFlowRate(n) * tuning.traceFlowBoost);
	}
	/** Whether to run the outline-following energy trace. */
	function showTrace(n: StudioNode): boolean {
		// The control-plane hub has its own radar sweep — no traffic trace on it.
		if (n.type === 'control-plane') return false;
		// A multi-mode agent never traces its own outline — the traffic belongs to
		// the child modes: their spokes when expanded, their badges when collapsed.
		if (n.modes && n.modes.length > 1) return false;
		return n.state !== 'offline' && (aggFlowRate(n) > 0 || n.state === 'degraded');
	}

	// ── Background interaction (pan/zoom are handled by the parent Canvas) ────────
	function onBgPointerDown(e: PointerEvent) {
		if ((e.target as Element).closest('[data-node]')) return;
		if (link) { cancelLink(); return; }
		// Deselect on empty-space press; the Canvas owns the pan gesture itself.
		selectedId = null;
		onSelect?.(null);
	}
	function onPointerMove(e: PointerEvent) {
		if (link) {
			const c = toCanvas(e.clientX, e.clientY);
			link = { ...link, cx: c.x, cy: c.y };
			return;
		}
		if (drag) {
			const c = toCanvas(e.clientX, e.clientY);
			const n = nodeById.get(drag.id);
			if (n) {
				n.x = drag.ox + (c.x - drag.sx);
				n.y = drag.oy + (c.y - drag.sy);
				if (Math.hypot(c.x - drag.sx, c.y - drag.sy) > 3) drag.moved = true;
			}
		}
	}
	function onPointerUp() {
		if (drag) {
			if (!drag.moved) { selectedId = drag.id; onSelect?.(drag.id); }
			drag = null;
		}
	}

	// ── Node body — drag / select ─────────────────────────────────────────────────
	function onNodePointerDown(e: PointerEvent, n: StudioNode) {
		e.stopPropagation();
		if (link) { completeLink(n, undefined); return; }
		// Drag disabled → the node is select-only; commit the selection on press.
		if (!allowNodeDrag) {
			selectedId = selectedId === n.id ? null : n.id;
			onSelect?.(selectedId);
			return;
		}
		const c = toCanvas(e.clientX, e.clientY);
		drag = { id: n.id, ox: n.x, oy: n.y, sx: c.x, sy: c.y, moved: false };
		svgEl?.setPointerCapture(e.pointerId);
	}

	// ── Hover — emit position in layer-local screen space for parent-drawn cards ──
	function emitHover(id: string | null, e?: MouseEvent) {
		hoveredId = id;
		if (!onNodeHover) return;
		if (id && e && svgEl) {
			const rect = svgEl.getBoundingClientRect();
			onNodeHover(id, { x: e.clientX - rect.left + 14, y: e.clientY - rect.top - 10 });
		} else {
			onNodeHover(null, null);
		}
	}

	// ── Port controls — start / complete a link ───────────────────────────────────
	function onPortPointerDown(e: PointerEvent, n: StudioNode, portId: string) {
		e.stopPropagation();
		if (!allowLinkDraw) return;
		if (link) { completeLink(n, portId); return; }
		// Any port is a valid start point — ports are connection bases, not
		// direction-locked sockets (in/out is a data-flow concept, not a wiring one).
		const c = toCanvas(e.clientX, e.clientY);
		link = { fromId: n.id, fromPort: portId, cx: c.x, cy: c.y };
		svgEl?.setPointerCapture(e.pointerId);
	}
	function completeLink(target: StudioNode, targetPort: string | undefined) {
		if (!link || target.id === link.fromId) { cancelLink(); return; }
		// Dropping on a specific port pins that end; dropping on the node body
		// leaves it unpinned so it snaps to the closest inlet (and re-routes on move).
		const toPort = targetPort;
		const src = nodeById.get(link.fromId);
		const srcPort = src ? nodeFindPort(src, link.fromPort) : undefined;
		const e: StudioEdge = {
			id: `e-${link.fromId}-${link.fromPort}-${target.id}-${toPort ?? 'auto'}-${edges.length}`,
			from: link.fromId, fromPort: link.fromPort, to: target.id, toPort,
			dataType: srcPort?.dataType, style: 'energy', active: true,
		};
		edges = [...edges, e];
		onLink?.(e);
		link = null;
	}
	function cancelLink() { link = null; }
	function onKey(e: KeyboardEvent) { if (e.key === 'Escape') cancelLink(); }

	// ── Presentation helpers ─────────────────────────────────────────────────────
	function stroke(n: StudioNode) { return n.strokeColor ?? MESH_NODE_COLOR[n.type]; }
	function fill(n: StudioNode) { return n.fillColor ?? MESH_NODE_FILL[n.type]; }

	// ── Connection arcs ──────────────────────────────────────────────────────────
	// Each link a node holds gets its own ring outside the disc: radius staggered so
	// they nest, arc length ∝ signal, coloured by the NEIGHBOUR so you can read who
	// a node talks to without tracing the line.
	/** Connection arcs answer "who does this node talk to" — which is worth drawing
	 *  for a leaf with a handful of links, and meaningless for the control plane,
	 *  which talks to everything. There the ring count is just the mesh size, and it
	 *  reads as a halo swallowing the crest. The hub reports its own scale in its
	 *  AGENTS readout instead. */
	/** A node standing as a SOLID on the globe's surface.
	 *
	 *  It takes BOTH: `piece` is the shape and `frame` is somewhere to stand, and
	 *  the flat arrangements withhold the frame rather than stripping the shape,
	 *  so this is the only honest test of "is this actually a building right now". */
	function isSolid(n: StudioNode): boolean {
		return !!(n.piece && n.frame);
	}

	/** Connection arcs — nested rings and orbit dots outside the rim.
	 *
	 *  Never around a solid, and this is the rule the globe was breaking. A ring
	 *  with dots riding on it IS a small globe with an orbit, and the container is
	 *  a globe with a graticule and dots on it — the same shape language at two
	 *  scales. Repeat a container's own vocabulary inside it and you delete the
	 *  one cue the eye uses to tell a level from the level above: everything reads
	 *  as the same kind of object, and the scene turns into a globe covered in
	 *  little globes.
	 *
	 *  A building has to be categorically NOT a sphere, which costs every ring
	 *  around it. Nothing is actually lost — the links already say what the arcs
	 *  said, and on a globe they are drawn as true 3D spokes that say it better. */
	function showConnArcs(n: StudioNode): boolean {
		return tuning.connArcs && n.type !== 'control-plane' && !isSolid(n);
	}

	/** Captions are set in a soft neutral, not in the world's hue.
	 *
	 *  Type is annotation ABOUT the scene, not another object in it. Setting it in
	 *  the same colour as the buildings makes it compete with them at equal weight,
	 *  and setting it in each node's own colour — which is what this used to do —
	 *  puts every mode's hue back on a globe that just spent a lot of effort
	 *  getting them off it. Labels were the loudest identity-coloured thing left.
	 *
	 *  State still outranks: a degraded or offline node says so in its caption too,
	 *  because that is the one thing worth reading before the name. */
	const LABEL_INK = '#C6D9E2';
	function labelInk(n: StudioNode): string {
		if (!tuning.worldHue) return stroke(n);
		return n.state === 'degraded'
			? tuning.degradedColor
			: n.state === 'offline'
				? tuning.offlineColor
				: LABEL_INK;
	}

	const nodeConns = $derived.by(() => {
		const m = new Map<string, StudioEdge[]>();
		for (const e of edges) {
			for (const id of [e.from, e.to]) {
				const list = m.get(id);
				if (list) list.push(e);
				else m.set(id, [e]);
			}
		}
		return m;
	});

	/** Signal for an edge — explicit when given, else inferred from its treatment. */
	function edgeSig(e: StudioEdge): number {
		if (e.sig !== undefined) return Math.max(0, Math.min(1, e.sig));
		if (e.style === 'latent') return 0.15;
		if (e.edgeState === 'offline' || e.style === 'blocked') return 0.2;
		if (e.edgeState === 'degraded' || e.style === 'degraded') return 0.4;
		return e.active ? 0.85 : 0.5;
	}

	/** An orbit dot reports the LINK's health, not the neighbour's identity — so a
	 *  severed link shows red even between two healthy nodes. */
	function connDotColor(e: StudioEdge, neighbourColor: string): string {
		if (e.edgeState === 'offline' || e.style === 'blocked') return tuning.offlineColor;
		if (e.edgeState === 'degraded' || e.style === 'degraded') return tuning.degradedColor;
		if (e.style === 'latent') return 'rgba(148,163,184,0.7)';
		return neighbourColor;
	}

	function neighbourOf(e: StudioEdge, id: string): StudioNode | undefined {
		return nodeById.get(e.from === id ? e.to : e.from);
	}
	function canReceive(n: StudioNode) { return !!link && link.fromId !== n.id; }
	function connectedToSel(n: StudioNode): boolean {
		return edges.some((e) => (e.from === selectedId && e.to === n.id) || (e.to === selectedId && e.from === n.id));
	}
	function nodeOpacity(n: StudioNode, isSel: boolean): number {
		// The caller's fade MULTIPLIES whatever this layer decides, rather than
		// replacing it. They answer different questions — the layer's is "is this
		// node relevant to what you're looking at", the caller's is "how far away
		// is it" — and a node that is both irrelevant AND distant should read as
		// both, not as whichever happened to be applied last.
		const dim = n.opacity ?? 1;
		if (flow) {
			const d = flow.depth.get(n.id);
			if (flowStep != null) return (d === flowStep ? 1 : d === undefined ? 0.1 : 0.2) * dim;
			return dim;
		}
		// Selecting one node quietens the rest — it does not switch them off.
		//
		// 0.28 was tuned when selection meant "read this ONE record", and the rest of
		// the mesh was context you were done with. On a globe it is the opposite: the
		// camera has just flown you somewhere, and the neighbours are how you know
		// WHERE — the region you landed in, what else stands in it, which way the
		// links run. Dim those to a quarter and the scene you were brought to see
		// goes with them, leaving one lit object on an empty ball.
		if (selectedId && !isSel && !connectedToSel(n)) return unselectedDim * dim;
		return dim;
	}
</script>

<svelte:window onkeydown={onKey} />

<!-- svelte-ignore a11y_no_static_element_interactions -->
<svg
	class="ms-svg"
	class:ms-linking={!!link}
	bind:this={svgEl}
	onpointerdown={onBgPointerDown}
	onpointermove={onPointerMove}
	onpointerup={onPointerUp}
	role="application"
	aria-label="Interactive mesh — {concept}"
	style:--hover-scale={tuning.hoverScale}
>
		<defs>
			<pattern id="ms-grid" width="40" height="40" patternUnits="userSpaceOnUse"
				patternTransform="translate({transform.tx},{transform.ty}) scale({transform.tk})">
				<path d="M 40 0 L 0 0 0 40" fill="none" stroke="var(--border)" stroke-width="0.5" />
			</pattern>
			<radialGradient id="ms-highlight" cx="35%" cy="35%" r="50%">
				<stop offset="0%" stop-color="rgba(255,255,255,0.22)" />
				<stop offset="100%" stop-color="rgba(255,255,255,0)" />
			</radialGradient>
			<filter id="ms-glow" x="-60%" y="-60%" width="220%" height="220%">
				<feGaussianBlur stdDeviation="3.5" result="b" /><feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
			</filter>
			<filter id="ms-glow-port" x="-200%" y="-200%" width="500%" height="500%">
				<feGaussianBlur stdDeviation="2" result="b" /><feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
			</filter>
			<filter id="ms-particle" x="-400%" y="-400%" width="900%" height="900%">
				<feGaussianBlur stdDeviation="1.6" result="b" /><feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
			</filter>
			<marker id="ms-arrow" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
				<path d="M0,0 L0,6 L8,3 z" fill="var(--border-strong)" opacity="0.75" />
			</marker>
			<marker id="ms-arrow-flow" markerWidth="7" markerHeight="7" refX="5" refY="3" orient="auto">
				<path d="M0,0 L0,6 L7,3 z" fill="#22D3EE" opacity="0.9" />
			</marker>
			<!-- invisible motion paths for particle edges — derived from the live edgePath -->
			{#each edges as e (e.id)}
				{#if needsMotionPath(e)}
					{@const d = edgePath(e)}
					{#if d}<path id={particleId(e)} {d} fill="none" stroke="none" />{/if}
				{/if}
			{/each}
		</defs>

		{#if showGrid}
			<rect width="100%" height="100%" fill="url(#ms-grid)" />
		{/if}

		<!-- One edge layer, rendered twice: once beneath the nodes for ordinary edges
		     and once above them for raised ones. Same snippet both times, so a raised
		     edge differs from a base edge only in paint depth. -->
		{#snippet edgeLayer(list: StudioEdge[])}
			<!-- Base edges — colour + dash + state glow -->
			{#each list as e (e.id)}
				{@const d = edgePath(e)}
				{@const st = isStateEdge(e)}
				{@const fd = flow ? flow.edgeDepth.get(e.id) : undefined}
				{@const sig = edgeSig(e)}
				{#if d}
					<!-- Signal scales weight and opacity: a strong link reads heavier than a
					     trickle. State edges keep a floor so a severed link stays legible. -->
					<path {d} fill="none" stroke={edgeStroke(e)}
						stroke-width={(st ? tuning.edgeWidth + 0.4 : tuning.edgeWidth) * (0.5 + sig * 0.8)}
						stroke-dasharray={edgeDash(e)} class={edgeClass(e)} stroke-linecap="round"
						marker-end={!tuning.arrowheads || e.style === 'latent' ? 'none' : 'url(#ms-arrow)'}
						filter={showFilters && st ? 'url(#ms-glow)' : 'none'}
						opacity={tuning.edgeOpacity * (
							flow ? (fd !== undefined ? 0.14 : 0.06)

							: selectedId ? (selectedId === e.from || selectedId === e.to ? 0.9 : unselectedDim * 0.45)
							: st ? 0.85 : e.style ? 0.35 + sig * 0.6 : 0.5
						)} />
				{/if}
			{/each}

			<!-- Edge label pills — protocol + signal meter, parked off the line so the
			     midpoint marker stays visible. Hidden while a flow is isolating steps. -->
			{#each list as e (e.id)}
				{#if e.label && !flow && tuning.edgeLabels}
					<!-- Position comes from chipPlacements, which resolves every label on the
					     canvas against every other. See the ladder above: a chip hugs its own
					     line and only moves as far as the crowding forces. -->
					{@const box = chipPlacements.get(e.id)}
					{#if box}
						{@const sig = edgeSig(e)}
						{@const txt = `${e.label}  ${sigBars(sig)}`}
						{@const dim = !!selectedId && selectedId !== e.from && selectedId !== e.to}
						{@const ink = edgeChipColor(e)}
						{@const anchor = edgePointAt(e, 0.68)}
						<g pointer-events="none" opacity={dim ? 0.1 : 1}>
							<!-- Leader back to the line. Once collision pushes a chip off its
							     natural spot, the chip alone no longer says which line it belongs
							     to — in a tight bundle that's exactly when it matters. -->
							{#if anchor}
								<line x1={anchor.x} y1={anchor.y} x2={box.x} y2={box.y}
									stroke={ink} stroke-width={0.6} opacity={0.4} />
							{/if}
							<g transform="translate({box.x},{box.y})">
								<rect x={-box.w / 2} y={-7} width={box.w} height={14} rx={7}
									fill="var(--bg)" stroke={ink} stroke-width={1} />
								<text class="ms-t" y={2.6} font-size={6} letter-spacing="0.08em" fill={ink}>{txt}</text>
							</g>
						</g>
					{/if}
				{/if}
			{/each}

			<!-- State-edge midpoint badges -->
			{#each list as e (e.id)}
				{#if hasBadge(e) || e.style === 'encrypted'}
					{@const mid = edgeMid(e)}
					{#if mid}
						<g transform="translate({mid.x},{mid.y})" pointer-events="none">
							{#if e.style === 'encrypted'}
								<!-- padlock — a secure link is solid, so the marker is what says so -->
								<circle r={8} fill="var(--bg)" stroke="rgba(110,231,183,0.9)" stroke-width={1.2} />
								<rect x={-3.2} y={-1.5} width={6.4} height={5} rx={1.2} fill="none" stroke="rgba(110,231,183,0.9)" stroke-width={1.2} />
								<path d="M-2 -1.5 V-3 a2 2 0 0 1 4 0 V-1.5" fill="none" stroke="rgba(110,231,183,0.9)" stroke-width={1.2} />
							{:else if e.edgeState === 'degraded' || e.style === 'degraded'}
								<polygon points="0,-8 8,6 -8,6" fill="var(--bg)" stroke="rgb(250,204,21)" stroke-width={1.2} stroke-linejoin="round" />
								<path d="M0 -2 L0 2 M0 3.5 L0 3.7" stroke="rgb(250,204,21)" stroke-width={1.4} stroke-linecap="round" />
							{:else}
								<circle r={8} fill="var(--bg)" stroke="rgb(248,113,113)" stroke-width={1.2} />
								<path d="M-3 -3 L3 3 M3 -3 L-3 3" stroke="rgb(248,113,113)" stroke-width={1.6} stroke-linecap="round" />
							{/if}
						</g>
					{/if}
				{/if}
			{/each}

			<!-- Flow depth-coloured animated overlay -->
			{#if flow}
				{#each list as e (e.id)}
					{@const fd = flow.edgeDepth.get(e.id)}
					{#if fd !== undefined}
						{@const d = edgePath(e)}
						{@const col = flowDepthColor(fd)}
						{@const on = flowStep == null || fd === flowStep}
						{#if d && on}
							<path {d} fill="none" stroke={col} stroke-width={2.4}
								class={showAnimate ? 'ms-flow-pulse' : ''} style:animation-delay="-{fd * 0.18}s"
								opacity={0.9} marker-end="url(#ms-arrow-flow)" />
						{/if}
					{/if}
				{/each}
			{/if}
		{/snippet}

		<!-- Edge motion — particles / scanning / pulse / encrypted. Factored out so it
		     can be split across the node boundary when depthSortedParticles is set. -->
		{#snippet particleLayer(list: StudioEdge[])}
			{#each list as e (e.id)}
				{@const pid = particleId(e)}
				{#if maxParticles > 0 && isParticleEdge(e)}
					{@const count = Math.min(e.particleCount ?? maxParticles, maxParticles)}
					{@const dur = particleDur(e)}
					{@const col = particleColor(e)}
					{#each Array.from({ length: count }, (_, i) => i) as i (i)}
						<!-- Hidden until its motion begins. The stream is staggered by `begin`,
						     and a circle carries no position of its own — so between paint and
						     start time every particle after the first renders at the canvas
						     ORIGIN, parking a clump of dots in the top-left corner for up to
						     one full cycle. Fading in at the same moment the motion starts
						     costs nothing and changes nothing once the stream is running. -->
						<circle r={tuning.particleSize} fill={col} opacity="0" filter={showFilters ? 'url(#ms-particle)' : 'none'} pointer-events="none">
							<animateMotion dur="{dur}s" repeatCount="indefinite" begin="{(i / count) * dur}s"><mpath href="#{pid}" /></animateMotion>
							<animate attributeName="opacity" from="0" to="1" begin="{(i / count) * dur}s" dur="0.01s" fill="freeze" />
						</circle>
					{/each}
				{:else if maxParticles > 0 && e.style === 'scanning'}
					{@const sdur = (1.6 / tuning.particleSpeed).toFixed(2)}
					{#each [0, 0.4] as delay}
						<circle r={tuning.particleSize * 0.85} fill="rgba(56,189,248,0.9)" filter={showFilters ? 'url(#ms-particle)' : 'none'} pointer-events="none">
							<animateMotion dur="{sdur}s" repeatCount="indefinite" begin="{delay}s" calcMode="linear"><mpath href="#{pid}" /></animateMotion>
						</circle>
						<circle r={tuning.particleSize * 0.85} fill="rgba(56,189,248,0.9)" filter={showFilters ? 'url(#ms-particle)' : 'none'} pointer-events="none">
							<animateMotion dur="{sdur}s" repeatCount="indefinite" begin="{delay}s" calcMode="linear" keyPoints="1;0" keyTimes="0;1"><mpath href="#{pid}" /></animateMotion>
						</circle>
					{/each}
				{:else if maxParticles > 0 && e.style === 'pulse'}
					{@const pdur = (5 / tuning.particleSpeed).toFixed(2)}
					<circle r={tuning.particleSize * 2} fill="rgba(34,211,238,0.75)" filter={showFilters ? 'url(#ms-glow)' : 'none'} pointer-events="none">
						<animateMotion dur="{pdur}s" repeatCount="indefinite" calcMode="linear"><mpath href="#{pid}" /></animateMotion>
					</circle>
				{/if}
			{/each}
		{/snippet}

		<g transform="translate({transform.tx},{transform.ty}) scale({transform.tk})">
			{@render edgeLayer(baseEdges)}
			{#if depthSortedParticles}
				<!-- Base-edge energy paints here, behind the nodes, matching the static web. -->
				{@render particleLayer(baseEdges)}
			{/if}

			<!-- Rubber-band link -->
			{#if link}
				{@const a = attach(link.fromId, link.fromPort)}
				<path d="M {a.x} {a.y} L {link.cx} {link.cy}" fill="none"
					stroke="var(--accent)" stroke-width={1.6} stroke-dasharray="5 5" opacity="0.8" />
				<circle cx={link.cx} cy={link.cy} r={3} fill="var(--accent)" opacity="0.9" />
			{/if}

			<!-- Nodes -->
			{#each nodes as n (n.id)}
				{@const r = nodeR(n)}
				{@const spec = specFor(n)}
				{@const sil = silhouettePath(spec, r)}
				{@const cs = sampleFor(n)}
				{@const cShape = n.customShapeId ? CUSTOM_SHAPES[n.customShapeId] : undefined}
				{@const cScale = cs ? r / cs.maxR : 1}
				{@const isIcon = !!(cs && n.iconMarkup)}
				{@const isRinged = isRingedIcon(n)}
				<!-- A piece needs a shape AND a frame to stand in; either alone is not
				     enough to build one, so anything short of both draws the disc. -->
				{@const piece = n.piece && n.frame ? ALL_PIECES[n.piece] : undefined}
				<!-- Inset: a ringed leaf that carries a value draws its glyph small and
				     up top, with the label + value stacked inside the disc. A piece has no
				     disc to stack text inside, so its caption drops below it instead. -->
				{@const inset = insetLeafLabels && isRinged && !!n.value && !piece}
				{@const isSel = selectedId === n.id}
				{@const isHov = hoveredId === n.id}
				{@const isOrigin = !!(flow && flow.sources.has(n.id))}
				<!-- Text sits clear of the connection rings, not just the rim. -->
				{@const outerR = rimR(r, (nodeConns.get(n.id) ?? []).length, showConnArcs(n))}
				<!-- The node's ink. State outranks identity, which is the ordering that
				     makes `worldHue` safe: collapsing the palette only ever takes the
				     HEALTHY branch, so degraded and offline keep their own colour and
				     become the only saturated things in the scene. -->
				{@const oc = n.state === 'degraded' ? tuning.degradedColor : n.state === 'offline' ? tuning.offlineColor : (tuning.worldHue || stroke(n))}
				<!-- svelte-ignore a11y_click_events_have_key_events -->
				<!-- `data-node` carries the id, not just the marker: an overlay drawn
				     OVER the canvas (a combat effect, a callout) has to find a node's
				     live screen box, and on a spinning globe that box moves every
				     frame. The attribute is the only stable handle onto it. -->
				<g
					class="ms-node"
					data-node={n.id}
					transform="translate({n.x},{n.y})"
					style:pointer-events={n.inert ? 'none' : null}
					style:filter={n.blur && tier !== 'minimal' ? `blur(${n.blur}px)` : null}
					style:opacity={nodeOpacity(n, isSel)}
					class:ms-receive={canReceive(n)}
					onpointerdown={(ev) => onNodePointerDown(ev, n)}
					onmouseenter={(ev) => emitHover(n.id, ev)}
					onmousemove={(ev) => onNodeHover && emitHover(n.id, ev)}
					onmouseleave={() => emitHover(null)}
					role="button"
					tabindex="0"
					aria-label={n.label}
				>
					<!-- Origin pulse rings. Withheld from a solid: two more concentric
					     circles around a building is the little-globe read again, and an
					     expanding ring is the loudest form of it. -->
					{#if isOrigin && !piece}
						<circle r={r + 22} fill="none" stroke="#22D3EE" stroke-width={1} opacity={0.2} class={showAnimate ? 'ms-source-outer' : ''} />
						<circle r={r + 10} fill="none" stroke="#22D3EE" stroke-width={1.5} opacity={0.5} class={showAnimate ? 'ms-source-pulse' : ''} />
					{/if}

					<!-- Connection arcs — one nested ring per link. Dots are spaced evenly
					     around the node rather than placed on each link's true bearing, so
					     they stay legible when several neighbours sit in one direction. -->
					{#if showConnArcs(n)}
						{@const conns = nodeConns.get(n.id) ?? []}
						{#each conns as ce, ci}
							{@const nb = neighbourOf(ce, n.id)}
							{@const nbCol = nb ? stroke(nb) : stroke(n)}
							{@const sig = edgeSig(ce)}
							{@const rr = r + ARC_GAP + ci * arcGeom(conns.length, r).step}
							{@const circ = 2 * Math.PI * rr}
							{@const ang = -90 + (360 / conns.length) * ci}
							{@const rad = (ang * Math.PI) / 180}
							<!-- faint full ring so every dot visibly sits on a track; it thins out
							     as rings crowd together, or a hub turns into a solid halo -->
							<circle r={rr} fill="none" stroke={nbCol} stroke-width={1}
								opacity={conns.length > 6 ? 0.09 : 0.18} />
							<!-- signal arc — length is the fraction of the ring that's live -->
							<circle r={rr} fill="none" stroke={nbCol} stroke-width={2} stroke-linecap="round"
								opacity={0.35 + sig * 0.5} transform="rotate(-90)"
								stroke-dasharray="{(circ * sig * 0.9).toFixed(1)} {circ.toFixed(1)}" />
							<!-- spoke: rim → dot -->
							<line x1={Math.cos(rad) * r} y1={Math.sin(rad) * r}
								x2={Math.cos(rad) * rr} y2={Math.sin(rad) * rr}
								stroke={nbCol} stroke-width={1.5} opacity={0.4} />
							<!-- orbit dot — coloured by the link's health -->
							{@const dc = connDotColor(ce, nbCol)}
							<circle cx={Math.cos(rad) * rr} cy={Math.sin(rad) * rr} r={3.5}
								fill="var(--bg)" stroke={dc} stroke-width={2}
								filter={showFilters ? 'url(#ms-glow-port)' : 'none'} />
							<circle cx={Math.cos(rad) * rr} cy={Math.sin(rad) * rr} r={1.6} fill={dc} opacity={0.9} />
						{/each}
					{:else if (n.count ?? 0) > 1 && !piece}
						<!-- Compact roll-up badge — the constant-cost alternative to the arcs.
						     Also a ring, so it is withheld from a solid for the same reason
						     the arcs are: the count belongs in the caption, which already
						     carries it, and not in another orbit around another little globe.
						     Six elements whatever the count, against five PER LINK: at 78
						     members the arcs are ~390 elements and read as a halo, while this
						     reads as "78, three of them broken" at any zoom.

						     The ring states the HEALTHY SHARE and the pip states the FAULT
						     COUNT, deliberately on separate channels — see `fault` above. -->
						{@const cnt = n.count ?? 0}
						{@const bad = Math.min(n.fault ?? 0, cnt)}
						{@const ok = (cnt - bad) / cnt}
						{@const rr = r + ARC_GAP}
						{@const circ = 2 * Math.PI * rr}
						<circle r={rr} fill="none" stroke={stroke(n)} stroke-width={1} opacity={0.16} />
						<circle r={rr} fill="none" stroke={stroke(n)} stroke-width={2.4} stroke-linecap="round"
							opacity={0.75} transform="rotate(-90)"
							stroke-dasharray="{(circ * ok).toFixed(1)} {circ.toFixed(1)}" />
						<!-- count, parked on the rim's lower right so it never covers the glyph -->
						<g transform="translate({rr * 0.72},{rr * 0.72})" pointer-events="none">
							<rect x={-13} y={-7.5} width={26} height={15} rx={7.5}
								fill="var(--bg)" stroke={stroke(n)} stroke-width={1} opacity={0.95} />
							<text class="ms-t" y={3.4} font-size={9} letter-spacing="0.04em"
								fill={labelInk(n)}>{cnt > 999 ? '999+' : cnt}</text>
						</g>
						<!-- fault pip — upper right, saturated, drawn last, never culled -->
						{#if bad > 0}
							<g transform="translate({rr * 0.72},{-rr * 0.72})" pointer-events="none">
								<circle r={8} fill="var(--bg)" stroke="rgb(248,113,113)" stroke-width={1.6} />
								<text class="ms-t" y={3.2} font-size={9} font-weight="600"
									fill="rgb(248,113,113)">{bad > 99 ? '99+' : bad}</text>
							</g>
						{/if}
					{/if}

					<!-- selection / receive halo -->
					{#if isSel || isHov || canReceive(n)}
						<path d={cs ? binsSilhouette(cs, r) : sil} fill="none"
							stroke={canReceive(n) ? 'var(--accent)' : stroke(n)}
							stroke-width={2.5} opacity={0.32} transform="scale({cs ? 1.12 : 1.14})"
							filter={showFilters ? 'url(#ms-glow)' : 'none'} />
					{/if}

					<g class={showAnimate && tuning.popIn && n.popDelay !== undefined ? 'ms-pop' : ''} style:animation-delay="{n.popDelay ?? 0}s">
					<g class="ms-bubble">
						<!-- Layered "planes" behind the node — conveys rolled-up multiplicity.
						     Furthest colour first (largest offset) so the node sits on top.
						     An opaque bg fill occludes the graph lines behind each plane,
						     then a colour tint on top gives it its hue. -->
						{#if n.stackColors?.length}
							{@const plane = cs ? binsSilhouette(cs, r) : sil}
							{#each n.stackColors as sc, si}
								{@const off = (n.stackColors.length - si) * 5}
								<g transform="translate({off},{off})" pointer-events="none">
									<path d={plane} fill="var(--bg)" />
									<path d={plane} fill={sc} fill-opacity={0.5} stroke={sc} stroke-width={1.4} />
								</g>
							{/each}
						{/if}

						{#if piece}
							<!-- The hit target.
							     A building draws nothing the pointer can land on: NodePiece is
							     `pointer-events="none"` throughout, and choosing a piece skips
							     the entire disc branch below — fill, rings, ports, glyph — which
							     is where a node's hit area used to come from. A <g> has no hit
							     area of its own, so without this a HEALTHY building could be
							     tabbed to (the group carries role/tabindex) but never clicked or
							     hovered. Only a broken one could, and only because its beacon
							     happens to carry a fat transparent stroke.

							     Sized from mesh-metrics rather than `r`: the building stands
							     PIECE_REACH radii off its plot, so the disc that covers a disc
							     does not cover this. -->
							<circle
								r={silhouetteR(n, {
									radiusScale: tuning.radiusScale,
									solids: true
								})}
								fill="transparent"
								stroke="none"
							/>
							<!-- A solid standing on the mesh, in place of everything a flat
							     node draws: fill, highlight, port arcs, rings, glyph. Those
							     all decorate a marker, and this is not one. The piece brings
							     its own ground and shadow — standing on something is part of
							     being a solid, not a decoration around one.

							     Skipped when a GL layer is drawing the bodies. Only the BODY
							     moves to the GPU: the hit proxy above, the caption, and the
							     beacon stay here, because they are the parts that have to be
							     pointed at, read aloud, or laid out against other text. -->
							{#if !glBodies}
							<NodePiece
								{piece}
								frame={n.frame!}
								ground={n.ground}
								sink={n.sink}
								groundColor={n.groundColor}
								color={oc}
								offline={n.state === 'offline'}
								selected={isSel}
							/>
							{/if}
						{:else}
						<!-- body fill — an opaque surface base under the accent tint, so the
						     disc reads as a dark instrument face (edges can't show through)
						     and the hue stays in the rim + glyph rather than the fill. -->
						{#if cs && cShape}
							<path d={cShape.outline} fill="var(--bg-elev)" stroke="none" opacity={tuning.bodyOpacity} transform="scale({cScale})" />
							<path d={cShape.outline} fill={fill(n)} stroke="none" transform="scale({cScale})" />
						{:else if isIcon}
							<path d={binsSilhouette(cs, r)} fill="var(--bg-elev)" stroke="none" opacity={tuning.bodyOpacity} />
							<path d={binsSilhouette(cs, r)} fill={fill(n)} stroke="none" opacity={0.5} />
						{:else}
							<path d={sil} fill="var(--bg-elev)" stroke="none" opacity={tuning.bodyOpacity} />
							<path d={sil} fill={fill(n)} stroke="none" />
						{/if}
						{#if !isIcon}
							<ellipse cx={-r * 0.26} cy={-r * 0.28} rx={r * 0.46} ry={r * 0.4} fill="url(#ms-highlight)" pointer-events="none" />
						{/if}

						<!-- segmented port arcs — ride the silhouette (parametric/custom; icons use the outline trace) -->
						{#if !isIcon}
							{#each portSegments(n.type) as seg}
								{@const flw = n.portFlow?.[seg.id]}
								{@const act = flw?.active ?? false}
								{@const col = DATA_TYPE_COLOR[seg.dataType]}
								{@const ap = cs ? binsArcPath(cs, seg.startDeg, seg.endDeg, r) : shapeArcPath(spec, seg.startDeg, seg.endDeg, r)}
								<path d={ap} fill="none" stroke={col} stroke-width={2} stroke-linecap="round" stroke-linejoin="round" opacity={act ? 0 : 0.14} />
								{#if act}
									<path d={ap} fill="none" stroke={col} stroke-width={tuning.arcWidth} stroke-linecap="round" stroke-linejoin="round"
										opacity={0.9} filter={showFilters ? 'url(#ms-glow-port)' : 'none'}
										class={showAnimate ? 'ms-arc' : ''} style:animation-duration="{tuning.arcPulseSpeed + (1 - (flw?.flowRate ?? 0.5)) * tuning.arcPulseSpeed}s" />
								{/if}
							{/each}
						{/if}

						<!-- decorative inner rings — parametric concept shapes only -->
						{#if !cs && spec.innerRings}
							{#each spec.innerRings as ir}
								<circle r={r * ir} fill="none" stroke={stroke(n)} stroke-width={1} opacity={0.35} />
							{/each}
						{/if}
						<!-- control-plane radar sweep — parametric discs only. A sampled body
						     (the mesh-server crest) owns its own outline; a circle drawn
						     across it reads as a ring the shield doesn't have. -->
						{#if !cs && n.type === 'control-plane' && n.state !== 'offline' && showAnimate}
							<circle r={r - 12} fill="none" stroke={sweepColor(n)} stroke-width={1}
								stroke-dasharray="2 12" opacity={0.5} class="ms-sweep" />
						{/if}

						<!-- silhouette outline / icon markup -->
						{#if cs && cShape}
							<g transform="scale({cScale})">
								{#if cShape.detail}
									<path d={cShape.detail} fill="none" stroke={oc} stroke-width={1.4 / cScale} stroke-linecap="round" stroke-linejoin="round" opacity={0.6} />
								{/if}
								<path d={cShape.outline} fill="none" stroke={oc} stroke-width={1.9 / cScale} stroke-linejoin="round"
									stroke-dasharray={n.state === 'offline' ? `${3 / cScale} ${5 / cScale}` : n.state === 'degraded' ? `${7 / cScale} ${5 / cScale}` : 'none'}
									opacity={isSel ? 1 : 0.9} />
							</g>
						{:else if isIcon}
							<!-- the icon markup IS the node silhouette; health folds into its own strokes -->
							<g transform="scale({cScale}) translate(-12,-12)" style:color={oc}
								stroke="currentColor" fill="none" stroke-width={tuning.glyphWidth / cScale} stroke-linecap="round" stroke-linejoin="round"
								stroke-dasharray={n.state === 'offline' ? `${1.6 / cScale} ${2.4 / cScale}` : 'none'}
								opacity={n.state === 'offline' ? 0.55 : isSel ? 1 : 0.92}
								filter={showFilters ? 'url(#ms-glow)' : 'none'}>
								{@html n.iconMarkup}
							</g>
						{:else}
							<path d={sil} fill="none" stroke={oc} stroke-width={spec.strokeWidth ?? 1.8} stroke-linejoin="round"
								stroke-dasharray={n.state === 'offline' ? '3 5' : n.state === 'degraded' ? '7 5' : 'none'} opacity={isSel ? 1 : 0.9} />
							{#if spec.doubleStroke && n.state === 'healthy'}
								<path d={sil} fill="none" stroke={stroke(n)} stroke-width={1} stroke-linejoin="round" opacity={0.35} transform="scale(0.88)" />
							{/if}
						{/if}

						<!-- Leaf icon — the disc above is the boundary, the glyph is cargo.
						     Sized to the mockup's proportion: a 64px glyph in a 156px disc. -->
						{#if isRinged}
							<!-- Inset shrinks the glyph and lifts it to the top third so the
							     label + count clear it inside the disc. -->
							{@const gs = (r * 2 * GLYPH_FRAC * (inset ? 0.56 : 1)) / 24}
							<!-- A mode caption rides under the glyph, so the glyph lifts to keep
							     the pair optically centred in the disc. -->
							{@const gy = inset ? -r * 0.44 : n.mode ? -r * 0.14 : 0}
							<g transform="translate(0,{gy}) scale({gs}) translate(-12,-12)" style:color={oc}
								stroke="currentColor" fill="none" stroke-width={tuning.glyphWidth / gs}
								stroke-linecap="round" stroke-linejoin="round"
								opacity={n.state === 'offline' ? 0.55 : isSel ? 1 : 0.92}
								filter={showFilters ? 'url(#ms-glow)' : 'none'} pointer-events="none">
								{@html n.iconMarkup}
							</g>
						{#if n.mode}
								{@const fs = Math.max(5.5, r * 0.15)}
								{@const by = r * 0.5}
								<!-- Chord at this baseline, inset so the text clears the rim. -->
								{@const chord = 2 * Math.sqrt(Math.max(0, r * r - by * by)) * 0.88}
								{#each wrapText(labelForMode(n.mode), fs, chord) as line, li}
									<text class="ms-t" y={by + li * (fs * 1.15)} font-size={fs}
										letter-spacing="0.04em" fill={labelInk(n)} opacity={0.75}>{line}</text>
								{/each}
							{/if}
						{/if}

						{/if}

						<!-- outline-following energy trace — flowing dash travels the node's OWN
						     outline. A piece has none in that sense: a trace follows a fixed
						     silhouette, and a solid's silhouette is different every spin. -->
						{#if tuning.trace && !piece && showTrace(n) && showAnimate}
							{@const tc = traceColor(n)}
							{@const gap = (10 * tuning.traceGap).toFixed(1)}
							{@const pgap = (12 * tuning.traceGap).toFixed(1)}
							{#if isIcon}
								<g transform="scale({cScale}) translate(-12,-12)" style:color={tc} stroke="currentColor" fill="none"
									stroke-width={tuning.traceWidth / cScale} stroke-linecap="round" stroke-dasharray="2 {gap}"
									class="ms-trace" style:animation-duration="{traceDur(n)}s"
									filter={showFilters ? 'url(#ms-glow)' : 'none'} opacity={tuning.traceOpacity} pointer-events="none">
									{@html n.iconMarkup}
								</g>
							{:else if cs && cShape}
								<path d={cShape.outline} transform="scale({cScale})" fill="none" stroke={tc}
									stroke-width={tuning.traceWidth / cScale} stroke-linecap="round" stroke-dasharray="2 {gap}"
									class="ms-trace" style:animation-duration="{traceDur(n)}s"
									filter={showFilters ? 'url(#ms-glow)' : 'none'} opacity={tuning.traceOpacity} pointer-events="none" />
							{:else}
								<path d={sil} fill="none" stroke={tc} stroke-width={tuning.traceWidth} stroke-linecap="round" stroke-dasharray="3 {pgap}"
									class="ms-trace" style:animation-duration="{traceDur(n)}s"
									filter={showFilters ? 'url(#ms-glow)' : 'none'} opacity={tuning.traceOpacity} pointer-events="none" />
							{/if}
						{/if}

						<!-- L-bracket hover corners -->
						<g class="ms-brackets" fill="none" stroke={stroke(n)} stroke-width={1.5} pointer-events="none">
							<polyline points="{-(r + 12)},{-(r + 12) + 10} {-(r + 12)},{-(r + 12)} {-(r + 12) + 10},{-(r + 12)}" />
							<polyline points="{(r + 12) - 10},{-(r + 12)} {(r + 12)},{-(r + 12)} {(r + 12)},{-(r + 12) + 10}" />
							<polyline points="{-(r + 12)},{(r + 12) - 10} {-(r + 12)},{(r + 12)} {-(r + 12) + 10},{(r + 12)}" />
							<polyline points="{(r + 12) - 10},{(r + 12)} {(r + 12)},{(r + 12)} {(r + 12)},{(r + 12) - 10}" />
						</g>

						<!-- Port controls. Drawing only — edge endpoints resolve through
						     nodePorts() regardless, so turning these off moves no lines.

						     Off for a solid, on two counts. They are dots spaced around a
						     circle, which is the little-globe read yet again; and they are
						     handles for a drag that a globe cannot service anyway — a body
						     on a sphere has no screen position a drag could set that the
						     next spin would not overwrite. Cost with no interaction behind
						     it. (The L-brackets above stay: they are rectilinear, so they
						     read as instrument chrome rather than as another orbit.) -->
						{#if tuning.ports && !piece}
						{#each nodePorts(n) as port}
							{@const off = boundaryFor(n, port.angle, r)}
							{@const flw = n.portFlow?.[port.id]}
							{@const act = flw?.active ?? false}
							{@const col = DATA_TYPE_COLOR[port.dataType]}
							{@const linkable = !n.portsLocked}
							{@const rad = (port.angle * Math.PI) / 180}
							<!-- svelte-ignore a11y_click_events_have_key_events -->
							<g transform="translate({off.dx},{off.dy})" class="ms-port" class:ms-port-linkable={linkable}
								onpointerdown={(ev) => linkable && onPortPointerDown(ev, n, port.id)}
								role="button" tabindex="-1" aria-label="{port.id} port{linkable ? '' : ' (locked)'}">
								<circle r={9} fill="transparent" />
								<circle r={act ? tuning.dotSize : tuning.dotSize * 0.63} fill={act ? col : 'rgba(255,255,255,0.18)'}
									stroke={linkable ? col : 'rgba(255,255,255,0.25)'} stroke-width={linkable ? 1.2 : 0.8}
									filter={act && showFilters ? 'url(#ms-glow-port)' : 'none'}
									class={act && showAnimate ? 'ms-port-dot ms-port-on' : 'ms-port-dot'} />
								{#if linkable}<circle class="ms-port-ring" r={6} fill="none" stroke={col} stroke-width={1} opacity={0} />{/if}
							</g>
							<!-- inbound trailing dot — directional incoming cue -->
							{#if act && port.role !== 'out'}
								<circle cx={off.dx - Math.cos(rad) * 8} cy={off.dy - Math.sin(rad) * 8} r={1.5} fill={col}
									opacity={0.55} class={showAnimate ? 'ms-port-on' : ''} />
							{/if}
						{/each}
						{/if}

						<!-- text stack — a glyph occupies the middle of both body-glyph and
						     ringed nodes, so their text sits below; only a bare parametric
						     shape has room to stack it inside. -->
						{#if inset}
							<!-- Label + count stacked INSIDE the disc, under the lifted glyph.
							     The name wraps to the chord so a two-word mode still fits. -->
							{@const lfs = Math.max(5.5, r * 0.16)}
							{@const lby = r * 0.08}
							{@const chord = 2 * Math.sqrt(Math.max(0, r * r - lby * lby)) * 0.82}
							{#each wrapText(n.label, lfs, chord) as line, li}
								<text class="ms-t" y={lby + li * (lfs * 1.1)} font-size={lfs} font-weight={600}
									letter-spacing="0.02em" fill={labelInk(n)}>{line}</text>
							{/each}
							{#if n.value}
								<text class="ms-t" y={r * 0.66} font-size={Math.max(9, r * 0.26)} font-weight={800} fill={labelInk(n)}>
									{n.value}{#if n.valueLabel}<tspan font-size={Math.max(5, r * 0.12)} font-weight={500} fill="rgba(255,255,255,0.55)"> {n.valueLabel}</tspan>{/if}
								</text>
							{/if}
						{:else if isIcon || isRinged}
							<!-- A caption UNDER the node, so it is not bounded by the disc —
							     but it still has to be bounded by something, or a long name
							     runs across its neighbours. Wrapped to the node's own width,
							     which is the only local measure available. -->
							{@const cfs = 9 * labelScale}
							{@const clines = wrapText(n.label, cfs, r * 2.6, 3)}
							{#each clines as line, li (li)}
								<text class="ms-t" y={outerR + 14 + li * cfs * 1.15} font-size={cfs} font-weight={600} fill={labelInk(n)}>{line}</text>
							{/each}
							{@const cdrop = (clines.length - 1) * cfs * 1.15}
							<!-- Optional live readout under the glyph (e.g. the inferred hub's
							     AGENTS count) — only rendered when the node carries a value. -->
							{#if n.value}
								<text class="ms-t" y={outerR + 28 + cdrop} font-size={12} font-weight={800} fill={labelInk(n)}>
									{n.value}{#if n.valueLabel}<tspan font-size={7} font-weight={500} fill="rgba(255,255,255,0.55)"> {n.valueLabel}</tspan>{/if}
								</text>
							{/if}
							{#if n.liveSlot}
								<text class="ms-t" y={outerR + (n.value ? 39 : 28) + cdrop} font-size={7} letter-spacing="0.12em" fill={labelInk(n)} opacity={0.6}>{n.liveSlot}</text>
							{/if}
						{:else}
							<!-- A bare parametric shape is the only node with room to stack its
							     text INSIDE, so the name wraps to the chord here exactly as it
							     does in the inset branch. It previously did not, and any label
							     longer than the disc simply ran out over its neighbours — which
							     a caller whose labels are real names (a roadmap initiative, not
							     `DEP·ANALYSIS`) hits immediately.
							     The readout below is pushed down by however much the extra lines
							     took, and the name lifted by half of it, so the block stays
							     centred instead of growing downward into the value. -->
							{@const lfs = Math.max(11, r * 0.2) * labelScale}
							{@const lchord = 2 * Math.sqrt(Math.max(0, r * r - (r * 0.06) ** 2)) * 0.82}
							{@const llines = wrapText(n.label, lfs, lchord, 3)}
							{@const extra = (llines.length - 1) * lfs * 1.05}
							{#if typeLabels}
								<text class="ms-t" y={-r * 0.36 - extra / 2} font-size={8} letter-spacing="0.18em" fill={labelInk(n)} opacity={0.8}>{MESH_NODE_LABEL[n.type]}</text>
							{/if}
							{#each llines as line, li (li)}
								<text class="ms-t" y={-r * 0.06 - extra / 2 + li * lfs * 1.05} font-size={lfs} font-weight="700" fill={labelInk(n)}>{line}</text>
							{/each}
							{#if n.value}<text class="ms-t" y={r * 0.24 + extra / 2} font-size={Math.max(15, r * 0.3)} font-weight="800" fill={labelInk(n)}>{n.value}</text>{/if}
							{#if n.valueLabel}<text class="ms-t" y={r * 0.44 + extra / 2} font-size={7} letter-spacing="0.12em" fill="rgba(255,255,255,0.5)">{n.valueLabel}</text>{/if}
							{#if n.liveSlot}<text class="ms-t" y={r * 0.62 + extra / 2} font-size={7} fill={labelInk(n)} opacity={0.55}>{n.liveSlot}</text>{/if}
						{/if}

						<!-- ── Alarm ──────────────────────────────────────────────────
						     A BEACON where the node is a solid, a badge where it is not.

						     The badge is an opaque disc with a flat icon on it — pure 2D
						     dashboard, pasted over a 3D scene, and on the globe it was the
						     highest-contrast thing on screen precisely because it belonged
						     to a different world. It also only existed because hue had been
						     spent on identity: with seventeen mode colours in play there was
						     no colour left to say "broken", so it had to shout in shape
						     instead.

						     A beacon says it inside the scene instead: a column of light off
						     the building's roof, leaning with the globe because it is built
						     along the frame's own up-axis. It reads from any bearing, at any
						     zoom, and it costs three lines. It is also the one thing allowed
						     to break the ladder and out-glow everything — an alarm that does
						     not interrupt is not an alarm. -->
						{#if n.state !== 'healthy'}
							{@const alarm = n.state === 'degraded' ? tuning.degradedColor : tuning.offlineColor}
							{#if piece && n.frame}
								<!-- Height in NODE RADII, not pixels. `frame.u` is already the
								     screen displacement of one radius straight up, which is the
								     same unit `pieces.ts` is written in — so a beacon is 3.4
								     radii tall on any globe, at any zoom, and it leans with the
								     surface for free. Multiplying by `r` as well would square
								     the scale, which is exactly the bug this comment replaces. -->
								{@const H = 3.4}
								{@const bx = n.frame.u.x * H}
								{@const by = n.frame.u.y * H}
								<!-- The beacon is a TARGET, not just an indicator. It is the tallest,
								     brightest thing on a broken node and therefore the thing a hand
								     goes to — and a 2px line is not a hit area, so it carries an
								     invisible fat stroke to be grabbed by. Left inside the node's
								     own interactive group, so it inherits that node's click and
								     hover rather than needing a second handler that could drift out
								     of agreement with it. -->
								<line
									x1={0}
									y1={0}
									x2={bx}
									y2={by}
									stroke="transparent"
									stroke-width={18}
									stroke-linecap="round"
								/>
								<g pointer-events="none" class={showAnimate ? 'ms-beacon' : ''}>
									<!-- The column: a wide faint shaft with a bright core inside
									     it. Two strokes rather than a gradient — a gradient along
									     an arbitrary screen direction needs its own <defs> per
									     node, and at this size the soft edge does the same job. -->
									<line x1={0} y1={0} x2={bx} y2={by} stroke={alarm} stroke-width={7}
										stroke-linecap="round" opacity={0.12} />
									<line x1={0} y1={0} x2={bx} y2={by} stroke={alarm} stroke-width={2}
										stroke-linecap="round" opacity={0.5} />
									<!-- The light itself, at the top of the shaft. -->
									<circle cx={bx} cy={by} r={4.6} fill={alarm} opacity={0.22} />
									<circle cx={bx} cy={by} r={2} fill={alarm} />
								</g>
							{:else}
								<g transform="translate({r * 0.6},{-r * 0.6})" pointer-events="none">
									<circle r={7} fill="rgba(10,12,18,0.9)" />
									{#if n.state === 'degraded'}
										<polygon points="0,-5 4.6,3.4 -4.6,3.4" fill="rgb(250,204,21)" />
										<text y={3.2} text-anchor="middle" font-size={4.4} font-weight="900" fill="#0a0a0a">!</text>
									{:else}
										<circle r={5} fill="rgb(248,113,113)" />
										<line x1={-2.4} y1={-2.4} x2={2.4} y2={2.4} stroke="#0a0a0a" stroke-width={1.5} stroke-linecap="round" />
										<line x1={2.4} y1={-2.4} x2={-2.4} y2={2.4} stroke="#0a0a0a" stroke-width={1.5} stroke-linecap="round" />
									{/if}
								</g>
							{/if}
						{/if}
					</g>
					</g>

					<!-- Multi-mode agent: the modes fan out from the agent container.
					     Collapsed = mode glyphs hug the node; expanded = satellites + spokes. -->
					{#if n.modes && n.modes.length > 1}
						{@const mn = n.modes.length}
						{#if n.expanded}
							<!-- Expanded: the modes become full, normal-sized nodes on a ring
							     whose radius grows so they never overlap each other or the hub. -->
							{@const facetR = Math.min(r, 40)}
							{@const ringR = Math.max(r + facetR + 22, (facetR + 12) / Math.sin(Math.PI / mn))}
							{#each n.modes as fmode, fi}
								{@const fang = -90 + (360 / mn) * fi}
								{@const frad = (fang * Math.PI) / 180}
								{@const fx = Math.cos(frad) * ringR}
								{@const fy = Math.sin(frad) * ringR}
								{@const bp = boundaryFor(n, fang, r)}
								{@const fcs = facetSample(fmode)}
								{@const occ = n.modes.slice(0, fi).filter((m) => m === fmode).length}
								{@const flow = n.modeFlows?.[fi] ?? 0}
								<line x1={bp.dx} y1={bp.dy} x2={fx} y2={fy} stroke={stroke(n)}
									stroke-width={1.2} opacity={flow > 0 ? 0.4 : 0.22} />
								{#if flow > 0 && showAnimate}
									<!-- Traffic on this mode's spoke — a marching dash from hub → node. -->
									<line x1={bp.dx} y1={bp.dy} x2={fx} y2={fy} stroke={stroke(n)}
										stroke-width={2} stroke-linecap="round" stroke-dasharray="2 10"
										opacity={0.9} class="ms-spoke-flow"
										style:animation-duration="{Math.max(0.6, 2 - flow * 1.4)}s"
										filter={showFilters ? 'url(#ms-glow)' : 'none'} />
								{/if}
								<!-- svelte-ignore a11y_click_events_have_key_events -->
								<g transform="translate({fx},{fy})" class="ms-facet ms-facet--node"
									role="button" tabindex="-1" aria-label="{fmode} mode"
									onpointerdown={(ev) => { ev.stopPropagation(); onFacetSelect?.(n.id, fmode, occ); }}>
									{#if fcs}
										{@const fscale = facetR / fcs.maxR}
										<path d={binsSilhouette(fcs, facetR)} fill={fill(n)} opacity={0.55} />
										<g transform="scale({fscale}) translate(-12,-12)" style:color={stroke(n)}
											stroke="currentColor" fill="none" stroke-width={1.9 / fscale}
											stroke-linecap="round" stroke-linejoin="round">{@html glyphForMode(fmode)}</g>
									{:else}
										<circle r={facetR} fill={fill(n)} opacity={0.55} stroke={stroke(n)} stroke-width={1.6} />
									{/if}
									<text class="ms-t" y={facetR + 12} font-size={8} font-weight={600} fill={labelInk(n)}>{fmode}</text>
								</g>
							{/each}
						{:else}
							<!-- Collapsed: mode glyphs hug the container as small badges. A
							     badge whose mode has traffic flows around its OWN outline. -->
							{@const badgeR = r + 20}
							{@const badgeSize = 17}
							{@const br = badgeSize * 0.72}
							{#each n.modes as fmode, fi}
								{@const fang = -90 + (360 / mn) * fi}
								{@const frad = (fang * Math.PI) / 180}
								{@const fx = Math.cos(frad) * badgeR}
								{@const fy = Math.sin(frad) * badgeR}
								{@const bflow = n.modeFlows?.[fi] ?? 0}
								<g transform="translate({fx},{fy})" class="ms-facet">
									<circle r={br} fill="var(--bg)" stroke={stroke(n)}
										stroke-width={1} opacity={bflow > 0 ? 1 : 0.9} />
									<g transform="scale({badgeSize / 24}) translate(-12,-12)" style:color={stroke(n)}
										stroke="currentColor" fill="none" stroke-width={1.7 / (badgeSize / 24)}
										stroke-linecap="round" stroke-linejoin="round">{@html glyphForMode(fmode)}</g>
									{#if bflow > 0 && showAnimate}
										<circle r={br} fill="none" stroke={stroke(n)} stroke-width={1.6}
											stroke-dasharray="2 5" stroke-linecap="round" class="ms-badge-flow"
											style:animation-duration="{Math.max(0.7, 2 - bflow * 1.4)}s"
											filter={showFilters ? 'url(#ms-glow)' : 'none'} />
									{/if}
								</g>
							{/each}
						{/if}
						<!-- svelte-ignore a11y_click_events_have_key_events -->
						<g class="ms-fan-toggle" transform="translate({r * 0.66},{r * 0.66})"
							onpointerdown={(ev) => { ev.stopPropagation(); n.expanded = !n.expanded; }}
							role="button" tabindex="-1" aria-label={n.expanded ? 'Collapse modes' : 'Expand modes'}>
							<circle r={8} fill="var(--bg)" stroke={stroke(n)} stroke-width={1.2} />
							<text text-anchor="middle" y={3.2} font-size={12} font-weight={800} fill={labelInk(n)}>{n.expanded ? '−' : '+'}</text>
						</g>
					{/if}

					{#if isOrigin}
						<text class="ms-t" y={-(r + 26)} font-size={8} font-weight={700} letter-spacing="0.1em" fill="#22D3EE" pointer-events="none">ORIGIN</text>
					{/if}
				</g>
			{/each}

			<!-- Raised edges — same layer as above, re-rendered over the nodes so a link
			     the operator just made stays visible instead of vanishing under them. -->
			{@render edgeLayer(raisedEdges)}

			<!-- Edge motion — particles / scanning / pulse / encrypted. By default this
			     rides above the nodes so energy is never occluded; depthSortedParticles
			     splits it so base energy already painted behind the nodes stays there. -->
			{#if depthSortedParticles}
				{@render particleLayer(raisedEdges)}
			{:else}
				{@render particleLayer(edges)}
			{/if}
		</g>
	</svg>

<style>
	/* MeshStudio is a layer inside <Canvas>; the svg fills the Canvas root. */
	.ms-svg { position: absolute; inset: 0; width: 100%; height: 100%; display: block; touch-action: none; }
	.ms-svg.ms-linking { cursor: crosshair; }

	.ms-node { cursor: pointer; }
	.ms-fan-toggle { cursor: pointer; }
	.ms-facet { pointer-events: none; }
	.ms-facet--node { pointer-events: auto; cursor: pointer; }
	:global(.ms-facet--node:hover) { filter: brightness(1.25); }

	/* Traffic marching along an expanded mode spoke. */
	@keyframes ms-spoke-march { to { stroke-dashoffset: -12; } }
	.ms-spoke-flow {
		animation-name: ms-spoke-march;
		animation-timing-function: linear;
		animation-iteration-count: infinite;
	}

	/* Traffic flowing around a collapsed mode-badge's outline. */
	@keyframes ms-badge-march { to { stroke-dashoffset: -7; } }
	.ms-badge-flow {
		animation-name: ms-badge-march;
		animation-timing-function: linear;
		animation-iteration-count: infinite;
	}
	.ms-t { text-anchor: middle; pointer-events: none; font-family: var(--mono); }

	.ms-port { cursor: default; }
	.ms-port-linkable { cursor: crosshair; }
	.ms-port-dot { transition: r 0.15s; }
	.ms-port-linkable:hover .ms-port-ring { opacity: 0.9 !important; }
	.ms-port-linkable:hover .ms-port-dot { r: 4; }

	/* node body pop-in + hover scale */
	.ms-bubble { transform-box: fill-box; transform-origin: center; transition: transform 0.35s cubic-bezier(0.34,1.56,0.64,1); }
	:global(.ms-node:hover) .ms-bubble { transform: scale(var(--hover-scale, 1.05)); }
	@keyframes ms-pop-in { from { opacity: 0; transform: scale(0.6); } to { opacity: 1; transform: scale(1); } }
	.ms-pop { transform-box: fill-box; transform-origin: center; opacity: 0; animation: ms-pop-in 0.55s cubic-bezier(0.34,1.56,0.64,1) both; }

	/* L-brackets */
	.ms-brackets { opacity: 0; transition: opacity 0.25s; }
	:global(.ms-node:hover) .ms-brackets, :global(.ms-node:focus-within) .ms-brackets { opacity: 1; }

	@keyframes ms-arc-pulse { 0%,100% { opacity: 0.85; } 50% { opacity: 1; } }
	.ms-arc { animation: ms-arc-pulse 2s ease-in-out infinite; }

	@keyframes ms-port-pulse { 0%,100% { r: 3.5; } 50% { r: 4.6; } }
	.ms-port-on { animation: ms-port-pulse 1.8s ease-in-out infinite; }

	@keyframes ms-rotate { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
	.ms-sweep { transform-box: fill-box; transform-origin: center; animation: ms-rotate 30s linear infinite; }

	/* energy flowing along the node's own outline (60 ÷ 12 & 15 → seamless, gentle) */
	@keyframes ms-trace-move { to { stroke-dashoffset: -60; } }
	.ms-trace { animation-name: ms-trace-move; animation-timing-function: linear; animation-iteration-count: infinite; }

	/* edge status marching */
	@keyframes ms-state-march { from { stroke-dashoffset: 0; } to { stroke-dashoffset: -20; } }
	.ms-edge-degraded { animation: ms-state-march 2s linear infinite; }
	.ms-edge-offline { animation: ms-state-march 4s linear infinite; }

	/* flow marching */
	@keyframes ms-flow-march { from { stroke-dashoffset: 0; } to { stroke-dashoffset: -14; } }
	.ms-flow-pulse { stroke-dasharray: 8 6; animation: ms-flow-march 0.85s linear infinite; }

	/* origin pulse */
	@keyframes ms-source-pulse { 0%,100% { opacity: 0.55; } 50% { opacity: 0.9; } }
	@keyframes ms-source-outer { 0%,100% { opacity: 0.22; transform: scale(1); } 50% { opacity: 0.4; transform: scale(1.04); } }
	.ms-source-pulse { transform-box: fill-box; transform-origin: center; animation: ms-source-pulse 2s ease-in-out infinite; }
	.ms-source-outer { transform-box: fill-box; transform-origin: center; animation: ms-source-outer 2s ease-in-out infinite; }
	/* The beacon breathes rather than blinks. A hard blink is the only motion on a
	   globe that competes with the spin itself, and a scene where something is
	   always flashing stops reading as calm-with-one-problem. */
	@keyframes ms-beacon { 0%,100% { opacity: 0.72; } 50% { opacity: 1; } }
	.ms-beacon { animation: ms-beacon 2.4s ease-in-out infinite; }
	@media (prefers-reduced-motion: reduce) { .ms-beacon { animation: none; } }
</style>
