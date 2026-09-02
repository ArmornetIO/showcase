// ── svg-fx — the tuning layer behind SvgFx ───────────────────────────────────
//
// Kept out of the component so the arithmetic is testable in node, and so the
// filter markup stays declarative rather than string-built.
//
// The whole point of these effects is that they read the SOURCE ALPHA rather
// than any particular geometry, which is why they work on art nobody authored
// for them. Everything here is therefore expressed as a magnitude in the host's
// own user units, never as a coordinate.

export type SvgFxType = 'glow' | 'outline' | 'emboss' | 'chrome' | 'engrave';

export interface SvgFxTuning {
	/**
	 * Effect magnitude in the host's user units: glow spread, outline width,
	 * bevel depth. The one knob that changes an effect's size.
	 */
	size: number;
	/** 0–2. Opacity for paint effects, light intensity for lit ones. */
	strength: number;
	/** Light direction, degrees. 0 = from the right, 135 = upper-left (the
	 *  house key light). Lit effects only. */
	azimuth: number;
	/** Light height, degrees. Low grazes and exaggerates relief; high flattens. */
	elevation: number;
	/** Specular colour for lit effects. */
	light: string;
	/**
	 * Metal body colour for `chrome`. It is a DIFFUSE lighting colour, i.e. the
	 * brightest the body can get — a near-black value here crushes the art to
	 * nothing, which is not a shadow colour by another name.
	 */
	base: string;
	/** Inner-shadow colour for `engrave`. */
	shadow: string;
	/** Paint colour for glow and outline. */
	color: string;
	/** 0–1. Rounds and feathers hard edges. */
	softness: number;
}

// Literal hex, not `var(--accent, …)`: `flood-color` / `lighting-color` are
// resolved as ATTRIBUTES by most engines, where a var() reference is invalid and
// silently collapses to black. A caller can still pass a token — the components
// also set these as CSS properties, which is the path where var() does resolve.
export const FX_DEFAULTS: SvgFxTuning = {
	size: 3,
	strength: 1,
	azimuth: 135,
	elevation: 55,
	light: '#ffffff',
	base: '#6f9aa4',
	shadow: '#04141a',
	color: '#5fead5',
	softness: 0.35
};

/** Which knobs actually do anything, per effect — the showcase rig greys out
 *  the rest rather than offering controls that silently no-op. */
export const FX_KNOBS: Record<SvgFxType, (keyof SvgFxTuning)[]> = {
	glow: ['size', 'strength', 'color'],
	outline: ['size', 'strength', 'color', 'softness'],
	emboss: ['size', 'strength', 'azimuth', 'elevation', 'light', 'softness'],
	chrome: ['size', 'strength', 'azimuth', 'elevation', 'light', 'base', 'softness'],
	engrave: ['size', 'strength', 'azimuth', 'shadow', 'softness']
};

export const FX_BLURB: Record<SvgFxType, string> = {
	glow: 'Coloured bloom bled off the alpha and merged underneath.',
	outline:
		'Dilated alpha flooded with colour and dropped behind — a true outline of whatever you feed it.',
	emboss: 'Specular highlight lit off the alpha as a height map. Raises the art, keeps its colour.',
	chrome: 'Shaded metal body under a hard specular. REPLACES the art’s own colour — use emboss to keep it.',
	engrave: 'Inner shadow inside the alpha. Presses the art into the surface.'
};

export interface ResolvedFx extends SvgFxTuning {
	/** stdDeviation for the height-map blur — how rounded the bevel shoulder is. */
	bump: number;
	/** stdDeviation for paint-effect feathering. */
	feather: number;
	/** Inner-shadow offset, resolved from the light direction. */
	dx: number;
	dy: number;
}

/**
 * Fold the tuning into the handful of numbers the filter primitives take.
 *
 * `dx/dy` push AWAY from the light, so an engrave lit from the upper left
 * darkens its lower-right lip — the same key direction the lit effects use, so
 * stacking them cannot contradict itself.
 */
export function resolveFx(t: Partial<SvgFxTuning> = {}): ResolvedFx {
	const m = { ...FX_DEFAULTS, ...t };
	const size = Math.max(0, m.size);
	const softness = Math.min(1, Math.max(0, m.softness));
	const rad = (m.azimuth * Math.PI) / 180;
	const reach = size * 0.7;
	return {
		...m,
		size,
		softness,
		strength: Math.max(0, m.strength),
		// A bevel needs SOME shoulder or the lighting has no gradient to read and
		// the effect vanishes on flat-sided art.
		bump: Math.max(0.35, size * (0.3 + 0.5 * softness)),
		feather: size * softness * 0.6,
		dx: -Math.cos(rad) * reach,
		dy: Math.sin(rad) * reach
	};
}

/**
 * Filter region as an objectBoundingBox percentage box.
 *
 * Effects spill past the content, and the SVG default region (-10%/120%) clips
 * every one of them. We cannot compute an exact margin without measuring the
 * content, and measuring means a browser round-trip per instance — so the
 * region is deliberately generous and tunable instead. `bleed` is a percentage
 * of the content box per side.
 */
export function fxRegion(bleed = 50) {
	const b = Math.max(0, bleed);
	return { x: `${-b}%`, y: `${-b}%`, width: `${100 + b * 2}%`, height: `${100 + b * 2}%` };
}
