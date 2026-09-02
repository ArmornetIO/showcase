<script lang="ts" module>
	import {
		CREST_MESH_GEOMETRY,
		CREST_MESH_SHAPES,
		outlinePoly,
		insetPoints,
		placeFigure,
		rayHit,
		type CrestMeshShape,
		type Pt as MeshPt
	} from './ArmornetCrestMesh.svelte';

	/** The traced shield keeps its own name; everything else comes from the mesh mark. */
	export type ChromeShape = 'traced' | CrestMeshShape;
	export const CHROME_SHAPES: ChromeShape[] = ['traced', ...CREST_MESH_SHAPES];

	// The mesh shields are authored in a 24 box; this cut is authored in a 200×220
	// one, and every gradient, trace and ball radius here is tuned to that. So the
	// silhouette is mapped in rather than the artwork being re-scaled out — and
	// the map is UNIFORM, because a shield stretched to fill a slightly different
	// aspect stops matching the line version of itself.
	const MESH_S = 11.5;
	const meshToBox = ([x, y]: MeshPt): MeshPt => [100 + (x - 12) * MESH_S, y * MESH_S - 30.35];

	// Frame band and rim depths, read off the traced shield: OUTER at 8, mid at
	// 13, inner at 17, rim at 30.
	const BAND_MID = 5;
	const BAND_IN = 9;
	const BAND_RIM = 22;

	const r2 = (v: number) => Math.round(v * 100) / 100;
	const polyPath = (p: readonly MeshPt[]) =>
		`M${p.map(([x, y]) => `${r2(x)} ${r2(y)}`).join(' L')} Z`;

	/** A mesh shield's four concentric contours, in the chrome box. */
	export function chromeContours(shape: CrestMeshShape) {
		const poly = outlinePoly(CREST_MESH_GEOMETRY[shape], 16).map(meshToBox);
		return {
			outer: polyPath(poly),
			mid: polyPath(insetPoints(poly, BAND_MID)),
			inner: polyPath(insetPoints(poly, BAND_IN)),
			rim: polyPath(insetPoints(poly, BAND_RIM)),
			innerPoly: insetPoints(poly, BAND_IN)
		};
	}

	/** The crestlink figure, in the chrome box, with ball radii to match. */
	export function chromeFigure(shape: CrestMeshShape) {
		const pf = placeFigure(CREST_MESH_GEOMETRY[shape]);
		return {
			hub: meshToBox(pf.hub),
			nodes: pf.nodes.map(meshToBox),
			hubR: pf.hubR * MESH_S,
			nodeR: pf.nodeR * MESH_S
		};
	}
</script>

<script lang="ts">
	/**
	 * Armornet crest — forged chrome variant.
	 *
	 * The rendered/emblem cut of the mark: a milled shield with a bevelled frame,
	 * a dark glass field, and the A drawn as machined tubing on ball joints. It is
	 * presentation art — hero, splash, favicon source — NOT a UI icon. It carries
	 * gradients and a cast shadow, so it will not survive single-colour
	 * reproduction and it muddies below ~48px. Reach for `<ArmornetCrest />`
	 * (two-tone line) or `<Icon name="armornet" />` (single weight) at UI sizes.
	 *
	 * Every colour here is SAMPLED from the reference render rather than picked by
	 * eye, which is why the ramps are lopsided — chrome is not a smooth blend.
	 * Notes worth keeping if this ever gets re-cut:
	 *
	 * · The frame is ONE ring (9 units thick) plus two hairline contours, not a
	 *   stack of facets. What sells the bevel is that the two hairlines carry
	 *   OPPOSITE gradients: the outer edge burns bright on the left and dies on
	 *   the right, the inner edge does the reverse. That crossover is the whole
	 *   emboss — with both edges bright it reads as a sticker.
	 * · The inner rim line floats 12 units INSIDE the frame with plain field
	 *   between them. It is not a chamfer on the frame; it is a second, separate
	 *   border, and it is only a shade brighter than the glass it sits on.
	 * · Members are drawn in their OWN rotated frame as rounded rects, so the
	 *   objectBoundingBox gradient runs ACROSS the tube. A stroked path cannot do
	 *   this — the gradient would follow the bbox diagonal and the highlight would
	 *   slide off the leg.
	 * · The tube ramp is rail · groove · rail, traced straight off a scanline of
	 *   the reference: a wide bright rail, a near-black channel, a narrower second
	 *   rail. All four members share two angles and the same handedness, so ONE
	 *   gradient serves them all — the left legs light on their upper flank, the
	 *   right legs on their inner flank, which is what the reference does.
	 * · Joints are two parts: a bright torus, and a core that is a lit-from-the-
	 *   left dark ball. Apex and feet read as pierced because their core is bigger
	 *   and deeper, not because anything is actually cut out.
	 *
	 * Geometry — TRACED off the reference silhouette, not eyeballed. Two things
	 * the trace turned up that a freehand shield never gets right: the top edge
	 * from the crown to the shoulder is DEAD STRAIGHT (not bowed), and the flanks
	 * run VERTICAL for a third of the height before the bottom curve starts.
	 *
	 *   200×220 box at 0.312 units/px · shield 8–192 wide, 3–217 tall
	 *   crown 100,3 · shoulders 8,42 · flanks straight to y=117 · point 100,217
	 *   frame 9 thick · rim 22 in
	 *   apex 100,51.2 · joints 76.8,106.9 and 122.8,107.5
	 *   feet 57.4,154.3 and 142.7,154.3 · hub 100,136.3 · member 10 wide
	 */
	interface CrestChromeProps {
		size?: number;
		/**
		 * Which silhouette to forge. 'traced' is this component's own hand-traced
		 * shield carrying the A monogram; anything else is a shield from
		 * `ArmornetCrestMesh` carrying the crestlink figure.
		 *
		 * Shape and figure move TOGETHER on purpose. The A's joints and feet were
		 * traced against the traced shield's exact proportions — its bar sits
		 * where that silhouette is widest — so dropping it into a notched or
		 * clipped crown puts the apex under a slot and the feet in the taper.
		 */
		shape?: ChromeShape;
		/** Bloom under the shield and behind the joints. */
		glow?: boolean;
		/** Bloom strength, 0–1. Ignored when `glow` is off. */
		bloom?: number;
		/** Faint circuitry etched into the glass. Drop it below ~64px. */
		traces?: boolean;
		/** The second border floating inside the frame. */
		rim?: boolean;
		/** Cast shadow seating the mark into the glass. */
		emboss?: boolean;
		/** Struts tying every joint out to the shield wall — the A stops floating
		 *  in the field and becomes structure the shield carries. */
		tethers?: boolean;
		/** 0–1. How far the A grows PAST the shield boundary: at 1 the apex crosses
		 *  the crown and the feet cross the lower flanks, so the mark reads as
		 *  overlaid on the shield rather than contained by it. */
		breakout?: number;
		title?: string;
		class?: string;
		style?: string;
	}

	let {
		size = 128,
		shape = 'traced',
		glow = true,
		bloom = 1,
		traces = true,
		rim = true,
		emboss = true,
		tethers = false,
		breakout = 0,
		title = 'Armornet',
		class: cls = '',
		style = ''
	}: CrestChromeProps = $props();

	// Scoped so several crests can share a page without their defs colliding.
	const uid = $props.id();
	const id = (n: string) => `crest-${n}-${uid}`;

	// One contour, stepped inward twice. Hand-cut rather than scaled about a
	// centre, because a uniform scale pinches the band at the shoulders.
	const TRACED = {
		outer: 'M100 3 L192 42 L192 117 C192 152 155 205 100 217 C45 205 8 152 8 117 L8 42 Z',
		mid: 'M100 8 L187 45 L187 117 C187 151 152 201 100 212 C48 201 13 151 13 117 L13 45 Z',
		inner: 'M100 13 L183 48 L183 117 C183 150 150 197 100 207 C50 197 17 150 17 117 L17 48 Z',
		rim: 'M100 27 L170 56 L170 117 C170 147 144 180 100 190 C56 180 30 147 30 117 L30 56 Z'
	};

	// A mesh shield derives all four contours by mitring one segment list, where
	// the traced shield carries four hand-cut curves. Both are here because they
	// are genuinely different objects, not two spellings of one.
	const MC = $derived(shape === 'traced' ? null : chromeContours(shape));
	const C = $derived(MC ?? TRACED);
	const OUTER = $derived(C.outer);
	const FRAME_MID = $derived(C.mid);
	const FRAME_IN = $derived(C.inner);
	const RIM = $derived(C.rim);

	/** Present only on a mesh shield; null means the A monogram is in play. */
	const FIG = $derived(shape === 'traced' ? null : chromeFigure(shape));

	type Pt = { x: number; y: number };

	const BASE = {
		apex: { x: 100, y: 51.2 },
		jointL: { x: 76.8, y: 106.9 },
		jointR: { x: 122.8, y: 107.5 },
		footL: { x: 57.4, y: 154.3 },
		footR: { x: 142.7, y: 154.3 },
		hub: { x: 100, y: 136.3 }
	};
	const BASE_R = { apex: 12, foot: 11.8, joint: 9.2, hub: 3.2 };
	const TUBE_W = 10;

	/** Where each joint's strut lands: on FRAME_IN, the actual shield wall — NOT
	 *  on the rim. Landing on the rim looks like wiring to a decorative line and
	 *  leaves runs so short the joint balls swallow them; carrying them all the
	 *  way to the frame is what makes the A read as structure the shield holds.
	 *  They are FIXED, so growing the A shortens its wiring rather than dragging
	 *  the landings off the wall with it. */
	const WALL: Record<string, Pt> = {
		apex: { x: 100, y: 13 },
		jointL: { x: 17, y: 95 },
		jointR: { x: 183, y: 95 },
		footL: { x: 25.5, y: 149 },
		footR: { x: 174.5, y: 149 }
	};

	// Breakout is resolved in JS rather than as an SVG transform on the mark: the
	// struts have to keep one end on the moving joint and the other pinned to the
	// wall, which a group transform cannot express.
	const bo = $derived(Math.max(0, Math.min(1, breakout)));
	// Calibrated so the range is useful end to end: mid-slider the mark overlaps
	// the frame band, and at 1 the apex and BOTH feet clear the silhouette
	// outright. Anything gentler and the top of the slider still looks contained.
	const grow = $derived(1 + 0.45 * bo);
	// Pivot on the A's own centre, then lift — the shield narrows toward the
	// point, so a pure scale bursts the feet out long before the apex reaches the
	// crown, and the mark grows lopsided. The lift is the counterweight, and it is
	// a trade: too much and the feet ride back up into the wide part of the shield
	// and stop breaking out at all.
	const PIVOT = { x: 100, y: 103 };
	const lift = $derived(-9 * bo);
	const T = (p: Pt): Pt => ({
		x: PIVOT.x + (p.x - PIVOT.x) * grow,
		y: PIVOT.y + (p.y - PIVOT.y) * grow + lift
	});

	const P = $derived({
		apex: T(BASE.apex),
		jointL: T(BASE.jointL),
		jointR: T(BASE.jointR),
		footL: T(BASE.footL),
		footR: T(BASE.footR),
		hub: T(BASE.hub)
	});
	const R = $derived({
		apex: BASE_R.apex * grow,
		foot: BASE_R.foot * grow,
		joint: BASE_R.joint * grow,
		hub: BASE_R.hub * grow,
		tube: TUBE_W * grow
	});

	/** A run of tubing in its own rotated frame, so it can be shaded across its
	 *  width. `flip` mirrors the right-hand runs: both legs are hot on their OUTER
	 *  flank in the reference, and rotation alone puts local -y on the right of
	 *  every member — unmirrored, the right leg lights on the inside and the A
	 *  reads like it is lit from two different rooms. */
	const run = (a: Pt, b: Pt) => ({
		x: a.x,
		y: a.y,
		len: Math.hypot(b.x - a.x, b.y - a.y),
		angle: (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI,
		flip: b.x > a.x
	});

	// Members run apex → joint → foot. Ends sit ON the joint centres, so the
	// rounded caps disappear under the rings.
	const MEMBERS = $derived(
		[
			[P.apex, P.jointL],
			[P.apex, P.jointR],
			[P.jointL, P.footL],
			[P.jointR, P.footR]
		].map(([a, b]) => run(a, b))
	);

	const TETHERS = $derived(
		(['apex', 'jointL', 'jointR', 'footL', 'footR'] as const).map((k) => ({
			...run(P[k], WALL[k]),
			to: WALL[k]
		}))
	);

	// The inner web: crossbar, and the hub tying the bar joints to the feet.
	const WEB = $derived(
		`M${P.jointL.x} ${P.jointL.y} L${P.jointR.x} ${P.jointR.y}
		M${P.jointL.x} ${P.jointL.y} L${P.hub.x} ${P.hub.y} L${P.jointR.x} ${P.jointR.y}
		M${P.hub.x} ${P.hub.y} L${P.footL.x} ${P.footL.y} M${P.hub.x} ${P.hub.y} L${P.footR.x} ${P.footR.y}`
	);

	/**
	 * The crestlink figure in the chrome box, breakout applied.
	 *
	 * It gets the SAME grow-and-lift treatment as the A, on its own centre. The A
	 * pivots at y=103 because that is where the A balances; the mesh figure is a
	 * hub over a triangle and balances lower, so reusing the A's pivot would send
	 * the hub through the crown while the bottom satellite barely moved.
	 */
	const MFIG = $derived.by(() => {
		if (!FIG || !MC) return null;
		const cy = (FIG.hub[1] + Math.max(...FIG.nodes.map((n) => n[1]))) / 2;
		const t = (q: MeshPt): Pt => ({
			x: 100 + (q[0] - 100) * grow,
			y: cy + (q[1] - cy) * grow + lift
		});
		const hub = t(FIG.hub);
		const nodes = FIG.nodes.map(t);
		const wall = MC.innerPoly;
		return {
			hub,
			nodes,
			hubR: FIG.hubR * grow,
			nodeR: FIG.nodeR * grow,
			spokes: nodes.map((n) => run(hub, n)),
			// Struts leave each satellite along the spoke it arrived on and carry
			// to the wall, exactly as the A's do — same reason, too: a strut that
			// stops short reads as a line crossing the mark rather than as
			// structure the shield holds.
			tethers: nodes.map((n) => {
				const dx = n.x - hub.x;
				const dy = n.y - hub.y;
				const L = Math.hypot(dx, dy) || 1;
				const [lx, ly] = rayHit([n.x, n.y], [dx / L, dy / L], wall);
				return { ...run(n, { x: lx, y: ly }), to: { x: lx, y: ly } };
			})
		};
	});

	const halo = $derived(glow ? Math.max(0, Math.min(1, bloom)) : 0);

	// A broken-out apex rises past y=0 and its bloom gets guillotined by the box.
	// Rather than pull the breakout back until it fits, the box grows headroom to
	// meet it — the shield stays exactly where it was at breakout 0, so the
	// default export is unaffected, and `rasterSize` reads the viewBox so PNG
	// exports pick the new aspect up on their own.
	const headroom = $derived(16 * bo);
	const box = $derived(`0 ${-headroom} 200 ${220 + headroom}`);
</script>

<svg
	class="crest {cls}"
	{style}
	width={size}
	height={size}
	viewBox={box}
	role="img"
	aria-label={title}
>
	<title>{title}</title>

	<defs>
		<!-- Frame body. The key is very nearly OVERHEAD, not at 45°: the reference
		     runs ~#80eef1 across the whole crown and only ~#1d5760 at the point,
		     with barely a shade between the left and right flanks. Tilting this
		     gradient to a diagonal is what made earlier cuts look like flat plastic. -->
		<linearGradient id={id('frame')} x1="0.36" y1="0" x2="0.62" y2="1">
			<stop offset="0" stop-color="#c8f4f6" />
			<stop offset="0.05" stop-color="#b0eef1" />
			<stop offset="0.1" stop-color="#93e5ea" />
			<stop offset="0.15" stop-color="#6ec4cc" />
			<stop offset="0.21" stop-color="#45a7b3" />
			<stop offset="0.25" stop-color="#389baa" />
			<stop offset="0.55" stop-color="#3b92a3" />
			<stop offset="0.78" stop-color="#2c7080" />
			<stop offset="1" stop-color="#1d5760" />
		</linearGradient>

		<!-- Two shading passes over the band, both horizontal, because the vertical
		     key alone cannot produce them: the whole right flank sits a stop darker
		     than the left, and the left flank alone carries a hard shadow on its
		     INNER half where the bevel turns away. -->
		<linearGradient id={id('shadeR')} x1="0" y1="0" x2="1" y2="0">
			<stop offset="0.45" stop-color="#06263d" stop-opacity="0" />
			<stop offset="0.7" stop-color="#06263d" stop-opacity="0.14" />
			<stop offset="1" stop-color="#06263d" stop-opacity="0.32" />
		</linearGradient>

		<linearGradient id={id('shadeL')} x1="0" y1="0" x2="1" y2="0">
			<stop offset="0" stop-color="#030e14" stop-opacity="0.5" />
			<stop offset="0.16" stop-color="#030e14" stop-opacity="0.3" />
			<stop offset="0.3" stop-color="#030e14" stop-opacity="0" />
		</linearGradient>

		<!-- Outer contour: a clean specular line the whole way round, and PURER
		     cyan (~H181) than the body it sits on (H190–195). That hue split is
		     half of what makes it read as a lit edge rather than a drawn one. -->
		<linearGradient id={id('edgeOut')} x1="0" y1="0.1" x2="1" y2="0.9">
			<stop offset="0" stop-color="#52e8ea" />
			<stop offset="0.3" stop-color="#7af2f2" />
			<stop offset="0.6" stop-color="#52e8ea" />
			<stop offset="0.85" stop-color="#47e3e1" />
			<stop offset="1" stop-color="#3ec6c8" />
		</linearGradient>

		<!-- Inner contour runs the OTHER way — vertically. In the reference the
		     inner lip is dead black for the whole upper shield and only catches
		     light in the lower flanks, where it goes pale and DESATURATED. Lighting
		     it evenly (or brightly on the right) inverts the bevel and the frame
		     reads as a flat outline. -->
		<linearGradient id={id('edgeIn')} x1="0" y1="0" x2="0.15" y2="1">
			<stop offset="0" stop-color="#071216" />
			<stop offset="0.5" stop-color="#061014" />
			<stop offset="0.62" stop-color="#6fb6bd" />
			<stop offset="0.74" stop-color="#afe1e7" />
			<stop offset="0.86" stop-color="#7fc4cc" />
			<stop offset="1" stop-color="#3d8f99" />
		</linearGradient>

		<!-- Glass. Lit hard along the top lip where the frame bounces into it,
		     then falling to near-black at the feet. -->
		<linearGradient id={id('field')} x1="0" y1="0" x2="0" y2="1">
			<stop offset="0" stop-color="#073036" />
			<stop offset="0.06" stop-color="#062227" />
			<stop offset="0.14" stop-color="#05171c" />
			<stop offset="0.45" stop-color="#061419" />
			<stop offset="0.7" stop-color="#061115" />
			<stop offset="1" stop-color="#050c10" />
		</linearGradient>

		<!-- The glass is not a flat vertical ramp: light pools off-centre to the
		     upper left, which is what keeps it from looking like a painted panel.
		     Kept weak — the reference field is genuinely almost black below the
		     crossbar, and lifting it is the fastest way to lose the depth. -->
		<radialGradient id={id('pool')} cx="0.3" cy="0.32" r="0.52">
			<stop offset="0" stop-color="#12454c" stop-opacity="0.4" />
			<stop offset="0.6" stop-color="#12454c" stop-opacity="0.12" />
			<stop offset="1" stop-color="#12454c" stop-opacity="0" />
		</radialGradient>

		<!-- The floating inner border, barely above the glass it sits on. -->
		<linearGradient id={id('rim')} x1="0" y1="0" x2="0.2" y2="1">
			<stop offset="0" stop-color="#05262c" />
			<stop offset="0.5" stop-color="#083a3c" />
			<stop offset="1" stop-color="#0b4a4c" />
		</linearGradient>

		<!-- Rail · groove · rail, traced off a scanline of the reference. Offset 0
		     is the DIM rail: with all four members sharing one handedness, that
		     puts the highlight on the outer flank of the left legs and the inner
		     flank of the right legs, exactly as the reference has it. -->
		<linearGradient id={id('tube')} x1="0" y1="0" x2="0" y2="1">
			<stop offset="0" stop-color="#39a0a7" />
			<stop offset="0.08" stop-color="#6cdbe1" />
			<stop offset="0.17" stop-color="#8ceef2" />
			<stop offset="0.28" stop-color="#4fbcc2" />
			<stop offset="0.36" stop-color="#0e3438" />
			<stop offset="0.42" stop-color="#050a0b" />
			<stop offset="0.5" stop-color="#040f11" />
			<stop offset="0.56" stop-color="#12565c" />
			<stop offset="0.64" stop-color="#52d3d9" />
			<stop offset="0.73" stop-color="#8ceef2" />
			<stop offset="0.83" stop-color="#b6f5f7" />
			<stop offset="0.92" stop-color="#d8f3f5" />
			<stop offset="1" stop-color="#5ba0a6" />
		</linearGradient>

		<!-- The torus stays bright all the way round — the reference reads ~#a0f7f7
		     on BOTH shoulders of a ring. Only the last few percent rolls off, so
		     the ring keeps an edge without turning into a lit ball. -->
		<!-- NB `r` is in objectBoundingBox units — a fraction of the BBOX, so a
		     circle's own radius is 0.5. Anything near 1 here spreads the ramp over
		     twice the ball and it never darkens: the ring stops reading as metal
		     and turns into a glowing lozenge. -->
		<radialGradient id={id('ring')} cx="0.42" cy="0.3" r="0.7">
			<stop offset="0" stop-color="#f7fbfb" />
			<stop offset="0.28" stop-color="#c4f5f6" />
			<stop offset="0.55" stop-color="#96f0f4" />
			<stop offset="0.75" stop-color="#5cdce3" />
			<stop offset="0.9" stop-color="#2f9fab" />
			<stop offset="1" stop-color="#15606a" />
		</radialGradient>

		<!-- The four lower joints sit a full stop under the apex in the reference —
		     the feet bottom out around #25bac4. Running every ball at apex
		     brightness is what flattens the mark into glowing plastic. -->
		<radialGradient id={id('ringDim')} cx="0.42" cy="0.3" r="0.7">
			<stop offset="0" stop-color="#daf1f2" />
			<stop offset="0.3" stop-color="#6fd9e0" />
			<stop offset="0.58" stop-color="#3ecad3" />
			<stop offset="0.78" stop-color="#25a5b0" />
			<stop offset="0.9" stop-color="#1a7481" />
			<stop offset="1" stop-color="#0e424a" />
		</radialGradient>

		<!-- Cores are lit from the LEFT, not the top-left: the reference ramps
		     across them horizontally. -->
		<radialGradient id={id('core')} cx="0.3" cy="0.42" r="0.6">
			<stop offset="0" stop-color="#2a8d93" />
			<stop offset="0.42" stop-color="#0d3d44" />
			<stop offset="1" stop-color="#06121a" />
		</radialGradient>

		<!-- Darks bottom out at a neutral charcoal-navy, never at R=0. The
		     reference has almost no fully-clipped red; letting the shadows go pure
		     cyan-black is what gives a mark that plasticky, backlit look. -->
		<radialGradient id={id('pierce')} cx="0.28" cy="0.4" r="0.62">
			<stop offset="0" stop-color="#0b3238" />
			<stop offset="0.4" stop-color="#0a1e23" />
			<stop offset="1" stop-color="#070b0f" />
		</radialGradient>

		<!-- Struts are too narrow to carry the members' groove, so they get a plain
		     two-rail cylinder: hot along the top, shadowed underneath. -->
		<linearGradient id={id('strut')} x1="0" y1="0" x2="0" y2="1">
			<stop offset="0" stop-color="#3b9aa2" />
			<stop offset="0.2" stop-color="#9df0f4" />
			<stop offset="0.42" stop-color="#5cd2da" />
			<stop offset="0.68" stop-color="#12565c" />
			<stop offset="0.88" stop-color="#2b8b93" />
			<stop offset="1" stop-color="#0b3238" />
		</linearGradient>

		<radialGradient id={id('bloom')} cx="0.5" cy="0.5" r="0.5">
			<stop offset="0" stop-color="#5fe6ea" stop-opacity="0.5" />
			<stop offset="1" stop-color="#5fe6ea" stop-opacity="0" />
		</radialGradient>

		<filter id={id('soft')} x="-45%" y="-45%" width="190%" height="190%">
			<feGaussianBlur stdDeviation="3" />
		</filter>

		<filter id={id('cast')} x="-25%" y="-25%" width="150%" height="150%">
			<feDropShadow dx="1.4" dy="2.6" stdDeviation="2.2" flood-color="#01080a" flood-opacity="0.95" />
		</filter>

		<clipPath id={id('glass')}>
			<path d={FRAME_IN} />
		</clipPath>
	</defs>

	<!-- The mark spills light onto whatever it sits on. Normally clipped to the
	     glass, so it never leaks over the frame — that leak is what makes a mark
	     look pasted on. -->
	{#snippet markBloom(damp = 1)}
		<g filter="url(#{id('soft')})" opacity={0.45 * halo * damp}>
			{#if MFIG}
				{#each MFIG.nodes as n}
					<circle cx={n.x} cy={n.y} r={MFIG.nodeR} fill="#43cfd6" />
				{/each}
				<circle cx={MFIG.hub.x} cy={MFIG.hub.y} r={MFIG.hubR} fill="#8ff2f6" />
			{:else}
				<circle cx={P.apex.x} cy={P.apex.y} r={R.apex} fill="#43cfd6" />
				<circle cx={P.footL.x} cy={P.footL.y} r={R.foot} fill="#43cfd6" />
				<circle cx={P.footR.x} cy={P.footR.y} r={R.foot} fill="#43cfd6" />
				<circle cx={P.jointL.x} cy={P.jointL.y} r={R.joint * 0.92} fill="#43cfd6" />
				<circle cx={P.jointR.x} cy={P.jointR.y} r={R.joint * 0.92} fill="#43cfd6" />
				<circle cx={P.hub.x} cy={P.hub.y} r={R.hub * 1.5} fill="#8ff2f6" />
			{/if}
		</g>
	{/snippet}

	{#if halo > 0}
		<!-- Kept deliberately faint: the reference has flat near-black right up to
		     the frame, so anything more reads as a sticker with a shadow. -->
		<ellipse cx="100" cy="112" rx="99" ry="108" fill="url(#{id('bloom')})" opacity={0.22 * halo} />
	{/if}

	<!-- FRAME — one band, two shading passes, then the crossed hairlines. -->
	<path d="{OUTER} {FRAME_IN}" fill="url(#{id('frame')})" fill-rule="evenodd" />
	<path d="{OUTER} {FRAME_IN}" fill="url(#{id('shadeR')})" fill-rule="evenodd" />
	<path d="{FRAME_MID} {FRAME_IN}" fill="url(#{id('shadeL')})" fill-rule="evenodd" />

	<!-- GLASS -->
	<path d={FRAME_IN} fill="url(#{id('field')})" />

	<g clip-path="url(#{id('glass')})">
		<path d={FRAME_IN} fill="url(#{id('pool')})" />

		{#if traces}
			<!-- Etched circuitry: decoration, clipped to the glass, and the first
			     thing to go when the mark is reproduced small. -->
			<!-- Traces sit at ~H178 — they are the only GREEN-leaning element in the
			     reference, a full 10° off the frame's blue-teal. Matching them to
			     the frame's hue is what makes etched circuitry look like a
			     lower-opacity copy of the mark instead of a different material. -->
			<g stroke="#12726c" stroke-opacity="0.85" stroke-width="0.7" fill="none" stroke-linecap="round">
				<path d="M38 72 L58 72 M42 80 L66 80 M38 88 L52 88 M46 96 L46 110 L58 110" />
				<path d="M32 108 L32 126 M36 118 L50 118" />
				<path d="M162 72 L142 72 M158 80 L134 80 M162 88 L148 88 M154 96 L154 110 L142 110" />
				<path d="M168 108 L168 126 M164 118 L150 118" />
			</g>
			<!-- A few segments and every node run hot — the reference's traces peak
			     around #21ece8, far above their own mean. -->
			<g stroke="#1ec9bd" stroke-opacity="0.75" stroke-width="0.7" fill="none" stroke-linecap="round">
				<path d="M42 80 L54 80 M46 96 L46 104 M158 80 L146 80 M154 96 L154 104" />
			</g>
			<g fill="#21ece8" fill-opacity="0.8">
				<circle cx="61" cy="72" r="1.1" />
				<circle cx="55" cy="88" r="1.1" />
				<circle cx="32" cy="106" r="1.1" />
				<circle cx="139" cy="72" r="1.1" />
				<circle cx="145" cy="88" r="1.1" />
				<circle cx="168" cy="106" r="1.1" />
			</g>
			<g stroke="#12726c" stroke-opacity="0.45" stroke-width="0.5" fill="none">
				<path d="M30 138 L48 138 M36 146 L36 160 M152 138 L170 138 M164 146 L164 160" />
			</g>
		{/if}

		{#if halo > 0 && bo === 0}
			{@render markBloom()}
		{/if}
	</g>

	<!-- Once the mark crosses the frame, its bloom cannot be clipped to the glass
	     any more — the parts hanging outside would sit in a hard vacuum. So the
	     bloom moves OUT of the clip and is pulled back, since it now falls on the
	     frame and the page rather than only on dark glass. -->
	{#if halo > 0 && bo > 0}
		{@render markBloom(0.7)}
	{/if}

	{#if rim}
		<path d={RIM} fill="none" stroke="url(#{id('rim')})" stroke-width="1.1" />
	{/if}

	<!-- The crossed hairlines. Drawn after the glass so the inner one sits on top
	     of the field edge and reads as the lip of the bevel. -->
	<path d={OUTER} fill="none" stroke="url(#{id('edgeOut')})" stroke-width="1.1" />
	<path d={FRAME_IN} fill="none" stroke="url(#{id('edgeIn')})" stroke-width="1.3" />
	<path d={OUTER} fill="none" stroke="#03080c" stroke-opacity="0.55" stroke-width="0.5" />

	<!-- MARK -->
	<g filter={emboss ? `url(#${id('cast')})` : undefined}>
		{#if MFIG}
			<!-- crestlink, forged. Same vocabulary as the A — struts first so their
			     ends vanish under the ball they leave and the frame they land on,
			     then tubing, then the balls over the top. -->
			{#if tethers}
				{#each MFIG.tethers as t}
					<g transform="translate({t.x} {t.y}) rotate({t.angle}){t.flip ? ' scale(1 -1)' : ''}">
						<rect
							x="0"
							y="-1.6"
							width={t.len}
							height="3.2"
							rx="1.6"
							fill="url(#{id('strut')})"
							stroke="#05191f"
							stroke-opacity="0.7"
							stroke-width="0.4"
						/>
					</g>
				{/each}
				<g stroke="#06171c" stroke-opacity="0.6" stroke-width="0.4">
					{#each MFIG.tethers as t}
						<circle cx={t.to.x} cy={t.to.y} r="2.6" fill="url(#{id('ringDim')})" />
					{/each}
				</g>
			{/if}

			{#each MFIG.spokes as m}
				<g transform="translate({m.x} {m.y}) rotate({m.angle}){m.flip ? ' scale(1 -1)' : ''}">
					<rect
						x="0"
						y={-(TUBE_W * grow) / 2}
						width={m.len}
						height={TUBE_W * grow}
						rx={(TUBE_W * grow) / 2}
						fill="url(#{id('tube')})"
						stroke="#05191f"
						stroke-opacity="0.7"
						stroke-width="0.45"
					/>
				</g>
			{/each}

			<g stroke="#06171c" stroke-opacity="0.6" stroke-width="0.45">
				{#each MFIG.nodes as n}
					<circle cx={n.x} cy={n.y} r={MFIG.nodeR} fill="url(#{id('ringDim')})" />
				{/each}
			</g>
			<g stroke="#9fe9ec" stroke-opacity="0.3" stroke-width="0.5">
				{#each MFIG.nodes as n}
					<circle cx={n.x} cy={n.y} r={MFIG.nodeR * 0.534} fill="url(#{id('pierce')})" />
				{/each}
			</g>

			<!-- The hub is the one ball that reads as solid metal rather than a
			     pierced ring — it is the only thing telling it from a satellite. -->
			<circle
				cx={MFIG.hub.x}
				cy={MFIG.hub.y}
				r={MFIG.hubR}
				fill="url(#{id('ring')})"
				stroke="#06171c"
				stroke-opacity="0.6"
				stroke-width="0.45"
			/>

			<g fill="#fbfdfd">
				{#each MFIG.nodes as n}
					<circle
						cx={n.x - MFIG.nodeR * 0.466}
						cy={n.y - MFIG.nodeR * 0.534}
						r={MFIG.nodeR * 0.127}
						opacity="0.75"
					/>
				{/each}
				<circle
					cx={MFIG.hub.x - MFIG.hubR * 0.45}
					cy={MFIG.hub.y - MFIG.hubR * 0.52}
					r={MFIG.hubR * 0.13}
					opacity="0.85"
				/>
			</g>
		{:else}
		{#if tethers}
			<!-- Struts out to the wall. Drawn FIRST, so every one of them disappears
			     under the joint it leaves and the frame it lands on — a strut whose
			     ends are visible reads as a line crossing the mark, not as structure
			     the shield carries. Narrower than the members and with a plain
			     two-rail ramp: at this width the members' groove would just read as
			     mud. -->
			{#each TETHERS as t}
				<g transform="translate({t.x} {t.y}) rotate({t.angle}){t.flip ? ' scale(1 -1)' : ''}">
					<rect
						x="0"
						y="-1.6"
						width={t.len}
						height="3.2"
						rx="1.6"
						fill="url(#{id('strut')})"
						stroke="#05191f"
						stroke-opacity="0.7"
						stroke-width="0.4"
					/>
				</g>
			{/each}
			<g stroke="#06171c" stroke-opacity="0.6" stroke-width="0.4">
				{#each TETHERS as t}
					<circle cx={t.to.x} cy={t.to.y} r="2.6" fill="url(#{id('ringDim')})" />
				{/each}
			</g>
		{/if}

		<!-- Web sits UNDER the members and joints, so it passes beneath them. -->
		<path
			d={WEB}
			fill="none"
			stroke="#04171c"
			stroke-opacity="0.85"
			stroke-width="2.1"
			stroke-linecap="round"
		/>
		<path
			d={WEB}
			fill="none"
			stroke="#8ceff2"
			stroke-opacity="0.9"
			stroke-width="0.9"
			stroke-linecap="round"
		/>

		{#each MEMBERS as m}
			<g transform="translate({m.x} {m.y}) rotate({m.angle}){m.flip ? ' scale(1 -1)' : ''}">
				<rect
					x="0"
					y={-R.tube / 2}
					width={m.len}
					height={R.tube}
					rx={R.tube / 2}
					fill="url(#{id('tube')})"
					stroke="#05191f"
					stroke-opacity="0.7"
					stroke-width="0.45"
				/>
			</g>
		{/each}

		<!-- Joints: a bright torus over a lit-from-the-left core. -->
		<g stroke="#06171c" stroke-opacity="0.6" stroke-width="0.45">
			<circle cx={P.apex.x} cy={P.apex.y} r={R.apex} fill="url(#{id('ring')})" />
			<circle cx={P.footL.x} cy={P.footL.y} r={R.foot} fill="url(#{id('ringDim')})" />
			<circle cx={P.footR.x} cy={P.footR.y} r={R.foot} fill="url(#{id('ringDim')})" />
			<circle cx={P.jointL.x} cy={P.jointL.y} r={R.joint} fill="url(#{id('ringDim')})" />
			<circle cx={P.jointR.x} cy={P.jointR.y} r={R.joint} fill="url(#{id('ringDim')})" />
		</g>

		<g stroke="#9fe9ec" stroke-opacity="0.3" stroke-width="0.5">
			<circle cx={P.apex.x} cy={P.apex.y} r={R.apex * 0.558} fill="url(#{id('pierce')})" />
			<circle cx={P.footL.x} cy={P.footL.y} r={R.foot * 0.534} fill="url(#{id('pierce')})" />
			<circle cx={P.footR.x} cy={P.footR.y} r={R.foot * 0.534} fill="url(#{id('pierce')})" />
			<circle cx={P.jointL.x} cy={P.jointL.y} r={R.joint * 0.522} fill="url(#{id('core')})" />
			<circle cx={P.jointR.x} cy={P.jointR.y} r={R.joint * 0.522} fill="url(#{id('core')})" />
		</g>

		<!-- Catchlights, up and left on every ball. Near-NEUTRAL, not cyan: in the
		     reference highlights lose saturation as they gain value, and a hot
		     saturated dot is the difference between polished metal and an LED. -->
		<g fill="#fbfdfd">
			<circle
				cx={P.apex.x - R.apex * 0.467}
				cy={P.apex.y - R.apex * 0.533}
				r={R.apex * 0.125}
				opacity="0.8"
			/>
			<circle
				cx={P.footL.x - R.foot * 0.466}
				cy={P.footL.y - R.foot * 0.534}
				r={R.foot * 0.127}
				opacity="0.75"
			/>
			<circle
				cx={P.footR.x - R.foot * 0.466}
				cy={P.footR.y - R.foot * 0.534}
				r={R.foot * 0.127}
				opacity="0.7"
			/>
			<circle
				cx={P.jointL.x - R.joint * 0.435}
				cy={P.jointL.y - R.joint * 0.489}
				r={R.joint * 0.12}
				opacity="0.8"
			/>
			<circle
				cx={P.jointR.x - R.joint * 0.435}
				cy={P.jointR.y - R.joint * 0.489}
				r={R.joint * 0.12}
				opacity="0.7"
			/>
		</g>

		<circle cx={P.hub.x} cy={P.hub.y} r={R.hub} fill="url(#{id('ring')})" />
		<circle
			cx={P.hub.x - R.hub * 0.25}
			cy={P.hub.y - R.hub * 0.28}
			r={R.hub * 0.344}
			fill="#fbfdfd"
			opacity="0.85"
		/>
		{/if}
	</g>
</svg>

<style>
	.crest {
		display: inline-block;
		flex-shrink: 0;
		vertical-align: middle;
	}
</style>
