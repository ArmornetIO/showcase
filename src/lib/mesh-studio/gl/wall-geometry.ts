// ── mesh-studio/gl/wall-geometry — territory ramparts → one vertex buffer ────
// The per-frame half of the wall renderer, and the reason this file is
// `wall-geometry` rather than the `wall-instances` its sibling `piece-instances`
// would suggest: there is no static mesh here to instance. A building is one
// shape standing at a moving origin, so 27 floats of frame per node say
// everything. A rampart is the opposite — every one of its vertices is a rim
// sample that the CPU has already spun and projected, so the geometry itself is
// what changes each frame and an instance buffer would have nothing to point at.
// So this rebuilds a vertex buffer, and `updateBuffer` re-uploads it in place.
//
// Pure: no WebGL, no Svelte, no DOM. It fills a Float32Array and reports where
// each territory's passes landed in it.
//
// ── Everything is a quad ────────────────────────────────────────────────────
// Panes, the footing, the posts and the crest are all two triangles. Lines are
// quads too, and deliberately: `gl.lineWidth` is clamped to 1.0 on every desktop
// implementation that matters, so drawing the crest as GL_LINES would silently
// throw away the weight that makes it the sharpest thing on the wall.
//
// A ribbon carries its screen-space offset as an ATTRIBUTE rather than baking a
// half-width into the position, so the vertex shader can apply the width after
// the camera transform. That is what keeps the stroke non-scaling — the same
// property `vector-effect="non-scaling-stroke"` gave the SVG paths — while the
// positions stay in canvas world coordinates and survive a pan or a zoom
// untouched.
//
// ── Depth ───────────────────────────────────────────────────────────────────
// There is no depth buffer (see `gl/context.ts`: the globe is meant to be seen
// through, and a z-buffer would reject the far hemisphere the scene exists to
// show). So the panes are sorted back to front here, once per frame, over the
// ~72 samples of a rim — which is nothing, and is what the SVG was already
// paying for in document order.

/** A point in canvas world coordinates — the space the camera uniform maps to
 *  pixels, so nothing built here has to know the zoom. */
export interface Pt {
	x: number;
	y: number;
}

/** One sample of the wall: where it meets the sphere, where its crest is, and
 *  how near the eye it is. Base and crest come from the SAME unit direction and
 *  differ only in lift, which is what makes the wall share the nodes' vanishing
 *  point instead of being a screen-space offset. */
export interface Seg {
	base: Pt;
	top: Pt;
	/** Spun depth of the rim direction, +z toward the viewer. Sorting key only. */
	z: number;
}

/** The four things a wall is made of, each its own draw with its own width and
 *  opacity. Names match the passes the SVG drew, in the same order. */
export type WallKind = 'pane' | 'base' | 'post' | 'crest';

/** One territory's wall, as geometry. Paint (ink, focus, facing) is the
 *  renderer's business and deliberately absent — this file decides where the
 *  triangles go and nothing else. */
export interface WallCapInput {
	key: string;
	/** Front-facing runs only. A cap's rim can pass behind the globe, and building
	 *  on those pinned points draws a rampart along the horizon; the caller drops
	 *  them before we ever see them. */
	runs: Seg[][];
}

/** Where one pass of one territory landed in the buffer, in VERTICES. */
export interface WallSpan {
	first: number;
	count: number;
}

export interface WallCapSpans {
	key: string;
	spans: Record<WallKind, WallSpan>;
}

export interface WallBuild {
	/** Interleaved vertex data — see `WALL_VERT_FLOATS`. May be longer than the
	 *  frame needs; `caps` says what is live. */
	data: Float32Array;
	/** Total vertices written, for the buffer upload. */
	vertices: number;
	caps: WallCapSpans[];
}

/** Floats per vertex: `aWorld.xy` then `aExpand.xy`. Must match `WALL_ATTRIBS`
 *  in `gl/wall-shaders.ts`. */
export const WALL_VERT_FLOATS = 4;

/** Two triangles, six vertices, no index buffer. An index buffer would save a
 *  third of the memory on geometry that is thrown away every frame anyway, and
 *  cost a second dynamic upload to do it. */
const QUAD_VERTS = 6;
const QUAD_FLOATS = QUAD_VERTS * WALL_VERT_FLOATS;

const EMPTY: WallSpan = { first: 0, count: 0 };

/** A quad's place in the rim, kept as a reference rather than as copied floats:
 *  the sort runs over these, and the emit reads through them. */
interface QuadRef {
	run: Seg[];
	i: number;
	z: number;
}

/**
 * Build every territory's wall into one buffer.
 *
 * `reuse` lets the caller hand back last frame's array. This runs once per frame
 * for the life of the globe, and a fresh Float32Array each time is garbage the
 * collector has to find mid-animation. Grown geometrically, never shrunk.
 */
export function buildWalls(
	caps: WallCapInput[],
	/** A post every N samples — the caller's `POST_EVERY`, passed rather than
	 *  redeclared so the raised wall and the flat one cannot drift apart. */
	postEvery: number,
	reuse?: Float32Array,
): WallBuild {
	let quads = 0;
	for (const c of caps)
		for (const r of c.runs) {
			// pane, footing and crest are one quad per rim SEGMENT; posts are one per
			// strided sample.
			quads += (r.length - 1) * 3 + Math.ceil(r.length / Math.max(1, postEvery));
		}

	const need = quads * QUAD_FLOATS;
	const data = reuse && reuse.length >= need ? reuse : new Float32Array(Math.max(need, 256));

	let at = 0;
	const out: WallCapSpans[] = [];
	const edges: QuadRef[] = [];
	const posts: QuadRef[] = [];

	for (const c of caps) {
		edges.length = 0;
		posts.length = 0;
		for (const run of c.runs) {
			for (let i = 0; i < run.length - 1; i++)
				edges.push({ run, i, z: (run[i].z + run[i + 1].z) * 0.5 });
			for (let i = 0; i < run.length; i += Math.max(1, postEvery))
				posts.push({ run, i, z: run[i].z });
		}
		// Far first. The panes are transparent and there is no depth buffer, so
		// this ordering IS the depth test — and it matters most on a wide cap, where
		// the near rim and the far rim overlap on screen.
		edges.sort(byDepth);
		posts.sort(byDepth);

		const spans: Record<WallKind, WallSpan> = {
			pane: EMPTY,
			base: EMPTY,
			post: EMPTY,
			crest: EMPTY,
		};

		spans.pane = { first: at / WALL_VERT_FLOATS, count: edges.length * QUAD_VERTS };
		for (const q of edges) at = pane(data, at, q.run[q.i], q.run[q.i + 1]);

		spans.base = { first: at / WALL_VERT_FLOATS, count: edges.length * QUAD_VERTS };
		for (const q of edges) at = ribbon(data, at, q.run[q.i].base, q.run[q.i + 1].base);

		spans.post = { first: at / WALL_VERT_FLOATS, count: posts.length * QUAD_VERTS };
		for (const q of posts) at = ribbon(data, at, q.run[q.i].base, q.run[q.i].top);

		spans.crest = { first: at / WALL_VERT_FLOATS, count: edges.length * QUAD_VERTS };
		for (const q of edges) at = ribbon(data, at, q.run[q.i].top, q.run[q.i + 1].top);

		out.push({ key: c.key, spans });
	}

	return { data, vertices: at / WALL_VERT_FLOATS, caps: out };
}

function byDepth(a: QuadRef, b: QuadRef): number {
	return a.z - b.z;
}

/** One pane: the quad between two neighbouring rim samples, ground to crest.
 *  No expansion — a pane is a filled surface, not a stroke. */
function pane(out: Float32Array, at: number, a: Seg, b: Seg): number {
	at = vert(out, at, a.base, 0, 0);
	at = vert(out, at, b.base, 0, 0);
	at = vert(out, at, b.top, 0, 0);
	at = vert(out, at, a.base, 0, 0);
	at = vert(out, at, b.top, 0, 0);
	return vert(out, at, a.top, 0, 0);
}

/** One ribbon segment: a thick line from `p` to `q`.
 *
 *  The normal is computed in WORLD coordinates and used as a SCREEN offset, which
 *  is exact rather than an approximation: the camera transform is a uniform scale
 *  plus a translation, so it maps directions to parallel directions. If it ever
 *  grows a rotation or a skew this is the line that breaks.
 *
 *  Joins are left as butt ends. At 72 samples a rim turns ~5° per segment, so the
 *  notch a round join would have filled is well under the 1–2px stroke it sits
 *  in; posts are single segments where the SVG's round cap added a half-pixel dot
 *  at each end. */
function ribbon(out: Float32Array, at: number, p: Pt, q: Pt): number {
	const dx = q.x - p.x;
	const dy = q.y - p.y;
	const len = Math.hypot(dx, dy) || 1;
	const nx = -dy / len / 2;
	const ny = dx / len / 2;
	at = vert(out, at, p, nx, ny);
	at = vert(out, at, q, nx, ny);
	at = vert(out, at, q, -nx, -ny);
	at = vert(out, at, p, nx, ny);
	at = vert(out, at, q, -nx, -ny);
	return vert(out, at, p, -nx, -ny);
}

function vert(out: Float32Array, at: number, p: Pt, ex: number, ey: number): number {
	out[at] = p.x;
	out[at + 1] = p.y;
	out[at + 2] = ex;
	out[at + 3] = ey;
	return at + WALL_VERT_FLOATS;
}
