// ── mesh-studio/gl/piece-shaders — the building material, in GLSL ────────────
// The 17 agent-mode pieces used to be ~1,300 SVG <path> mutations a frame. This
// is the same picture as two shader sources: one instanced draw per pass, with
// the per-piece frame arriving as instance attributes rather than as a Svelte
// re-render.
//
// `NodePiece.svelte` is the specification, not the inspiration. The vertex
// position below is `at()` transcribed line for line, the shading ladder is
// `band()`, the height ramp is the <linearGradient>, and the four passes are its
// four <g> groups with their opacities carried over as named constants. Where
// this deliberately departs from the SVG — the contours, the bloom's blend, the
// offline dash — the comment says so and says why.
//
// Strings and numbers only. No WebGL calls, no Svelte, no imports: the host owns
// the context and the geometry flattener owns the buffers, and neither of those
// belongs in the thing that has to stay readable as shader source.
//
// ── Winding ─────────────────────────────────────────────────────────────────
// `pieces.ts` winds faces counter-clockwise seen from outside, in a right-handed
// local frame. Screen-y points DOWN, so that projects CLOCKWISE. The host sets
// `gl.frontFace(gl.CW)` with `gl.CULL_FACE` and the winding is correct as it
// stands — do NOT flip a cross product or reverse an index buffer to "fix" it.
//
// ── Depth ───────────────────────────────────────────────────────────────────
// gl_Position.z is 0 and there is no depth buffer. Hidden surfaces are settled
// exactly as the SVG settled them: cull the faces pointing away (exact, because
// every part is convex) and draw what survives back to front. A z-buffer would
// also have to be disabled for the additive passes to composite, so it would buy
// nothing.

/** Vertical spacing of the contour bands, in node radii — six or so up a piece.
 *  Interpolated into the fragment source below rather than retyped, so the
 *  isolines here and any CPU-side hit-testing cannot drift apart. */
export const BAND = 0.24;

/** The key light, fixed in SCREEN space: up and to the left, tilted toward the
 *  viewer. Screen space and not world space on purpose — a light fixed to the
 *  globe would sweep across every piece as it spins, so faces would pulse bright
 *  and dark for no reason the viewer can see.
 *
 *  Left unnormalised at |L| = 1.002, exactly as NodePiece had it: the band
 *  thresholds were tuned against this dot product, so normalising would move
 *  every edge by a fraction of a percent for no gain. */
export const LIGHT: readonly [number, number, number] = [-0.42, -0.5, 0.76];

/** The hover dais radius, in node radii — see `pieces/piece-base`. Here because
 *  the shader shades by it and this module imports nothing. Wider than a glyph's
 *  plate, so the piece hangs over the pool rather than filling it. */
export const DAIS_R = 1.4;

/** GLSL has no integer-to-float promotion in constructors, so `1` is a compile
 *  error where `1.0` is fine. Every interpolated number goes through here. */
const f = (x: number): string => (Number.isInteger(x) ? x.toFixed(1) : String(x));

const L = `vec3(${f(LIGHT[0])}, ${f(LIGHT[1])}, ${f(LIGHT[2])})`;

/**
 * Vertex shader.
 *
 * `(e, n, h)` rides in `(x, y, z)` — GLSL has no `.enh` swizzle, so the packed
 * attributes are read positionally and the mapping is stated once, here.
 */
export const PIECE_VERT = `#version 300 es
precision highp float;

// Static, per-vertex. (e, n, h) in (x, y, z), node radii.
in vec3 aLocal;
in vec3 aNormal;
in float aHNorm;

// Per-instance, divisor 1.
in vec2 iOrigin;
in vec2 iE;
in vec2 iN;
in vec2 iU;
in float iGrow;
in float iSink;
in vec3 iAxisE;
in vec3 iAxisN;
in vec3 iAxisU;
in vec3 iColor;
in vec3 iLand;
in float iAlpha;
in float iState;

uniform vec3 uCam;
uniform vec2 uSize;

out vec3 vColor;
out vec3 vNormalW;
out vec2 vNodePx;
out float vH;
out float vAlpha;
out vec2 vLocal;
flat out float vState;

void main() {
	// NodePiece.at(), verbatim. \`sink\` is applied here and not in the shape:
	// how deep a piece sits is a fact about the ground, not about what it is.
	float h = aLocal.z - iSink;
	// The higher a vertex sits the nearer the eye it is, so its offsets ACROSS
	// the surface open out. Without this a piece seen from overhead is a roof
	// lying flat on its own floor.
	float k = 1.0 + (iGrow - 1.0) * h;
	vec2 world = iOrigin + (aLocal.x * iE + aLocal.y * iN) * k + h * iU;
	vec2 px = uCam.xy + uCam.z * world;

	gl_Position = vec4(px.x / uSize.x * 2.0 - 1.0, 1.0 - px.y / uSize.y * 2.0, 0.0, 1.0);

	// Node-relative, not absolute: the offline dash is cut from this, and a
	// pattern pinned to the canvas would crawl along the edges as the globe spun.
	vNodePx = px - (uCam.xy + uCam.z * iOrigin);

	// +z is toward the viewer. Constant across a face — every vertex carries its
	// FACE's normal — so the interpolation is a no-op and the facing test in the
	// fragment shader is per-face, as NodePiece's was.
	vNormalW = normalize(aNormal.x * iAxisE + aNormal.y * iAxisN + aNormal.z * iAxisU);

	// Land colour at the foot, the piece's own by a third of the way up: the
	// building leaves the ground as ground and only becomes itself further up.
	vColor = mix(iLand, iColor, smoothstep(0.0, 0.34, aHNorm));

	// Un-sunk. Contour levels are measured from the piece's own base; \`sink\`
	// only decides where that base sits in the ground.
	vH = aLocal.z;

	vAlpha = iAlpha;
	vLocal = aLocal.xy;
	vState = iState;
}
`;

/**
 * Fragment shader. Branches on `uPass`; see `PIECE_PASSES` for the blend each
 * one expects.
 *
 * Output is always PREMULTIPLIED. That is what lets one fragment serve all three
 * blend equations, and it is load-bearing for `screen`: `gl.ONE,
 * gl.ONE_MINUS_SRC_COLOR` never reads `src.a` for the colour channels, so the
 * emissive pass has to arrive with its opacity already folded into the colour.
 */
export const PIECE_FRAG = `#version 300 es
precision highp float;

in vec3 vColor;
in vec3 vNormalW;
in vec2 vNodePx;
in float vH;
in float vAlpha;
in vec2 vLocal;
flat in float vState;

uniform int uPass;

out vec4 fragColor;

const int PASS_SEAT = 0;
const int PASS_BLOOM = 1;
const int PASS_EMIT = 2;
const int PASS_EDGE = 3;
const int PASS_BASE = 4;
const float DAIS_R = ${f(DAIS_R)};

const vec3 LIGHT = ${L};
const float BAND = ${f(BAND)};

// NodePiece's four <g> opacities, healthy / offline — raised from the SVG's
// values. The SVG sat on a flat dark globe; this one has lit territories and
// contour lines under it, and at the inherited alphas the ground read THROUGH
// the buildings hard enough that they looked printed on the map.
const float SEAT_A = 0.78, SEAT_A_OFF = 0.5;
const float BLOOM_A = 0.16, BLOOM_A_OFF = 0.08;
const float EMIT_A = 0.42, EMIT_A_OFF = 0.18;
const float EDGE_A = 0.95, EDGE_A_OFF = 0.5;
const float CONTOUR_A = 0.4, CONTOUR_A_OFF = 0.22;

// Selected fattens the strokes, which is geometry the host builds; level is
// what is left for the shader.
//
// SEAT is the one that actually answers "I cannot see the selected building".
// The others add light to a material you can still read the globe's contour
// lines through, and on a lit territory the ground wins that contest however
// bright the edges get. Thickening the wash under the footprint is what makes
// the piece read as standing in front of the world rather than printed on it.
// It is still short of opaque on purpose — a hologram that goes solid when you
// touch it stops being the same object.
const float SEL_SEAT = 1.2, SEL_BLOOM = 1.9, SEL_EMIT = 1.5, SEL_EDGE = 1.12;

const float CONTOUR_W = 0.6;  // css px, matching the SVG stroke-width
const float DASH = 5.5;       // css px period
const float DASH_ON = 2.5;    // css px lit, i.e. the SVG's "2.5 3"

// Three hard values, no gradient. At 40 pixels a smooth ramp turns to mush —
// neighbouring faces land a few percent apart and read as one blob.
// step() is >=, NodePiece's band() was >; they differ only on the two exact
// threshold values, which is a measure-zero set of normals.
// The floor is what an UNLIT face is worth, and it is the whole reason a piece
// turned away from the key light used to vanish into the territory under it: at
// 0.54 its edges landed dimmer than the globe's own contour lines. Raised, with
// the two steps narrowed so the top of the ladder stays at 1.0 — the ladder is
// still three readable values, it just starts higher.
float band(float lit) {
	return 0.7 + 0.16 * step(0.22, lit) + 0.14 * step(0.62, lit);
}

void main() {
	vec3 n = normalize(vNormalW);
	// NodePiece's cull test, kept. CULL_FACE covers the solid passes; the edge
	// and bloom ribbons carry their face's normal, so this is what culls those.
	// It disagrees with the winding only within a hair of the silhouette, where
	// \`grow\` bends the projection off the affine map the winding assumes.
	if (n.z <= 0.001) discard;

	bool off = vState > 0.5 && vState < 1.5;
	bool sel = vState > 1.5;

	float shade = band(dot(n, LIGHT));

	// fwidth of a css-pixel varying is css px per device px, i.e. 1/dpr. Reading
	// it here is how hairlines stay the width vector-effect="non-scaling-stroke"
	// gave them, on any backing buffer, without a device-ratio uniform.
	float dpr = 1.0 / max(fwidth(vNodePx.x), 1e-6);

	vec3 rgb = vColor;
	float a = 0.0;

	if (uPass == PASS_SEAT) {
		// A dark wash confined to the footprint — just enough to stop the mesh's
		// lines reading THROUGH the building and being mistaken for its edges. A
		// hologram is transparent; it is not invisible.
		//
		// Black-with-alpha rather than the page's --bg, which a shader cannot
		// read: on a transparent canvas this scales what is behind it by (1 - a),
		// which is exactly what painting the background over it did, and it stays
		// right whatever --bg turns out to be.
		rgb = vec3(0.0);
		a = min(1.0, (off ? SEAT_A_OFF : SEAT_A) * (sel ? SEL_SEAT : 1.0));
	} else if (uPass == PASS_BLOOM) {
		// Light spilling off the piece, and its halo against the globe. Additive
		// rather than the SVG's 13% wash: a halo can only ever ADD light, and an
		// over-blended one darkened anything behind it brighter than the piece.
		a = (off ? BLOOM_A_OFF : BLOOM_A) * (sel ? SEL_BLOOM : 1.0);
	} else if (uPass == PASS_EMIT) {
		// The faces, in additive light. Overlapping planes get brighter instead
		// of hiding each other, which is how a hologram behaves and how a painted
		// solid does not. The shading bands survive it and start reading as how
		// much light each plane throws rather than how much it catches.
		a = (off ? EMIT_A_OFF : EMIT_A) * shade * (sel ? SEL_EMIT : 1.0);

		// Contours: ONE isoline running across the whole solid at constant
		// height. The SVG could only cut faces that straddled a level, so its
		// bands broke at every seam between them — a continuous band is what
		// those per-facet chords were always approximating.
		float u = vH / BAND;
		float perPx = fwidth(u);
		float d = min(fract(u), 1.0 - fract(u)) / max(perPx, 1e-6);
		float halfW = 0.5 * CONTOUR_W * dpr;
		float line = 1.0 - smoothstep(halfW, halfW + 1.0, d);
		// A face lying flat AT a level has no gradient and draws nothing, which
		// is right — its own outline already is the contour. At the other end,
		// once levels crowd inside a couple of pixels they stop being lines and
		// become a wash, so fade them out rather than fill the face.
		line *= 1.0 - smoothstep(0.25, 0.5, perPx);
		a += (off ? CONTOUR_A_OFF : CONTOUR_A) * line;
	} else if (uPass == PASS_BASE) {
		// The hover dais — \`Figure\`'s floor, stop for stop. Lit at the RIM: light
		// that falls off at the edge is a floor, a flat wash is a disc stood in
		// front of. The dark core is the hole the piece hangs over; without it a
		// lit pool under a floating piece reads as a lamp, not a place.
		float r = length(vLocal) / DAIS_R;
		float pool = r < 0.72
			? mix(0.09, 0.2, r / 0.72)
			: r < 0.93 ? mix(0.2, 0.38, (r - 0.72) / 0.21) : mix(0.38, 0.0, (r - 0.93) / 0.07);
		float px = fwidth(r);
		float rim = 0.5 * (1.0 - smoothstep(0.0, 1.5 * px, abs(r - 0.985)));
		float light = (pool + rim) * (sel ? 1.6 : 1.0) * (off ? 0.5 : 1.0);
		float hole = 0.55 * (1.0 - smoothstep(0.42, 0.56, r));
		a = light + hole - light * hole;
		rgb = a > 0.0 ? vColor * (light / a) : vec3(0.0);
	} else if (uPass == PASS_EDGE) {
		// Last and brightest. On a wireframe-ish material the edge carries the
		// whole shape, so it is the one thing allowed to be near-opaque. Rides
		// the height ramp, so the outline leaves the ground in the land's colour.
		a = (off ? EDGE_A_OFF : EDGE_A) * shade * (sel ? SEL_EDGE : 1.0);
		if (off) {
			// Dashed, like the rest of the studio's offline styling: an unused
			// capability should read as unbuilt, not merely unlit.
			//
			// A real dash needs arc length along the stroke and the attribute
			// contract carries none, so it is cut from screen space instead. Two
			// stripe families at 90 degrees, half weight each — one family alone
			// leaves every edge parallel to it either solid or blank, and there
			// is no single periodic function of position that does not. Summing
			// two guarantees every direction is modulated; the mean stays at
			// DASH_ON / DASH, so it reads at the same density as "2.5 3".
			vec2 s = fract(vec2(vNodePx.x + vNodePx.y, vNodePx.x - vNodePx.y) / DASH);
			float gap = 1.0 - DASH_ON / DASH;
			a *= 0.5 * step(gap, s.x) + 0.5 * step(gap, s.y);
		}
	}

	a = clamp(a, 0.0, 1.0) * vAlpha;
	fragColor = vec4(rgb * a, a);
}
`;

/** Attribute order — the host builds its VAO from this, so the two cannot drift.
 *  Both blocks are interleaved and tightly packed in this order: 7 floats of
 *  static vertex data, 27 floats of per-instance frame. */
export const PIECE_ATTRIBS: { name: string; size: 1 | 2 | 3 | 4; divisor?: number }[] = [
	// Static, per-vertex — one buffer shared by every instance of a piece.
	{ name: 'aLocal', size: 3 },
	{ name: 'aNormal', size: 3 },
	{ name: 'aHNorm', size: 1 },

	// Per-instance — one node's frame, colours and state.
	{ name: 'iOrigin', size: 2, divisor: 1 },
	{ name: 'iE', size: 2, divisor: 1 },
	{ name: 'iN', size: 2, divisor: 1 },
	{ name: 'iU', size: 2, divisor: 1 },
	{ name: 'iGrow', size: 1, divisor: 1 },
	{ name: 'iSink', size: 1, divisor: 1 },
	{ name: 'iAxisE', size: 3, divisor: 1 },
	{ name: 'iAxisN', size: 3, divisor: 1 },
	{ name: 'iAxisU', size: 3, divisor: 1 },
	{ name: 'iColor', size: 3, divisor: 1 },
	{ name: 'iLand', size: 3, divisor: 1 },
	{ name: 'iAlpha', size: 1, divisor: 1 },
	{ name: 'iState', size: 1, divisor: 1 },
];

export const PIECE_UNIFORMS: string[] = ['uCam', 'uSize', 'uPass'];

/** Pass identifiers the host draws in order; the frag shader branches on uPass.
 *
 *  Every pass writes PREMULTIPLIED colour, so the blend modes are:
 *
 *    over    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA)
 *    add     gl.blendFunc(gl.ONE, gl.ONE)
 *    screen  gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_COLOR)
 *
 *  `screen` is `src + dst − src·dst` exactly — the same arithmetic as CSS
 *  mix-blend-mode: screen, not an approximation of it. That single line is why
 *  the hologram look survives the port: overlapping planes get brighter instead
 *  of hiding each other. Note that its colour factor never reads src.a, which is
 *  the reason the shader premultiplies rather than leaving alpha to the blender.
 *
 *  Order matters and is painter's order: the seat clears the mesh out from
 *  behind the piece, the bloom lays a halo under the real lines, the faces emit,
 *  and the edges land on top. */
/** The hover dais, drawn before every piece pass and only under pieces whose
 *  base is `hover`. Its own mesh, so it is not in `PIECE_PASSES`, which the host
 *  draws against each piece's own buffers. Premultiplied OVER — `ONE,
 *  ONE_MINUS_SRC_ALPHA`, as the table above states — because unlike the seat
 *  it carries colour. */
export const PIECE_BASE_PASS = { id: 4, name: 'base' } as const;

export const PIECE_PASSES: { id: number; name: string; blend: 'over' | 'add' | 'screen' }[] = [
	{ id: 0, name: 'seat', blend: 'over' },
	{ id: 1, name: 'bloom', blend: 'add' },
	{ id: 2, name: 'emit', blend: 'screen' },
	{ id: 3, name: 'edge', blend: 'over' },
];
