// ── backdrop/gl/strip-shaders — the belt, its slats and its riders ──────────
//
// Every animation the SVG version ran as a CSS keyframe is a phase here, and a
// phase is `uTime`. That is the whole point of the port: `stroke-dashoffset`
// and `stroke-width` are not compositable, so each keyframe frame was a full
// main-thread repaint of a large stroked path behind whatever the reader was
// trying to read. Nothing below writes to the DOM.
//
// ── Straight vs premultiplied alpha ────────────────────────────────────────
// These passes ACCUMULATE ordered translucent geometry into a transparent
// framebuffer, so the fragment shader emits `rgb·a` and the context is created
// with `premultipliedAlpha: true`. Emitting straight alpha into a transparent
// buffer has the compositor multiply a second time, which lands a pass at alpha
// `a` near `a²` — and these are 6%-alpha marks, so "faint" becomes "gone".

/** Which art the stroke program is drawing. One program rather than four
 *  because the geometry, the placement and the fade are identical across them
 *  and only the width, the ink and the dash differ. */
export const STROKE_MODE = {
	/** The band's slats, pulsing in a wave down its length. */
	rung: 0,
	/** The rim's own dash flow. */
	belt: 1,
	/** The charge running over the rim. */
	energy: 2,
	/** The bloom SvgFx used to bleed off the alpha, drawn underneath. */
	bloom: 3
} as const;

export const STRIP_VERT = /* glsl */ `#version 300 es
in vec2 aPos;
in vec2 aMiter;
in float aSide;
in float aArcN;
in float aArcU;
in float aChunkU;
in float aDepth;
in float aPhase;

uniform vec2 uSize;        // canvas, CSS px
uniform vec2 uVbMin;       // viewBox origin, layout user units
uniform vec2 uVbSize;
uniform float uScale;      // user units -> CSS px
uniform vec2 uRot;         // cos, sin of the strip's fixed bearing
uniform vec2 uTrans;       // where the strip's centre sits, CSS px
uniform vec2 uOffset;      // the ghost pass's misregistration, CSS px

uniform int uMode;
uniform float uTime;
uniform float uBelt;
uniform float uDelay;
uniform vec2 uEnergy;      // period seconds, dash offset per cycle in px
uniform vec2 uPhase;       // this strip's base and span in the chain-wide cycle
uniform float uOpacity;
uniform float uSoft;       // per-strip defocus, CSS px
uniform float uGlow;       // bloom sigma, CSS px
uniform float uGlowInk;
uniform vec4 uFade;        // amount, direction x, direction y, 1/gradient length
uniform vec2 uBox;         // the strip's own box, CSS px

out float vPerp;
out float vHalf;
out float vInk;
out float vCoord;
out float vPxPerUnit;

/** The mask that dissolves both ends of a strip along the chain's axis — the
 *  thing that lets several strips read as ONE ribbon. Eased rather than linear
 *  because a linear alpha ramp reads as a visible grey band. */
float fadeAt(vec2 pos) {
  if (uFade.x <= 0.0) return 1.0;
  vec2 px = ((pos - uVbMin) / uVbSize) * uBox;
  float t = 0.5 + dot(px - uBox * 0.5, uFade.yz) * uFade.w;
  float u = min(t, 1.0 - t);
  float knee = uFade.x * 0.55;
  if (u <= 0.0) return 0.0;
  if (u < knee) return (u / knee) * 0.35;
  if (u < uFade.x) return 0.35 + ((u - knee) / max(uFade.x - knee, 1e-4)) * 0.65;
  return 1.0;
}

void main() {
  float half_ = 0.35;
  float ink = 1.0;

  if (uMode == 0) {
    // A slat brightens as it passes. Same clock as the belt, offset by position
    // along the band, so the highlights read as one wave rather than every slat
    // blinking together.
    float p = fract(uTime / uBelt + aPhase);
    float w = p < 0.08 ? 0.7 + (p / 0.08) * 0.8
            : p < 0.30 ? 1.5 - ((p - 0.08) / 0.22) * 0.8
            : 0.7;
    half_ = w * 0.5;
    ink = 0.12 + aDepth * 0.88;
    vCoord = 0.0;
    vPxPerUnit = 1.0;
  } else if (uMode == 2) {
    half_ = 0.8;
    ink = 0.25 + aDepth * 0.75;
    // Dashes in screen px, and the offset with them, so every style in
    // EDGE_STYLE_DASH loops seamlessly instead of jumping at the wrap.
    vCoord = aArcU * uScale + uEnergy.y * fract(uTime / uEnergy.x + uPhase.x + aPhase * uPhase.y);
    vPxPerUnit = 1.0;
  } else {
    half_ = (0.7 + aDepth * 1.6) * 0.5;
    ink = 0.2 + aDepth * 0.8;
    // The rim's chunks are normalised to 100, so one dash pattern reads evenly
    // across chunks whose real lengths differ with perspective.
    vCoord = aArcN + 12.0 * fract((uTime - uDelay) / uBelt);
    vPxPerUnit = (aChunkU * uScale) / 100.0;
  }

  if (uMode == 3) {
    half_ += uGlow;
    ink *= uGlowInk;
  }

  // A real Gaussian defocus would cost a framebuffer pass per strip. Spreading
  // the stroke and dropping its ink by the same factor keeps the total light
  // roughly constant, which is the half of "out of focus" that carries depth.
  half_ += uSoft;
  ink *= uOpacity / (1.0 + uSoft);
  ink *= fadeAt(aPos);

  // Half a pixel of the coverage falloff lives OUTSIDE the nominal half-width,
  // so the quad is padded or the geometry clips its own antialiasing.
  float pad = uMode == 3 ? uGlow * 2.0 : 0.75;
  float reach = half_ + pad;

  vHalf = half_;
  vPerp = aSide * reach;
  vInk = ink;

  // Rotation and uniform scale only, and the two are applied separately: the
  // stroke is non-scaling-stroke, so its width is in screen pixels and must
  // not pick up the strip's scale, while its centreline must.
  vec2 local = aPos - (uVbMin + uVbSize * 0.5);
  vec2 spun = vec2(local.x * uRot.x - local.y * uRot.y, local.x * uRot.y + local.y * uRot.x);
  vec2 m = vec2(aMiter.x * uRot.x - aMiter.y * uRot.y, aMiter.x * uRot.y + aMiter.y * uRot.x);
  vec2 p = spun * uScale + uTrans + uOffset + m * aSide * reach;

  gl_Position = vec4(p.x / uSize.x * 2.0 - 1.0, 1.0 - p.y / uSize.y * 2.0, 0.0, 1.0);
}
`;

export const STRIP_FRAG = /* glsl */ `#version 300 es
precision highp float;
// Explicit, and load-bearing: a fragment shader defaults ints to mediump while a
// vertex shader defaults them to highp, and a uniform declared in both stages
// with different precision fails the LINK, not the compile.
precision highp int;

in float vPerp;
in float vHalf;
in float vInk;
in float vCoord;
in float vPxPerUnit;

uniform int uMode;
uniform vec2 uDash;   // mark, cycle. mark <= 0 draws a continuous stroke
uniform vec4 uColor;

out vec4 outColor;

void main() {
  float d = abs(vPerp);
  if (uDash.x > 0.0) {
    float a = mod(vCoord, uDash.y);
    // Distance to the nearest mark, measured through the wrap so the cap at the
    // end of one dash and the cap at the start of the next are the same shape.
    float gap = a <= uDash.x ? 0.0 : min(a - uDash.x, uDash.y - a);
    d = length(vec2(gap * vPxPerUnit, vPerp));
  }
  // Box-filter coverage, not a smoothstep: these strokes are under a pixel wide
  // at the far end of the band, and coverage is what keeps a 0.7px line reading
  // at 0.7 of full ink instead of vanishing.
  float cov = uMode == 3
    ? exp(-(d * d) / max(2.0 * vHalf * vHalf, 1e-3))
    : clamp(vHalf - d + 0.5, 0.0, 1.0);
  float a = clamp(vInk * cov * uColor.a, 0.0, 1.0);
  outColor = vec4(uColor.rgb * a, a);
}
`;

/** Floats per traveller. */
export const SPARK_FLOATS = 8;

export const SPARK_ATTRIBS = [
	{ name: 'aP', size: 2 as const },
	/** Sprite radius including the halo, CSS px. */
	{ name: 'aR', size: 1 as const },
	/** The solid dot inside it. */
	{ name: 'aCore', size: 1 as const },
	{ name: 'aColor', size: 4 as const }
];

export const SPARK_VERT = /* glsl */ `#version 300 es
in vec2 aP;
in float aR;
in float aCore;
in vec4 aColor;

uniform vec2 uSize;
uniform float uDpr;

out float vR;
out float vCore;
out vec4 vColor;

void main() {
  vR = aR;
  vCore = aCore;
  vColor = aColor;
  // gl_PointSize is in DEVICE pixels while everything else here is CSS px.
  gl_PointSize = aR * 2.0 * uDpr;
  gl_Position = vec4(aP.x / uSize.x * 2.0 - 1.0, 1.0 - aP.y / uSize.y * 2.0, 0.0, 1.0);
}
`;

export const SPARK_FRAG = /* glsl */ `#version 300 es
precision highp float;

in float vR;
in float vCore;
in vec4 vColor;

out vec4 outColor;

void main() {
  float d = length(gl_PointCoord - 0.5) * 2.0 * vR;
  float core = clamp(vCore - d + 0.5, 0.0, 1.0);
  // The drop-shadow the SVG dot carried, drawn rather than filtered: it was
  // always just a radial falloff, and a filter on a moving element is a full
  // re-rasterise per particle per frame.
  float halo = exp(-(d * d) / max(2.0 * vCore * vCore, 1e-3)) * 0.6;
  float a = clamp((core + halo * (1.0 - core)) * vColor.a, 0.0, 1.0);
  outColor = vec4(vColor.rgb * a, a);
}
`;
