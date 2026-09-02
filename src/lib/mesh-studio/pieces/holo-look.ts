// ── holo-look — the projection material, as numbers ──────────────────────────
// The seven values that decide whether a suspended piece reads as a hologram or
// as a smudge. They were literals inside `NodePiece` until the studio needed to
// tune them, and the move out is not just plumbing: a material nobody can turn
// is a material nobody can judge, and every one of these was wrong on the first
// guess. The bloom width in particular had to come down by nearly half before
// the small facets stopped growing their own blobs.
//
// Shared rather than duplicated. `NodePiece` renders from these and
// `piece-knobs` seats its sliders on the same object, so "the default" is one
// fact — a second copy in the panel would drift the moment either side is tuned,
// and the panel would then be describing a material that no longer exists.
//
// Every entry is a MULTIPLIER on the shipped look except `seat` and `scan`,
// which are absolute because they are a coverage and a length. So the defaults
// below reproduce exactly what the renderer drew before it took a prop, and a
// caller that passes nothing sees no change.

export interface HoloLook {
	/** Bloom stroke width, ×. The spill is drawn per FACET, so past about 1.5 the
	 *  stroke outgrows the smallest facet it is glowing off and the halo turns
	 *  into a filled lozenge — see the note in NodePiece. */
	glow: number;
	/** Bloom opacity, ×. */
	glowLevel: number;
	/** How much of the Fresnel inversion to apply, 0–1.
	 *
	 *  The one knob that is not a decoration. At 1 the faces are brightest seen
	 *  edge-on, which is how a volume of light behaves; at 0 they are lit flat,
	 *  which is how paint behaves. Sliding it is the whole "hologram vs chess
	 *  piece" argument, live. */
	fresnel: number;
	/** Vertical pitch of the scanlines, in node radii. Clamped by the renderer —
	 *  a pitch of zero is an infinite loop, not a solid fill. */
	scan: number;
	/** Scanline opacity, ×. Zero switches them off. */
	scanLevel: number;
	/** Opacity of the far side seen through the near, ×. Zero makes the piece
	 *  opaque again, which is the fastest way to see how much of the effect is
	 *  carried by simply not hiding its own back. */
	through: number;
	/** The dark wash confined to the piece's footprint, absolute 0–1. It stops
	 *  the mesh behind reading as the piece's own edges. Pure transparency at 0
	 *  is honest and, over a busy globe, unreadable. */
	seat: number;
}

export const HOLO_DEFAULTS: HoloLook = {
	glow: 1,
	glowLevel: 1,
	fresnel: 1,
	scan: 0.062,
	scanLevel: 1,
	through: 1,
	seat: 0.16
};

/** Blend a Fresnel term toward flat by `mix`.
 *
 *  `lo + (1 - lo) * f` is the shipped curve; at `mix = 0` this returns 1, which
 *  is flat and full brightness rather than flat and dark. That matters: fading
 *  the effect out must not also fade the piece out, or the knob reads as a
 *  brightness slider and tells you nothing about what Fresnel is doing. */
export function fresnelMix(f: number, lo: number, mix: number): number {
	return 1 - mix + mix * (lo + (1 - lo) * f);
}
