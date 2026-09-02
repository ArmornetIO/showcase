// ── backdrop/gl/strip-placement — where a strip lands, in pixels ────────────
//
// The DOM hosts are placed in `%` and `vw`, which is the right unit for a layer
// nailed behind a page. A shader cannot consume either, so the GL layer needs
// the same placement resolved to pixels — and resolved against the SAME boxes,
// or the rim would drift off the band's body drawn under it.
//
// Pure, so the arithmetic that decides that can be tested without a GPU.

import type { MobiusLayout } from '../mobius.js';
import type { StripSpec } from '../strips.js';

/** The world rectangle a spec's percentages map onto inside a Canvas.
 *
 *  A spec's numbers are PERCENTAGES; used raw as world units they land inside a
 *  100×100 box — a few strips a few pixels wide stacked on the origin, which is
 *  what "the strips vanished" actually was. */
export const WORLD = { w: 1600, h: 1000 };

export interface Camera {
	tx: number;
	ty: number;
	tk: number;
}

/** Centre and width in CSS pixels, matching what the strip's `<svg>` occupies. */
export interface StripBox {
	cx: number;
	cy: number;
	w: number;
}

export function stripBox(
	spec: StripSpec,
	frame: { w: number; h: number },
	vw: number,
	camera: Camera | null
): StripBox {
	if (!camera) {
		return {
			cx: (spec.left / 100) * frame.w,
			cy: (spec.top / 100) * frame.h,
			w: (spec.size / 100) * vw
		};
	}
	return {
		cx: (spec.left / 100) * WORLD.w * camera.tk + camera.tx,
		cy: (spec.top / 100) * WORLD.h * camera.tk + camera.ty,
		w: (spec.size / 100) * WORLD.w * camera.tk
	};
}

/** Slack around the layout's extent, in user units. The rim is stroked and
 *  bloomed, and both spill past the geometry that generated them. */
const PAD = 40;

/** The rectangle a strip's art is drawn in — the SVG viewBox, and the box the
 *  shader maps user units through. One definition, because a viewBox that
 *  disagreed with the shader's would offset every stroke from the glass. */
export function viewBoxOf(layout: MobiusLayout): { x: number; y: number; w: number; h: number } {
	const e = layout.extent;
	return {
		x: e.minX - PAD,
		y: e.minY - PAD,
		w: e.maxX - e.minX + PAD * 2,
		h: e.maxY - e.minY + PAD * 2
	};
}

/** The end-dissolve, precomputed against a strip's own box.
 *
 *  `amount` is the fade as a fraction; `dx`/`dy` are the gradient's direction
 *  in CSS pixel space (y down) and `invLen` its reciprocal length, so a
 *  position becomes a stop with one dot product. */
export interface FadeParams {
	amount: number;
	dx: number;
	dy: number;
	invLen: number;
}

export function fadeParams(spec: StripSpec, boxW: number, boxH: number): FadeParams {
	const amount = Math.max(0, Math.min(0.5, spec.fade));
	// CSS gradient angles run clockwise from "up", and up is -y on screen.
	const a = (spec.fadeAngle * Math.PI) / 180;
	const dx = Math.sin(a);
	const dy = -Math.cos(a);
	const len = Math.abs(boxW * dx) + Math.abs(boxH * dy);
	return { amount, dx, dy, invLen: len > 0 ? 1 / len : 0 };
}

/** The mask's alpha at a point, given in the strip's box in CSS pixels.
 *
 *  The shader carries its own copy of this ramp; this one exists for the
 *  travellers, which are placed on the CPU because there are two of them and a
 *  GPU-side path evaluation would cost more geometry than it saved. */
export function fadeAt(f: FadeParams, px: number, py: number, boxW: number, boxH: number): number {
	if (f.amount <= 0) return 1;
	const t = 0.5 + ((px - boxW / 2) * f.dx + (py - boxH / 2) * f.dy) * f.invLen;
	const u = Math.min(t, 1 - t);
	const knee = f.amount * 0.55;
	if (u <= 0) return 0;
	if (u < knee) return (u / knee) * 0.35;
	if (u < f.amount) return 0.35 + ((u - knee) / (f.amount - knee)) * 0.65;
	return 1;
}
