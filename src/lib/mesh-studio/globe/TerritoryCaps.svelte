<script lang="ts">
	// ── TerritoryCaps — region outline + tint + name, on the globe ──────────────
	// When a globe is packed by `packSphereClusters`, the groups are IMPLIED by
	// colour and proximity. This layer NAMES and BOUNDS them.
	//
	// Every territory is WALLED: a rampart standing UP off the rim, with posts at
	// intervals and a lit crest along the top. Quiet at rest, lit when the
	// territory is the subject. A boundary you can see at rest is the point — a
	// region that only exists once you click it cannot tell you the globe HAS
	// regions.
	//
	// The wall is real 3D, not a screen-space ornament: every rim sample is
	// projected TWICE from the same unit direction — once on the shell, once at
	// `wallHeight` globe radii above it (`project`'s `lift`). The quad between the
	// two is the pane. So the wall shares the nodes' vanishing point, leans with
	// the curve of the sphere, and foreshortens to nothing as its region turns
	// away — none of which a fixed screen-space offset can do. It is deliberately
	// left transparent and unshaded: a hologram of a boundary, not a solid that
	// would hide the nodes it encloses.
	//
	// Two artifacts had to be handled, both consequences of a cap being a closed
	// curve on a sphere:
	//
	//  · Half the rim can be behind the globe. `rim()` pins those points to the limb
	//    so the FILL closes seamlessly, but building a wall on that path would run a
	//    rampart along the horizon — a border that is not one, reading as a bug. So
	//    the wall is built from `rimRuns()`, which emits only the runs that actually
	//    face the viewer and leaves the rest unbuilt.
	//  · A cap seen edge-on is mostly limb, so even honest runs degenerate into a
	//    crescent hugging the horizon. Wall opacity therefore falls off with how
	//    face-on the cap is, and a territory fades out before it can mislead.
	//
	// Strokes are non-scaling, so a boundary holds one weight against GlobeFrame's
	// meridians at any zoom rather than thickening into a band.
	//
	// Drawn AFTER GlobeFrame and BEFORE MeshStudio, so nodes always paint on top.
	import { getContext } from 'svelte';
	import { CANVAS_CTX, type CanvasContextValue } from '../../primitives/canvas-camera.js';
	import { alignZ, spin, project, type Cap, type Vec3 } from '../../physics/sphere.js';
	import { contours, type Terrain, type Relief } from '../../physics/terrain.js';

	/** How a region LOOKS and what its ground is like — everything a caller can say
	 *  about a territory without knowing where it landed on the sphere.
	 *
	 *  Split from `Territory` because the two are authored in different places: a
	 *  caller writes this by hand, while the cap is solved by `packSphereClusters`
	 *  and only exists once the globe has been packed. Asking a caller for a cap it
	 *  cannot know is what made `territoryOf` awkward to type. */
	export interface TerritoryStyle {
		name: string;
		color: string;
		/** Brighter variant used while the territory is the subject. */
		glow?: string;
		/** The character of this region's ground.
		 *
		 *  Four regions sharing one elevation field are the same landscape four
		 *  times, and once the palette collapses there is no tint left to tell them
		 *  apart either. The biome puts the difference where it survives both: in
		 *  the SPACING of the contours, which is what the eye actually reads as
		 *  terrain. Consumed by `maskTerrain`, not here — the ground has to be one
		 *  field or the nodes and the floor stop agreeing about where it is. */
		biome?: Relief;
	}

	/** One named region of the globe: its style, plus where it actually landed. */
	export interface Territory extends TerritoryStyle {
		/** The group key it was packed under — also its identity here. */
		key: string;
		cap: Cap;
	}

	let {
		cx,
		cy,
		globeR,
		yaw,
		pitch,
		viewDistance,
		territories = [],
		/** The territory in focus, or null. Only the focused one gets a tint. */
		focus = null,
		/** 0..1 through the focusing beat — the tint blooms rather than switching. */
		progress = 1,
		/** Whether to draw the names at all. */
		labels = true,
		/** How far the wall stands off the sphere, in GLOBE RADII — the same unit
		 *  `project`'s lift takes, so 0.06 is 6% of the globe's radius and the wall
		 *  keeps its proportion however big the sphere is packed.
		 *
		 *  0 lays it flat back on the surface: the pane collapses, the posts vanish,
		 *  and base and crest fall on the same line — which is exactly the outline
		 *  this layer drew before it stood up. */
		wallHeight = 0.06,
		terrain,
		relief = 0,
		contourInterval = 0.07,
		moving = false
	}: {
		cx: number;
		cy: number;
		globeR: number;
		yaw: number;
		pitch: number;
		viewDistance: number;
		territories?: Territory[];
		focus?: string | null;
		progress?: number;
		labels?: boolean;
		wallHeight?: number;
		/** The ground. A territory is not an outline on a sphere — it is a piece of
		 *  LAND, and its floor is drawn as a contour web rising out of the surface.
		 *  What is between territories gets no floor and no web: not sea, nothing.
		 *  Expected to be cut to these same caps (see terrain `maskTerrain`), so the
		 *  land falls to the surface exactly at the shore. */
		terrain?: Terrain;
		/** Height of the highest ground, in globe radii. */
		relief?: number;
		/** Elevation between neighbouring contour lines, in the field's own units
		 *  (a masked terrain runs 0..1). The map's scale, and the one knob that
		 *  decides how much ink the floor costs — halving it doubles the lines
		 *  everywhere. Every 5th comes out as a heavier index contour.
		 *
		 *  Set against the field's REAL range, not its nominal one. `maskTerrain`
		 *  lifts to 0..1, but the interior of a region only reaches roughly 0.25–0.75
		 *  — summed waves almost never peak together — so an interval chosen for the
		 *  full range yields two or three lines and an empty-looking map. */
		contourInterval?: number;
		/** Whether the camera is currently flying. Drops the per-frame-expensive
		 *  ornament — see the bloom on the wall below — for as long as nobody could
		 *  see it anyway. */
		moving?: boolean;
	} = $props();

	const ctx = getContext<CanvasContextValue>(CANVAS_CTX);
	const transform = ctx.transform;

	/** Counter-scale, so a name holds one size on screen at any camera zoom.
	 *  Nothing in this engine counter-scales, so the layer that needs it does it. */
	const inv = $derived(1 / Math.max(0.0001, transform.tk));

	const SAMPLES = 72;
	/** A post every N samples. Dense enough to read as structure holding the pane
	 *  up, sparse enough that the wall stays something you can see the globe
	 *  through — which is the whole reason it is transparent. */
	const POST_EVERY = 6;
	/** Battlement geometry for the FLAT wall, in SCREEN px — counter-scaled at use
	 *  so it keeps its built proportions at any zoom. Merlons every other sample
	 *  give a dense enough comb to read as a parapet without becoming a band. */
	const MERLON_LEN = 5.5;
	const MERLON_EVERY = 2;
	const TOWER_SIZE = 2.1;
	const TOWER_EVERY = 12;

	/** Whether the wall stands up at all.
	 *
	 *  The two drawings are genuinely different objects, not one with a parameter
	 *  turned down. A raised wall is a STRUCTURE — you read its height from the
	 *  pane and the posts, and ornament on top of that is noise. A flat wall has
	 *  no height to read, so it has to say "wall" some other way, and battlements
	 *  are that way: they are what the eye takes for a rampart seen from above. */
	const raised = $derived(wallHeight > 0.001);

	/** The cap's rim, projected. Points that have gone round the back are pinned
	 *  to the limb instead of being dropped — a dropped point opens the polygon
	 *  and the fill spills across the globe. At z=0 the projection lands exactly
	 *  on the limb circle, so the pinned points join the visible arc seamlessly. */
	function rim(cap: Cap): string {
		const sinA = Math.sin(cap.alpha);
		const cosA = Math.cos(cap.alpha);
		const pts: string[] = [];
		for (let i = 0; i <= SAMPLES; i++) {
			const t = (i / SAMPLES) * Math.PI * 2;
			const local: Vec3 = { x: Math.cos(t) * sinA, y: Math.sin(t) * sinA, z: cosA };
			const s = spin(alignZ(cap.center, local), yaw, pitch);
			if (s.z >= 0) {
				const p = project(s, globeR, viewDistance);
				pts.push(`${(cx + p.x).toFixed(1)},${(cy + p.y).toFixed(1)}`);
			} else {
				const d = Math.hypot(s.x, s.y) || 1;
				pts.push(
					`${(cx + (s.x / d) * globeR).toFixed(1)},${(cy + (s.y / d) * globeR).toFixed(1)}`
				);
			}
		}
		return pts.join(' ');
	}

	type Pt = { x: number; y: number };
	/** One sample of the wall: where it meets the sphere, and where its crest is.
	 *  Both come from the SAME unit direction — the only difference is the lift. */
	type Seg = { base: Pt; top: Pt };

	/** The rim's VISIBLE runs, as base/crest pairs.
	 *
	 *  Where `rim()` pins hidden points to the limb to keep a fill closed, the WALL
	 *  must not: that pinned arc is an artifact of the projection, not a boundary,
	 *  and building on it puts a rampart along the horizon. So hidden samples break
	 *  the run instead. A cap straddling the limb yields two runs (the sampling
	 *  starts mid-arc), which is why this returns a list. */
	function rimRuns(cap: Cap): Seg[][] {
		const sinA = Math.sin(cap.alpha);
		const cosA = Math.cos(cap.alpha);
		const runs: Seg[][] = [];
		let run: Seg[] = [];
		for (let i = 0; i <= SAMPLES; i++) {
			const t = (i / SAMPLES) * Math.PI * 2;
			const local: Vec3 = { x: Math.cos(t) * sinA, y: Math.sin(t) * sinA, z: cosA };
			const s = spin(alignZ(cap.center, local), yaw, pitch);
			if (s.z >= 0.02) {
				const b = project(s, globeR, viewDistance);
				const c = project(s, globeR, viewDistance, wallHeight);
				run.push({
					base: { x: cx + b.x, y: cy + b.y },
					top: { x: cx + c.x, y: cy + c.y }
				});
			} else if (run.length) {
				runs.push(run);
				run = [];
			}
		}
		if (run.length) runs.push(run);
		// The sweep starts at an arbitrary t, so a run that wraps the seam arrives as
		// a head and a tail of one arc — join them back into a single wall.
		if (runs.length > 1) {
			const first = runs[0];
			const last = runs[runs.length - 1];
			const a = first[0].base;
			const b = last[last.length - 1].base;
			if (Math.hypot(a.x - b.x, a.y - b.y) < globeR * 0.08) {
				runs[0] = [...last, ...first];
				runs.pop();
			}
		}
		return runs.filter((r) => r.length > 1);
	}

	const d = (p: Pt) => `${p.x.toFixed(1)} ${p.y.toFixed(1)}`;
	const poly = (pts: Pt[]) => `M ${pts.map(d).join(' L ')}`;

	/** A polyline along one edge of the wall — `base` for where it meets the
	 *  sphere, `top` for its crest. One path across every run, so a territory costs
	 *  a handful of elements rather than one per sample. */
	function edgePath(runs: Seg[][], edge: 'base' | 'top'): string {
		return runs.map((r) => poly(r.map((s) => s[edge]))).join(' ');
	}

	/** The pane: the quad strip between base and crest, closed into one polygon per
	 *  run — out along the ground, back along the crest. Filled faintly rather than
	 *  shaded, so it reads as a held field and never occludes a node behind it. */
	function panePath(runs: Seg[][]): string {
		return runs
			.map((r) => {
				const tops = r.map((s) => s.top).reverse();
				return `${poly(r.map((s) => s.base))} L ${tops.map(d).join(' L ')} Z`;
			})
			.join(' ');
	}

	/** Posts: the true vertical struts from ground to crest. These replace what used
	 *  to be battlement ticks pushed out in SCREEN space — a post is the same rim
	 *  direction at two radii, so it leans with the sphere and shortens to nothing
	 *  at the limb instead of standing to attention wherever the camera is. */
	function postPath(runs: Seg[][], stride: number): string {
		const out: string[] = [];
		for (const r of runs)
			for (let i = 0; i < r.length; i += stride) out.push(`M ${d(r[i].base)} L ${d(r[i].top)}`);
		return out.join(' ');
	}

	// ── The flat wall ───────────────────────────────────────────────────────────
	// Everything below draws the parapet a wall gets when it has no height: ticks
	// and towers pushed out in SCREEN space, since with base and crest on the same
	// line there is no world direction left to build along.

	/** Outward normal at a rim point: straight away from the territory's projected
	 *  centre. A cap projects to a near-ellipse, so this is the true normal to
	 *  within a hair, and it needs no tangent — which keeps it stable at the seam
	 *  where a tangent would flip. */
	function outward(p: Pt, c: Pt): Pt {
		const dx = p.x - c.x;
		const dy = p.y - c.y;
		const len = Math.hypot(dx, dy) || 1;
		return { x: dx / len, y: dy / len };
	}

	/** Battlements: merlon ticks standing off the wall, facing OUT of the territory
	 *  — the parapet reads as defending what is inside it. One path, all ticks. */
	function merlonPath(runs: Seg[][], c: Pt, len: number, stride: number): string {
		const out: string[] = [];
		for (const r of runs)
			for (let i = 0; i < r.length; i += stride) {
				const p = r[i].base;
				const n = outward(p, c);
				out.push(`M ${d(p)} L ${(p.x + n.x * len).toFixed(1)} ${(p.y + n.y * len).toFixed(1)}`);
			}
		return out.join(' ');
	}

	/** Watchtowers: a squarer, heavier mark every so often along the wall, set just
	 *  outside the crest. They give the run a rhythm and a scale — an unbroken line
	 *  of merlons reads as hatching, the towers make it read as built. */
	function towerPath(runs: Seg[][], c: Pt, off: number, size: number, stride: number): string {
		const out: string[] = [];
		for (const r of runs)
			for (let i = Math.floor(stride / 2); i < r.length; i += stride) {
				const p = r[i].base;
				const n = outward(p, c);
				const x = p.x + n.x * off;
				const y = p.y + n.y * off;
				out.push(
					`M ${(x - size).toFixed(1)} ${(y - size).toFixed(1)} h ${(size * 2).toFixed(1)} v ${(size * 2).toFixed(1)} h ${(-size * 2).toFixed(1)} Z`
				);
			}
		return out.join(' ');
	}

	/** 0..1 — how face-on a cap is, from its centre's depth. Drives outline opacity
	 *  so a territory dims out as it turns toward the limb. */
	function facing(z: number): number {
		return Math.max(0, Math.min(1, (z - 0.15) / 0.4));
	}

	// ── The floor ───────────────────────────────────────────────────────────────
	// ISOLINES: lines of constant elevation, the way a contour map draws ground.
	//
	// This used to be a polar web — rings of constant angle from the cap's centre
	// plus spokes, each sample displaced by the height under it. That is a
	// COORDINATE SYSTEM draped over a height field, and the difference matters:
	// a line drawn across a slope carries the elevation only as a few pixels of
	// wobble nobody can read, so you pay full ink for every line and learn nothing
	// from any of them. It also converged on a visible point at each cap's centre,
	// which reads as an artefact because it is one.
	//
	// A line drawn ALONG the slope is the opposite deal. Its spacing IS the
	// gradient, its closed loops ARE the peaks, and it is absent from flat ground
	// entirely — measured, contours touch 30–40% of a gentle region's cells against
	// the web's unconditional 100%. Worth being honest about the part that is not a
	// win: at matched interval they cost about the same (2,524 segments against
	// 2,816). What you gain is that `contourInterval` is a real knob, where the web
	// cost the same on a plain as on a mountain range.
	//
	// It also makes an existing claim true. `NodePiece` cuts contour bands across
	// the BUILDINGS at constant height and calls them the same thing the floor
	// draws. They were not the same thing. Now they are, and a building wearing
	// contours reads as the ground continuing up over it.

	type Iso = { level: number; index: boolean; segs: { a: Vec3; b: Vec3 }[] };

	/** Every cap's isolines, in the GLOBE's own frame.
	 *
	 *  Split from the projection below because it depends on the ground and the
	 *  regions but not on the camera: the terrain turns with the globe, so a line's
	 *  elevation never changes and only where it lands does. */
	const floors = $derived.by((): Map<string, Iso[]> => {
		const out = new Map<string, Iso[]>();
		if (!terrain || !relief) return out;
		for (const t of territories) {
			out.set(
				t.key,
				contours(terrain, t.cap, { interval: contourInterval, indexEvery: 5 }).map((l) => ({
					level: l.level,
					index: l.index,
					segs: l.segments
				}))
			);
		}
		return out;
	});

	// ── The floor is drawn on a CANVAS, under the SVG ───────────────────────────
	// Everything else here stays SVG — the walls, the tint, the names — because
	// they are a handful of elements that change rarely and benefit from being
	// real nodes. The floor is the opposite: thousands of segments that must be
	// re-projected on every frame the globe turns.
	//
	// As SVG that meant, per frame, building a `d` string of ~2,500 commands per
	// region and handing it to the browser to re-parse, re-tessellate and
	// re-rasterise. Measured on real hardware the whole scene sat at ~29fps with
	// our own script at 0.0ms — the cost was entirely downstream of us, which is
	// exactly the shape of "you are asking the DOM to do something it is not for".
	//
	// Canvas removes the middleman. The same projection maths feeds `lineTo`
	// directly: no strings, no parsing, no retained nodes, and one `stroke()` per
	// weight per region instead of a document mutation. Redrawing a few thousand
	// line segments per frame is what a 2D context is built to do.
	//
	// The trade is honest and worth naming: canvas has no DOM, so nothing on the
	// floor can be hit-tested, inspected, or read by a screen reader. Nothing ever
	// wanted to be — the floor is ground, and every interactive thing on this
	// globe is a node in the SVG above it.

	/** Stroke one region's isolines at one weight, straight into the context.
	 *
	 *  Every point on a contour sits at the SAME elevation — that is what a contour
	 *  is — so the lift is the level itself and no per-point terrain lookup is
	 *  needed. Exact, and the reason this is cheaper per point than the polar web
	 *  it replaced.
	 *
	 *  A segment with either end round the back is dropped rather than clipped.
	 *  Same rule the wall uses: a line behind the globe is not a fainter line, it is
	 *  a line that is not there. At this segment length the difference at the
	 *  horizon is under a pixel. */
	function traceIso(ctx: CanvasRenderingContext2D, key: string, wantIndex: boolean): void {
		const lines = floors.get(key);
		if (!lines) return;
		ctx.beginPath();
		for (const l of lines) {
			if (l.index !== wantIndex) continue;
			const lift = l.level * relief;
			for (const s of l.segs) {
				const a = spin(s.a, yaw, pitch);
				if (a.z < 0.02) continue;
				const b = spin(s.b, yaw, pitch);
				if (b.z < 0.02) continue;
				const pa = project(a, globeR, viewDistance, lift);
				const pb = project(b, globeR, viewDistance, lift);
				ctx.moveTo(cx + pa.x, cy + pa.y);
				ctx.lineTo(cx + pb.x, cy + pb.y);
			}
		}
	}

	let floorEl = $state<HTMLCanvasElement | null>(null);
	let boxW = $state(0);
	let boxH = $state(0);

	$effect(() => {
		const el = floorEl;
		if (!el || !boxW || !boxH) return;
		// Read every dependency BEFORE the imperative work, so Svelte registers
		// them: an effect only subscribes to what it touches while it runs, and
		// anything read inside a helper called later still counts — but anything
		// read only on a branch we skip this frame does not.
		const t = { tx: transform.tx, ty: transform.ty, tk: transform.tk };
		void yaw;
		void pitch;
		void viewDistance;
		void globeR;
		void relief;
		void moving;
		void progress;
		void focus;
		void floors;

		// Deliberately NOT the device pixel ratio. The floor is faint background
		// linework at well under one pixel of stroke; drawing it at 2× quadruples the
		// fill for a difference nobody can see on a 0.6px line at 16% alpha. The SVG
		// layers above — which carry the edges the eye actually reads — keep full
		// resolution, because they are vector and cost nothing to.
		const dpr = 1;
		const w = Math.round(boxW * dpr);
		const h = Math.round(boxH * dpr);
		if (el.width !== w) el.width = w;
		if (el.height !== h) el.height = h;
		const ctx = el.getContext('2d');
		if (!ctx) return;

		ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
		ctx.clearRect(0, 0, boxW, boxH);
		ctx.translate(t.tx, t.ty);
		ctx.scale(t.tk, t.tk);
		// Butt, not round. Every isoline is a heap of TWO-POINT subpaths, so a round
		// cap asks the rasterizer for a filled circle at both ends of each of some
		// thousands of segments — and at 0.6px wide, against segments that already
		// meet end to end, not one of those circles is visible.
		ctx.lineCap = 'butt';

		// Widths are divided by the zoom so a line keeps its thickness on screen —
		// the canvas equivalent of the `vector-effect="non-scaling-stroke"` the SVG
		// paths carried, and the reason the floor does not thicken into a mat as the
		// jib closes in.
		const px = (v: number) => v / Math.max(0.0001, t.tk);

		for (const s of shown) {
			const lit = s.focused ? Math.min(1, progress * 2.2) : 0;
			// The fine contours are skipped while the camera flies. They are ~4/5 of
			// the segments and nobody can read a 0.07-interval map on ground that is
			// sweeping past — see `moving`.
			if (!moving) {
				traceIso(ctx, s.t.key, false);
				ctx.strokeStyle = s.t.color;
				ctx.globalAlpha = (0.16 + 0.16 * lit) * s.face;
				ctx.lineWidth = px(0.6);
				ctx.stroke();
			}
			// Index contours: a wide faint pass under a sharp one. The bloom is what
			// makes a line read as EMITTED rather than drawn on, and confining it to
			// every 5th line keeps that read at a fifth of the cost.
			traceIso(ctx, s.t.key, true);
			ctx.strokeStyle = s.t.color;
			ctx.globalAlpha = (0.05 + 0.07 * lit) * s.face;
			ctx.lineWidth = px(3);
			ctx.stroke();
			ctx.strokeStyle = s.focused ? (s.t.glow ?? s.t.color) : s.t.color;
			ctx.globalAlpha = (0.3 + 0.3 * lit) * s.face;
			ctx.lineWidth = px(1);
			ctx.stroke();
		}
		ctx.globalAlpha = 1;
	});

	const shown = $derived(
		territories
			.map((t) => {
				const c = spin(t.cap.center, yaw, pitch);
				// The name goes on the territory's NORTHERN RIM, not its centre — the
				// centre is exactly where the territory's own nodes are, and a label
				// dropped there lands on top of the thing it is naming. The centroids
				// sit on the equator, so world-up is already perpendicular to them and
				// tilting by the cap's own half-angle lands precisely on the rim.
				// Past the rim, not on it: the rim is where the outermost nodes sit.
				const a = t.cap.alpha + 0.22;
				const north = spin(
					{
						x: t.cap.center.x * Math.cos(a),
						y: -Math.sin(a),
						z: t.cap.center.z * Math.cos(a)
					},
					yaw,
					pitch
				);
				return {
					t,
					c,
					p: project(north, globeR, viewDistance),
					focused: focus === t.key
				};
			})
			// A territory whose centre has gone round the back has nothing to say.
			.filter(({ c }) => c.z > 0.15)
			// Wall geometry is resolved HERE, not in the template: it depends on
			// yaw/pitch, so it has to be redone each spin — but only once per spin,
			// and only for the caps that survived the filter above.
			.map((s) => {
				const runs = rimRuns(s.t.cap);
				// The territory's centre on screen. Only the flat wall needs it — its
				// ornaments are pushed out along a screen-space normal measured from
				// here, where a raised wall builds along a real world direction.
				const cp = project(s.c, globeR, viewDistance);
				const centre = { x: cx + cp.x, y: cy + cp.y };
				// The parapet is counter-scaled so it keeps its built size on screen at
				// any zoom; without that it grows into a fence as you zoom in. A raised
				// wall needs no such correction — it is built in WORLD units off the
				// sphere, so zooming in shows more of it, exactly as it does of a node.
				//
				// So `inv` is read ONLY on the flat branch, and that placement is load
				// bearing. A `$derived` subscribes to what it actually reads while it
				// runs: computing the counter-scale up here made this whole map depend
				// on the live camera zoom, so every scale change rebuilt every
				// territory's contours — thousands of projected segments — to feed a
				// parapet that the default raised wall never draws.
				return {
					...s,
					face: facing(s.c.z),
					// ── Motion LOD: the fine contours are not BUILT while moving ────
					// This is the scene's dominant cost, and it is paid every frame.
					// `shown` re-derives on every yaw change, so each frame re-projects
					// and re-serialises every isoline in every region — on the order of
					// two thousand segments — and hands the browser a brand new `d` to
					// parse, tessellate and rasterise. Measured on real hardware the
					// whole scene sits at ~29fps with script at 0.0ms, which is what a
					// cost of that shape looks like: all of it downstream of us.
					//
					// The index contours alone are about a fifth of the segments and
					// carry the shape of the ground perfectly well at speed. Nobody can
					// read a 0.07-interval contour map on a globe that is sweeping past
					// — so it is not drawn, and more importantly not computed. Skipping
					// the string build is most of the saving; skipping the paint is the
					// rest.
					pane: panePath(runs),
					base: edgePath(runs, 'base'),
					crest: edgePath(runs, 'top'),
					posts: postPath(runs, POST_EVERY),
					merlons: raised ? '' : merlonPath(runs, centre, MERLON_LEN * inv, MERLON_EVERY),
					towers: raised
						? ''
						: towerPath(runs, centre, MERLON_LEN * inv * 0.55, TOWER_SIZE * inv, TOWER_EVERY)
				};
			})
	);
</script>

<!-- The ground. First in the DOM so every SVG layer paints over it, and marked
     aria-hidden + pointer-events:none like the rest of this chrome: it is terrain,
     and everything you can point at is a node in the layer above. -->
<canvas
	class="floor"
	bind:this={floorEl}
	bind:clientWidth={boxW}
	bind:clientHeight={boxH}
	aria-hidden="true"
></canvas>

<svg class="caps" aria-hidden="true">
	<defs>
		<!-- Only ever applied to the ONE focused territory, so the cost is bounded no
		     matter how many regions the globe carries. -->
		<filter id="caps-glow" x="-30%" y="-30%" width="160%" height="160%">
			<feGaussianBlur stdDeviation="2.5" result="b" />
			<feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
		</filter>
	</defs>
	<g transform="translate({transform.tx},{transform.ty}) scale({transform.tk})">
		<!-- LAND. Every territory is tinted, not just the subject — a region is a
		     piece of ground whether or not you are looking at it, and what is not
		     tinted is not unlit land but no land at all. The subject then goes
		     brighter still, which is a difference in degree rather than in kind and
		     so does not have to carry the whole job of saying "region". -->
		{#each shown as s (s.t.key)}
			<polygon
				points={rim(s.t.cap)}
				fill={s.t.color}
				opacity={(0.09 + (s.focused ? 0.09 * Math.min(1, progress * 2.2) : 0)) * (0.3 + 0.7 * s.face)}
				stroke="none"
			/>
		{/each}

		<!-- The floor used to be drawn here. It is now strokes on the <canvas>
		     below this <svg> in the DOM — see `traceIso`. Everything left in this
		     layer is a handful of elements that change rarely; the floor was
		     thousands that changed every frame, which is the line between what
		     belongs in a document and what belongs in a raster. -->

		<!-- The wall. Always built, quiet at rest, lit when its territory is the
		     subject. Four passes, drawn ground-up so the crest ends up the sharpest
		     thing on it: the pane, the footing where it meets the sphere, the posts
		     holding it, then the crest. Each pass is ONE path across every run — a
		     territory costs four elements regardless of how much of it faces us.

		     Every opacity here is low on purpose. A wall you can see the globe
		     through is a hologram; an opaque one is a fence that hides the nodes it
		     was drawn to enclose. -->
		{#each shown as s (s.t.key)}
			{@const lit = s.focused ? Math.min(1, progress * 2.2) : 0}
			{@const ink = s.focused ? (s.t.glow ?? s.t.color) : s.t.color}
			{@const a = s.face}
			<!-- The bloom is dropped WHILE THE CAMERA MOVES.
			     A Gaussian blur over a whole territory — floor contours, pane, posts,
			     crest — has to be re-rasterized on any frame where its contents or its
			     scale change, and during a flight both change every frame. Measured on
			     the arrival flight, this alone was the difference between a worst frame
			     of ~34ms and ~26ms: it does not move the median, it makes the spikes,
			     which is exactly what a hand reads as lag.
			     It costs nothing to give up, because nobody can see a soft glow on a
			     territory that is sweeping past. Motion LOD, the oldest trick there is:
			     spend detail where the eye can rest on it. -->
			<g opacity={a} style:filter={s.focused && !moving ? 'url(#caps-glow)' : null}>
				{#if raised}
					<!-- the pane — a held field of light, not a surface -->
					<path d={s.pane} fill={ink} stroke="none" opacity={0.07 + 0.1 * lit} />
					<!-- footing: where the wall meets the sphere. Fainter than the crest,
					     so the eye reads the top edge as the boundary and this as its
					     shadow. -->
					<path
						d={s.base}
						fill="none"
						stroke={ink}
						stroke-width={1}
						stroke-linecap="round"
						stroke-linejoin="round"
						vector-effect="non-scaling-stroke"
						opacity={0.25 + 0.35 * lit}
					/>
					<path
						d={s.posts}
						fill="none"
						stroke={ink}
						stroke-width={1 + 0.3 * lit}
						stroke-linecap="round"
						vector-effect="non-scaling-stroke"
						opacity={0.3 + 0.45 * lit}
					/>
				{:else}
					<!-- rampart body — a wide soft stroke gives the crest something to sit
					     on, so the wall reads as built rather than drawn -->
					<path
						d={s.base}
						fill="none"
						stroke={ink}
						stroke-width={7}
						stroke-linecap="round"
						stroke-linejoin="round"
						vector-effect="non-scaling-stroke"
						opacity={0.1 + 0.22 * lit}
					/>
					<path
						d={s.merlons}
						fill="none"
						stroke={ink}
						stroke-width={1.4 + 0.4 * lit}
						stroke-linecap="round"
						vector-effect="non-scaling-stroke"
						opacity={0.4 + 0.55 * lit}
					/>
					<path
						d={s.towers}
						fill="var(--bg)"
						stroke={ink}
						stroke-width={1.3}
						stroke-linejoin="round"
						vector-effect="non-scaling-stroke"
						opacity={0.55 + 0.45 * lit}
					/>
				{/if}
				<!-- The crest last either way, so it stays the sharpest thing on the
				     wall. With no height, base and crest are the same line. -->
				<path
					d={s.crest}
					fill="none"
					stroke={ink}
					stroke-width={1.5 + 0.9 * lit}
					stroke-linecap="round"
					stroke-linejoin="round"
					vector-effect="non-scaling-stroke"
					opacity={0.55 + 0.45 * lit}
				/>
			</g>
		{/each}

		{#if labels}
			{#each shown as s (s.t.key)}
				<g transform="translate({s.p.x + cx},{s.p.y + cy}) scale({inv})">
					<text
						y="4"
						text-anchor="middle"
						font-size="11"
						font-family="var(--mono)"
						letter-spacing="0.14em"
						fill={s.focused ? (s.t.glow ?? s.t.color) : s.t.color}
						opacity={(s.focused ? 1 : 0.35) * (0.35 + 0.65 * s.face)}
						>{s.t.name.toUpperCase()}</text
					>
				</g>
			{/each}
		{/if}
	</g>
</svg>

<style>
	.caps {
		position: absolute;
		inset: 0;
		overflow: visible;
		/* Chrome, not a target. */
		pointer-events: none;
	}
	/* The floor raster. Same box as the SVG layers so world coordinates line up
	   once the camera transform is applied to the context — the canvas is not
	   positioned relative to the globe, it IS the viewport, and the transform does
	   the rest. */
	.floor {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		pointer-events: none;
	}
</style>
