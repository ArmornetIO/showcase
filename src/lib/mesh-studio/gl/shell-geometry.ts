// ── mesh-studio/gl/shell-geometry — the graticule → one vertex buffer ────────
// The per-frame half of the globe's wireframe, and the reason it is `-geometry`
// rather than the `-instances` its sibling `piece-instances` would suggest: a
// building is one static mesh standing at a moving origin, so an instance buffer
// of frames says everything. A meridian is the opposite — every vertex is a
// sample the CPU has spun and projected, so the geometry itself is what changes
// each frame and there is nothing for an instance to point at.
//
// Pure: no WebGL, no Svelte, no DOM. It fills a Float32Array and reports where
// the near and far halves landed in it.
//
// ── Why the rings are built once and projected every frame ──────────────────
// `buildShellGrid` is the sampling; `buildShellWeb` is the projection. They are
// split because the rings are FIXED TO THE GLOBE — turning it moves where a
// meridian lands, never where it is — so re-sampling on a spin would be redoing
// work whose answer cannot have changed. This is the same split `GlobeFrame`
// made between its `grid` and `web` deriveds, kept because it is the reason a
// terrain lookup happens once per ring instead of once per frame.
import { project, spin, type Vec3 } from '../../physics/sphere.js';

/** How finely a ring is sampled. 72 is a segment every 5° — past that the
 *  polyline is already smoother than a screen pixel. Matches `GlobeFrame`'s
 *  `STEPS`, and must: the two draw the same sphere. */
export const SHELL_STEPS = 72;

/** A grid sample: where it sits on the unit sphere, and how high the ground is
 *  there. The point is GLOBE-FIXED (unspun), which is what lets `lift` be looked
 *  up once and reused for the life of the grid. */
export interface ShellSample {
	p: Vec3;
	lift: number;
}

/** Where one pass landed in the buffer, in VERTICES. */
export interface ShellSpan {
	first: number;
	count: number;
}

export interface ShellWebBuild {
	/** Interleaved vertex data — see `SHELL_VERT_FLOATS`. May be longer than the
	 *  frame needs; the spans say what is live. */
	data: Float32Array;
	/** Total vertices written, for the buffer upload. */
	vertices: number;
	/** The far hemisphere, drawn first and fainter. */
	back: ShellSpan;
	front: ShellSpan;
}

/** Floats per vertex: `aWorld.xy` then `aExpand.xy`. Must match
 *  `SHELL_WEB_ATTRIBS` in `gl/shell-shaders.ts`. */
export const SHELL_VERT_FLOATS = 4;

/** Two triangles, six vertices, no index buffer — an index buffer would save a
 *  third of the memory on geometry that is rebuilt every frame anyway, and cost
 *  a second dynamic upload to do it. */
const QUAD_VERTS = 6;
const QUAD_FLOATS = QUAD_VERTS * SHELL_VERT_FLOATS;

const EMPTY: ShellSpan = { first: 0, count: 0 };

/**
 * The rings, on the unit sphere, at rest.
 *
 * `liftAt` is the terrain lookup, passed in rather than taken as a `Terrain` so
 * this file stays free of the terrain module — the grid has to ride the same
 * ground the land does (or there are two surfaces, a wireframe sphere and a
 * wireframe landscape hovering over it), but *how* that height is found is not
 * this file's business.
 */
export function buildShellGrid(
	meridians: number,
	parallels: number,
	liftAt?: (p: Vec3) => number,
): ShellSample[][] {
	const rings: ShellSample[][] = [];
	const at = (p: Vec3): ShellSample => ({ p, lift: liftAt ? liftAt(p) : 0 });

	// Meridians — great circles through the poles, one per bearing. A full circle
	// per bearing, so `meridians` of them cover the sphere twice over in halves.
	for (let m = 0; m < meridians; m++) {
		const lon = (Math.PI * m) / meridians;
		const pts: ShellSample[] = [];
		for (let i = 0; i <= SHELL_STEPS; i++) {
			const t = (i / SHELL_STEPS) * Math.PI * 2;
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
	// equal area (which is what the node placement wants), but drawn as lines they
	// bunch at the poles and read as a wobble rather than a grid.
	for (let p = 1; p <= parallels; p++) {
		const lat = -Math.PI / 2 + (Math.PI * p) / (parallels + 1);
		const y = Math.sin(lat);
		const r = Math.cos(lat);
		const pts: ShellSample[] = [];
		for (let i = 0; i <= SHELL_STEPS; i++) {
			const t = (i / SHELL_STEPS) * Math.PI * 2;
			pts.push(at({ x: Math.cos(t) * r, y, z: Math.sin(t) * r }));
		}
		rings.push(pts);
	}
	return rings;
}

export interface ShellWebOpts {
	yaw: number;
	pitch: number;
	radius: number;
	viewDistance: number;
	/** Centre of the globe in canvas world coordinates. */
	cx: number;
	cy: number;
}

/**
 * Spin, project and ribbon every ring into one buffer, far half first.
 *
 * ── Which half a segment belongs to ─────────────────────────────────────────
 * A segment takes the hemisphere of its FIRST point, which is not an
 * approximation: it is exactly what `GlobeFrame`'s run-splitter did. That
 * function closed the current run with the point that crossed the horizon and
 * opened the next run at the same point, so the crossing segment stayed with the
 * hemisphere it left and the two halves met rather than leaving a gap. Stated
 * per-segment it needs no run bookkeeping at all — and the near and far halves
 * still share their boundary vertex, which is the property that mattered.
 *
 * `reuse` lets the caller hand back last frame's array. This runs once per frame
 * for the life of the globe, and a fresh Float32Array each time is garbage the
 * collector has to find mid-animation. Grown geometrically, never shrunk.
 */
export function buildShellWeb(
	grid: ShellSample[][],
	opts: ShellWebOpts,
	reuse?: Float32Array,
): ShellWebBuild {
	const { yaw, pitch, radius, viewDistance, cx, cy } = opts;
	if (!(radius > 0) || !grid.length) {
		return { data: reuse ?? new Float32Array(0), vertices: 0, back: EMPTY, front: EMPTY };
	}

	let segments = 0;
	for (const ring of grid) segments += Math.max(0, ring.length - 1);

	const need = segments * QUAD_FLOATS;
	const data = reuse && reuse.length >= need ? reuse : new Float32Array(Math.max(need, 256));

	// Projection is done ONCE into this scratch and read twice by the emit below.
	// Projecting per pass instead would double the trigonometry, which at ~1,500
	// samples a frame is the most expensive thing this file does.
	const points = scratchFor(grid);
	let n = 0;
	let backSegs = 0;
	for (const ring of grid) {
		for (let i = 0; i < ring.length; i++) {
			const s = ring[i];
			// Spin the POINT, keep the elevation: the ground is fixed to the globe, so
			// turning it moves where a hill is drawn, never how high it is.
			const q = spin(s.p, yaw, pitch);
			const pr = project(q, radius, viewDistance, s.lift);
			points[n] = cx + pr.x;
			points[n + 1] = cy + pr.y;
			points[n + 2] = q.z >= 0 ? 1 : 0;
			// The last point of a ring starts no segment.
			if (i < ring.length - 1 && q.z < 0) backSegs++;
			n += 3;
		}
	}

	const backFloats = backSegs * QUAD_FLOATS;
	let backAt = 0;
	let frontAt = backFloats;

	let base = 0;
	for (const ring of grid) {
		for (let i = 0; i < ring.length - 1; i++) {
			const a = base + i * 3;
			const b = a + 3;
			if (points[a + 2] > 0.5) {
				frontAt = ribbon(data, frontAt, points[a], points[a + 1], points[b], points[b + 1]);
			} else {
				backAt = ribbon(data, backAt, points[a], points[a + 1], points[b], points[b + 1]);
			}
		}
		base += ring.length * 3;
	}

	const frontSegs = segments - backSegs;
	return {
		data,
		vertices: (backFloats + frontSegs * QUAD_FLOATS) / SHELL_VERT_FLOATS,
		back: { first: 0, count: backSegs * QUAD_VERTS },
		front: { first: backSegs * QUAD_VERTS, count: frontSegs * QUAD_VERTS },
	};
}

/** Projected samples, x/y/frontness per sample. Held across frames for the same
 *  reason `reuse` exists — this is ~4,600 floats that would otherwise be
 *  allocated and collected sixty times a second. Keyed by nothing: a second
 *  globe on the page reuses it too, which is safe because it is filled and drained
 *  entirely within one synchronous call. */
let scratch: Float32Array | undefined;

function scratchFor(grid: ShellSample[][]): Float32Array {
	let samples = 0;
	for (const ring of grid) samples += ring.length;
	const need = samples * 3;
	if (!scratch || scratch.length < need) scratch = new Float32Array(Math.max(need, 512));
	return scratch;
}

/**
 * One ribbon segment: a thick line from (px,py) to (qx,qy).
 *
 * The normal is computed in WORLD coordinates and used as a SCREEN offset, which
 * is exact rather than an approximation: the camera transform is a uniform scale
 * plus a translation, so it maps directions to parallel directions. If it ever
 * grows a rotation or a skew this is the line that breaks.
 *
 * Joins are butt ends. At 72 samples a ring turns 5° per segment, so the notch a
 * round join would fill is far under the sub-pixel stroke it sits in — and the
 * graticule is the faintest thing in the scene at 0.03 and 0.08 alpha, where the
 * notch is not resolvable at all.
 */
function ribbon(
	out: Float32Array,
	at: number,
	px: number,
	py: number,
	qx: number,
	qy: number,
): number {
	const dx = qx - px;
	const dy = qy - py;
	const len = Math.hypot(dx, dy) || 1;
	const nx = -dy / len / 2;
	const ny = dx / len / 2;
	at = vert(out, at, px, py, nx, ny);
	at = vert(out, at, qx, qy, nx, ny);
	at = vert(out, at, qx, qy, -nx, -ny);
	at = vert(out, at, px, py, nx, ny);
	at = vert(out, at, qx, qy, -nx, -ny);
	return vert(out, at, px, py, -nx, -ny);
}

function vert(
	out: Float32Array,
	at: number,
	x: number,
	y: number,
	ex: number,
	ey: number,
): number {
	out[at] = x;
	out[at + 1] = y;
	out[at + 2] = ex;
	out[at + 3] = ey;
	return at + SHELL_VERT_FLOATS;
}

/** The disc's quad, in canvas world coordinates.
 *
 *  Bled two units past the limb so the stroke — which straddles the edge rather
 *  than sitting inside it — has somewhere to land. Without the bleed the outer
 *  half of the limb is clipped by the quad and the sphere loses its outline. */
export function buildShellDisc(
	cx: number,
	cy: number,
	limb: number,
	reuse?: Float32Array,
): Float32Array {
	const r = limb + 2;
	const d = reuse && reuse.length >= 12 ? reuse : new Float32Array(12);
	d[0] = cx - r; d[1] = cy - r;
	d[2] = cx + r; d[3] = cy - r;
	d[4] = cx + r; d[5] = cy + r;
	d[6] = cx - r; d[7] = cy - r;
	d[8] = cx + r; d[9] = cy + r;
	d[10] = cx - r; d[11] = cy + r;
	return d;
}

/** Where the view ray grazes the sphere.
 *
 *  Under perspective this is WIDER than the sphere's own radius — you see
 *  slightly less than a hemisphere, but it projects further out — and it has a
 *  closed form: R·k/√(k²−1) for a camera k radii away. It is what gives the web
 *  an edge to end at instead of fading into nothing. Transcribed from
 *  `GlobeFrame`'s `limb`; the two must agree or the GL sphere and the SVG
 *  fallback are different sizes. */
export function shellLimb(radius: number, viewDistance: number): number {
	const k = Math.max(1.2, viewDistance);
	return (radius * k) / Math.sqrt(k * k - 1);
}
