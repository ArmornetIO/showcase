// ── physics/terrain — ground on a sphere ─────────────────────────────────────
// An elevation field over the unit sphere: hand it a direction, it hands back a
// height. That is the whole interface, and everything that wants ground — the
// wireframe, a node's altitude, the patch a building is buried in — asks the
// same question and gets an answer that agrees.
//
// The generator is a SUM OF PLANE WAVES: a few dozen sinusoids, each running
// across the sphere in its own random direction at its own frequency. It is the
// simplest thing that is genuinely terrain-like, and on a sphere it is a better
// fit than the usual grid noise:
//
//  · No parametrisation, so no seam at the date line and no pinch at the poles.
//    Perlin and friends need a lat/long grid or a 3D lattice; a wave is defined
//    by a direction and a frequency, and a sphere has those everywhere.
//  · Smooth by construction — infinitely differentiable, no interpolation
//    kernel to choose and no lattice artefacts to hide.
//  · Closed form. Same seed, same ground, every time, with nothing cached and
//    no way to fail to converge — which is how the rest of physics/ behaves.
//
// The trade is that it cannot make cliffs or ridgelines: a sum of smooth waves
// is smooth. That is a real limit and it is also exactly what is wanted here —
// a light roll under the mesh, not a landscape competing with the nodes.
//
// Pure: no Svelte, no DOM, no dependencies.
import { alignZ, type Vec3, type Cap } from './sphere.js';

export interface TerrainOpts {
	/** Same seed, same ground. */
	seed?: number;
	/** How many bands of detail. Each is `lacunarity` times finer and `gain`
	 *  times fainter than the last. */
	octaves?: number;
	/** Waves in the coarsest band — how many bumps around the globe. Below ~2
	 *  the whole sphere is one lump; above ~6 it reads as noise rather than
	 *  landscape at the size a mesh is drawn. */
	frequency?: number;
	/** Frequency step between bands. */
	lacunarity?: number;
	/** Amplitude step between bands. Under 0.5 the fine detail is decoration on
	 *  a shape the coarse band already decided, which is what makes it read as
	 *  terrain rather than as static. */
	gain?: number;
	/** Waves per band. Three is the fewest that stops the ground looking
	 *  striped — one wave alone is a corrugation, and its direction shows. */
	wavesPerOctave?: number;
}

export interface Terrain {
	/** Elevation at a unit direction, in −1..1. Roughly zero-mean, so a caller
	 *  can treat 0 as sea level and scale by whatever relief it wants. */
	heightAt(d: Vec3): number;
}

/** mulberry32 — a seeded PRNG in four lines.
 *
 *  Here so the terrain is reproducible: `Math.random` would give a different
 *  world on every reload, and a mesh whose ground moves under it between
 *  refreshes is a mesh nobody can learn the shape of. */
function rng(seed: number): () => number {
	let a = seed >>> 0;
	return () => {
		a = (a + 0x6d2b79f5) >>> 0;
		let t = Math.imul(a ^ (a >>> 15), 1 | a);
		t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

/** A uniformly random unit direction.
 *
 *  Height first, then bearing — equal bands of height carve equal area on a
 *  sphere (Archimedes again; `sphere.ts` leans on the same fact). Drawing the
 *  polar ANGLE uniformly instead would crowd the waves toward the poles and
 *  give the ground a grain that follows the axis. */
function randomDir(next: () => number): Vec3 {
	const y = 2 * next() - 1;
	const r = Math.sqrt(Math.max(0, 1 - y * y));
	const t = 2 * Math.PI * next();
	return { x: Math.cos(t) * r, y, z: Math.sin(t) * r };
}

interface Wave {
	dir: Vec3;
	freq: number;
	phase: number;
	amp: number;
}

/** Build an elevation field over the sphere.
 *
 *  The waves are chosen once, up front; sampling is then a fixed number of
 *  multiply-adds with no allocation, which is what makes it safe to call per
 *  vertex per frame. */
export function makeTerrain(opts: TerrainOpts = {}): Terrain {
	const {
		seed = 1,
		octaves = 4,
		frequency = 3,
		lacunarity = 2.1,
		gain = 0.5,
		wavesPerOctave = 3
	} = opts;

	const next = rng(seed);
	const waves: Wave[] = [];
	let total = 0;
	for (let o = 0; o < octaves; o++) {
		const freq = frequency * Math.pow(lacunarity, o);
		const amp = Math.pow(gain, o);
		for (let w = 0; w < wavesPerOctave; w++) {
			waves.push({ dir: randomDir(next), freq, phase: 2 * Math.PI * next(), amp });
			total += amp;
		}
	}
	// Normalise by the amplitude that COULD be reached, so the field is bounded
	// in −1..1 whatever the octave settings. It rarely gets near either end —
	// every wave peaking at once is vanishingly unlikely — which is the usual
	// reason summed noise looks flat if you normalise by the observed range
	// instead: one freak peak then squashes everything else.
	const norm = total || 1;

	return {
		heightAt(d: Vec3): number {
			let h = 0;
			for (const w of waves) {
				h += w.amp * Math.sin(w.freq * (d.x * w.dir.x + d.y * w.dir.y + d.z * w.dir.z) + w.phase);
			}
			return h / norm;
		}
	};
}

/** The lift a terrain puts a direction at, in globe radii — ready to hand
 *  straight to `project`'s `lift` or `tangentFrame`'s.
 *
 *  A tiny wrapper, but it is the one place the scaling convention lives:
 *  `relief` multiplies the field, so for a raw terrain (−1..1) it is the
 *  half-range about sea level, and for a masked one (0..1) it is the height of
 *  the highest ground. 0 is the smooth sphere either way. */
export function terrainLift(terrain: Terrain | undefined, d: Vec3, relief: number): number {
	return terrain && relief ? terrain.heightAt(d) * relief : 0;
}

// ── Land and water ───────────────────────────────────────────────────────────
// Ground everywhere is a planet. Ground only where the regions are is a MAP —
// four landmasses with nothing between them, which is what the mesh actually
// means: a node belongs to a territory, and the space between territories is
// not somewhere you can be. So the elevation field gets cut to the caps, and
// what is left over is not sea to be drawn. It is absence.

/** Smoothstep — a falloff with no corner at either end. A linear shore leaves a
 *  visible crease where it meets the water, because the eye reads the
 *  discontinuity in the SLOPE, not in the value. */
function smoothstep(t: number): number {
	const x = Math.max(0, Math.min(1, t));
	return x * x * (3 - 2 * x);
}

/** How much land ONE region has at a direction: 1 well inside it, 0 outside, with
 *  a shore between. */
function capMaskAt(cap: Cap, d: Vec3, shore: number): number {
	const dot = d.x * cap.center.x + d.y * cap.center.y + d.z * cap.center.z;
	const ang = Math.acos(Math.max(-1, Math.min(1, dot)));
	// Distance in from the rim, as a fraction of the shore's width.
	const inFrom = (cap.alpha - ang) / Math.max(1e-6, cap.alpha * shore);
	return smoothstep(inFrom);
}

/** How much land there is at a direction: 1 well inside a region, 0 outside
 *  every one, with a shore between.
 *
 *  Max over the caps rather than a sum, so two regions that happen to lie close
 *  do not pile up into a ridge between them. */
export function capMask(caps: Cap[], d: Vec3, shore = 0.22): number {
	let best = 0;
	for (const cap of caps) {
		best = Math.max(best, capMaskAt(cap, d, shore));
		if (best >= 1) break;
	}
	return best;
}

/** A terrain cut to a set of regions: rolling ground inside them, nothing
 *  outside.
 *
 *  The field is also lifted out of the water — the masked height runs 0..1
 *  rather than −1..1 — so land is ALWAYS above the surface it is cut from. A
 *  region whose middle dipped below sea level would have a hole in its own
 *  floor, and on a globe with nothing under it that hole shows straight
 *  through. */
export function maskTerrain(
	base: Terrain,
	caps: Cap[],
	shore = 0.22,
	/** A biome per cap, parallel to `caps`. Omit for one field everywhere.
	 *
	 *  Handing the biomes to the MASK rather than letting each layer shape its own
	 *  is the whole reason this parameter exists. Everything that needs ground —
	 *  the globe's wireframe, a node's altitude, the patch a building is buried in,
	 *  the contours on the floor — asks this one field, and they agree only because
	 *  it is one field. A floor that shaped its own copy would sit a few pixels off
	 *  the ground the buildings stand on, and the globe would quietly become two
	 *  surfaces with the nodes on one and the landscape on the other. */
	reliefs?: Relief[]
): Terrain {
	// Shaped once, up front. `shapeTerrain` wraps rather than samples, so building
	// these per call would be cheap anyway — but `heightAt` runs per vertex per
	// frame, and allocating in it is the one thing that is not.
	const fields = reliefs ? caps.map((_, i) => shapeTerrain(base, reliefs[i] ?? 'rolling')) : null;
	return {
		heightAt(d: Vec3): number {
			if (!fields) {
				const m = capMask(caps, d, shore);
				return m <= 0 ? 0 : m * (0.5 + 0.5 * base.heightAt(d));
			}
			// Which region owns this point — the strongest mask wins, matching
			// `capMask`'s max. Regions are packed with an empty border between them
			// (that border is the only reason a region reads as a region), so at any
			// point with land at all there is effectively one candidate. Where two
			// shores did overlap, both masks are near zero and so is the height, so
			// the switch happens where there is nothing to see a seam in.
			let best = 0;
			let owner = -1;
			for (let i = 0; i < caps.length; i++) {
				const m = capMaskAt(caps[i], d, shore);
				if (m > best) {
					best = m;
					owner = i;
				}
			}
			if (best <= 0 || owner < 0) return 0;
			return best * (0.5 + 0.5 * fields[owner].heightAt(d));
		}
	};
}

// ── Biomes ───────────────────────────────────────────────────────────────────
// Four regions sharing one elevation field are the same landscape four times.
// Tinting them apart does not fix that — colour is the one channel a viewer
// reads LAST when the shapes underneath are identical, so it ends up carrying a
// distinction the ground itself is refusing to make.
//
// So the character is put in the FIELD. Each of these is a pointwise transform
// of a height, which is the cheapest place a difference can live and the only
// place that survives being drawn in one colour: reshaping the field changes
// where the contours fall, and contour SPACING is what the eye reads as terrain.

/** How a region's ground is shaped. Named for what it reads as, not for the
 *  maths — the maths is one line each and the read is the whole point. */
export type Relief = 'rolling' | 'terraced' | 'ridged' | 'scattered';

/** Reshape an elevation field into one of the biomes.
 *
 *  Applied BEFORE masking, so the shore still takes every region down to the
 *  surface at its rim however violent its interior. */
export function shapeTerrain(base: Terrain, kind: Relief, steps = 5): Terrain {
	if (kind === 'rolling') return base;
	return {
		heightAt(d: Vec3): number {
			const h = base.heightAt(d);
			switch (kind) {
				// Plateaus with cliffs between them. Quantising the field collapses
				// each step into flat ground, so the contours abandon the middle of a
				// terrace entirely and pile up at its edge — which is exactly how a
				// contour map draws a cliff, and reads as cut, built, industrial.
				case 'terraced':
					return Math.round(h * steps) / steps;
				// Ridgelines. Folding the field about zero turns every crossing into a
				// crease, and a crease is the one thing summed smooth waves cannot
				// otherwise make (see the note at the top of this file). Sharp, high,
				// and the contours run in tight parallel bands down each flank.
				case 'ridged':
					return 2 * (1 - Math.abs(h)) - 1;
				// Isolated peaks over flat ground. The cube pulls everything near zero
				// flatter still and leaves only the extremes standing, so the region
				// breaks into scattered high points with empty ground between them.
				case 'scattered':
					return h * h * h * 4;
			}
		}
	};
}

// ── Contours ─────────────────────────────────────────────────────────────────
// A line drawn ACROSS a slope tells you nothing about it. A line drawn ALONG one
// — at constant elevation — tells you everything: its spacing is the gradient,
// its loops are the peaks, and the shape it traces is the shape of the ground.
//
// That difference is why this exists. A polar web of rings and spokes, displaced
// by a height field, carries elevation only in a few pixels of wobble; you pay
// for every line and read the terrain from none of them. Isolines invert the
// deal — they are DENSE where the ground is steep and absent where it is flat,
// so the ink lands only where there is something to say, and most of a gentle
// region costs nothing at all.
//
// They also settle a disagreement the renderer already had with itself:
// `NodePiece` cuts contour bands across the buildings at constant height and
// calls them "the SAME thing the territory floor draws on the ground". They
// weren't the same thing. Now they are, and a building wearing contours reads as
// the ground continuing up over it rather than as an object parked on top.
//
// Marching squares over the cap's own polar lattice. Closed form, no tracing
// pass, no iteration to tune — the module's usual contract.

export interface ContourOpts {
	/** Elevation between neighbouring lines. The single knob that matters: it is
	 *  the map's scale, and halving it doubles the ink everywhere. */
	interval?: number;
	/** Every Nth line is an INDEX contour, for the caller to draw heavier.
	 *
	 *  Standard cartographic practice and worth keeping, because it buys a second
	 *  line-weight tier out of the same geometry: the fine lines give the surface
	 *  its texture, the heavy ones give it a rhythm you can count elevation by. */
	indexEvery?: number;
	/** Lattice resolution across the cap and around it. The contours are only as
	 *  smooth as the cells they are cut from; these are the fewest that stop a
	 *  loop reading as a polygon at the size a region is drawn. */
	rings?: number;
	spokes?: number;
}

/** One segment of an isoline, as unit directions on the sphere. The caller lifts
 *  and projects them like any other point — nothing here knows about a camera. */
export interface ContourSegment {
	a: Vec3;
	b: Vec3;
}

export interface ContourLine {
	/** The elevation this line follows, in the field's own units. */
	level: number;
	/** An index contour — every `indexEvery`th line. */
	index: boolean;
	/** Unjoined segments. Neighbouring cells interpolate the edge they share
	 *  identically, so the pieces meet exactly and a stroked path is
	 *  indistinguishable from a traced polyline — at a fraction of the code, and
	 *  with no case where tracing fails to close a loop. */
	segments: ContourSegment[];
}

/** A point a fraction of the way from one direction to another, back on the
 *  sphere. Lerp-then-normalise rather than a true slerp: inside one lattice cell
 *  the two differ by well under a pixel, and this is called per cell per level. */
function between(a: Vec3, b: Vec3, t: number): Vec3 {
	const x = a.x + (b.x - a.x) * t;
	const y = a.y + (b.y - a.y) * t;
	const z = a.z + (b.z - a.z) * t;
	const m = Math.hypot(x, y, z) || 1;
	return { x: x / m, y: y / m, z: z / m };
}

/** Cut a terrain into isolines over one region.
 *
 *  The lattice is polar — rings of constant angle from the cap's centre, spokes
 *  around it — because that is the parametrisation a cap already has, and it
 *  reaches the rim exactly. Its one degeneracy is the pole, where every spoke
 *  meets: those cells collapse to triangles with two coincident corners, which
 *  marching squares handles without special-casing (the zero-length edge cannot
 *  be crossed, so it simply contributes nothing). */
export function contours(terrain: Terrain, cap: Cap, opts: ContourOpts = {}): ContourLine[] {
	const { interval = 0.1, indexEvery = 5, rings = 26, spokes = 64 } = opts;
	if (!(interval > 0)) return [];

	// Sample the whole lattice once. Every corner is shared by four cells, so
	// looking it up again per cell would quadruple the terrain calls — which are
	// the expensive part, being a few dozen sines each.
	const dirs: Vec3[][] = [];
	const hs: number[][] = [];
	for (let i = 0; i <= rings; i++) {
		const a = (cap.alpha * i) / rings;
		const sinA = Math.sin(a);
		const cosA = Math.cos(a);
		const dRow: Vec3[] = [];
		const hRow: number[] = [];
		for (let j = 0; j <= spokes; j++) {
			const b = (j / spokes) * Math.PI * 2;
			const p = alignZ(cap.center, {
				x: Math.cos(b) * sinA,
				y: Math.sin(b) * sinA,
				z: cosA
			});
			dRow.push(p);
			hRow.push(terrain.heightAt(p));
		}
		dirs.push(dRow);
		hs.push(hRow);
	}

	let lo = Infinity;
	let hi = -Infinity;
	for (const row of hs)
		for (const h of row) {
			if (h < lo) lo = h;
			if (h > hi) hi = h;
		}
	if (!(hi > lo)) return [];

	const out: ContourLine[] = [];
	const first = Math.ceil(lo / interval);
	const last = Math.floor(hi / interval);
	for (let k = first; k <= last; k++) {
		const level = k * interval;
		const segments: ContourSegment[] = [];
		for (let i = 0; i < rings; i++) {
			for (let j = 0; j < spokes; j++) {
				// Corners, counter-clockwise: (i,j) (i,j+1) (i+1,j+1) (i+1,j).
				const ch = [hs[i][j], hs[i][j + 1], hs[i + 1][j + 1], hs[i + 1][j]];
				const cd = [dirs[i][j], dirs[i][j + 1], dirs[i + 1][j + 1], dirs[i + 1][j]];

				// Where the level crosses each edge of the cell. Rather than the usual
				// 16-case table, collect the crossings and pair them — same result,
				// and the saddle below is the only case that needs a decision at all.
				const cuts: (Vec3 | null)[] = [null, null, null, null];
				let n = 0;
				for (let e = 0; e < 4; e++) {
					const ha = ch[e];
					const hb = ch[(e + 1) % 4];
					// `>=` on one side only, so a corner sitting exactly ON the level is
					// counted once rather than opening a crossing on both its edges.
					if (ha >= level === hb >= level) continue;
					cuts[e] = between(cd[e], cd[(e + 1) % 4], (level - ha) / (hb - ha));
					n++;
				}
				if (n === 2) {
					const pair = cuts.filter((c): c is Vec3 => c !== null);
					segments.push({ a: pair[0], b: pair[1] });
				} else if (n === 4) {
					// A saddle: two ridges crossing, and the level cuts all four edges.
					// Which pairs join is genuinely ambiguous from the corners alone, so
					// ask the middle — the connected side is the one the centre agrees
					// with. Guessing instead is what produces the little bow-ties that
					// give a contour map away as generated.
					const mid = (ch[0] + ch[1] + ch[2] + ch[3]) / 4;
					if (mid >= level) {
						segments.push({ a: cuts[3]!, b: cuts[0]! }, { a: cuts[1]!, b: cuts[2]! });
					} else {
						segments.push({ a: cuts[0]!, b: cuts[1]! }, { a: cuts[2]!, b: cuts[3]! });
					}
				}
			}
		}
		if (segments.length) out.push({ level, index: k % indexEvery === 0, segments });
	}
	return out;
}
