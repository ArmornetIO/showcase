<script lang="ts">
	// ── NodePiece — a solid standing where a node's disc would be ───────────────
	// Draws a `pieces.ts` solid through a node's local frame. It is the first node
	// body in the studio that is a THING rather than a symbol: it has sides, it
	// turns as the globe turns, and it hides its own back.
	//
	// It knows nothing about spheres. Everything three-dimensional arrives in the
	// `frame` — a screen displacement and a world direction per axis — so the same
	// component would stand a piece on anything that can produce a local frame.
	// That boundary is the one physics/ holds: geometry is somebody else's
	// problem, and this only draws.
	//
	// Hidden surfaces, in two lines and no z-buffer:
	//  · Cull every face whose outward normal points away. Exact on a convex
	//    solid, which is why `pieces.ts` only ever emits convex parts.
	//  · Sort what survives back-to-front. Parts of a piece overlap each other (a
	//    chimney in front of a roof), and depth order is what settles it.
	//
	// Everything else here is legibility at 40 pixels, where the geometry alone is
	// not enough to tell one building from another. See the notes on the light and
	// on the silhouette pass — both are doing more work than the shape is.
	import type { Piece, PieceVert } from './pieces.js';
	import type { TangentFrame } from '../../physics/sphere.js';
	import { pieceFacets, pieceProjector } from './piece-facets.js';
	import { HOLO_DEFAULTS, fresnelMix, type HoloLook } from './holo-look.js';

	let {
		piece,
		frame,
		color,
		/** Dashed like the rest of the studio's offline styling, and drawn dimmer:
		 *  an unused capability should read as unbuilt, not merely unlit. */
		offline = false,
		/** Lifts the whole piece's presence — matches the studio's selected state. */
		selected = false,
		/** Radius of the plot the piece stands on, in the frame's own units. Only
		 *  used when there is no `ground` — a real patch is better in every way,
		 *  and this is the flat-sphere fallback. */
		plot = 1,
		/** The ground around the piece: screen offsets from the node, each flagged
		 *  nearer to the viewer than the node or not.
		 *
		 *  The far side is drawn behind the piece and the near side in FRONT of it,
		 *  so the ground closes over the footings. That is the entire trick, and it
		 *  is the difference between a building standing IN the ground and one
		 *  parked on top of it. Nothing about it needs a z-buffer: the patch is
		 *  small enough that "nearer than the node" is the only depth question
		 *  worth asking. */
		ground,
		/** How far the piece is pushed down into that ground, in node radii. Its
		 *  base ends up below the surface, where the near half of the patch covers
		 *  it — so the building has no visible bottom edge, which is exactly what a
		 *  building embedded in terrain does not have. */
		sink = 0,
		/** The colour of the LAND this piece stands in. Its lines start here and
		 *  become `color` as they rise, so the building leaves the ground as ground
		 *  and only becomes itself further up. Defaults to its own colour, which
		 *  turns the ramp off. */
		groundColor,
		/** Draw this as a PROJECTION rather than as a founded solid.
		 *
		 *  Not a skin over the same drawing — it removes things. Every cue that
		 *  says "resting on a surface" goes: the plot, the contact shadow, the
		 *  terrain patch, the footing stitches, the near lip that buries the base,
		 *  and the height ramp that hands the outline to the land. Those cues are
		 *  strong, and while any of them survive no amount of glow upstream will
		 *  outvote them — a lit shape with a shadow under it is an object on a
		 *  table, full stop.
		 *
		 *  What replaces them is the physics of the other thing. A solid is
		 *  brightest where it faces you; a volume of glowing particles is brightest
		 *  where you look ALONG it, so opacity rides `fresnel` and the far side
		 *  stays visible through the near one. See `piece-facets`. */
		suspended = false,
		/** The projection material. Ignored unless `suspended` — a founded piece is
		 *  lit, not projected, and has nothing here to tune. */
		holo = HOLO_DEFAULTS
	}: {
		piece: Piece;
		frame: TangentFrame;
		color: string;
		offline?: boolean;
		selected?: boolean;
		plot?: number;
		ground?: { x: number; y: number; near: boolean }[];
		sink?: number;
		groundColor?: string;
		suspended?: boolean;
		holo?: HoloLook;
	} = $props();

	// Ids for this instance's <defs> — one ramp per piece, since each is oriented
	// by its own frame.
	const uid = $props.id();
	const land = $derived(groundColor ?? color);

	// Cull, shade and depth-sort live in `piece-facets` — the same three
	// operations a character in a first-person scene needs over the same vertex
	// format, and two copies of a cull are two culls that drift.
	const facets = $derived(pieceFacets(piece, frame, { sink, showBack: suspended }));
	/** Split once. `pieceFacets` returns them already sorted back to front, and
	 *  filtering preserves that, so each pass keeps the one ordering that matters. */
	const near = $derived(facets.filter((f) => f.front));
	const far = $derived(facets.filter((f) => !f.front));

	/** Every visible facet outline as ONE path's worth of subpaths.
	 *
	 *  The bloom's uniformity depends on this being a single element, which is not
	 *  obvious and is the whole reason it exists. Stroke opacity accumulates
	 *  BETWEEN elements, not within one: a facet each meant every interior edge
	 *  two facets share got stroked twice, every vertex three or four times, and
	 *  each round join laid a disc on top — so the halo came out as a bank of
	 *  overlapping circles brightest exactly where the geometry happened to be
	 *  densest. Rasterised as one shape, the same strokes are one coverage mask
	 *  composited once, and the glow is even wherever it falls.
	 *
	 *  The cost is that the bloom can no longer vary per facet — one element gets
	 *  one opacity. That is a fair trade and arguably the more correct model: a
	 *  halo is light that has left the surface and stopped belonging to any one
	 *  face of it. Fresnel still rides the faces and the edges, which is where it
	 *  reads as form rather than as blotching. */
	const outline = $derived(near.map((f) => f.d).join(' '));
	/** The same projection the facets were built with. The contour bands and the
	 *  height ramp below place points in the piece's own local space, and a second
	 *  projector that agreed with this one only by inspection would eventually
	 *  stop agreeing. */
	const at = $derived(pieceProjector(frame, { sink }));

	// ── Belonging to the ground ─────────────────────────────────────────────────
	// A solid drawn in its own language sits ON the terrain no matter how
	// accurately it is placed — it is a different KIND of thing, and the eye reads
	// that before it reads any geometry. The three passes below are the argument
	// that it is not: the ground's own contour lines carry on up over it, the
	// ground threads into its footings, and its lines start out the colour of the
	// land and only become its own as they rise.

	/** Vertical spacing of the horizontal slices, in node radii.
	 *
	 *  ONE mechanism, two readings, and that is why it is not two code paths. A
	 *  plane cutting the solid at constant height is a CONTOUR on a building — six
	 *  of them up a piece, saying "this is terrain at a height" — and at a quarter
	 *  of the spacing the identical lines are SCANLINES, saying "this is a raster
	 *  being drawn". The line is the same line; only the pitch decides which thing
	 *  the eye is told it is looking at. */
	const BAND = $derived(suspended ? Math.max(0.02, holo.scan) : 0.24);

	const maxH = $derived(Math.max(...piece.flatMap((s) => s.verts.map((v) => v.h))));
	/** Where the geometry actually starts. Zero for anything founded, but a
	 *  projection hangs, and stepping the slice loop up from the ground through
	 *  empty air below it is that many passes over every facet for no lines. */
	const minH = $derived(Math.min(...piece.flatMap((s) => s.verts.map((v) => v.h))));

	/** Contour lines across the piece at constant height — the SAME thing the
	 *  territory floor draws on the ground, continued up over the building.
	 *
	 *  This is the strongest claim available that the piece is topology rather than
	 *  an object standing on it: a contour is a statement about elevation, so a
	 *  building wearing contours is reading as elevation. Each visible face is
	 *  convex and planar, so a horizontal plane crosses exactly two of its edges
	 *  and the isoline is one segment — no clipping library, no marching squares. */
	const bands = $derived.by((): string => {
		const out: string[] = [];
		for (let h = Math.ceil((minH + 1e-6) / BAND) * BAND; h < maxH; h += BAND) {
			for (const f of near) {
				const hits: { x: number; y: number }[] = [];
				for (let i = 0; i < f.verts.length && hits.length < 2; i++) {
					const a = f.verts[i];
					const b = f.verts[(i + 1) % f.verts.length];
					const da = a.h - h;
					const db = b.h - h;
					// Straddles this level. A face lying flat AT the level has every
					// difference zero and contributes nothing, which is correct — its
					// own outline already is the contour.
					if (da === db || da > 0 === db > 0) continue;
					const t = da / (da - db);
					hits.push(
						at({ e: a.e + (b.e - a.e) * t, n: a.n + (b.n - a.n) * t, h })
					);
				}
				if (hits.length === 2) {
					out.push(
						`M ${hits[0].x.toFixed(2)} ${hits[0].y.toFixed(2)} L ${hits[1].x.toFixed(2)} ${hits[1].y.toFixed(2)}`
					);
				}
			}
		}
		return out.join(' ');
	});

	/** The ground gathering into the footings: a short line in from every sample of
	 *  the patch, toward the piece. Drawn before the piece and in the LAND's
	 *  colour, so what you see is the terrain running under the building rather
	 *  than a plinth belonging to it. Their inner ends disappear beneath it. */
	const stitches = $derived.by((): string => {
		if (!ground?.length) return '';
		return ground
			.map(
				(g) =>
					`M ${g.x.toFixed(2)} ${g.y.toFixed(2)} L ${(g.x * 0.38).toFixed(2)} ${(g.y * 0.38).toFixed(2)}`
			)
			.join(' ');
	});

	/** The top of the piece on screen, for the height ramp below. */
	const apex = $derived(at({ e: 0, n: 0, h: maxH }));
	/** A ramp needs somewhere to run. Facing straight down the up-axis it has no
	 *  length on screen and the gradient would be undefined, so fall back to flat. */
	const ramped = $derived(Math.hypot(apex.x, apex.y) > 2);
	const ink = $derived(ramped && !suspended ? `url(#np-ramp-${uid})` : color);

	/** Face brightness.
	 *
	 *  Founded: lambert, banded — how much light this plane CATCHES.
	 *  Suspended: fresnel — how much light it THROWS at you, which is most where
	 *  you are looking along the plane and least where you are square to it. A
	 *  trace of `shade` survives so form does not go completely flat. */
	const emit = (f: { shade: number; fresnel: number }) =>
		suspended
			? (offline ? 0.11 : 0.3) *
				fresnelMix(f.fresnel, 0.14, holo.fresnel) *
				(0.72 + 0.28 * f.shade)
			: (offline ? 0.14 : 0.32) * f.shade;

	/** Edge brightness. Same inversion, less of it — an outline that faded out
	 *  square-on would take the silhouette with it, and the silhouette is what
	 *  carries identity at 40px. */
	const rim = (f: { shade: number; fresnel: number }) =>
		suspended
			? (offline ? 0.44 : 0.92) * fresnelMix(f.fresnel, 0.5, holo.fresnel)
			: (offline ? 0.5 : 0.95) * f.shade;

	/** The fallback plot, for a globe with no terrain: an ellipse, because the two
	 *  surface directions are no longer square to each other once projected. */
	const disc = $derived({
		rx: Math.hypot(frame.e.x, frame.e.y) * plot,
		ry: Math.max(0.5, Math.hypot(frame.n.x, frame.n.y) * plot),
		rot: (Math.atan2(frame.e.y, frame.e.x) * 180) / Math.PI
	});

	const poly = (pts: { x: number; y: number }[]) =>
		`M ${pts.map((p) => `${p.x.toFixed(2)} ${p.y.toFixed(2)}`).join(' L ')} Z`;

	/** The whole patch — the ground the piece is standing in, drawn behind it. */
	const patch = $derived(ground && ground.length > 2 ? poly(ground) : null);

	/** The near lip of that patch: the contiguous run of samples closer to the
	 *  viewer than the node, closed straight across.
	 *
	 *  Closed with a chord rather than through the node's centre on purpose — the
	 *  chord runs about level with where the piece meets the ground, so the lip
	 *  covers what is below the surface and nothing above it. Take the run
	 *  CONTIGUOUSLY (wrapping the seam) rather than filtering: the near samples
	 *  always form one arc, and a filtered set would zig-zag across the patch
	 *  wherever the arc happens to start. */
	const lip = $derived.by(() => {
		if (!ground || ground.length < 3) return null;
		const n = ground.length;
		// The first near sample whose predecessor is far — the start of the arc.
		let start = -1;
		for (let i = 0; i < n; i++) {
			if (ground[i].near && !ground[(i - 1 + n) % n].near) {
				start = i;
				break;
			}
		}
		if (start < 0) return ground.every((g) => g.near) ? poly(ground) : null;
		const run = [];
		for (let k = 0; k < n; k++) {
			const g = ground[(start + k) % n];
			if (!g.near) break;
			run.push(g);
		}
		return run.length > 1 ? poly(run) : null;
	});
</script>

<g pointer-events="none">
	<defs>
		<!-- The height ramp. Runs from the piece's base to its apex ALONG THE
		     PROJECTED UP-AXIS, so it stays aligned with the building however the
		     globe is turned — a screen-vertical ramp would slide across it as the
		     piece leaned. Land colour at the foot, the piece's own by a third of
		     the way up: the building leaves the ground as ground. -->
		<linearGradient
			id="np-ramp-{uid}"
			gradientUnits="userSpaceOnUse"
			x1="0"
			y1="0"
			x2={apex.x.toFixed(2)}
			y2={apex.y.toFixed(2)}
		>
			<stop offset="0%" stop-color={land} />
			<stop offset="34%" stop-color={color} />
			<stop offset="100%" stop-color={color} />
		</linearGradient>

		{#if suspended}
			<!-- The one filter in this component, and it earns its place only because
			     the bloom is now a SINGLE path rather than one per facet. A stroke has
			     a hard outer boundary however faint it is, so widening it reads as a
			     sticker cut around the shape — the exact tell the layered falloff was
			     meant to avoid and cannot, because every layer is itself a stroke.
			     Blurring the widest one is the only way to give the halo an edge that
			     actually ends.

			     The filter region is generous on purpose: the default -10%/+10% box
			     clips a blur this wide and lays a straight cut across the glow, which
			     reads as a rendering fault rather than as a filter setting. -->
			<filter id="np-haze-{uid}" x="-70%" y="-70%" width="240%" height="240%">
				<feGaussianBlur stdDeviation={0.9 * holo.glow} />
			</filter>
		{/if}
	</defs>

	<!-- ── The ground, part one: all of it, behind the piece ──────────────────
	     A real terrain patch when the globe has ground, an ellipse when it does
	     not. Either way it is opaque enough to sit under the building rather
	     than letting the mesh show through the hole it is standing in. -->
	{#if suspended}
		<!-- Nothing. Deliberately nothing.
		     This is where the plot, the contact shadow and the terrain patch would
		     go, and a projection has none of them: it is not standing anywhere. The
		     empty branch is kept rather than folded into the condition below so the
		     absence is legible as a decision — the shadow in particular is the
		     single strongest "solid object on a surface" cue the eye has, and it is
		     worth a reader seeing that it was taken out on purpose. -->
	{:else if patch}
		<!-- Barely there. This is a clearing in the territory's own floor, not a
		     plate laid on top of it — a dark disc under every piece punches a hole
		     in the landscape and puts the building back on a sticker. The near lip
		     below does all the occluding that is actually needed. -->
		<path
			d={patch}
			fill={land}
			fill-opacity={0.07}
			stroke={land}
			stroke-width={1}
			stroke-linejoin="round"
			vector-effect="non-scaling-stroke"
			opacity={0.4}
		/>
	{:else}
		<!-- Contact shadow, thrown away from the light. On flat ground this is the
		     strongest cue that a thing is standing on a surface rather than
		     hovering over it; with a patch, the buried footings say it better. -->
		<ellipse
			cx={2.5}
			cy={3}
			rx={disc.rx}
			ry={disc.ry}
			transform="rotate({disc.rot})"
			fill="#000"
			opacity={0.28}
		/>
		<ellipse
			rx={disc.rx}
			ry={disc.ry}
			transform="rotate({disc.rot})"
			fill={color}
			fill-opacity={0.12}
			stroke={color}
			stroke-width={1}
			vector-effect="non-scaling-stroke"
			opacity={0.5}
		/>
	{/if}

	<!-- The land running in under the footings. Drawn in the LAND's colour and
	     before the piece, so it belongs to the ground and its inner ends vanish
	     beneath the building instead of stopping at a visible seam. -->
	{#if stitches && !suspended}
		<path
			d={stitches}
			fill="none"
			stroke={land}
			stroke-width={0.8}
			stroke-linecap="round"
			vector-effect="non-scaling-stroke"
			opacity={0.4}
		/>
	{/if}

	<!-- Seat: a dark wash confined to the piece's own footprint. Not the opaque
	     shell a solid would get — just enough to stop the mesh's lines reading
	     THROUGH the building and being mistaken for its edges. A hologram is
	     transparent; it is not invisible. -->
	<g fill="var(--bg)" stroke="none" opacity={suspended ? holo.seat : offline ? 0.34 : 0.55}>
		{#each near as f, i (i)}
			<path d={f.d} />
		{/each}
	</g>

	<!-- The far side, seen THROUGH the near one, and only when suspended.
	     This is the cue no amount of glow can fake: an opaque object hides its own
	     back, and a volume of light does not. Outline only and very faint — it has
	     to be legible as depth without competing with the surface actually facing
	     the viewer, which is the failure a straight second copy of the edge pass
	     would produce. -->
	{#if suspended}
		<g
			fill="none"
			stroke={color}
			stroke-width={0.7}
			stroke-linejoin="round"
			vector-effect="non-scaling-stroke"
			opacity={(offline ? 0.1 : 0.22) * holo.through}
		>
			{#each far as f, i (i)}
				<path d={f.d} />
			{/each}
		</g>
	{/if}

	<!-- Bloom: every visible edge stroked wide and faint, under the real ones. A
	     projected object has no hard boundary — light spills off it — and this is
	     that spill for the cost of one path per face and no filter. It also gives
	     the piece a halo against the globe, which is the job the dark silhouette
	     used to do before the material stopped being opaque. -->
	{#if suspended}
		<!-- Two widths, not one. Real light falls off as a curve, and a single wide
		     stroke gives it a hard outer edge — the halo then reads as a sticker cut
		     around the shape, which is most of what makes a cheap hologram look
		     cheap. A wide faint pass under a narrow brighter one is two samples of
		     that curve, and two is enough for the eye to infer the rest.

		     Both layers stroke ONE merged path — see `outline`, which is where the
		     evenness actually comes from. Keep the widths modest anyway: a stroke
		     wider than the smallest facet it is glowing off closes over that facet
		     and turns its halo into a filled lozenge, which merging does not fix.
		     That is what `glow` is bounded at 2.5 for. -->
		<g class="np-emit" fill="none" stroke={color} stroke-linejoin="round">
			<!-- Haze: the widest layer, blurred, so the halo fades out instead of
			     stopping. This is the layer that carries the "light in the air"
			     reading; the two crisp ones under it are the core. -->
			<path
				d={outline}
				stroke-width={(selected ? 6.2 : 4.8) * holo.glow}
				opacity={(offline ? 0.09 : 0.2) * holo.glowLevel}
				filter="url(#np-haze-{uid})"
			/>
			<path
				d={outline}
				stroke-width={(selected ? 3.4 : 2.6) * holo.glow}
				opacity={(offline ? 0.04 : 0.08) * holo.glowLevel}
			/>
			<path
				d={outline}
				stroke-width={(selected ? 1.9 : 1.4) * holo.glow}
				opacity={(offline ? 0.08 : 0.18) * holo.glowLevel}
			/>
		</g>
	{:else}
		<g
			fill="none"
			stroke={color}
			stroke-width={selected ? 5 : 3.6}
			stroke-linejoin="round"
			stroke-linecap="round"
			opacity={offline ? 0.06 : 0.13}
		>
			{#each near as f, i (i)}
				<path d={f.d} />
			{/each}
		</g>
	{/if}

	<!-- The faces themselves, in ADDITIVE light. `screen` is what makes it read as
	     projection rather than as paint: overlapping planes get brighter instead of
	     hiding each other, which is exactly how a hologram behaves and exactly how
	     a painted solid does not. The three shading bands survive it — they now
	     read as how much light each plane is throwing rather than how much it is
	     catching. -->
	<g class="np-emit">
		{#each near as f, i (i)}
			<path d={f.d} fill={color} stroke="none" opacity={emit(f)} />
		{/each}
	</g>

	<!-- Contour bands: the ground's own isolines, carried on up over the building.
	     Thinner and quieter than the edges — they are texture, not structure, and
	     the moment they compete with the outline the piece stops reading as a
	     shape at all. Same weight and hue language as the territory floor, which
	     is what makes the two look like one surface at two heights. -->
	{#if bands}
		<path
			d={bands}
			fill="none"
			stroke={suspended ? color : ink}
			stroke-width={suspended ? 0.45 : 0.6}
			stroke-linecap="round"
			vector-effect="non-scaling-stroke"
			opacity={suspended
				? (offline ? 0.12 : 0.26) * holo.scanLevel
				: offline
					? 0.22
					: 0.4}
		/>
	{/if}

	<!-- Edges last and brightest. On a wireframe-ish material the edge carries the
	     whole shape, so it is the one thing here allowed to be near-opaque. Rides
	     the height ramp, so the outline leaves the ground in the land's colour. -->
	{#each near as f, i (i)}
		<path
			d={f.d}
			fill="none"
			stroke={ink}
			stroke-width={selected ? 1.3 : 1}
			stroke-linejoin="round"
			stroke-dasharray={offline ? '2.5 3' : 'none'}
			vector-effect="non-scaling-stroke"
			opacity={rim(f)}
		/>
	{/each}

	<!-- ── The ground, part two: the near lip, OVER the piece ──────────────────
	     The last thing drawn, and the one that does the embedding. The piece is
	     sunk below the surface; this covers everything below it, so the building
	     has no bottom edge and no visible plate under it — it comes out of the
	     ground the way a house comes out of a hill.

	     Drawn a shade lighter than the patch behind, because it is the near side
	     of a slope and the light is up-left: the same cue that makes the terrain
	     read as terrain rather than as a hole. -->
	{#if lip && !suspended}
		<!-- More opaque than the patch behind, and that is not a style choice: this
		     is the one element whose JOB is to occlude. A hologram is transparent
		     everywhere except where something is in front of something else, and
		     the near lip of the ground is exactly that.

		     In the LAND's colour, not the piece's. It is a fold of ground lying over
		     the footings, and colouring it after the building would make it read as
		     a skirt the building is wearing. -->
		<path d={lip} fill="var(--bg)" opacity={0.82} />
		<path
			d={lip}
			fill={land}
			fill-opacity={0.16}
			stroke={land}
			stroke-width={1.1}
			stroke-linejoin="round"
			vector-effect="non-scaling-stroke"
			opacity={0.62}
		/>
	{/if}
</g>

<style>
	/* Additive light. Scoped to the faces alone — the seat wash under them has to
	   stay subtractive, and the occluding lip has to stay opaque, so neither can
	   be inside this group. */
	.np-emit {
		mix-blend-mode: screen;
	}
</style>
