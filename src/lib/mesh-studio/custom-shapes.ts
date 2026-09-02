// ── Arbitrary-SVG node silhouettes (mesh-studio custom shapes) ──────────────
//
// Authored icon paths (centred on the origin, ~[-12,12] unit space) used as
// node silhouettes. The generic sampling machinery that turns any outline into
// an angle→radius map lives in `mesh-studio/glyph-sample.ts` (shared by both
// canvas renderers); this file only holds the mesh-studio shape catalogue.

export interface CustomShape {
	/** Closed outline path used for fill + edge/port attachment (origin-centred). */
	outline: string;
	/** Optional decorative interior strokes (the icon detail), not attached to. */
	detail?: string;
}

export const CUSTOM_SHAPES: Record<string, CustomShape> = {
	// 3D package / crate — outer boundary is the cube hexagon; detail = top face + edge.
	package: {
		outline: 'M 0 -9.5 L -8 -5 L -8 5 L 0 9.5 L 8 5 L 8 -5 Z',
		detail: 'M -8 -5 L 0 -0.5 L 8 -5 M 0 -0.5 L 0 9.5',
	},
	// Barcode — outer boundary is a rounded rectangle; detail = the bars.
	barcode: {
		outline: 'M -9 -7 Q -9 -8 -8 -8 L 8 -8 Q 9 -8 9 -7 L 9 7 Q 9 8 8 8 L -8 8 Q -9 8 -9 7 Z',
		detail: 'M -5 -4 L -5 4 M -2 -4 L -2 4 M 1 -4 L 1 5 M 4 -4 L 4 4 M 6.5 -4 L 6.5 4',
	},
};
