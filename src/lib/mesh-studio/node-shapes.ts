// ── Mesh node silhouette geometry ──────────────────────────────────────────
//
// Generalises the settled circular mesh node into a family of convex
// silhouettes WITHOUT disturbing the three jobs the circle does today:
//   1. Silhouette   — the visible outline (this is what varies per type).
//   2. Ring band    — the segmented port arcs stay on the circle at radius r.
//   3. Perimeter    — edges/ports resolve to a boundary point for any angle θ.
//
// The single seam is `boundaryPoint(spec, θ, r)` — the shape-aware successor to
// canvas-ports.ts `resolvePortOffset(angle, r)`. For a plain disc it returns the
// identical `r·(cosθ, sinθ)`, so the circle is a zero-cost special case.
//
// Angle convention matches canvas-ports.ts: degrees, 0=right · 90=bottom (SVG y
// points down) · 180=left · 270=top.

import type { MeshNodeType, NodeState } from '../primitives/canvas/canvas.types.js';

export type ShapeConcept = 'signet' | 'instrument';

export type ShapeKind =
	| 'disc' // plain circle (control-plane Signet, control-plane/instrument bases)
	| 'squircle' // superellipse — soft-cornered (agentic)
	| 'shield' // squircle base + smooth apex lobe (proxy Signet / teardrop / rocket)
	| 'hexagon' // regular flat-top hexagon, faces tangent to r (daemon Signet)
	| 'octagon' // regular octagon — crate / package
	| 'pentagon' // regular pentagon — home / vendor
	| 'triangle' // rounded triangle — funnel / filter / warning
	| 'ellipse' // stretched oval — capsule / module / eye
	| 'blob'; // gently lobed organic silhouette — reasoning / language

/** A fully-resolved silhouette description an engineer can render + attach to. */
export interface ShapeSpec {
	kind: ShapeKind;
	/** Superellipse exponent for squircle / shield base. Higher = boxier. */
	n?: number;
	/** Rotation of the silhouette in degrees (e.g. tilt a squircle into a diamond). */
	rotate?: number;
	/** Shield apex lobe — angle (screen deg), peak amplitude (·r), gaussian width (deg). */
	apexAngle?: number;
	apexAmp?: number;
	apexSigma?: number;
	/** Hexagon face phase (deg) — chosen so no port sits on a vertex. */
	hexPhase?: number;
	/** Regular-polygon rotation (deg) for octagon/pentagon/triangle. */
	polyPhase?: number;
	/** Ellipse minor/major ratio (<1 = wide lozenge). */
	aspect?: number;
	/** Blob lobe depth (fraction of r) + count. */
	lobeAmp?: number;
	lobeFreq?: number;
	/** Instrument facet — one shallow inward flat centred on facetAngle. */
	facetAngle?: number;
	facetDepth?: number; // fraction of r pulled inward
	facetWidth?: number; // half-width of the flat, deg
	/** Instrument notches — shallow inward dimples at these angles. */
	notchAngles?: number[];
	notchDepth?: number;
	notchSigma?: number; // deg
	// ── Additive outline / decoration devices (drawn by the renderer) ─────────
	/** Concentric inner ring radii, as fractions of r (authority / nesting). */
	innerRings?: number[];
	/** Outer outline stroke weight (privilege ladder). */
	strokeWidth?: number;
	/** Second concentric outline stroke (trust boundary). */
	doubleStroke?: boolean;
	// ── State deformation (applied on top of the base silhouette) ─────────────
	/** Degraded "deflation" dent amplitude (fraction of r). */
	dentAmp?: number;
	/** Uniform scale (offline recede). */
	scale?: number;
}

const DEG = Math.PI / 180;

function angDist(a: number, b: number): number {
	const d = Math.abs(((a - b) % 360 + 360) % 360);
	return Math.min(d, 360 - d);
}

/** Default rotation so a polygon reads naturally (vertex up for pentagon/triangle). */
const POLY: Record<string, { sides: number; phase: number }> = {
	octagon: { sides: 8, phase: 22.5 },
	pentagon: { sides: 5, phase: 270 },
	triangle: { sides: 3, phase: 90 },
};

/** Regular n-gon radius ratio (circumradius = r; corners touch r, faces inset). */
function polyRatio(thetaDeg: number, sides: number, phaseDeg: number): number {
	const seg = 360 / sides;
	const half = seg / 2;
	let a = (((thetaDeg - phaseDeg) % seg) + seg) % seg;
	if (a > half) a -= seg;
	return Math.cos(half * DEG) / Math.cos(a * DEG);
}

/** Base (un-deformed) silhouette radius as a ratio of r at angle θ (deg). */
function baseRatio(spec: ShapeSpec, thetaDeg: number): number {
	switch (spec.kind) {
		case 'disc':
			return 1;

		case 'squircle': {
			const n = spec.n ?? 4;
			const phi = (thetaDeg - (spec.rotate ?? 0)) * DEG;
			const c = Math.abs(Math.cos(phi));
			const s = Math.abs(Math.sin(phi));
			return Math.pow(Math.pow(c, n) + Math.pow(s, n), -1 / n);
		}

		case 'shield': {
			const n = spec.n ?? 4;
			const phi = thetaDeg * DEG;
			const c = Math.abs(Math.cos(phi));
			const s = Math.abs(Math.sin(phi));
			const base = Math.pow(Math.pow(c, n) + Math.pow(s, n), -1 / n);
			const d = angDist(thetaDeg, spec.apexAngle ?? 90);
			const sigma = spec.apexSigma ?? 35;
			const lobe = (spec.apexAmp ?? 0.18) * Math.exp(-((d / sigma) * (d / sigma)));
			return base * (1 + lobe);
		}

		case 'hexagon': {
			const phase = spec.hexPhase ?? 15;
			// angle from nearest face centre, wrapped to [-30, 30]
			const a = (((thetaDeg - phase) % 60) + 90) % 60 - 30;
			return 1 / Math.cos(a * DEG);
		}

		case 'octagon':
		case 'pentagon':
		case 'triangle': {
			const p = POLY[spec.kind];
			return polyRatio(thetaDeg, p.sides, spec.polyPhase ?? p.phase);
		}

		case 'ellipse': {
			const b = spec.aspect ?? 0.62; // minor/major
			const rad = thetaDeg * DEG;
			const c = Math.cos(rad);
			const s = Math.sin(rad);
			return b / Math.sqrt(b * b * c * c + s * s);
		}

		case 'blob': {
			const amp = spec.lobeAmp ?? 0.12;
			const freq = spec.lobeFreq ?? 3;
			// dimples between lobes; stays star-convex for amp < ~0.2
			return 1 - amp * (0.5 - 0.5 * Math.cos(freq * thetaDeg * DEG));
		}
	}
}

/** Applies instrument facet + notch perturbations (inward) to a ratio. */
function applyPerturbations(spec: ShapeSpec, thetaDeg: number, ratio: number): number {
	let out = ratio;
	if (spec.facetAngle !== undefined) {
		const d = angDist(thetaDeg, spec.facetAngle);
		const w = spec.facetWidth ?? 30;
		// smoothstep flatten over the window
		const t = Math.max(0, Math.min(1, (w - d) / w));
		const smooth = t * t * (3 - 2 * t);
		out *= 1 - (spec.facetDepth ?? 0.1) * smooth;
	}
	if (spec.notchAngles?.length) {
		const sigma = spec.notchSigma ?? 12;
		let dip = 0;
		for (const na of spec.notchAngles) {
			const d = angDist(thetaDeg, na);
			dip += Math.exp(-((d / sigma) * (d / sigma)));
		}
		out *= 1 - (spec.notchDepth ?? 0.06) * Math.min(1, dip);
	}
	return out;
}

/** Full silhouette radius ratio at θ (deg), including perturbations + state deform. */
export function radiusRatio(spec: ShapeSpec, thetaDeg: number): number {
	let ratio = baseRatio(spec, thetaDeg);
	ratio = applyPerturbations(spec, thetaDeg, ratio);
	if (spec.dentAmp) {
		// subtle irregular deflation — degraded
		ratio *= 1 - spec.dentAmp * (1 + Math.sin(3 * thetaDeg * DEG)) * 0.5;
	}
	return ratio * (spec.scale ?? 1);
}

/** Shape-aware successor to resolvePortOffset — dx/dy from centre to the silhouette. */
export function boundaryPoint(spec: ShapeSpec, thetaDeg: number, r: number): { dx: number; dy: number } {
	const rr = radiusRatio(spec, thetaDeg) * r;
	const rad = thetaDeg * DEG;
	return { dx: Math.cos(rad) * rr, dy: Math.sin(rad) * rr };
}

/**
 * An open SVG arc that follows the SILHOUETTE boundary from startDeg→endDeg,
 * so the segmented port ring rides the actual shape (not an inner circle).
 * Shape-aware successor to canvas-ports.ts `arcPath`.
 */
export function shapeArcPath(spec: ShapeSpec, startDeg: number, endDeg: number, r: number): string {
	const span = ((endDeg - startDeg) % 360 + 360) % 360;
	const steps = Math.max(2, Math.ceil(span / 3));
	const pts: string[] = [];
	for (let i = 0; i <= steps; i++) {
		const t = startDeg + (span * i) / steps;
		const { dx, dy } = boundaryPoint(spec, t, r);
		pts.push(`${dx.toFixed(2)} ${dy.toFixed(2)}`);
	}
	return `M ${pts.join(' L ')}`;
}

/** Closed SVG path for the silhouette outline, centred at (0,0). */
export function silhouettePath(spec: ShapeSpec, r: number): string {
	if (spec.kind === 'hexagon') {
		// exact 6 vertices (crisp corners; renderer rounds joins via stroke-linejoin)
		const phase = spec.hexPhase ?? 15;
		const scale = spec.scale ?? 1;
		const pts: string[] = [];
		for (let k = 0; k < 6; k++) {
			const ang = phase + 30 + k * 60;
			const rr = (1 / Math.cos(30 * DEG)) * r * scale;
			const x = Math.cos(ang * DEG) * rr;
			const y = Math.sin(ang * DEG) * rr;
			pts.push(`${x.toFixed(2)} ${y.toFixed(2)}`);
		}
		return `M ${pts.join(' L ')} Z`;
	}
	// sampled smooth silhouette
	const step = 3;
	const pts: string[] = [];
	for (let t = 0; t < 360; t += step) {
		const { dx, dy } = boundaryPoint(spec, t, r);
		pts.push(`${dx.toFixed(2)} ${dy.toFixed(2)}`);
	}
	return `M ${pts.join(' L ')} Z`;
}

// ── Concept → per-type shape catalogue ─────────────────────────────────────

const SIGNET: Record<MeshNodeType, ShapeSpec> = {
	// Disc + sovereign inner ring — root of trust, the anchor primitive.
	'control-plane': { kind: 'disc', innerRings: [0.72], strokeWidth: 2.4, doubleStroke: true },
	// Tilted rounded-square → diamond; corners bulge to the 4 ports = an actor in motion.
	'agentic': { kind: 'squircle', n: 4, rotate: 45, strokeWidth: 1.9 },
	// Escutcheon — round-shouldered dome tapering to a downward apex point.
	'proxy': { kind: 'shield', n: 2.6, apexAngle: 90, apexAmp: 0.32, apexSigma: 24, strokeWidth: 2.2, doubleStroke: true },
	// Flat-top hexagon — the tessellating edge-resident sensor.
	'daemon': { kind: 'hexagon', hexPhase: 15, strokeWidth: 1.5 },
};

const INSTRUMENT: Record<MeshNodeType, ShapeSpec> = {
	// Triple-ring gauge — the deepest instrument = authority.
	'control-plane': { kind: 'disc', innerRings: [0.8, 0.58], strokeWidth: 2.4, doubleStroke: true },
	// Machined disc — a circle, but squared at the shoulders.
	'agentic': { kind: 'squircle', n: 4, strokeWidth: 1.8 },
	// Faceted dial — one chamfer facing the port it filters.
	'proxy': { kind: 'disc', facetAngle: 90, facetDepth: 0.1, facetWidth: 30, strokeWidth: 2.2, doubleStroke: true },
	// Notched dial — three gauge inlets, one per port.
	'daemon': { kind: 'disc', notchAngles: [270, 0, 90], notchDepth: 0.06, notchSigma: 12, strokeWidth: 1.5 },
};

export function shapeForType(concept: ShapeConcept, type: MeshNodeType): ShapeSpec {
	const base = (concept === 'signet' ? SIGNET : INSTRUMENT)[type];
	return { ...base };
}

/** Applies state deformation to a base shape (additive to badges). */
export function withState(spec: ShapeSpec, state: NodeState | undefined): ShapeSpec {
	if (state === 'degraded') return { ...spec, dentAmp: 0.05 };
	if (state === 'offline') return { ...spec, scale: 0.9 };
	return spec;
}
