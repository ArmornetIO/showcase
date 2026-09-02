// ── mesh-studio/gl/particle-shaders — energy particles, in GLSL ──────────────
// The whole point of this pass is that NOTHING about a particle changes per
// frame except the clock. A particle's path, colour, speed and phase are packed
// once when the edges change; after that a frame is one uniform write and one
// `drawArrays`. That is what the SVG version could not do: `<animateMotion>`
// with an `<mpath>` is per-element browser-side interpolation against a live
// path, and it re-runs whether or not anything moved.
//
// One vertex IS one particle — `gl.POINTS`, no instancing. There is nothing to
// instance: every particle carries different curve, colour and phase, so an
// instanced draw would upload the same bytes through a slower path.

/** Floats per particle in the packed buffer. Keep in step with `PARTICLE_ATTRIBS`
 *  and with `packParticles` — the three are one format described three ways, and
 *  a mismatch shows up as particles smeared across the viewport rather than as an
 *  error. */
export const PARTICLE_FLOATS = 15;

export interface ParticleAttrib {
	name: string;
	size: number;
}

/** Declaration order IS buffer order. */
export const PARTICLE_ATTRIBS: ParticleAttrib[] = [
	{ name: 'aP0', size: 2 },
	{ name: 'aC1', size: 2 },
	{ name: 'aC2', size: 2 },
	{ name: 'aP3', size: 2 },
	{ name: 'aColor', size: 3 },
	{ name: 'aPhase', size: 1 },
	{ name: 'aRate', size: 1 },
	{ name: 'aSize', size: 1 },
	{ name: 'aKind', size: 1 },
];

/** `aKind` values. An elbow is the one edge curve that is not expressible as a
 *  cubic, so it gets a branch rather than an approximation — a particle cutting
 *  the corner of a right-angled run reads as a routing bug. */
export const KIND_CUBIC = 0;
export const KIND_ELBOW = 1;

/** How much wider the point sprite is than the particle's own radius, to leave
 *  room for the glow to fall off inside it. The SVG spelling was a
 *  `feGaussianBlur stdDeviation="1.6"` on a filter region of 900%; three sigma
 *  covers the visible part of that, and a sprite is cheaper than a filter by the
 *  whole cost of a filter. */
export const SPRITE_PAD = 3.4;

export const PARTICLE_VERT = /* glsl */ `#version 300 es
precision highp float;

in vec2 aP0;
in vec2 aC1;
in vec2 aC2;
in vec2 aP3;
in vec3 aColor;
in float aPhase;
in float aRate;
in float aSize;
in float aKind;

// Camera as (tx, ty, tk) — read from the shared <Canvas> transform and never
// written here. A GL layer that owns its own camera drifts a pixel away from the
// SVG drawn over it, which is the one failure this port has to avoid.
uniform vec3 uCam;
uniform vec2 uSize;
uniform float uTime;
uniform float uDpr;
uniform float uPad;

out vec3 vColor;
out float vCore;

vec2 cubicAt(float t) {
	float u = 1.0 - t;
	return u*u*u*aP0 + 3.0*u*u*t*aC1 + 3.0*u*t*t*aC2 + t*t*t*aP3;
}

// M a H b.x V b.y — two axis-aligned runs. Split by ARC LENGTH, not by t, so the
// dot holds one speed through the corner instead of sprinting the short leg.
vec2 elbowAt(float t) {
	vec2 corner = vec2(aP3.x, aP0.y);
	float l1 = abs(aP3.x - aP0.x);
	float l2 = abs(aP3.y - aP0.y);
	float total = max(l1 + l2, 1e-4);
	float d = t * total;
	return d < l1 ? mix(aP0, corner, d / max(l1, 1e-4))
	              : mix(corner, aP3, (d - l1) / max(l2, 1e-4));
}

void main() {
	// fract() is the loop. The SVG used repeatCount="indefinite"; this is the same
	// thing without a timeline to fall out of sync — every particle is a pure
	// function of one clock, so there is no state that can drift.
	float t = fract(uTime * aRate + aPhase);
	vec2 world = aKind < 0.5 ? cubicAt(t) : elbowAt(t);

	// World → CSS px → clip. Y flips because screen-y points down and clip-y up.
	vec2 css = world * uCam.z + uCam.xy;
	vec2 ndc = (css / uSize) * 2.0 - 1.0;
	gl_Position = vec4(ndc.x, -ndc.y, 0.0, 1.0);

	// The radius is authored in WORLD units (the SVG circle lived inside the
	// scaled group), so it has to track zoom the same way the edges under it do.
	float radius = max(aSize * uCam.z, 0.35);
	float sprite = radius * 2.0 * uPad * uDpr;
	gl_PointSize = clamp(sprite, 1.0, 64.0);

	vColor = aColor;
	// Where the solid core ends, as a fraction of the sprite's half-width. Passed
	// through rather than recomputed in the fragment shader because the clamp
	// above can shrink the sprite off its nominal size, and a core sized against
	// the nominal would then overflow it.
	vCore = clamp((radius * 2.0 * uDpr) / max(sprite, 1e-4), 0.02, 1.0);
}
`;

export const PARTICLE_FRAG = /* glsl */ `#version 300 es
precision highp float;

in vec3 vColor;
in float vCore;

out vec4 frag;

void main() {
	// 0 at the sprite's centre, 1 at its edge.
	float d = length(gl_PointCoord - 0.5) * 2.0;

	// Antialias the core against the sprite's own resolution rather than a fixed
	// epsilon: at a far zoom a particle is three pixels across, and a constant
	// feather would eat the whole dot.
	float aa = fwidth(d) + 1e-4;
	float core = 1.0 - smoothstep(vCore - aa, vCore + aa, d);

	// The glow the blur filter used to draw. Gaussian falloff over the padding,
	// which is what a stdDeviation on a small disc actually looked like.
	float halo = exp(-4.5 * (d / max(vCore, 1e-4)) * (d / max(vCore, 1e-4)));

	float a = clamp(core + halo * 0.55, 0.0, 1.0);
	// Cutting fully-transparent fragments keeps the additive pass from tinting the
	// square footprint of every sprite, which at these counts is most of the
	// canvas.
	if (a <= 0.003) discard;
	frag = vec4(vColor, a);
}
`;
