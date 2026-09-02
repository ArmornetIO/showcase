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
uniform vec3 uVeil;
uniform float uVeilA;
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

	vec4 c = vec4(uVeil * uVeilA, uVeilA) * inside;

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
	// `half` is a reserved word in GLSL ES 3.00 — do not shorten this name.
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

/** The disc's fixed paint, transcribed from `GlobeFrame`'s elements.
 *
 *  `veil` is not here: it is the caller's `surface` prop, the one value the
 *  sphere's own markup left tunable. */
export const SHELL_DISC = {
	/** `<circle fill="url(#scan)" opacity="0.05">` over a pattern bar drawn at
	 *  0.5 — so the bar lands at 0.025, and the gap at nothing. */
	scan: 0.05 * 0.5,
	/** The radial gradient's two lit stops: 0.1 at 88%, 0.42 at the limb. */
	rimMid: 0.1,
	rimEdge: 0.42,
	/** `stroke-width="1" opacity="0.35"`, in world units. */
	ringAlpha: 0.35,
	ringWidth: 1,
} as const;

/** The graticule's two passes. Far first, and far is nearly invisible on
 *  purpose: it is what makes the wireframe read as ENCLOSING the nodes rather
 *  than as a doily laid over them, and anything strong enough to count the lines
 *  of puts the back of the sphere at the same rank as the front. */
export const SHELL_WEB_PASSES = [
	{ back: true, width: 0.4, alpha: 0.03 },
	{ back: false, width: 0.5, alpha: 0.08 },
] as const;
