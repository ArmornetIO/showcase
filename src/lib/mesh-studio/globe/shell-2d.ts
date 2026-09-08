// ── mesh-studio/globe/shell-2d — the same sphere, without a GPU ──────────────
// The fallback `GlobeShell` reaches for when WebGL2 is missing, when a driver
// rejects the shaders, when a lost context never comes back, or when every GL
// call succeeds and the canvas composites nothing anyway.
//
// It replaces an SVG `GlobeFrame` that was a fallback in name only. That one was
// a second DESCRIPTION of the sphere — its own elements, its own gradient stops,
// its own stylesheet overrides on the marketing page — so keeping it looking
// like the GL globe was manual work that nobody did, and it re-serialised ~1,500
// coordinates into two `d` strings every frame to be re-parsed and
// re-tessellated by the browser. A fallback that is slower than the thing it
// stands in for and drifts away from it is not a fallback.
//
// This one shares the sphere with the GL path by construction: the same
// `buildShellGrid` rings, the same `shellLimb`, the same `SHELL_VARIANTS` paint
// numbers, the same camera. Every value below is READ from the variant rather
// than restated, which is the property that makes it stay in agreement — a
// retune of the globe moves both renderers or neither.
//
// Why 2D canvas and not SVG or WebGL: it is the only raster surface with no GPU
// in its critical path. A browser with no WebGL2, a blocklisted driver and a
// software compositor all still have a working `2d` context, which is exactly
// the population this file exists for.
//
// Draws in WORLD units — the caller applies the camera — and touches no DOM
// beyond the context it is handed.
import { project, spin } from '../../physics/sphere.js';
import type { ShellSample } from '../gl/shell-geometry.js';
import type { ShellVariant } from '../gl/shell-shaders.js';

export type Rgb = [number, number, number];

export interface Shell2dOpts {
	/** The canvas camera, exactly as the GL vertex shaders consume it:
	 *  `px = cam.t + cam.tk * world`. */
	cam: { tx: number; ty: number; tk: number };
	/** Drawing-buffer size and the ratio it was allocated at. */
	width: number;
	height: number;
	dpr: number;
	cx: number;
	cy: number;
	radius: number;
	viewDistance: number;
	yaw: number;
	pitch: number;
	/** From `shellLimb` — passed in rather than recomputed so the two renderers
	 *  cannot disagree about how big the sphere is. */
	limb: number;
	surface: number;
	paint: ShellVariant;
	/** Already resolved against the live element by the host: a `var(--accent)`
	 *  means nothing to a canvas. */
	ink: Rgb;
	body: [Rgb, Rgb, Rgb];
}

const TAU = Math.PI * 2;

/** Projected samples, `x, y, front` per sample. Held across frames for the same
 *  reason `shell-geometry`'s scratch is: this is thousands of floats that would
 *  otherwise be allocated and collected at frame rate. Safe to share between
 *  globes — it is filled and drained inside one synchronous call. */
let scratch: Float32Array | undefined;

export function drawShell2d(
	c: CanvasRenderingContext2D,
	grid: ShellSample[][],
	o: Shell2dOpts,
): void {
	const { cam, cx, cy, limb, paint } = o;
	// Device pixels first, then the camera on top of it, so everything below is
	// stated in the same world units the GL path uses.
	c.setTransform(o.dpr, 0, 0, o.dpr, 0, 0);
	c.clearRect(0, 0, o.width / o.dpr, o.height / o.dpr);
	if (!(o.radius > 0) || !(limb > 0)) return;
	c.transform(cam.tk, 0, 0, cam.tk, cam.tx, cam.ty);

	// ── The disc ────────────────────────────────────────────────────────────
	// Body, scanlines and rim are all clipped to the sphere; the limb stroke is
	// not, because a stroke straddles the path it sits on.
	c.save();
	c.beginPath();
	c.arc(cx, cy, limb, 0, TAU);
	c.clip();

	c.fillStyle = bodyGradient(c, o);
	c.fillRect(cx - limb, cy - limb, limb * 2, limb * 2);

	if (paint.scan > 0) paintScan(c, o);

	if (paint.rimEdge > 0 || paint.rimMid > 0) {
		// The rim ramps LINEARLY in the shader and a canvas gradient interpolates
		// its stops linearly too, so these three stops are the same function, not
		// an approximation of it.
		const rim = c.createRadialGradient(cx, cy, 0, cx, cy, limb);
		rim.addColorStop(0, rgba(o.ink, 0));
		rim.addColorStop(0.55, rgba(o.ink, 0));
		rim.addColorStop(0.88, rgba(o.ink, paint.rimMid));
		rim.addColorStop(1, rgba(o.ink, paint.rimEdge));
		c.fillStyle = rim;
		c.fillRect(cx - limb, cy - limb, limb * 2, limb * 2);
	}
	c.restore();

	if (paint.ringAlpha > 0 && paint.ringWidth > 0) {
		c.beginPath();
		c.arc(cx, cy, limb, 0, TAU);
		// World units, like the shader's `uRingW`: it lived inside the scaled group
		// on the page this was tuned against, so it thickens with zoom.
		c.lineWidth = paint.ringWidth;
		c.strokeStyle = rgba(o.ink, paint.ringAlpha);
		c.stroke();
	}

	paintWeb(c, grid, o);
}

/**
 * The body: a three-stop gradient across the sphere's own bounding box.
 *
 * Sampled into many stops rather than declared as three, because the shader
 * interpolates its stops in STRAIGHT alpha and a canvas gradient interpolates in
 * premultiplied alpha. Between two stops that differ in both colour and opacity
 * — which is every pair in the `scenery` variant — those are visibly different
 * curves. Sampling the shader's own function closes the gap to nothing.
 */
function bodyGradient(c: CanvasRenderingContext2D, o: Shell2dOpts): CanvasGradient {
	const { paint, body, surface } = o;
	const g = c.createLinearGradient(o.cx - o.limb, 0, o.cx + o.limb, 0);
	const STOPS = 16;
	for (let i = 0; i <= STOPS; i++) {
		const t = i / STOPS;
		const stop = paint.bodyStop;
		const first = t < stop;
		const k = first ? t / Math.max(stop, 1e-6) : (t - stop) / Math.max(1 - stop, 1e-6);
		const from = first ? 0 : 1;
		const to = first ? 1 : 2;
		g.addColorStop(
			t,
			rgba(mixRgb(body[from], body[to], k), mix(paint.bodyAlpha[from], paint.bodyAlpha[to], k) * surface),
		);
	}
	return g;
}

/**
 * Scanlines: a 1-unit bar every 3 world units.
 *
 * A tile in world space rather than screen space, because the raster is a
 * property of the OBJECT — it scales with the globe, which is what the pattern
 * transform on the SVG this was tuned against did. The tile is cut at 8× and
 * scaled back down so its edge is resolved rather than a single blurred pixel.
 */
function paintScan(c: CanvasRenderingContext2D, o: Shell2dOpts): void {
	const pattern = scanPattern(c, o.ink, o.paint.scan);
	if (!pattern) return;
	c.fillStyle = pattern;
	c.fillRect(o.cx - o.limb, o.cy - o.limb, o.limb * 2, o.limb * 2);
}

/** Keyed by the paint it was cut with: the tile only changes when the theme or
 *  the variant does, and rebuilding it per frame would put a canvas allocation
 *  in the frame path. */
let scanTile: { key: string; pattern: CanvasPattern | null } | null = null;

function scanPattern(
	c: CanvasRenderingContext2D,
	ink: Rgb,
	alpha: number,
): CanvasPattern | null {
	const key = `${ink.join()}/${alpha}`;
	if (scanTile?.key === key) return scanTile.pattern;

	const S = 8;
	const tile = document.createElement('canvas');
	tile.width = S;
	tile.height = S * 3;
	const t = tile.getContext('2d');
	let pattern: CanvasPattern | null = null;
	if (t) {
		t.fillStyle = rgba(ink, alpha);
		t.fillRect(0, 0, S, S);
		pattern = c.createPattern(tile, 'repeat');
		// Without the down-scale the tile would be 8 world units tall instead of 3.
		// A browser too old for `setTransform` on a pattern gets no scanlines, which
		// is a 2.5%-alpha raster missing — not a globe missing.
		if (pattern && typeof DOMMatrix !== 'undefined' && pattern.setTransform) {
			pattern.setTransform(new DOMMatrix([1 / S, 0, 0, 1 / S, 0, 0]));
		} else {
			pattern = null;
		}
	}
	scanTile = { key, pattern };
	return pattern;
}

/**
 * The graticule, far half then near half.
 *
 * A segment belongs to the hemisphere of its FIRST point — the same rule
 * `buildShellWeb` applies, and for the same reason: the segment that crosses the
 * horizon stays with the half it left, so the two halves meet instead of leaving
 * a gap at the limb.
 */
function paintWeb(c: CanvasRenderingContext2D, grid: ShellSample[][], o: Shell2dOpts): void {
	let samples = 0;
	for (const ring of grid) samples += ring.length;
	const need = samples * 3;
	if (!scratch || scratch.length < need) scratch = new Float32Array(Math.max(need, 512));
	const pts = scratch;

	let n = 0;
	for (const ring of grid) {
		for (const s of ring) {
			// Spin the point, keep the elevation: turning the globe moves where a hill
			// is drawn, never how high it is.
			const q = spin(s.p, o.yaw, o.pitch);
			const pr = project(q, o.radius, o.viewDistance, s.lift);
			pts[n] = o.cx + pr.x;
			pts[n + 1] = o.cy + pr.y;
			pts[n + 2] = q.z >= 0 ? 1 : 0;
			n += 3;
		}
	}

	c.lineCap = 'butt';
	c.lineJoin = 'round';
	for (const pass of o.paint.web) {
		// Never rasterise a sub-pixel stroke: below a pixel the line thins into
		// partial coverage and the grid reads as broken rather than faint. Widen to
		// one and pay it back in alpha, which keeps the ink per unit length the same
		// — the identical trade the GL path makes, so the two look alike at any zoom.
		const want = pass.width * o.cam.tk;
		const wpx = Math.max(want, 1);
		c.lineWidth = wpx / o.cam.tk;
		c.strokeStyle = rgba(o.ink, pass.alpha * (want / wpx));

		c.beginPath();
		let base = 0;
		for (const ring of grid) {
			let open = false;
			for (let i = 0; i < ring.length - 1; i++) {
				const a = base + i * 3;
				const front = pts[a + 2] > 0.5;
				if (front === pass.back) {
					open = false;
					continue;
				}
				if (!open) {
					c.moveTo(pts[a], pts[a + 1]);
					open = true;
				}
				c.lineTo(pts[a + 3], pts[a + 4]);
			}
			base += ring.length * 3;
		}
		c.stroke();
	}
}

function mix(a: number, b: number, t: number): number {
	return a + (b - a) * t;
}

function mixRgb(a: Rgb, b: Rgb, t: number): Rgb {
	return [mix(a[0], b[0], t), mix(a[1], b[1], t), mix(a[2], b[2], t)];
}

/** The host resolves colours to 0..1 floats for the uniforms; CSS wants 0..255. */
function rgba(c: Rgb, a: number): string {
	const v = (x: number) => Math.round(Math.max(0, Math.min(1, x)) * 255);
	return `rgba(${v(c[0])},${v(c[1])},${v(c[2])},${Math.max(0, Math.min(1, a))})`;
}
