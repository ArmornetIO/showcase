// ── noise — a small value-noise field ───────────────────────────────────────
//
// Hand-written rather than a dependency: this is forty lines, and the two
// backdrops that want it (the contour terrain and the flow field) need only
// smooth, seeded, cheap-to-sample values in 2D and 3D. A simplex library would
// be better noise and a worse trade.
//
// Value noise, not Perlin/simplex: hash the integer lattice, interpolate with a
// smoothstep. It has visible axis-alignment at high frequencies, which is why
// both callers stack octaves — at three octaves the artefacts are gone and the
// difference from simplex is not visible through a blur or a contour trace.

/** Deterministic hash of an integer lattice point, returning 0…1. */
function hash(x: number, y: number, z: number, seed: number): number {
	let h = x * 374761393 + y * 668265263 + z * 1442695040888963407 + seed * 2654435761;
	h = (h ^ (h >>> 13)) * 1274126177;
	return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** 6t⁵−15t⁴+10t³ — the quintic smoothstep, so the second derivative is
 *  continuous and contour lines do not kink at lattice boundaries. */
function fade(t: number): number {
	return t * t * t * (t * (t * 6 - 15) + 10);
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** Smooth value noise at (x, y, z), 0…1. Integer inputs land on lattice points. */
export function valueNoise(x: number, y: number, z: number, seed = 1): number {
	const xi = Math.floor(x);
	const yi = Math.floor(y);
	const zi = Math.floor(z);
	const u = fade(x - xi);
	const v = fade(y - yi);
	const w = fade(z - zi);

	const c = (dx: number, dy: number, dz: number) => hash(xi + dx, yi + dy, zi + dz, seed);

	const x00 = lerp(c(0, 0, 0), c(1, 0, 0), u);
	const x10 = lerp(c(0, 1, 0), c(1, 1, 0), u);
	const x01 = lerp(c(0, 0, 1), c(1, 0, 1), u);
	const x11 = lerp(c(0, 1, 1), c(1, 1, 1), u);

	return lerp(lerp(x00, x10, v), lerp(x01, x11, v), w);
}

/**
 * Stacked octaves — each one double the frequency and half the amplitude.
 *
 * Three is the useful default: one octave is visibly lattice-aligned, two still
 * reads as a grid under a contour trace, and past four the extra detail is
 * smaller than a pixel at the scales either caller uses.
 */
export function fbm(x: number, y: number, z: number, octaves = 3, seed = 1): number {
	let sum = 0;
	let amp = 1;
	let freq = 1;
	let norm = 0;
	for (let i = 0; i < octaves; i++) {
		sum += valueNoise(x * freq, y * freq, z * freq, seed + i) * amp;
		norm += amp;
		amp *= 0.5;
		freq *= 2;
	}
	return sum / norm;
}
