// ── mesh-studio/gl/shell-shaders — the globe's body, in GLSL ─────────────────
// `GlobeFrame` drew the sphere as six SVG elements: a veil circle, a scanline
// pattern, a rim gradient, a limb stroke, and two `<path>` graticules whose `d`
// strings were rebuilt from 21 rings × 73 samples on every frame of a spin. The
// paths were the expensive half — ~1,500 coordinate pairs serialised to text,
// re-parsed, re-tessellated and re-rasterised sixty times a second — but the
// four circles were not free either, because a filter-free repaint of a
// full-bleed gradient still costs fill rate.
//
// Here the entire body is TWO draws: one quad for the disc (veil, scanlines,
// rim and limb together, composited in the fragment shader), and one buffer of
// ribbons for the graticule.
//
// `GlobeFrame.svelte` is the specification. Every opacity, radius and gradient
// stop below is transcribed from the element it replaced, so the GL sphere and
// the SVG one are the same picture — which is the whole point, since the SVG
// stays as the no-WebGL2 fallback and the two must not drift.
//
// Strings and numbers only. No WebGL calls, no Svelte: the host owns the
// context and `shell-geometry` owns the buffer.
//
// ── Compositing ─────────────────────────────────────────────────────────────
// Both programs output PREMULTIPLIED alpha and pair with
// `blendFunc(ONE, ONE_MINUS_SRC_ALPHA)` — the exact "over" operator, which is
// what the SVG's document order was doing implicitly. That only holds if the
// context agrees, so `GlobeShell` asks for `premultipliedAlpha: true`.
import type { AttribSpec } from './context.js';

/**
 * The disc: one quad, and four of GlobeFrame's elements resolved inside it.
 *
 * A quad rather than a fan because the fragment shader needs the world position
 * anyway — every layer here is a function of distance from the centre — and a
 * 128-segment fan would only be an approximation of the circle the shader can
 * describe exactly.
 */
export const SHELL_DISC_VERT = `#version 300 es
precision highp float;

in vec2 aWorld;

uniform vec3 uCam;
uniform vec2 uSize;

out vec2 vWorld;

void main() {
	vWorld = aWorld;
	vec2 px = uCam.xy + uCam.z * aWorld;
	gl_Position = vec4(px.x / uSize.x * 2.0 - 1.0, 1.0 - px.y / uSize.y * 2.0, 0.0, 1.0);
}
`;

/**
 * Veil, scanlines, rim glow and limb, composited bottom-up in one pass.
 *
 * Antialiasing is by `fwidth` throughout rather than by MSAA: these are
 * analytic edges (a circle, a stripe), so a derivative gives exact coverage at
 * any zoom where multisampling gives 4 or 8 steps of it.
 *
 * The scanline term is the one place this is BETTER than the SVG rather than
 * equal to it. An SVG pattern rasterised below its own pitch aliases into moiré;
 * as `fwidth` grows past the 3-unit tile the stripe here converges to its mean
 * coverage of 1/3 instead, so zooming out fades the raster rather than beating
 * against it.
 */
export const SHELL_DISC_FRAG = `#version 300 es
precision highp float;

in vec2 vWorld;

uniform vec2 uCenter;
/** Where the view ray grazes the sphere — wider than the radius under
 *  perspective. The host computes it; see GlobeFrame's \`limb\`. */
uniform float uLimb;
/** The body, as a three-stop horizontal gradient across the sphere's own box.
 *  A flat fill reads as a disc; a body wants one side nearer the light than the
 *  other. The studio variant collapses all three stops onto one colour, so a
 *  flat veil is the degenerate case of this rather than a second code path. */
uniform vec3 uBody0;
uniform vec3 uBody1;
uniform vec3 uBody2;
uniform vec3 uBodyA;
uniform float uBodyStop;
/** The caller's \`surface\`, multiplying the whole body. */
uniform float uSurface;
uniform vec3 uInk;
uniform float uScanA;
uniform float uRimMid;
uniform float uRimEdge;
uniform float uRingA;
/** Limb stroke weight in WORLD units — it sat inside GlobeFrame's scaled <g>,
 *  so it thickens with zoom, unlike the graticule's non-scaling ribbons. */
uniform float uRingW;

out vec4 fragColor;

/** \`src\` over \`dst\`, both premultiplied. */
vec4 over(vec4 src, vec4 dst) {
	return src + dst * (1.0 - src.a);
}

void main() {
	float r = length(vWorld - uCenter);
	float aa = max(fwidth(r), 1e-6);
	// The disc mask. Veil, scan and rim are all clipped by it; the limb stroke is
	// not, because a stroke straddles the path it is on.
	float inside = 1.0 - smoothstep(uLimb - aa, uLimb + aa, r);

	// The body gradient runs across the sphere's bounding box, which is what an
	// SVG \`objectBoundingBox\` gradient means: 0 at the left of the limb, 1 at the
	// right. Interpolated per channel in straight alpha, because that is how the
	// gradient this was transcribed from resolves its stops.
	float bt = clamp((vWorld.x - (uCenter.x - uLimb)) / max(2.0 * uLimb, 1e-6), 0.0, 1.0);
	vec3 bodyRgb;
	float bodyA;
	if (bt < uBodyStop) {
		float k = bt / max(uBodyStop, 1e-6);
		bodyRgb = mix(uBody0, uBody1, k);
		bodyA = mix(uBodyA.x, uBodyA.y, k);
	} else {
		float k = (bt - uBodyStop) / max(1.0 - uBodyStop, 1e-6);
		bodyRgb = mix(uBody1, uBody2, k);
		bodyA = mix(uBodyA.y, uBodyA.z, k);
	}
	bodyA *= uSurface;

	vec4 c = vec4(bodyRgb * bodyA, bodyA) * inside;

	// Scanlines: a 1-unit bar every 3 world units. Pattern space IS world space —
	// GlobeFrame carried the camera on \`patternTransform\`, so the raster scales
	// with the globe and reads as a property of the object rather than of the
	// display.
	float m = mod(vWorld.y, 3.0);
	float w = max(fwidth(vWorld.y), 1e-6);
	float bar = smoothstep(-w, w, m) - smoothstep(1.0 - w, 1.0 + w, m);
	bar = mix(bar, 0.3333333, smoothstep(0.5, 1.5, w));
	c = over(vec4(uInk * (uScanA * bar * inside), uScanA * bar * inside), c);

	// The rim: transparent through the middle, lit at the edge. A hologram is
	// brightest where the eye looks through the most of it, which on a sphere is
	// the limb — and keeping the face clear is what lets the mesh read through it.
	//
	// Ramped LINEARLY, not with smoothstep: an SVG gradient interpolates its stops
	// linearly, and easing them here would lift the whole face by a few percent
	// while the SVG fallback stayed where it was tuned.
	float t = r / max(uLimb, 1e-6);
	float rim = uRimMid * clamp((t - 0.55) / 0.33, 0.0, 1.0)
	          + (uRimEdge - uRimMid) * clamp((t - 0.88) / 0.12, 0.0, 1.0);
	rim *= inside;
	c = over(vec4(uInk * rim, rim), c);

	// The limb stroke, last and unclipped.
	float edge = abs(r - uLimb);
	// Not "half": that is a reserved word in GLSL ES 3.00 and will not compile.
	float halfW = max(uRingW * 0.5, aa);
	float ring = uRingA * (1.0 - smoothstep(halfW - aa, halfW + aa, edge));
	c = over(vec4(uInk * ring, ring), c);

	fragColor = c;
}
`;

/** Disc attributes — the host builds its VAO from this. */
export const SHELL_DISC_ATTRIBS: AttribSpec[] = [{ name: 'aWorld', size: 2 }];

/**
 * The graticule: thick lines as quads.
 *
 * A deliberate twin of the wall material, and deliberately NOT an import of it.
 * The two are byte-identical today and describe different objects: `wall-shaders`
 * is specified by `TerritoryCaps`, this one by `GlobeFrame`, and each is tuned
 * against its own reference. Sharing the string would mean a wall tweak silently
 * restyling the sphere.
 *
 * `aExpand` is a half-unit offset applied AFTER the camera transform, so the
 * host decides in `uWidth` whether a stroke scales with zoom. It does, and
 * deliberately: GlobeFrame's graticule sat INSIDE the scaled `<g>`, so its 0.4
 * and 0.5 weights were world units that thickened as you zoomed in. `GlobeShell`
 * premultiplies by `uCam.z` to reproduce that. Dropping the multiply would give
 * a non-scaling stroke — arguably nicer, definitely a different picture, and not
 * a change to make silently while the SVG is still the fallback.
 */
export const SHELL_WEB_VERT = `#version 300 es
precision highp float;

in vec2 aWorld;
in vec2 aExpand;

uniform vec3 uCam;
uniform vec2 uSize;
uniform float uWidth;

void main() {
	vec2 px = uCam.xy + uCam.z * aWorld + aExpand * uWidth;
	gl_Position = vec4(px.x / uSize.x * 2.0 - 1.0, 1.0 - px.y / uSize.y * 2.0, 0.0, 1.0);
}
`;

export const SHELL_WEB_FRAG = `#version 300 es
precision highp float;

uniform vec3 uInk;
uniform float uAlpha;

out vec4 fragColor;

void main() {
	fragColor = vec4(uInk * uAlpha, uAlpha);
}
`;

export const SHELL_WEB_ATTRIBS: AttribSpec[] = [
	{ name: 'aWorld', size: 2 },
	{ name: 'aExpand', size: 2 },
];

/** One pass of the graticule. Far first, and far is nearly invisible on purpose:
 *  it is what makes the wireframe read as ENCLOSING the nodes rather than as a
 *  doily laid over them, and anything strong enough to count the lines of puts
 *  the back of the sphere at the same rank as the front. */
export interface ShellWebPass {
	back: boolean;
	/** Stroke weight in world units — see the note on `SHELL_WEB_VERT`. */
	width: number;
	alpha: number;
}

/** How a globe is painted. Everything a surface can restyle, in one object. */
export interface ShellVariant {
	/** Three CSS colours across the sphere's box, left to right. Any CSS colour,
	 *  `var(--bg)` included — the host resolves them against the live canvas. */
	body: [string, string, string];
	bodyAlpha: [number, number, number];
	/** Where the middle stop sits, 0..1. */
	bodyStop: number;
	/** Overrides the caller's `color` for every lit layer. Absent means "use the
	 *  theme accent the caller passed". */
	ink?: string;
	/** `<circle fill="url(#scan)" opacity="0.05">` over a pattern bar drawn at
	 *  0.5 — so the bar lands at 0.025, and the gap at nothing. */
	scan: number;
	/** The rim gradient's two lit stops: at 88%, and at the limb. */
	rimMid: number;
	rimEdge: number;
	/** The limb stroke: opacity, and a weight in world units. */
	ringAlpha: number;
	ringWidth: number;
	web: ShellWebPass[];
}

/**
 * The two globes this library actually draws.
 *
 * `studio` is `GlobeFrame`'s own markup, transcribed value for value — the
 * console's sphere.
 *
 * `scenery` is the marketing hero's, and it exists because that page had been
 * restyling `GlobeFrame`'s internals FROM PAGE CSS: a `fill: url(#globe-body)`
 * onto the veil circle, a `display: none` over the whole second group, and
 * brighter, thicker graticule strokes matched by attribute selector. That works
 * on SVG and cannot work on a canvas, so the overrides had to become values.
 * They are transcribed here from the rules that produced them.
 *
 * The visible differences are all deliberate, and the reasons are the page's own:
 * the body is a gradient because a flat fill reads as a disc rather than a body;
 * the rim, limb stroke and scanlines are OFF because a lit outline drew a hard
 * bright edge exactly where the sphere should have been dissolving into the
 * page; and the graticule is far stronger because it is the only thing left
 * saying "sphere" once the outline is gone.
 */
export const SHELL_VARIANTS: Record<'studio' | 'scenery', ShellVariant> = {
	studio: {
		body: ['var(--bg)', 'var(--bg)', 'var(--bg)'],
		bodyAlpha: [1, 1, 1],
		bodyStop: 0.45,
		scan: 0.05 * 0.5,
		rimMid: 0.1,
		rimEdge: 0.42,
		ringAlpha: 0.35,
		ringWidth: 1,
		web: [
			{ back: true, width: 0.4, alpha: 0.03 },
			{ back: false, width: 0.5, alpha: 0.08 },
		],
	},
	scenery: {
		body: ['#010305', '#0b1c1a', '#20554f'],
		bodyAlpha: [0.97, 0.68, 0.58],
		bodyStop: 0.45,
		ink: '#2FFFE0',
		scan: 0,
		rimMid: 0,
		rimEdge: 0,
		ringAlpha: 0,
		ringWidth: 0,
		web: [
			{ back: true, width: 0.6, alpha: 0.075 },
			// The back half rises WITH the front rather than staying put: the ratio
			// between them is the depth cue, and holding the back at 0.03 while the
			// front went to 0.22 would have flattened the far side out of existence.
			{ back: false, width: 0.6, alpha: 0.22 },
		],
	},
};
