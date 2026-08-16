<script lang="ts">
	// ── Mesh shield workbench ──────────────────────────────────────────────────
	//
	// An isolation rig for the one mark that stands for the armornet server. It
	// exists BECAUSE that mark currently lives in three places that must agree:
	//
	//   1. `icons/Icon.svelte` → `crestlink`        — the product icon
	//   2. `icons/supply-chain-glyphs.ts` → `HUB_GLYPH` — the demo hub (copy)
	//   3. `mesh-studio/node-shapes.ts` → kind `'shield'`      — the parametric
	//      escutcheon silhouette (today mapped to `proxy`, not `control-plane`)
	//
	// ── The design problem ────────────────────────────────────────────────────
	// The inner mesh must resolve into an "A" (Armornet) WITHOUT being a drawn A.
	// Pass 1 tried that with opacity and hue and failed for a mechanical reason:
	// hue, opacity, node size and density are PRE-ATTENTIVE channels — the visual
	// system segments on them in parallel, in <200ms, however much clutter you
	// add. That is pop-out, the opposite of emergence. Colouring the A does not
	// hide it, it LABELS it. Hence the rule pass 2+ obeys: the A must never be a
	// continuous drawn path, and never the only thing carrying a unique colour.
	//
	// ── Pass 3: the field is GENERATED, not hand-placed ───────────────────────
	// Pass 2's chaos was 16 nodes dropped by hand, and it looked it — clumped in
	// places, gappy in others, with edge lengths all over the map. Hand-placing a
	// "random" field is the one thing humans are reliably bad at.
	//
	// So the field is now phyllotaxis: the golden angle, 137.5077°, the same rule
	// a sunflower head uses. Because the golden ratio is the irrational number
	// worst approximated by fractions, successive points never fall into rows —
	// the packing is aperiodic yet near-uniform, which is exactly "organic but
	// evenly spaced". Every node sits at r = spread·√i, θ = i·137.5077°.
	//
	// Links come from a k-nearest-neighbour rule over the WHOLE node set, A
	// anchors included. That matters: the A's vertices are ordinary members of
	// the graph with chaos links running into them, rather than a letter laid on
	// top of a backdrop. The mesh is clipped to the shield, and nodes just
	// outside the rim survive as link targets — so edges run off the edge and get
	// cut, which is the cheapest possible way to say "more mesh exists".

	import { silhouettePath, shapeArcPath, type ShapeSpec } from '$lib/mesh-studio/node-shapes.js';
	import {
		sampleMarkup,
		binsSilhouette,
		type SampledShape
	} from '$lib/mesh-studio/glyph-sample.js';

	// ── Outlines ──────────────────────────────────────────────────────────────

	const OUTLINES = {
		shipped: {
			label: 'shipped',
			d: 'M12 3 20 6v5c0 5-3.5 8.5-8 10-4.5-1.5-8-5-8-10V6z',
			verts: null,
			note: 'curved taper — the mark as it ships today'
		},
		chamfer: {
			label: 'chamfer 8',
			d: 'M12 2.6 L20.2 5.9 L20.2 11.3 L17.3 16.5 L12 21.4 L6.7 16.5 L3.8 11.3 L3.8 5.9 Z',
			verts: [
				[12, 2.6],
				[20.2, 5.9],
				[20.2, 11.3],
				[17.3, 16.5],
				[12, 21.4],
				[6.7, 16.5],
				[3.8, 11.3],
				[3.8, 5.9]
			],
			note: 'peaked crown, waist break, straight taper'
		},
		crest: {
			label: 'crest',
			// Heraldic: domed crown, straight flanks, a long curve to the point.
			// The form a SOLID mark wants — facets read as chipped once filled.
			d: 'M12 2.2 C14.8 3.6 17.4 4.3 19.4 4.5 L19.4 11.8 C19.4 16.5 16.4 19.9 12 21.8 C7.6 19.9 4.6 16.5 4.6 11.8 L4.6 4.5 C6.6 4.3 9.2 3.6 12 2.2 Z',
			verts: [
				[12, 2.2],
				[19.4, 4.5],
				[19.4, 11.8],
				[16.4, 19.2],
				[12, 21.8],
				[7.6, 19.2],
				[4.6, 11.8],
				[4.6, 4.5]
			],
			note: 'domed crown, straight flanks, long taper — built to be filled'
		},
		bevel: {
			label: 'bevel crest',
			d: 'M6.8 3.2 L17.2 3.2 L20.2 6.2 L20.2 11.4 L12 21.4 L3.8 11.4 L3.8 6.2 Z',
			verts: [
				[6.8, 3.2],
				[17.2, 3.2],
				[20.2, 6.2],
				[20.2, 11.4],
				[12, 21.4],
				[3.8, 11.4],
				[3.8, 6.2]
			],
			note: 'flat crown, cut corners, single long taper'
		}
	} as const;

	type OutlineKey = keyof typeof OUTLINES;
	let outlineKey = $state<OutlineKey>('crest');
	const outline = $derived(OUTLINES[outlineKey]);

	// ── The A skeleton ────────────────────────────────────────────────────────
	// Anchors are indices 0..6 of the node array, so the A is a set of EDGES in
	// the same graph as everything else, never a separate drawing.

	const ANCHORS = [
		{ x: 12, y: 7.2 }, // 0 apex
		{ x: 10.43, y: 11.2 }, // 1 left upper
		{ x: 9.6, y: 13.3 }, // 2 left bar
		{ x: 8.3, y: 16.6 }, // 3 left foot
		{ x: 13.57, y: 11.2 }, // 4 right upper
		{ x: 14.4, y: 13.3 }, // 5 right bar
		{ x: 15.7, y: 16.6 } // 6 right foot
	] as const;

	const A_EDGES: [number, number][] = [
		[0, 1],
		[1, 2],
		[2, 3],
		[0, 4],
		[4, 5],
		[5, 6],
		[2, 5]
	];

	// The A as three pen strokes — used for masks and gradients only, never drawn
	// as a figure in its own right.
	const A_PATH =
		'M12 7.2 L10.43 11.2 L9.6 13.3 L8.3 16.6 M12 7.2 L13.57 11.2 L14.4 13.3 L15.7 16.6 M9.6 13.3 L14.4 13.3';

	// ── Field generation ──────────────────────────────────────────────────────

	interface Pt {
		x: number;
		y: number;
	}
	interface Edge {
		a: number;
		b: number;
		isA: boolean;
	}
	interface Graph {
		nodes: Pt[];
		inside: boolean[]; // false = rim ghost, an edge target that gets clipped
		edges: Edge[];
		degree: number[];
	}

	/** Golden angle in radians — 2π/φ², ≈137.5077°. */
	const GOLDEN = Math.PI * (3 - Math.sqrt(5));

	function inPoly(p: Pt, verts: readonly (readonly number[])[]): boolean {
		let inside = false;
		for (let i = 0, j = verts.length - 1; i < verts.length; j = i++) {
			const [xi, yi] = verts[i];
			const [xj, yj] = verts[j];
			if (yi > p.y !== yj > p.y && p.x < ((xj - xi) * (p.y - yi)) / (yj - yi) + xi)
				inside = !inside;
		}
		return inside;
	}

	/** Scales the outline about its centroid — k<1 insets, k>1 grows. */
	function scaled(verts: readonly (readonly number[])[], k: number): number[][] {
		const cx = verts.reduce((s, v) => s + v[0], 0) / verts.length;
		const cy = verts.reduce((s, v) => s + v[1], 0) / verts.length;
		return verts.map(([x, y]) => [cx + (x - cx) * k, cy + (y - cy) * k]);
	}

	const dist = (a: Pt, b: Pt) => Math.hypot(a.x - b.x, a.y - b.y);

	// Defaults tuned for an ICON, not a diagram: ~24 drawn nodes and ~40 links is
	// about the ceiling before the interior turns to grey mush at 40px.
	let fieldCount = $state(34);
	let fieldSpread = $state(1.42);
	let fieldPhase = $state(18);
	let linkK = $state(2);
	let linkMax = $state(4.2);
	let clearRadius = $state(1.3);

	const graph = $derived.by<Graph>(() => {
		const verts = outline.verts ?? OUTLINES.chamfer.verts;
		const hull = scaled(verts, 1.06); // accept a little past the rim → clipped bleed
		const core = scaled(verts, 0.84); // where a node is solid enough to draw a dot
		const cx = verts.reduce((s, v) => s + v[0], 0) / verts.length;
		const cy = verts.reduce((s, v) => s + v[1], 0) / verts.length;

		// A anchors come first so their indices match A_EDGES.
		const nodes: Pt[] = ANCHORS.map((a) => ({ x: a.x, y: a.y }));
		const inside: boolean[] = ANCHORS.map(() => true);

		// Vogel's model. The phase spin is purely aesthetic — it rotates which
		// spiral arm points where, and some rotations sit better in a shield.
		const phase = (fieldPhase * Math.PI) / 180;
		for (let i = 0; i < fieldCount; i++) {
			const r = fieldSpread * Math.sqrt(i + 0.5);
			const a = i * GOLDEN + phase;
			const p = { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) };
			if (!inPoly(p, hull)) continue;
			// Keep clear of the A's own vertices so they don't read as doubled.
			if (ANCHORS.some((an) => dist(p, an) < clearRadius)) continue;
			nodes.push(p);
			inside.push(inPoly(p, core));
		}

		// k-nearest-neighbour links over the whole set, deduped. Symmetric kNN
		// gives a connected, organic web without the long stringy edges a pure
		// distance threshold produces.
		const seen = new Set<string>();
		const edges: Edge[] = [];
		const push = (a: number, b: number, isA: boolean) => {
			const key = a < b ? `${a}:${b}` : `${b}:${a}`;
			if (seen.has(key)) return;
			seen.add(key);
			edges.push({ a, b, isA });
		};
		for (const [a, b] of A_EDGES) push(a, b, true);
		for (let i = 0; i < nodes.length; i++) {
			const near = nodes
				.map((p, j) => ({ j, d: dist(nodes[i], p) }))
				.filter((c) => c.j !== i && c.d <= linkMax)
				.sort((x, y) => x.d - y.d)
				.slice(0, linkK);
			for (const c of near) push(i, c.j, false);
		}

		const degree = nodes.map(() => 0);
		for (const e of edges) {
			degree[e.a]++;
			degree[e.b]++;
		}
		return { nodes, inside, edges, degree };
	});

	const chaosEdges = $derived(graph.edges.filter((e) => !e.isA));
	const aEdges = $derived(graph.edges.filter((e) => e.isA));

	function edgeD(g: Graph, e: Edge): string {
		const a = g.nodes[e.a];
		const b = g.nodes[e.b];
		return `M${a.x.toFixed(2)} ${a.y.toFixed(2)} L${b.x.toFixed(2)} ${b.y.toFixed(2)}`;
	}
	function pathOf(g: Graph, es: Edge[]): string {
		return es.map((e) => edgeD(g, e)).join(' ');
	}
	/** Drawable field nodes — anchors excluded, rim ghosts excluded. */
	function fieldDots(g: Graph, r: number, attrs = ''): string {
		const rr = r.toFixed(3);
		return g.nodes
			.map((p, i) =>
				i < ANCHORS.length || !g.inside[i]
					? ''
					: `<circle cx="${p.x.toFixed(2)}" cy="${p.y.toFixed(2)}" r="${rr}" ${attrs}/>`
			)
			.join('');
	}
	function anchorDots(rs: number[], attrs = ''): string {
		return ANCHORS.map(
			(a, i) => `<circle cx="${a.x}" cy="${a.y}" r="${rs[i].toFixed(3)}" ${attrs}/>`
		).join('');
	}

	// Anchor dot sizes — apex heaviest, feet next, mid-leg lightest.
	const ANCHOR_R = [1.05, 0.6, 0.85, 0.78, 0.6, 0.85, 0.78];

	// ── The integrated core ───────────────────────────────────────────────────
	// A different treatment from the line-art variants: the shield is SOLID and
	// everything inside is knocked out of it. The A stops being a highlighted
	// subgraph and becomes a rigid structural element — five joints and three
	// members, drawn heavy, occluding the mesh behind it. The mesh in turn drops
	// to a hairline footprint that never touches the A.
	//
	// Its proportions are its own: wider stance and a lower bar than the line-art
	// skeleton, because a knocked-out form needs more counter to stay open.

	const CORE = {
		apex: { x: 12, y: 5.8 },
		lFoot: { x: 7.9, y: 16.3 },
		rFoot: { x: 16.1, y: 16.3 },
		lBar: { x: 9.27, y: 12.8 },
		rBar: { x: 14.73, y: 12.8 }
	};
	const CORE_PATH = `M${CORE.apex.x} ${CORE.apex.y} L${CORE.lFoot.x} ${CORE.lFoot.y} M${CORE.apex.x} ${CORE.apex.y} L${CORE.rFoot.x} ${CORE.rFoot.y} M${CORE.lBar.x} ${CORE.lBar.y} L${CORE.rBar.x} ${CORE.rBar.y}`;
	const CORE_JOINTS: [{ x: number; y: number }, number][] = [
		[CORE.apex, 1.15],
		[CORE.lBar, 1.0],
		[CORE.rBar, 1.0],
		[CORE.lFoot, 1.25],
		[CORE.rFoot, 1.25]
	];

	// A field of its own, kept clear of the core so the mesh reads as a separate,
	// further layer rather than as scaffolding hanging off the letter.
	let coreCount = $state(64);
	let coreSpread = $state(1.16);
	let corePhase = $state(126);
	let coreClear = $state(2.35);

	const coreGraph = $derived.by<Graph>(() => {
		const verts = outline.verts ?? OUTLINES.crest.verts;
		const hull = scaled(verts, 1.02);
		const core = scaled(verts, 0.88);
		const cx = verts.reduce((s, v) => s + v[0], 0) / verts.length;
		const cy = verts.reduce((s, v) => s + v[1], 0) / verts.length;

		/** Distance from p to the nearest point on the core's three members. */
		const toCore = (p: Pt) => {
			const segs: [Pt, Pt][] = [
				[CORE.apex, CORE.lFoot],
				[CORE.apex, CORE.rFoot],
				[CORE.lBar, CORE.rBar]
			];
			let best = Infinity;
			for (const [a, b] of segs) {
				const vx = b.x - a.x;
				const vy = b.y - a.y;
				const len2 = vx * vx + vy * vy;
				const t = Math.max(0, Math.min(1, ((p.x - a.x) * vx + (p.y - a.y) * vy) / len2));
				best = Math.min(best, Math.hypot(p.x - (a.x + t * vx), p.y - (a.y + t * vy)));
			}
			return best;
		};

		const nodes: Pt[] = [];
		const inside: boolean[] = [];
		const phase = (corePhase * Math.PI) / 180;
		for (let i = 0; i < coreCount; i++) {
			const r = coreSpread * Math.sqrt(i + 0.5);
			const a = i * GOLDEN + phase;
			const p = { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) };
			if (!inPoly(p, hull)) continue;
			if (toCore(p) < coreClear) continue;
			nodes.push(p);
			inside.push(inPoly(p, core));
		}

		const seen = new Set<string>();
		const edges: Edge[] = [];
		for (let i = 0; i < nodes.length; i++) {
			const near = nodes
				.map((p, j) => ({ j, d: dist(nodes[i], p) }))
				.filter((c) => c.j !== i && c.d <= 4.6)
				.sort((x, y) => x.d - y.d)
				.slice(0, 2);
			for (const c of near) {
				const key = i < c.j ? `${i}:${c.j}` : `${c.j}:${i}`;
				if (seen.has(key)) continue;
				seen.add(key);
				edges.push({ a: i, b: c.j, isA: false });
			}
		}
		return { nodes, inside, edges, degree: nodes.map(() => 0) };
	});

	// ── Optical sizing ────────────────────────────────────────────────────────
	// A stroke width in a 24-unit box is a SIZE SPECIFICATION, not a style. 1.4
	// units renders as ~1.4px at 24px — correct — and as ~9px at 160px, which is
	// why an un-tiered mark reads as a fat gem when you scale it up. So every
	// weight below is a base value multiplied by the tier it is drawn at.
	//
	// At 160px one unit is 6.67px; at 40px it is 1.67px; at 24px it is 1px.

	interface Tier {
		key: string;
		/** Stroke multiplier. */
		w: number;
		/** Node-radius multiplier — dots shrink faster than lines. */
		dot: number;
		/** Shield outline weight, in units (not multiplied). */
		outline: number;
		/** Solid treatment: hairline mesh weight + dot radius, in units. */
		mesh: number;
		meshDot: number;
	}

	const TIERS: Record<string, Tier> = {
		lg: { key: 'lg', w: 0.4, dot: 0.58, outline: 0.55, mesh: 0.24, meshDot: 0.26 },
		md: { key: 'md', w: 0.86, dot: 0.88, outline: 1.15, mesh: 0.42, meshDot: 0.32 },
		sm: { key: 'sm', w: 1.18, dot: 1.15, outline: 1.55, mesh: 0.55, meshDot: 0.36 }
	};

	// ── Variants ──────────────────────────────────────────────────────────────
	// Each is a function of the generated graph AND the tier, so changing the
	// field regenerates every card at once and they stay directly comparable.

	interface Variant {
		id: string;
		name: string;
		mech: string;
		idea: string;
		/**
		 * How the shield is drawn for this variant:
		 *   'stroke' (default) — the shared outline, stroked, line-art style
		 *   'fill'             — the shared outline, solid, content knocked out
		 *   'own'              — the variant draws its own shield entirely
		 */
		shield?: 'stroke' | 'fill' | 'own';
		build: (g: Graph, t: Tier) => string;
	}

	const CLIP_OPEN = '<g clip-path="url(#shield-@ID@)">';

	/** Base weights, pre-tier. */
	const W_CHAOS = 0.95;
	const W_A = 1.4;
	const sw = (base: number, t: Tier) => (base * t.w).toFixed(3);

	// ── The neon crest ────────────────────────────────────────────────────────
	// Traced from the reference render. Distinct from every other variant here:
	// the A is neither a lit subgraph nor a solid knockout, but an OUTLINED form
	// — three members stroked wide, with a narrower stroke masked out of their
	// middle, leaving two parallel contours and a transparent core. Five joint
	// rings are built the same way, and because the inner strokes and inner discs
	// are painted into one mask they merge into a single continuous channel.
	//
	// Mesh clearance is designed into the node placement rather than knocked out,
	// so the mark survives a colour change with nothing to re-cut.
	// Standalone copy: showcase/static/armornet-crest.svg

	const NEON = {
		shield:
			'M12 2.1 L20.1 5.3 L20.1 12.9 C20.1 17.4 16.7 20.5 12 21.9 C7.3 20.5 3.9 17.4 3.9 12.9 L3.9 5.3 Z',
		core: 'M12 6.25 L7.9 16.75 M12 6.25 L16.1 16.75 M9.364 13 L14.636 13',
		joints: [
			{ x: 12, y: 6.25, r: 1.02 },
			{ x: 9.364, y: 13, r: 0.86 },
			{ x: 14.636, y: 13, r: 0.86 },
			{ x: 7.9, y: 16.75, r: 1.08 },
			{ x: 16.1, y: 16.75, r: 1.08 }
		],
		meshLinks: [
			'M4.9 9.5 L6.6 11.1 L5.6 12.2 L4.8 13.4 L6.6 14.7 M6.6 11.1 L6.6 14.7 M4.9 9.5 L5.6 12.2',
			'M19.0 9.4 L17.1 11.8 L18.9 12.8 L17.3 15.0 M17.1 11.8 L17.3 15.0 M19.0 9.4 L18.9 12.8',
			'M12.0 16.2 L13.6 18.6 L14.4 17.5 L12.0 16.2 M13.6 18.6 L10.5 19.6 L9.9 18.0 M12.0 16.2 L9.9 18.0'
		],
		meshDots: [
			[4.9, 9.5, 0.16],
			[6.6, 11.1, 0.16],
			[5.6, 12.2, 0.13],
			[4.8, 13.4, 0.16],
			[6.6, 14.7, 0.16],
			[19.0, 9.4, 0.16],
			[17.1, 11.8, 0.16],
			[18.9, 12.8, 0.13],
			[17.3, 15.0, 0.16],
			[12.0, 16.2, 0.16],
			[13.6, 18.6, 0.16],
			[14.4, 17.5, 0.13],
			[10.5, 19.6, 0.16],
			[9.9, 18.0, 0.16]
		]
	};
	/** Contour weight, per tier — the one thing that must be optically sized. */
	const NEON_CONTOUR: Record<string, number> = { lg: 0.32, md: 0.46, sm: 0.58 };

	const VARIANTS: Variant[] = [
		{
			id: 'neon',
			name: 'Neon Crest',
			mech: 'outlined core / contour',
			shield: 'own', // draws its own shield; the shared outline is bypassed
			idea: 'Traced from the reference. The A is an OUTLINED form: three members stroked wide with a narrower stroke masked out of the middle, leaving two parallel contours and a transparent core, plus five joint rings built the same way. The mesh is a faint uncoloured footprint kept clear of the core by placement, so it reads as depth rather than as part of the mark.',
			build: (g, t) => {
				const c = NEON_CONTOUR[t.key];
				const outer = 1.3;
				const inner = Math.max(0.12, outer - 2 * c);
				const j = NEON.joints;
				return `
				<defs>
					<mask id="cut-@ID@" maskUnits="userSpaceOnUse" x="0" y="0" width="24" height="24">
						<rect x="0" y="0" width="24" height="24" fill="#fff"/>
						<g stroke="#000" fill="#000" stroke-linecap="round" stroke-linejoin="round">
							<path d="${NEON.core}" fill="none" stroke-width="${inner.toFixed(3)}"/>
							${j.map((p) => `<circle cx="${p.x}" cy="${p.y}" r="${Math.max(0.1, p.r - c).toFixed(3)}"/>`).join('')}
						</g>
					</mask>
				</defs>
				<g stroke="#7FA79A" stroke-opacity="0.34" stroke-width="${(t.mesh * 0.46).toFixed(3)}" fill="none" stroke-linecap="round">
					${NEON.meshLinks.map((d) => `<path d="${d}"/>`).join('')}
				</g>
				<g fill="#8FB8AA" fill-opacity="0.6">
					${NEON.meshDots.map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${(r * (t.meshDot / 0.26)).toFixed(3)}"/>`).join('')}
				</g>
				<path d="${NEON.shield}" fill="none" stroke="currentColor" stroke-width="${(c * 1.4).toFixed(3)}" stroke-linejoin="round"/>
				<g mask="url(#cut-@ID@)" fill="currentColor" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round">
					<path d="${NEON.core}" fill="none" stroke-width="${outer}"/>
					${j.map((p) => `<circle cx="${p.x}" cy="${p.y}" r="${p.r}"/>`).join('')}
				</g>`;
			}
		},
		{
			id: 'core',
			name: 'Integrated Core',
			mech: 'overlay / depth',
			shield: 'fill',
			idea: 'The shield goes solid and everything inside is knocked out of it. The A stops being a highlighted subgraph and becomes a rigid structural element — five joints, three members — sitting in FRONT of the mesh and occluding it. The mesh drops to a decentralized hairline footprint that never touches the core, so the two read as separate layers at different depths rather than as a letter with scaffolding.',
			build: (g, t) => {
				const cg = coreGraph;
				const ink = 'var(--bg)';
				// The clearance halo is a layout gap, not a weight — it stays a fixed
				// fraction of the member so the A's silhouette is identical at every
				// size. Only the mesh behind it is optically resized.
				const member = 1.5;
				const halo = member + 1.0;
				return `
				${CLIP_OPEN}
					<g stroke="${ink}" fill="none" stroke-width="${t.mesh}" stroke-opacity="0.72"
						stroke-linecap="round" stroke-linejoin="round">
						<path d="${cg.edges.map((e) => `M${cg.nodes[e.a].x.toFixed(2)} ${cg.nodes[e.a].y.toFixed(2)} L${cg.nodes[e.b].x.toFixed(2)} ${cg.nodes[e.b].y.toFixed(2)}`).join(' ')}"/>
					</g>
					<g fill="${ink}" stroke="none" fill-opacity="0.82">
						${cg.nodes
							.map((p, i) =>
								cg.inside[i]
									? `<circle cx="${p.x.toFixed(2)}" cy="${p.y.toFixed(2)}" r="${t.meshDot}"/>`
									: ''
							)
							.join('')}
					</g>
					<!-- knockout halo: clears the mesh so the core's edge stays crisp -->
					<g stroke="currentColor" fill="currentColor" stroke-linecap="round" stroke-linejoin="round">
						<path d="${CORE_PATH}" fill="none" stroke-width="${halo}"/>
						${CORE_JOINTS.map(([p, r]) => `<circle cx="${p.x}" cy="${p.y}" r="${(r + 0.5).toFixed(2)}"/>`).join('')}
					</g>
					<!-- the core itself -->
					<g stroke="${ink}" fill="${ink}" stroke-linecap="round" stroke-linejoin="round">
						<path d="${CORE_PATH}" fill="none" stroke-width="${member}"/>
						${CORE_JOINTS.map(([p, r]) => `<circle cx="${p.x}" cy="${p.y}" r="${r}"/>`).join('')}
					</g>
				</g>`;
			}
		},
		{
			id: 'illuminated',
			name: 'Illuminated Lattice',
			mech: 'graded corridor',
			idea: 'One mesh drawn twice — dim in place, then again bright through a graded corridor mask. Nothing IS the A; the A is where the light is, and the same links that form it carry on into the field at low level.',
			build: (g, t) => `
				<defs>
					<linearGradient id="fall-@ID@" gradientUnits="userSpaceOnUse" x1="12" y1="6.4" x2="12" y2="17.6">
						<stop offset="0" stop-color="#fff"/>
						<stop offset="0.45" stop-color="#fff"/>
						<stop offset="1" stop-color="#5a5a5a"/>
					</linearGradient>
					<mask id="lit-@ID@" maskUnits="userSpaceOnUse" x="0" y="0" width="24" height="24">
						<g fill="none" stroke="url(#fall-@ID@)" stroke-linecap="round" stroke-linejoin="round">
							<path d="${A_PATH}" stroke-width="${sw(4.6, t)}" stroke-opacity="0.18"/>
							<path d="${A_PATH}" stroke-width="${sw(2.9, t)}" stroke-opacity="0.42"/>
							<path d="${A_PATH}" stroke-width="${sw(1.7, t)}" stroke-opacity="1"/>
						</g>
					</mask>
				</defs>
				${CLIP_OPEN}
					<g id="web-@ID@">
						<path d="${pathOf(g, g.edges)}" stroke-width="${sw(W_CHAOS, t)}"/>
						<g fill="currentColor" stroke="none">
							${fieldDots(g, 0.44 * t.dot)}${anchorDots(ANCHOR_R.map((r) => r * 0.72 * t.dot))}
						</g>
					</g>
					<g stroke-opacity="0.24" fill-opacity="0.24">
						<use href="#web-@ID@"/>
					</g>
					<use href="#web-@ID@" mask="url(#lit-@ID@)" stroke-opacity="0.95" stroke-width="${sw(1.3, t)}"/>
				</g>`
		},
		{
			id: 'knockout',
			name: 'Knockout Weave',
			mech: 'occlusion / T-junction',
			idea: 'The A is the near layer; every chaos link crossing it is broken by a gap, exactly as edge-crossings are drawn in real network diagrams. Zero feature contrast — depth ordering is invisible to pop-out — and load-bearing: no crossings means no depth ordering means no A.',
			build: (g, t) => `
				<defs>
					<mask id="wv-@ID@" maskUnits="userSpaceOnUse" x="0" y="0" width="24" height="24">
						<rect x="0" y="0" width="24" height="24" fill="#fff"/>
						<path d="${A_PATH}" fill="none" stroke="#000"
							stroke-width="${sw(W_A + 2.1 * W_CHAOS, t)}" stroke-linecap="round"/>
					</mask>
				</defs>
				${CLIP_OPEN}
					<g mask="url(#wv-@ID@)">
						<path d="${pathOf(g, chaosEdges)}" stroke-width="${sw(W_CHAOS, t)}" stroke-opacity="0.45"/>
					</g>
					<path d="${pathOf(g, aEdges)}" stroke-width="${sw(W_A, t)}"/>
					<g fill="currentColor" stroke="none" fill-opacity="0.5">${fieldDots(g, 0.44 * t.dot)}</g>
					<g fill="currentColor" stroke="none">${anchorDots(ANCHOR_R.map((r) => r * t.dot))}</g>
				</g>`
		},
		{
			id: 'degree',
			name: 'Degree Hubs',
			mech: 'node degree — graph structure',
			idea: 'No tonal emphasis on the letter anywhere: every link is one weight and one opacity. The A resolves because its vertices carry a halo ring earned by their degree — they are structurally special rather than merely brighter. The strongest rebuttal to “it still just looks like an A”.',
			build: (g, t) => `
				${CLIP_OPEN}
					<path d="${pathOf(g, g.edges)}" stroke-width="${sw(W_CHAOS, t)}" stroke-opacity="0.62"/>
					<g fill="currentColor" stroke="none" fill-opacity="0.6">${fieldDots(g, 0.4 * t.dot)}</g>
					<g fill="none" stroke-width="${sw(0.62, t)}" stroke-opacity="0.55">
						${anchorDots(ANCHOR_R.map((r) => (r + 0.62) * t.dot))}
					</g>
					<g fill="currentColor" stroke="none">${anchorDots(ANCHOR_R.map((r) => r * 0.86 * t.dot))}</g>
				</g>`
		},
		{
			id: 'continuity',
			name: 'Broken Continuity',
			mech: 'good continuation',
			idea: 'Identical colour and weight throughout — every chaos link is dashed, and the A’s runs are the only unbroken lines in the field. Continuity is a structural Gestalt channel, so this is one of the few variants that survives the flatten gate untouched.',
			build: (g, t) => `
				${CLIP_OPEN}
					<g stroke-width="${sw(W_CHAOS, t)}" stroke-opacity="0.8">
						${chaosEdges
							.map((e, i) => {
								// Dash cadence varies per edge so the field doesn't stripe.
								const on = (1.3 + ((i * 7) % 11) * 0.14).toFixed(2);
								const off = (1.1 + ((i * 5) % 7) * 0.11).toFixed(2);
								return `<path d="${edgeD(g, e)}" stroke-dasharray="${on} ${off}"/>`;
							})
							.join('')}
					</g>
					<path d="${pathOf(g, aEdges)}" stroke-width="${sw(W_A, t)}"/>
					<g fill="none" stroke-width="${sw(0.7, t)}" stroke-opacity="0.75">
						${fieldDots(g, 0.52 * t.dot)}
					</g>
					<g fill="currentColor" stroke="none">${anchorDots(ANCHOR_R.map((r) => r * t.dot))}</g>
				</g>`
		},
		{
			id: 'peers',
			name: 'Two-Peer Routing',
			mech: 'hue = peer, not letter',
			idea: 'The split-tone rescue. Hue stops marking A-membership and starts marking WHICH PEER a route belongs to, so both colours scatter across the whole field and the A is simply where the two route trees run at full strength and share the bar. The look survives; the pop-out mechanism does not.',
			build: (g, t) => {
				// Peer assignment is a hash of the endpoints, not a side test — so
				// both hues appear on both sides and hue can't be read as "the A".
				const teal: Edge[] = [];
				const violet: Edge[] = [];
				chaosEdges.forEach((e) => ((e.a * 31 + e.b * 17) % 2 ? violet : teal).push(e));
				const bar = sw(W_A * 1.02, t);
				return `
				<defs>
					<linearGradient id="tl-@ID@" gradientUnits="userSpaceOnUse" x1="12" y1="7.2" x2="8.3" y2="16.6">
						<stop offset="0" stop-color="currentColor" stop-opacity="1"/>
						<stop offset="0.55" stop-color="currentColor" stop-opacity="0.9"/>
						<stop offset="1" stop-color="currentColor" stop-opacity="0.3"/>
					</linearGradient>
					<linearGradient id="vt-@ID@" gradientUnits="userSpaceOnUse" x1="12" y1="7.2" x2="15.7" y2="16.6">
						<stop offset="0" stop-color="#A78BFA" stop-opacity="1"/>
						<stop offset="0.55" stop-color="#A78BFA" stop-opacity="0.9"/>
						<stop offset="1" stop-color="#A78BFA" stop-opacity="0.3"/>
					</linearGradient>
					<linearGradient id="mix-@ID@" gradientUnits="userSpaceOnUse" x1="10.85" y1="7.2" x2="13.15" y2="7.2">
						<stop offset="0.5" stop-color="currentColor"/>
						<stop offset="0.5" stop-color="#A78BFA"/>
					</linearGradient>
				</defs>
				${CLIP_OPEN}
					<path d="${pathOf(g, teal)}" stroke-width="${sw(W_CHAOS, t)}" stroke-opacity="0.36"/>
					<path d="${pathOf(g, violet)}" stroke="#A78BFA" stroke-width="${sw(W_CHAOS, t)}" stroke-opacity="0.36"/>
					<path d="M12 7.2 L10.43 11.2 L9.6 13.3 L8.3 16.6" stroke="url(#tl-@ID@)" stroke-width="${sw(W_A, t)}"/>
					<path d="M12 7.2 L13.57 11.2 L14.4 13.3 L15.7 16.6" stroke="url(#vt-@ID@)" stroke-width="${sw(W_A, t)}"/>
					<path d="M9.6 13.3 L14.4 13.3" stroke-width="${bar}" stroke-dasharray="1.6 1.6"/>
					<path d="M9.6 13.3 L14.4 13.3" stroke="#A78BFA" stroke-width="${bar}" stroke-dasharray="1.6 1.6" stroke-dashoffset="1.6"/>
					<g stroke="none" fill-opacity="0.45">
						${g.nodes
							.map((p, i) =>
								i < ANCHORS.length || !g.inside[i]
									? ''
									: `<circle cx="${p.x.toFixed(2)}" cy="${p.y.toFixed(2)}" r="${(0.44 * t.dot).toFixed(3)}" fill="${
											(i * 13) % 2 ? '#A78BFA' : 'currentColor'
										}"/>`
							)
							.join('')}
					</g>
					<g stroke="none">
						<circle cx="12" cy="7.2" r="${(1.05 * t.dot).toFixed(3)}" fill="url(#mix-@ID@)"/>
						<circle cx="9.6" cy="13.3" r="${(0.85 * t.dot).toFixed(3)}" fill="currentColor"/>
						<circle cx="14.4" cy="13.3" r="${(0.85 * t.dot).toFixed(3)}" fill="#A78BFA"/>
						<circle cx="8.3" cy="16.6" r="${(0.72 * t.dot).toFixed(3)}" fill="currentColor" fill-opacity="0.55"/>
						<circle cx="15.7" cy="16.6" r="${(0.72 * t.dot).toFixed(3)}" fill="#A78BFA" fill-opacity="0.55"/>
					</g>
				</g>`;
			}
		},
		{
			id: 'voltage',
			name: 'Voltage Gradient',
			mech: 'radial falloff',
			idea: 'A radial gradient centred inside the counter runs the A at full strength through apex and bar, then decays it to the field’s own opacity at the feet — so the letter dissolves into the mesh at its ends instead of terminating as a stated figure.',
			build: (g, t) => `
				<defs>
					<radialGradient id="volt-@ID@" gradientUnits="userSpaceOnUse" cx="12" cy="11.5" r="7">
						<stop offset="0" stop-color="currentColor" stop-opacity="1"/>
						<stop offset="0.62" stop-color="currentColor" stop-opacity="0.97"/>
						<stop offset="0.82" stop-color="currentColor" stop-opacity="0.7"/>
						<stop offset="1" stop-color="currentColor" stop-opacity="0.4"/>
					</radialGradient>
				</defs>
				${CLIP_OPEN}
					<path d="${pathOf(g, chaosEdges)}" stroke-width="${sw(W_CHAOS, t)}" stroke-opacity="0.48"/>
					<path d="${pathOf(g, aEdges)}" stroke="url(#volt-@ID@)" stroke-width="${sw(W_A, t)}"/>
					<g fill="currentColor" stroke="none" fill-opacity="0.5">${fieldDots(g, 0.44 * t.dot)}</g>
					<g fill="currentColor" stroke="none">
						${anchorDots(
							ANCHOR_R.map((r, i) => (i === 3 || i === 6 ? r * 0.85 : r) * t.dot)
						)}
					</g>
				</g>`
		}
	];

	function withId(markup: string, key: string): string {
		return markup.replaceAll('@ID@', key);
	}

	// ── View state ────────────────────────────────────────────────────────────
	let showFill = $state(true);
	let showSkeleton = $state(false);
	let showField = $state(false);
	let flatten = $state(false);
	let unmask = $state(false);
	let refOpen = $state(false);

	const SKELETON = `<path d="${A_PATH}" stroke="#F87171" stroke-opacity="0.4" stroke-width="0.5" stroke-dasharray="0.8 0.8"/>`;

	function reseed() {
		fieldPhase = Math.round(Math.random() * 360);
		corePhase = Math.round(Math.random() * 360);
	}
	function resetField() {
		fieldCount = 34;
		fieldSpread = 1.42;
		fieldPhase = 18;
		linkK = 2;
		linkMax = 4.2;
		clearRadius = 1.3;
		coreCount = 64;
		coreSpread = 1.16;
		corePhase = 126;
		coreClear = 2.35;
	}

	// ── Reference bench ───────────────────────────────────────────────────────

	const CREST =
		'<path d="M12 3 20 6v5c0 5-3.5 8.5-8 10-4.5-1.5-8-5-8-10V6z"/><circle cx="12" cy="11" r="1.3" fill="currentColor" stroke="none"/><path d="M12 11 8 8M12 11 16 8M12 11 8 14M12 11 16 14M12 11 12 16.5"/><circle cx="8" cy="8" r="1"/><circle cx="16" cy="8" r="1"/><circle cx="8" cy="14" r="1"/><circle cx="16" cy="14" r="1"/><circle cx="12" cy="16.5" r="1"/>';

	// `sampleMarkup` measures real SVG geometry, so it needs a DOM: it runs in an
	// effect (client-only), never at module scope, or the prerender pass 500s.
	let crestBins = $state<SampledShape | undefined>(undefined);
	$effect(() => {
		if (typeof document === 'undefined' || crestBins) return;
		crestBins = sampleMarkup('<path d="M12 3 20 6v5c0 5-3.5 8.5-8 10-4.5-1.5-8-5-8-10V6z"/>');
	});
	const R = 96;
	const crestSil = $derived(crestBins ? binsSilhouette(crestBins, R) : '');
	const crestScale = $derived(crestBins ? R / crestBins.maxR : 1);

	let n = $state(2.6);
	let apexAngle = $state(90);
	let apexAmp = $state(0.32);
	let apexSigma = $state(24);
	let strokeWidth = $state(2.2);
	let doubleStroke = $state(true);

	const spec = $derived<ShapeSpec>({
		kind: 'shield',
		n,
		apexAngle,
		apexAmp,
		apexSigma,
		strokeWidth,
		doubleStroke
	});
	const SHIPPED: ShapeSpec = {
		kind: 'shield',
		n: 2.6,
		apexAngle: 90,
		apexAmp: 0.32,
		apexSigma: 24,
		strokeWidth: 2.2,
		doubleStroke: true
	};
	const liveSil = $derived(silhouettePath(spec, R));
	const shippedSil = silhouettePath(SHIPPED, R);
	const PORTS = [
		{ start: 200, end: 250, col: '#22D3EE' },
		{ start: 290, end: 340, col: '#A78BFA' },
		{ start: 20, end: 70, col: '#5EEAD4' }
	];
	const liveArcs = $derived(PORTS.map((p) => shapeArcPath(spec, p.start, p.end, R)));
	const specLine = $derived(
		`{ kind: 'shield', n: ${n}, apexAngle: ${apexAngle}, apexAmp: ${apexAmp}, apexSigma: ${apexSigma}, strokeWidth: ${strokeWidth}${doubleStroke ? ', doubleStroke: true' : ''} }`
	);

	function reset() {
		n = 2.6;
		apexAngle = 90;
		apexAmp = 0.32;
		apexSigma = 24;
		strokeWidth = 2.2;
		doubleStroke = true;
	}
</script>

{#snippet art(v: Variant, tierKey: string, cls: string, label: string | null)}
	{@const t = TIERS[tierKey]}
	{@const key = `${v.id}-${tierKey}`}
	<svg
		viewBox="0 0 24 24"
		class="ms-glyph {cls} ms-t-{tierKey}"
		class:ms-flat={flatten && !v.shield}
		class:ms-unmask={unmask}
		role={label ? 'img' : 'presentation'}
		aria-label={label}
	>
		<defs>
			<clipPath id="shield-{key}"><path d={outline.d} /></clipPath>
		</defs>
		{#if v.shield === 'fill'}
			<path d={outline.d} fill="currentColor" stroke="none" />
		{:else if v.shield !== 'own'}
			{#if showFill}
				<path d={outline.d} fill="currentColor" fill-opacity="0.06" stroke="none" />
			{/if}
			<path d={outline.d} stroke-width={t.outline} />
		{/if}
		{@html withId(v.build(graph, t), key)}
		{#if showSkeleton && !v.shield}{@html SKELETON}{/if}
	</svg>
{/snippet}

{#snippet card(v: Variant)}
	<article class="ms-card">
		<header class="ms-card-head">
			<span class="ms-cap">{v.name}</span>
			<code class="ms-id">{v.mech}</code>
		</header>

		<div class="ms-card-art">
			{@render art(v, 'lg', 'ms-art-big', v.name)}
			<!-- Legibility ride-along: the crest has to survive the nav rail. -->
			<div class="ms-card-sizes">
				<div class="ms-size">
					{@render art(v, 'md', 'ms-art-mid', null)}
					<span class="ms-cap ms-cap-sm">40</span>
				</div>
				<div class="ms-size">
					{@render art(v, 'sm', 'ms-art-sml', null)}
					<span class="ms-cap ms-cap-sm">24</span>
				</div>
			</div>
		</div>

		<p class="ms-note">{v.idea}</p>
	</article>
{/snippet}

<div class="ms-page">
	<header class="ms-head">
		<h1>Mesh shield</h1>
		<p>
			The inner mesh must resolve into an <strong>“A”</strong> without ever being
			a drawn one. The field is no longer hand-placed — it is
			<strong>phyllotaxis</strong>, the golden angle at 137.5077°, the rule a
			sunflower head uses. Because φ is the irrational worst approximated by
			fractions, successive points never fall into rows: the packing is
			aperiodic yet near-uniform. Links come from a k-nearest rule over the
			<em>whole</em> node set — A anchors included — so the letter’s vertices are
			ordinary members of the graph rather than a figure laid on a backdrop.
		</p>
	</header>

	<!-- ── Global controls ─────────────────────────────────────────────────── -->
	<section class="ms-bar">
		<div class="ms-bar-row">
			<span class="ms-ctl-title">Outline</span>
			<div class="ms-ctl-actions">
				{#each Object.keys(OUTLINES) as k}
					<button
						class="ms-btn"
						class:ms-on={outlineKey === k}
						title={OUTLINES[k as OutlineKey].note}
						onclick={() => (outlineKey = k as OutlineKey)}
						>{OUTLINES[k as OutlineKey].label}</button
					>
				{/each}
			</div>
			<span class="ms-sep"></span>
			<span class="ms-ctl-title">Gates</span>
			<div class="ms-ctl-actions">
				<button
					class="ms-btn"
					class:ms-on={flatten}
					title="One colour, one opacity, one stroke weight. If the A survives, the emergence is structural; if it vanishes, it was decoration."
					onclick={() => (flatten = !flatten)}>flatten</button
				>
				<button
					class="ms-btn"
					class:ms-on={unmask}
					title="Drop mask compositing — separates masks doing structural work (occlusion) from masks used only to brighten."
					onclick={() => (unmask = !unmask)}>unmask</button
				>
				<button
					class="ms-btn"
					class:ms-on={showSkeleton}
					onclick={() => (showSkeleton = !showSkeleton)}>skeleton</button
				>
				<button class="ms-btn" class:ms-on={showFill} onclick={() => (showFill = !showFill)}
					>fill</button
				>
				<button class="ms-btn" class:ms-on={showField} onclick={() => (showField = !showField)}
					>field</button
				>
			</div>
			<span class="ms-note ms-bar-note">
				{graph.nodes.length} nodes · {graph.edges.length} links
			</span>
		</div>

		{#if showField}
			<div class="ms-field">
				<label class="ms-row">
					<span class="ms-key">points · n</span>
					<input type="range" min="12" max="120" step="1" bind:value={fieldCount} />
					<span class="ms-val">{fieldCount}</span>
				</label>
				<label class="ms-row">
					<span class="ms-key">spread · c</span>
					<input type="range" min="0.7" max="2.2" step="0.02" bind:value={fieldSpread} />
					<span class="ms-val">{fieldSpread.toFixed(2)}</span>
				</label>
				<label class="ms-row">
					<span class="ms-key">phase · deg</span>
					<input type="range" min="0" max="360" step="1" bind:value={fieldPhase} />
					<span class="ms-val">{fieldPhase}</span>
				</label>
				<label class="ms-row">
					<span class="ms-key">links · k</span>
					<input type="range" min="1" max="6" step="1" bind:value={linkK} />
					<span class="ms-val">{linkK}</span>
				</label>
				<label class="ms-row">
					<span class="ms-key">link max · len</span>
					<input type="range" min="2" max="9" step="0.1" bind:value={linkMax} />
					<span class="ms-val">{linkMax.toFixed(1)}</span>
				</label>
				<label class="ms-row">
					<span class="ms-key">A clearance</span>
					<input type="range" min="0" max="2.5" step="0.05" bind:value={clearRadius} />
					<span class="ms-val">{clearRadius.toFixed(2)}</span>
				</label>
				<label class="ms-row">
					<span class="ms-key">core · points</span>
					<input type="range" min="16" max="140" step="1" bind:value={coreCount} />
					<span class="ms-val">{coreCount}</span>
				</label>
				<label class="ms-row">
					<span class="ms-key">core · spread</span>
					<input type="range" min="0.7" max="2.2" step="0.02" bind:value={coreSpread} />
					<span class="ms-val">{coreSpread.toFixed(2)}</span>
				</label>
				<label class="ms-row">
					<span class="ms-key">core · phase</span>
					<input type="range" min="0" max="360" step="1" bind:value={corePhase} />
					<span class="ms-val">{corePhase}</span>
				</label>
				<label class="ms-row">
					<span class="ms-key">core · clear</span>
					<input type="range" min="0.6" max="4.5" step="0.05" bind:value={coreClear} />
					<span class="ms-val">{coreClear.toFixed(2)}</span>
				</label>
				<div class="ms-ctl-actions">
					<button class="ms-btn" onclick={reseed}>spin</button>
					<button class="ms-btn" onclick={resetField}>reset field</button>
				</div>
			</div>
		{/if}
	</section>

	{#if flatten}
		<p class="ms-alert">
			<strong>FLATTEN ON</strong> — one colour, one opacity, one stroke weight. Node
			radius, dash and depth-gaps are left alone: those are structural channels,
			not decoration. Anything whose A disappears here was never emergent.
		</p>
	{/if}

	<section class="ms-group">
		<h2 class="ms-group-title">
			Pass 3 · phyllotaxis field — the A emerges from a generated network
		</h2>
		<div class="ms-iters">
			{#each VARIANTS as v (v.id)}{@render card(v)}{/each}
		</div>
	</section>

	<!-- ── Reference bench (collapsed) ─────────────────────────────────────── -->
	<section class="ms-panel">
		<button class="ms-disclose" onclick={() => (refOpen = !refOpen)}>
			<span>{refOpen ? '▾' : '▸'}</span>
			<h2>Reference · shipped crest &amp; the parametric shield</h2>
		</button>

		{#if refOpen}
			<div class="ms-bench">
				<figure class="ms-cell">
					<figcaption>crestlink · sampled silhouette</figcaption>
					<svg viewBox="-140 -140 280 280" role="img" aria-label="armornet server crest">
						<circle r={R} class="ms-guide" />
						{#if crestSil}
							<path d={crestSil} class="ms-body" />
							<path d={crestSil} class="ms-outline" />
						{/if}
						<g transform="scale({crestScale}) translate(-12,-12)" class="ms-glyph">
							{@html CREST}
						</g>
					</svg>
					<p class="ms-note">
						The glyph IS the body — the crest owns its outline, which is why the
						control-plane radar sweep is suppressed for sampled nodes.
					</p>
				</figure>

				<figure class="ms-cell">
					<figcaption>ShapeKind 'shield' · live</figcaption>
					<svg viewBox="-140 -140 280 280" role="img" aria-label="parametric shield silhouette">
						<circle r={R} class="ms-guide" />
						<path d={shippedSil} class="ms-ghost" />
						<path d={liveSil} class="ms-body" />
						<path d={liveSil} class="ms-outline" style:stroke-width={strokeWidth} />
						{#if doubleStroke}
							<path d={liveSil} class="ms-inner-stroke" transform="scale(0.88)" />
						{/if}
						{#each liveArcs as d, i}
							<path {d} class="ms-arc" style:stroke={PORTS[i].col} />
						{/each}
					</svg>
					<p class="ms-note">
						Dashed outline = shipped <code>SIGNET.proxy</code>. Coloured arcs are the
						port ring riding the silhouette via <code>shapeArcPath</code>.
					</p>
				</figure>
			</div>

			<div class="ms-controls">
				<div class="ms-ctl-head">
					<span class="ms-ctl-title">Shield spec</span>
					<div class="ms-ctl-actions">
						<button
							class="ms-btn"
							class:ms-on={doubleStroke}
							onclick={() => (doubleStroke = !doubleStroke)}>double</button
						>
						<button class="ms-btn" onclick={reset}>reset</button>
					</div>
				</div>
				<label class="ms-row">
					<span class="ms-key">n · squareness</span>
					<input type="range" min="1.4" max="8" step="0.1" bind:value={n} />
					<span class="ms-val">{n.toFixed(1)}</span>
				</label>
				<label class="ms-row">
					<span class="ms-key">apexAngle · deg</span>
					<input type="range" min="0" max="359" step="1" bind:value={apexAngle} />
					<span class="ms-val">{apexAngle}</span>
				</label>
				<label class="ms-row">
					<span class="ms-key">apexAmp · ·r</span>
					<input type="range" min="0" max="0.7" step="0.01" bind:value={apexAmp} />
					<span class="ms-val">{apexAmp.toFixed(2)}</span>
				</label>
				<label class="ms-row">
					<span class="ms-key">apexSigma · deg</span>
					<input type="range" min="6" max="90" step="1" bind:value={apexSigma} />
					<span class="ms-val">{apexSigma}</span>
				</label>
				<label class="ms-row">
					<span class="ms-key">strokeWidth</span>
					<input type="range" min="0.8" max="5" step="0.1" bind:value={strokeWidth} />
					<span class="ms-val">{strokeWidth.toFixed(1)}</span>
				</label>
				<pre class="ms-code">{specLine}</pre>
			</div>
		{/if}
	</section>

	<footer class="ms-foot">
		A winning pass lands in <code>showcase/src/lib/icons/Icon.svelte</code> (crestlink),
		<code>showcase/src/lib/icons/supply-chain-glyphs.ts</code> (HUB_GLYPH —
		must stay in step), and <code>showcase/src/lib/mesh-studio/node-shapes.ts</code
		> (the parametric spec).
	</footer>
</div>

<style>
	.ms-page {
		display: flex;
		flex-direction: column;
		gap: 1.4rem;
		padding: 1.5rem;
		max-width: 84rem;
		margin: 0 auto;
		color: var(--fg);
	}
	.ms-head h1 {
		margin: 0 0 0.4rem;
		font-size: 1.4rem;
		letter-spacing: 0.02em;
	}
	.ms-head p {
		margin: 0;
		max-width: 62rem;
		color: var(--fg-dim);
		font-size: 0.86rem;
		line-height: 1.6;
	}
	code {
		font-family: var(--mono, monospace);
		font-size: 0.82em;
		color: var(--accent);
	}

	/* ── bar ── */
	.ms-bar {
		display: flex;
		flex-direction: column;
		gap: 0.6rem;
		border: 1px solid var(--border);
		border-radius: 10px;
		background: var(--bg-elev);
		padding: 0.6rem 0.9rem;
		font-family: var(--mono, monospace);
		position: sticky;
		top: 0;
		z-index: 5;
	}
	.ms-bar-row {
		display: flex;
		align-items: center;
		gap: 0.7rem;
		flex-wrap: wrap;
	}
	.ms-sep {
		width: 1px;
		height: 1.1rem;
		background: var(--border);
	}
	.ms-bar-note {
		margin-left: auto;
	}
	.ms-field {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(16rem, 1fr));
		gap: 0.4rem 1.2rem;
		border-top: 1px solid var(--border);
		padding-top: 0.6rem;
	}
	.ms-alert {
		margin: 0;
		padding: 0.55rem 0.9rem;
		border: 1px dashed var(--accent);
		border-radius: 8px;
		font-family: var(--mono, monospace);
		font-size: 0.66rem;
		line-height: 1.6;
		color: var(--fg-dim);
	}
	.ms-alert strong {
		color: var(--accent);
		letter-spacing: 0.12em;
	}

	/* ── groups ── */
	.ms-group {
		display: flex;
		flex-direction: column;
		gap: 0.7rem;
	}
	.ms-group-title {
		margin: 0;
		font-family: var(--mono, monospace);
		font-size: 0.62rem;
		letter-spacing: 0.18em;
		text-transform: uppercase;
		color: var(--fg-dim);
		font-weight: 500;
	}
	.ms-iters {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(19rem, 1fr));
		gap: 1rem;
	}
	.ms-card {
		display: flex;
		flex-direction: column;
		gap: 0.7rem;
		border: 1px solid var(--border);
		border-radius: 10px;
		background: var(--bg-elev);
		padding: 0.9rem;
	}
	.ms-card-head {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: 0.5rem;
	}
	.ms-id {
		font-size: 0.58rem;
		opacity: 0.65;
		text-align: right;
	}
	.ms-card-art {
		display: flex;
		align-items: center;
		gap: 1rem;
	}
	.ms-art-big {
		width: 10rem;
		height: 10rem;
		flex: none;
	}
	.ms-art-mid {
		width: 40px;
		height: 40px;
	}
	.ms-art-sml {
		width: 24px;
		height: 24px;
	}
	.ms-card-sizes {
		display: flex;
		flex-direction: column;
		gap: 0.8rem;
		align-items: center;
	}
	.ms-size {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.25rem;
	}

	/* ── glyph ── */
	.ms-glyph {
		stroke: var(--accent);
		fill: none;
		stroke-width: 1.4;
		stroke-linecap: round;
		stroke-linejoin: round;
		color: var(--accent);
	}

	/* The flatten gate. Injected markup is not scoped by Svelte, so these have to
	   be :global. `defs` is excluded — recolouring a mask's own black stroke
	   would change what the mask does, which is not what the gate is testing. */
	.ms-flat :global(*:not(defs):not(defs *)) {
		stroke: var(--accent) !important;
		stroke-opacity: 1 !important;
		fill-opacity: 1 !important;
	}
	.ms-flat :global([fill]:not([fill='none']):not(defs *)) {
		fill: var(--accent) !important;
	}
	/* One weight — but "one weight" is per-tier, or flattening the hero would
	   just reintroduce the 9px slab this page exists to avoid. */
	.ms-flat.ms-t-lg :global(*:not(defs):not(defs *)) {
		stroke-width: 0.46 !important;
	}
	.ms-flat.ms-t-md :global(*:not(defs):not(defs *)) {
		stroke-width: 1 !important;
	}
	.ms-flat.ms-t-sm :global(*:not(defs):not(defs *)) {
		stroke-width: 1.35 !important;
	}
	.ms-unmask :global([mask]) {
		mask: none !important;
	}

	/* ── reference bench ── */
	.ms-bench {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(18rem, 1fr));
		gap: 1rem;
	}
	.ms-cell {
		margin: 0;
		border: 1px solid var(--border);
		border-radius: 10px;
		padding: 0.9rem;
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}
	.ms-cell figcaption {
		font-family: var(--mono, monospace);
		font-size: 0.6rem;
		letter-spacing: 0.18em;
		text-transform: uppercase;
		color: var(--fg-dim);
	}
	.ms-cell svg {
		width: 100%;
		height: auto;
		aspect-ratio: 1;
	}
	.ms-guide {
		fill: none;
		stroke: var(--border);
		stroke-width: 1;
		stroke-dasharray: 3 5;
		opacity: 0.7;
	}
	.ms-body {
		fill: var(--accent);
		fill-opacity: 0.1;
	}
	.ms-outline {
		fill: none;
		stroke: var(--accent);
		stroke-width: 2.2;
		stroke-linejoin: round;
	}
	.ms-ghost {
		fill: none;
		stroke: var(--fg-dim);
		stroke-width: 1;
		stroke-dasharray: 5 5;
		opacity: 0.55;
	}
	.ms-inner-stroke {
		fill: none;
		stroke: var(--accent);
		stroke-width: 1;
		opacity: 0.35;
		stroke-linejoin: round;
	}
	.ms-arc {
		fill: none;
		stroke-width: 3;
		stroke-linecap: round;
		stroke-linejoin: round;
		opacity: 0.85;
	}

	/* ── controls ── */
	.ms-controls {
		border: 1px solid var(--border);
		border-radius: 10px;
		padding: 0.9rem;
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		font-family: var(--mono, monospace);
	}
	.ms-ctl-head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.6rem;
		flex-wrap: wrap;
	}
	.ms-ctl-title {
		font-size: 0.62rem;
		letter-spacing: 0.18em;
		text-transform: uppercase;
		color: var(--fg-dim);
	}
	.ms-ctl-actions {
		display: flex;
		gap: 0.3rem;
		align-items: center;
	}
	.ms-btn {
		padding: 0.25rem 0.6rem;
		font-size: 0.62rem;
		letter-spacing: 0.08em;
		border: 1px solid var(--border);
		border-radius: 4px;
		background: transparent;
		color: var(--fg-dim);
		cursor: pointer;
		font-family: var(--mono, monospace);
	}
	.ms-btn:hover {
		border-color: var(--accent);
		color: var(--fg);
	}
	.ms-on {
		border-color: var(--accent);
		color: var(--accent);
	}
	.ms-row {
		display: grid;
		grid-template-columns: 7.5rem 1fr 3rem;
		align-items: center;
		gap: 0.6rem;
	}
	.ms-key {
		font-size: 0.64rem;
		letter-spacing: 0.06em;
		color: var(--fg-dim);
	}
	.ms-val {
		font-size: 0.66rem;
		text-align: right;
		color: var(--accent);
	}
	.ms-row input[type='range'] {
		width: 100%;
		accent-color: var(--accent);
	}
	.ms-code {
		margin: 0.3rem 0 0;
		padding: 0.55rem 0.7rem;
		border: 1px solid var(--border);
		border-radius: 6px;
		background: var(--bg);
		color: var(--fg-dim);
		font-size: 0.68rem;
		line-height: 1.5;
		white-space: pre-wrap;
		word-break: break-word;
	}

	/* ── panel ── */
	.ms-panel {
		border: 1px solid var(--border);
		border-radius: 10px;
		background: var(--bg-elev);
		padding: 0.9rem;
		display: flex;
		flex-direction: column;
		gap: 0.8rem;
	}
	.ms-disclose {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		background: none;
		border: none;
		padding: 0;
		cursor: pointer;
		color: var(--fg-dim);
		font-family: var(--mono, monospace);
	}
	.ms-disclose h2 {
		margin: 0;
		font-size: 0.62rem;
		letter-spacing: 0.18em;
		text-transform: uppercase;
		font-weight: 500;
	}
	.ms-cap {
		font-family: var(--mono, monospace);
		font-size: 0.68rem;
		letter-spacing: 0.1em;
		color: var(--fg);
	}
	.ms-cap-sm {
		font-size: 0.55rem;
		color: var(--fg-dim);
	}
	.ms-note {
		margin: 0;
		font-size: 0.7rem;
		line-height: 1.55;
		color: var(--fg-dim);
	}
	.ms-foot {
		font-size: 0.7rem;
		line-height: 1.6;
		color: var(--fg-dim);
	}
</style>
