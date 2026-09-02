/**
 * The relay dish — a parabolic antenna, drawn as SVG CHILDREN in a 24-unit box.
 *
 * Children rather than a component, because the two callers need it in
 * different coordinate spaces: the marketing globe places it under a
 * per-frame `translate/rotate/scale(1,ez)` chain that foreshortens it against
 * the sphere, and a badge just wants it at 1:1. A component owning its own
 * `<svg>` could not serve the first, and two copies of the geometry is how the
 * globe's dish and a badge's dish end up being different objects.
 *
 * Glyph "up" (−y) is the outward normal: a caller that rotates 0° when the stem
 * points up the screen gets the base at the BOTTOM, on the side facing the body
 * the dish stands on.
 *
 * Stroked, not filled — the caller supplies `stroke`, `stroke-width` and the
 * round joins on the wrapping `<g>`, so one dish can be a hairline on a globe
 * and a heavier mark in a badge without the geometry knowing.
 */
export const RELAY_DISH = (() => {
	const R = 9;
	const INNER = 2.7;
	const parts = [
		'<circle cx="12" cy="12" r="9"/>',
		'<circle cx="12" cy="12" r="5.6"/>',
		'<circle cx="12" cy="12" r="2.7"/>'
	];
	// Sixteen ribs from the hub to the rim. Fewer reads as a wheel; more closes
	// up into a filled disc at the sizes this is actually drawn at.
	for (let i = 0; i < 16; i++) {
		const a = (i / 16) * Math.PI * 2;
		const x1 = (12 + INNER * Math.cos(a)).toFixed(2);
		const y1 = (12 + INNER * Math.sin(a)).toFixed(2);
		const x2 = (12 + R * Math.cos(a)).toFixed(2);
		const y2 = (12 + R * Math.sin(a)).toFixed(2);
		parts.push(`<path d="M${x1} ${y1}L${x2} ${y2}"/>`);
	}
	// The mount. Narrows downward so the dish reads as standing on the surface
	// rather than floating over it.
	parts.push('<path d="M9.8 20.6 14.2 20.6 13 23.4 11 23.4Z"/>');
	return parts.join('');
})();
