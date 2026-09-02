// ── mesh-studio/gl/wall-shaders — the rampart material, in GLSL ──────────────
// The territory walls used to be four SVG paths per region, each with a fresh
// `d` built from ~72 rim samples on every frame the globe turned. This is the
// same picture as two very short shaders: the paint is uniforms, the geometry is
// one buffer, and nothing is serialised to a string on the way.
//
// `TerritoryCaps.svelte` is the specification. Every width and opacity in
// `WALL_PASSES` below is transcribed from the `{#if raised}` branch it replaced,
// in the same ground-up order, so the wall reads exactly as it was tuned to.
//
// Strings and numbers only. No WebGL calls, no Svelte: the host owns the context
// and `wall-geometry` owns the buffer.
//
// ── The wall is FLAT-SHADED on purpose ──────────────────────────────────────
// There is no normal, no light and no gradient here, and that is not an
// omission. A rampart you can see the globe through is a hologram of a boundary;
// shade it and it becomes a fence that hides the nodes it was drawn to enclose.
// All four passes are one ink at four opacities.
//
// ── Compositing ─────────────────────────────────────────────────────────────
// Output is PREMULTIPLIED and pairs with `blendFunc(ONE, ONE_MINUS_SRC_ALPHA)`,
// which is the exact "over" operator. That only holds if the CONTEXT agrees, so
// `TerritoryWalls` asks for `premultipliedAlpha: true` — the default is false to
// suit the additive passes elsewhere, and under it the browser would multiply
// RGB by alpha a second time at composite, landing the 0.07 pane at ~0.005.
// Alphas here are therefore the real intended values; do not tune them against a
// mis-set context.
import type { AttribSpec } from './context.js';
import type { WallKind } from './wall-geometry.js';

/**
 * Vertex shader.
 *
 * `aExpand` is a half-unit screen-space offset applied AFTER the camera
 * transform, which is what makes the strokes non-scaling: the same wall holds
 * one weight against GlobeFrame's meridians at any zoom rather than thickening
 * into a band. Panes carry a zero expand and are unaffected.
 */
export const WALL_VERT = `#version 300 es
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

/**
 * Fragment shader. One ink, one opacity, both uniforms — the whole material.
 */
export const WALL_FRAG = `#version 300 es
precision highp float;

uniform vec3 uInk;
uniform float uAlpha;

out vec4 fragColor;

void main() {
	fragColor = vec4(uInk * uAlpha, uAlpha);
}
`;

/** Attribute order — the host builds its VAO from this, so the two cannot drift
 *  from `WALL_VERT_FLOATS`. */
export const WALL_ATTRIBS: AttribSpec[] = [
	{ name: 'aWorld', size: 2 },
	{ name: 'aExpand', size: 2 },
];

/** How a territory is painted this frame. Kept apart from the geometry because
 *  colour precedence — theme hue, focus glow — is a CAPS decision, and resolving
 *  it here is how the two would drift. */
export interface WallPaint {
	/** Already resolved through the theme and the focus state. */
	ink: string;
	/** 0..1 through the focusing beat. */
	lit: number;
	/** 0..1 how face-on the cap is. A cap seen edge-on degenerates into a crescent
	 *  hugging the horizon, so it fades out before it can mislead. */
	face: number;
	/** Whether to lay the bloom under the strokes — see `WALL_BLOOM`. */
	glow: boolean;
}

export interface WallPass {
	kind: WallKind;
	/** Stroke weight in CSS px; 0 for the pane, which is a fill. */
	width(lit: number): number;
	alpha(lit: number): number;
}

/** Drawn ground-up, so the crest ends up the sharpest thing on the wall: the
 *  pane, the footing where it meets the sphere, the posts holding it, the crest.
 *
 *  Every opacity is low on purpose, and the footing is deliberately fainter than
 *  the crest so the eye reads the top edge as the boundary and the bottom as its
 *  shadow. */
export const WALL_PASSES: WallPass[] = [
	{ kind: 'pane', width: () => 0, alpha: (lit) => 0.07 + 0.1 * lit },
	{ kind: 'base', width: () => 1, alpha: (lit) => 0.25 + 0.35 * lit },
	{ kind: 'post', width: (lit) => 1 + 0.3 * lit, alpha: (lit) => 0.3 + 0.45 * lit },
	{ kind: 'crest', width: (lit) => 1.5 + 0.9 * lit, alpha: (lit) => 0.55 + 0.45 * lit },
];

/** The focused territory's glow: a wide faint pass under the sharp strokes.
 *
 *  Replaces the SVG's `feGaussianBlur`, which a raster layer has no cheap way to
 *  reproduce — and does not need to. This is the same substitution the floor's
 *  index contours already make, and it is what makes a line read as EMITTED
 *  rather than drawn on. Skipped on the pane, which has no edge to bloom. */
export const WALL_BLOOM = { width: 3.5, alpha: 0.22 };
