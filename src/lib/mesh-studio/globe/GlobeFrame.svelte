<script lang="ts">
	// ── GlobeFrame — the wireframe a mesh globe sits on ─────────────────────────
	// A sibling layer to MeshStudio inside the same <Canvas>, drawn first so it
	// sits behind the nodes. It carries no data: its whole job is to say "this is
	// a sphere, and it is turned like THIS" — without it, a spun globe is just
	// discs that change size for no visible reason.
	//
	// Every line is sampled, spun and projected with the same functions the nodes
	// use, rather than drawn as an ellipse. A circle on a sphere does project to a
	// conic, but only under orthographic projection — under perspective the near
	// half stretches, and an ellipse would drift off the nodes it is meant to be
	// carrying. Sampling is exact by construction and costs nothing at this size.
	import { getContext } from 'svelte';
	import { CANVAS_CTX } from '../../primitives/canvas-camera.js';
	import type { CanvasContextValue } from '../../primitives/canvas-camera.js';
	import { spin, project, type Vec3 } from '../../physics/sphere.js';
	import type { Terrain } from '../../physics/terrain.js';

	let {
		cx,
		cy,
		radius,
		yaw = 0,
		pitch = 0,
		viewDistance = 2.6,
		meridians = 12,
		parallels = 5,
		color = 'var(--accent)',
		surface = 0.72,
		terrain,
		relief = 0,
	}: {
		/** Centre of the globe, in canvas coords. */
		cx: number;
		cy: number;
		/** The sphere the nodes sit on — the same radius they were placed with. */
		radius: number;
		yaw?: number;
		pitch?: number;
		/** Must match the projection the nodes use, or the web won't sit under them. */
		viewDistance?: number;
		/** Lines of longitude — full great circles through both poles. */
		meridians?: number;
		/** Lines of latitude between the poles. Poles themselves are a point, not a
		 *  circle, so they are never drawn. */
		parallels?: number;
		color?: string;
		/** How solid the globe's interior is, 0..1.
		 *
		 *  What actually sells it as a body is that the canvas GRID stops at its
		 *  edge — an object you can't see the floor through. So the interior is
		 *  filled with the page background rather than tinted with the accent: a
		 *  tint recolours the grid, it doesn't hide it.
		 *
		 *  Not 1: the far side still has to show through, or spinning the globe
		 *  stops being a way to find anything and the depth cues have nothing to
		 *  act on. */
		surface?: number;
		/** The ground, MASKED to the territories.
		 *
		 *  The grid has to ride the same terrain the land does, or there are two
		 *  surfaces: a wireframe sphere, and a wireframe landscape hovering over it
		 *  with the sphere's own lines showing through from underneath. Nothing then
		 *  looks joined, because nothing IS — the nodes stand on one and the globe
		 *  is the other.
		 *
		 *  A masked field makes this safe as well as right: it is exactly zero
		 *  outside every region, so the grid stays on the sphere everywhere there is
		 *  no land and rises only where there is. One surface, continuous, and the
		 *  shore is where it meets itself. */
		terrain?: Terrain;
		/** Height of the highest ground, in globe radii. */
		relief?: number;
	} = $props();

	const ctx = getContext<CanvasContextValue>(CANVAS_CTX);
	const transform = ctx.transform;

	// Ids for this instance's <defs>. Two globes on one page would otherwise share
	// one pattern, and the second to mount would silently repaint the first.
	const uid = $props.id();

	/** How finely a ring is sampled. 72 is a segment every 5° — past that the
	 *  polyline is already smoother than a screen pixel. */
	const STEPS = 72;

	type Run = { d: string; front: boolean };
	/** A grid sample: where it is on the unit sphere, and the ground there. The
	 *  point is GLOBE-FIXED (unspun), so its elevation is looked up once and reused
	 *  every frame — the terrain turns with the globe, so a sample's height never
	 *  changes and only where it lands does. */
	type Sample = { p: Vec3; lift: number };

	/** Project a ring of samples, split where it crosses the horizon.
	 *
	 *  Split so the far half can be drawn fainter than the near half — which is the
	 *  entire reason the wireframe reads as enclosing the nodes rather than as a
	 *  flat doily laid over them. */
	function runs(pts: Sample[]): Run[] {
		const out: Run[] = [];
		let d: string[] = [];
		let front = pts[0].p.z >= 0;
		for (const { p, lift } of pts) {
			const isFront = p.z >= 0;
			const pr = project(p, radius, viewDistance, lift);
			const xy = `${(cx + pr.x).toFixed(1)},${(cy + pr.y).toFixed(1)}`;
			if (isFront !== front && d.length) {
				// Carry the crossing point into both runs, so the halves meet instead
				// of leaving a gap on the horizon.
				d.push(`L${xy}`);
				out.push({ d: d.join(''), front });
				d = [`M${xy}`];
				front = isFront;
				continue;
			}
			d.push(`${d.length ? 'L' : 'M'}${xy}`);
		}
		if (d.length > 1) out.push({ d: d.join(''), front });
		return out;
	}

	/** The grid, on the globe, at rest.
	 *
	 *  Split from the projection below so the sampling happens when the grid's
	 *  density changes rather than on every frame of a spin — the rings are fixed
	 *  to the globe, and turning it only moves where they land. */
	const grid = $derived.by((): Sample[][] => {
		const rings: Sample[][] = [];
		const at = (p: Vec3): Sample => ({
			p,
			lift: terrain && relief ? terrain.heightAt(p) * relief : 0,
		});

		// Meridians — great circles through the poles, one per bearing.
		for (let m = 0; m < meridians; m++) {
			const lon = (Math.PI * m) / meridians;
			const pts: Sample[] = [];
			for (let i = 0; i <= STEPS; i++) {
				const t = (i / STEPS) * Math.PI * 2;
				pts.push(
					at({
						x: Math.cos(t) * Math.cos(lon),
						y: Math.sin(t),
						z: Math.cos(t) * Math.sin(lon),
					}),
				);
			}
			rings.push(pts);
		}

		// Parallels — evenly spaced in ANGLE, not height. Equal height steps carve
		// equal area (which is what the node placement wants), but drawn as lines
		// they bunch at the poles and read as a wobble rather than a grid.
		for (let p = 1; p <= parallels; p++) {
			const lat = -Math.PI / 2 + (Math.PI * p) / (parallels + 1);
			const y = Math.sin(lat);
			const r = Math.cos(lat);
			const pts: Sample[] = [];
			for (let i = 0; i <= STEPS; i++) {
				const t = (i / STEPS) * Math.PI * 2;
				pts.push(at({ x: Math.cos(t) * r, y, z: Math.sin(t) * r }));
			}
			rings.push(pts);
		}
		return rings;
	});

	const rings = $derived.by((): Run[] => {
		if (!(radius > 0)) return [];
		const out: Run[] = [];
		// Spin the POINT, keep the elevation: the ground is fixed to the globe, so
		// turning it moves where a hill is drawn, never how high it is.
		for (const ring of grid)
			out.push(...runs(ring.map((s) => ({ p: spin(s.p, yaw, pitch), lift: s.lift }))));
		return out;
	});

	/** The silhouette — where the view ray grazes the sphere. Under perspective
	 *  this is wider than the sphere's own radius (you see slightly less than a
	 *  hemisphere, but it projects further out), and it has a closed form:
	 *  R·k/√(k²−1) for a camera k radii away. Drawing it is what gives the web an
	 *  edge to end at instead of fading into nothing. */
	const limb = $derived.by(() => {
		const k = Math.max(1.2, viewDistance);
		return (radius * k) / Math.sqrt(k * k - 1);
	});
</script>

<svg class="gf" aria-hidden="true">
	<defs>
		<!-- Scan lines. The one cue that says PROJECTED rather than drawn: a
		     hologram is a raster being redrawn, and the lines are the raster. Kept
		     to a 3px pitch in world units so they thicken with zoom like everything
		     else — a screen-fixed pitch would read as an artefact of the display
		     instead of a property of the object. -->
		<pattern
			id="gf-scan-{uid}"
			width="6"
			height="3"
			patternUnits="userSpaceOnUse"
			patternTransform="translate({transform.tx},{transform.ty}) scale({transform.tk})"
		>
			<rect width="6" height="1" fill={color} opacity="0.5" />
		</pattern>
		<!-- The limb glow: bright at the rim, gone by the middle. A real hologram is
		     brightest where you look through the most of it, which on a sphere is
		     the edge — so the edge lights and the face stays clear enough to read
		     the mesh through. -->
		<radialGradient id="gf-rim-{uid}">
			<stop offset="55%" stop-color={color} stop-opacity="0" />
			<stop offset="88%" stop-color={color} stop-opacity="0.1" />
			<stop offset="100%" stop-color={color} stop-opacity="0.42" />
		</radialGradient>
	</defs>
	<g transform="translate({transform.tx},{transform.ty}) scale({transform.tk})">
		<!-- Background first, so the canvas grid stops at the globe's edge — that's
		     what makes it read as a body rather than as loose wire. Held well under
		     1: a hologram you cannot see through is a ball. -->
		<circle {cx} {cy} r={limb} fill="var(--bg)" opacity={surface} />
	</g>
	<!-- Scanlines outside the zoom transform, since the pattern carries the camera
	     itself — nesting both would apply it twice. -->
	<g transform="translate({transform.tx},{transform.ty}) scale({transform.tk})">
		<circle {cx} {cy} r={limb} fill="url(#gf-scan-{uid})" opacity={0.05} />
		<circle {cx} {cy} r={limb} fill="url(#gf-rim-{uid})" />
		<circle {cx} {cy} r={limb} fill="none" stroke={color} stroke-width={1} opacity={0.35} />
		<!-- The graticule, demoted to the bottom rung of the ladder.
		     Once the territories draw real isolines, a lat/long grid is a SECOND
		     description of the same surface competing with the first — and it is the
		     one carrying no information, because a meridian says nothing about the
		     ground it crosses. A map of terrain does not also wear a mercator grid.

		     It keeps its place for one reason: between the territories there is no
		     land, so out there this is the only thing left saying "sphere". At 0.08
		     it still does that and stops competing with everything else.

		     The bloom pass is gone with it. A wide faint stroke is what makes a line
		     read as emitted rather than drawn on, and that is worth paying for on
		     the things you are meant to look at — the index contours and the pieces
		     still carry it. Spending it on the quietest layer in the scene only
		     built a haze that lifted the whole globe's black point. -->
		{#each rings as r, i (i)}
			<path
				d={r.d}
				fill="none"
				stroke={color}
				stroke-width={r.front ? 0.5 : 0.4}
				opacity={r.front ? 0.08 : 0.03}
			/>
		{/each}
	</g>
</svg>

<style>
	.gf {
		position: absolute;
		inset: 0;
		overflow: visible;
		/* Chrome, not a target — every click belongs to the canvas under it. */
		pointer-events: none;
	}
</style>
