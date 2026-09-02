<script lang="ts">
	// ─────────────────────────────────────────────────────────────────────────
	// MOBIUS WEAVE — the authored strips, on canvas, weaving through themselves.
	//
	// Takes real `StripSpec`s — the same ones `strips.ts` composes and the SVG
	// backdrop renders — and honours their placement vocabulary exactly:
	// `left`/`top` as viewport percentages, `size` in vw, geometry built at the
	// canonical radius 420 and fitted to that width, `spin` as a fixed bearing
	// about the box centre, `belt`/`period`/`traffic`/`fade`/`opacity`/`ghost`
	// as authored. A composition tuned against the SVG renderer lands here
	// unchanged; this is a second renderer for the same data, not a new look.
	//
	// WHY IT EXISTS. In SVG every pass is additive, so where a strip's far lap
	// and near lap cross you get a BRIGHT JUNCTION instead of an occlusion, and
	// the band reads as a decal rather than an object. Here each facet fills with
	// the page ground before its edges are stroked, painted back to front over
	// interleaved depth-sorted facets/rungs/edge — so near genuinely hides far.
	// The sort order IS the occlusion: no depth buffer, no second pass, no mask.
	// A Möbius boundary takes two laps to close, so that weave is the shape's own
	// property rather than an effect applied on top of it.
	//
	// The strips do NOT rotate. They are fixed and the BELT runs along them,
	// which is what `belt`/`energySpeed` have always meant.
	import { onMount } from 'svelte';
	import { mobiusLayout, type MobiusStroke } from './mobius.js';
	import { EDGE_STYLE_DASH } from '../primitives/canvas/canvas.types.js';
	import type { StripSpec } from './strips.js';

	interface Props {
		strips: StripSpec[];
		/** The ground the near band paints with. MUST match the page behind it,
		 *  or the occluding fill reads as a grey smear instead of a hole. */
		ground?: string;
		/** `r, g, b`. Defaults are the spider-verse palette's own values. */
		stripColor?: string;
		/**
		 * Second stop. The band is painted with a gradient across its own extent
		 * rather than a flat colour, so the hue travels along the ribbon and the
		 * far and near laps are never quite the same — which reads as one long
		 * object turning through space instead of two arcs of the same paint.
		 * Set equal to `stripColor` for a flat strip.
		 */
		stripColor2?: string;
		travellerColor?: string;
	}

	let {
		strips,
		ground = '6, 7, 11',
		stripColor = '255, 47, 176',
		stripColor2 = stripColor,
		travellerColor = '253, 224, 71'
	}: Props = $props();

	// Hue-rotating an rgb triple directly. The SVG path uses a CSS filter for the
	// ghost plate; a filter forces a raster pass per frame, which is the cost
	// this renderer exists to avoid — so the rotation happens in the colour.
	function hueShift(rgb: string, deg: number): string {
		const [r, g, b] = rgb.split(',').map((n) => +n / 255);
		const a = (deg * Math.PI) / 180;
		const c = Math.cos(a);
		const s = Math.sin(a);
		const m = [
			0.213 + c * 0.787 - s * 0.213, 0.715 - c * 0.715 - s * 0.715, 0.072 - c * 0.072 + s * 0.928,
			0.213 - c * 0.213 + s * 0.143, 0.715 + c * 0.285 + s * 0.14, 0.072 - c * 0.072 - s * 0.283,
			0.213 - c * 0.213 - s * 0.787, 0.715 - c * 0.715 + s * 0.715, 0.072 + c * 0.928 + s * 0.072
		];
		return [
			m[0] * r + m[1] * g + m[2] * b,
			m[3] * r + m[4] * g + m[5] * b,
			m[6] * r + m[7] * g + m[8] * b
		]
			.map((v) => Math.round(Math.min(1, Math.max(0, v)) * 255))
			.join(', ');
	}

	let el: HTMLCanvasElement;

	onMount(() => {
		const ctx = el.getContext('2d')!;
		// One scratch canvas, reused by every strip. A strip's `fade` dissolves its
		// ends so a chain reads as ONE ribbon passing through frame, and that needs
		// a mask over the finished strip — which cannot be done in place without
		// erasing the strips already painted underneath.
		const buf = document.createElement('canvas');
		const bctx = buf.getContext('2d')!;

		const dpr = Math.min(window.devicePixelRatio || 1, 2);
		let w = 0;
		let h = 0;

		function resize() {
			const r = el.getBoundingClientRect();
			w = r.width;
			h = r.height;
			for (const c of [el, buf]) {
				c.width = Math.round(w * dpr);
				c.height = Math.round(h * dpr);
			}
			for (const c of [ctx, bctx]) c.setTransform(dpr, 0, 0, dpr, 0, 0);
		}
		resize();
		const ro = new ResizeObserver(resize);
		ro.observe(el);

		// Honoured by rendering ONE frame and never scheduling another, rather than
		// by listing which animations to suppress — a list is what let the SVG
		// backdrop's hue cycle keep running for reduced-motion users.
		const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

		// Geometry is independent of time, so it is built once per strip and reused
		// every frame. Only the dash offset and the riders actually move.
		const built = strips.map((s) => ({
			s,
			layout: mobiusLayout(
				Array.from({ length: 240 }, (_, i) => `t${i}`),
				{ radius: 420, band: s.band, yaw: s.yaw, pitch: s.pitch, segments: 220, rungs: s.rungs }
			)
		}));

		function paintStrip(
			c: CanvasRenderingContext2D,
			b: (typeof built)[number],
			t: number,
			stripRGB: string,
			stripRGB2: string,
			travRGB: string,
			alpha: number
		) {
			const { s, layout } = b;
			// Built in the strip's own space, so the ramp is anchored to the OBJECT
			// and travels with it — a screen-space gradient would slide across the
			// band as the layout resized, which reads as a lighting bug.
			const e = layout.extent;
			const grad = c.createLinearGradient(e.minX, e.minY, e.maxX, e.maxY);
			grad.addColorStop(0, `rgb(${stripRGB})`);
			grad.addColorStop(1, `rgb(${stripRGB2})`);

			// Straight from `EDGE_STYLE_DASH`, in the strip's user units like every
			// other length here. A style with no entry is solid by design.
			const pattern = EDGE_STYLE_DASH[s.energy as keyof typeof EDGE_STYLE_DASH];
			const dash = pattern ? pattern.split(/\s+/).map(Number) : null;
			const dashLen = dash ? dash.reduce((a, n) => a + n, 0) : 0;
			// Interleaved by depth across all three lists. Sorting each list on its
			// own would paint every edge over every facet and lose the crossings —
			// which is exactly the flat reading this renderer exists to fix.
			const parts = [
				...layout.facets.map((x) => ({ x, kind: 0 as const })),
				...layout.rungs.map((x) => ({ x, kind: 1 as const })),
				...layout.edge.map((x) => ({ x, kind: 2 as const }))
			].sort((p, q) => p.x.depth - q.x.depth);

			for (const { x, kind } of parts) {
				const p = new Path2D(x.d);
				const lit = (0.25 + x.depth * 0.75) * alpha;
				if (kind === 0) {
					// The occluding fill, rising with depth: the near band is nearly
					// solid ground and genuinely hides what it crosses, while the far
					// band stays airy rather than a flat silhouette.
					c.globalAlpha = (0.4 + x.depth * 0.55) * alpha;
					c.fillStyle = `rgb(${ground})`;
					c.fill(p);
					c.globalAlpha = 0.07 * lit;
					c.fillStyle = `rgb(${stripRGB})`;
					c.fill(p);
				} else if (kind === 1) {
					c.globalAlpha = 0.16 * lit;
					c.lineWidth = 1.4;
					c.strokeStyle = `rgb(${stripRGB})`;
					c.setLineDash([]);
					c.stroke(p);
				} else {
					// THE OUTLINE. Its rhythm comes from `energy` — the mesh's own edge
					// vocabulary, so a long mark with a short gap reads as moving and a
					// short mark with a long gap as intermittent, exactly as it does on
					// a line between two agents. `pulse` and `encrypted` have no dash
					// entry on purpose: they are solid, and `pulse` carries its meaning
					// in the orb that rides it instead.
					//
					// The gradient rides the OUTLINE only — the band's fill and ribs
					// stay flat, so the colour reads as the edge catching light along
					// its length rather than the whole surface being tinted.
					c.globalAlpha = 0.85 * lit;
					c.lineWidth = 2.2;
					c.strokeStyle = grad;
					if (dash) {
						c.setLineDash(dash);
						c.lineDashOffset = still ? 0 : -(((t + s.delay) / s.energySpeed) % 1) * dashLen;
					} else {
						c.setLineDash([]);
					}
					c.stroke(p);
				}
			}
			c.setLineDash([]);

			// Riders, sampled off the edge curve so they inherit the projection the
			// band was built with — depth drives size and alpha, `MobiusPlacement`
			// used verbatim.
			const n = layout.points.length;

			// `pulse` — a surge running ALONG the conductor, not a light floating
			// near it. A detached radial glow was the whole problem: energy in a
			// wire is a length of the wire briefly lit, so this is drawn as a comet
			// down the edge curve itself — `layout.points` is ordered by traversal,
			// so consecutive samples are adjacent along the rim and the trail bends
			// with the strip instead of sitting on top of it.
			//
			// Additively blended: overlapping trail segments accumulate into a hot
			// core the way real emission does, which is what a flat alpha ramp
			// cannot give you.
			if (s.energy === 'pulse') {
				// Several surges spaced evenly around the traversal. One is the
				// purest reading of `pulse`, but these strips run mostly off-frame,
				// so a lone head spends most of its 16s lap outside the viewport and
				// the rim just looks inert. A train keeps at least one in view.
				const COUNT = Math.max(2, Math.round(s.traffic / 2));
				const TRAIL = 26;
				c.save();
				c.globalCompositeOperation = 'lighter';
				c.lineCap = 'round';
				c.setLineDash([]);
				for (let q = 0; q < COUNT; q++) {
				const phase = ((still ? 0.25 : (t + s.delay) / s.period) + q / COUNT) % 1;
				const head = Math.round(phase * (n - 1));
				for (let j = TRAIL; j > 0; j--) {
					const a = layout.points[(head - j + n) % n];
					const bpt = layout.points[(head - j + 1 + n) % n];
					if (!a || !bpt) continue;
					// Squared falloff: a linear tail reads as a smear, this reads as
					// something moving fast enough to leave one.
					const f = 1 - j / TRAIL;
					c.globalAlpha = f * f * 0.9 * (0.35 + a.depth * 0.65) * alpha;
					c.lineWidth = 1 + 5 * f * a.scale;
					c.strokeStyle = `rgb(${travRGB})`;
					c.beginPath();
					c.moveTo(a.x, a.y);
					c.lineTo(bpt.x, bpt.y);
					c.stroke();
				}
				// The head: a small hot core, not a halo. Its bloom comes from the
				// additive stack of the trail segments converging on it.
				const hp = layout.points[head];
				if (hp) {
					c.globalAlpha = (0.5 + hp.depth * 0.5) * alpha;
					c.fillStyle = `rgb(${travRGB})`;
					c.beginPath();
					c.arc(hp.x, hp.y, 2 + 3 * hp.scale, 0, Math.PI * 2);
					c.fill();
				}
				}
				c.restore();
			}

			for (let i = 0; i < (s.energy === 'pulse' ? 0 : s.traffic); i++) {
				const phase = still
					? i / Math.max(1, s.traffic)
					: ((t + s.delay) / s.period + i / Math.max(1, s.traffic)) % 1;
				const pt = layout.points[Math.round(phase * (n - 1))];
				if (!pt) continue;
				c.globalAlpha = (0.25 + pt.depth * 0.75) * alpha;
				c.fillStyle = s.energyColor || `rgb(${travRGB})`;
				c.beginPath();
				// Radius is in the strip's own user units, so it scales with the
				// strip exactly as its strokes do.
				c.arc(pt.x, pt.y, 1.4 + 2.2 * pt.scale, 0, Math.PI * 2);
				c.fill();
			}
		}

		let raf = 0;
		const t0 = performance.now();

		function frame(now: number) {
			const t = (now - t0) / 1000;
			ctx.clearRect(0, 0, w, h);

			for (const b of built) {
				const { s, layout } = b;
				const e = layout.extent;
				const pad = 40;
				// The SVG renderer fits this same padded extent into `size` vw via a
				// viewBox, so the scale is derived rather than guessed — a strip is
				// the same size in both renderers.
				const boxW = e.maxX - e.minX + pad * 2;
				const boxH = e.maxY - e.minY + pad * 2;
				const k = ((s.size / 100) * w) / boxW;
				// `spin` rotates about the element's centre, matching CSS's default
				// transform-origin on the SVG.
				const cx = (s.left / 100) * w + (boxW * k) / 2;
				const cy = (s.top / 100) * h + (boxH * k) / 2;

				// The scratch canvas is shared, so only this strip's own footprint is
				// cleared and composited. Doing both full-canvas once per strip was
				// five full-screen clears plus five full-screen draws a frame, which
				// is most of what a multi-strip composition costs.
				const hw = (boxW * k) / 2;
				const hh = (boxH * k) / 2;
				const rad = (s.spin * Math.PI) / 180;
				const ac = Math.abs(Math.cos(rad));
				const as = Math.abs(Math.sin(rad));
				// Padded for the ghost offset and half a stroke width.
				const pd = 8 + Math.abs(s.ghost?.dx ?? 0) + Math.abs(s.ghost?.dy ?? 0);
				const bx = Math.max(0, Math.floor(cx - (hw * ac + hh * as) - pd));
				const by = Math.max(0, Math.floor(cy - (hw * as + hh * ac) - pd));
				const bw2 = Math.min(w - bx, Math.ceil((hw * ac + hh * as) * 2 + pd * 2));
				const bh2 = Math.min(h - by, Math.ceil((hw * as + hh * ac) * 2 + pd * 2));
				if (bw2 <= 0 || bh2 <= 0) continue;

				bctx.clearRect(bx, by, bw2, bh2);
				bctx.save();
				bctx.translate(cx, cy);
				bctx.rotate((s.spin * Math.PI) / 180);
				bctx.scale(k, k);
				bctx.translate(-(e.minX + e.maxX) / 2, -(e.minY + e.maxY) / 2);
				bctx.lineJoin = 'round';
				bctx.lineCap = 'round';

				// Ghost first, base on top — printing plates, where the key plate
				// lands over the misaligned colour plate. This misregistration IS
				// the spider-verse signature; one pass only ever reads as colourful.
				if (s.ghost) {
					bctx.save();
					bctx.translate(s.ghost.dx / k, s.ghost.dy / k);
					paintStrip(
						bctx,
						b,
						t,
						hueShift(stripColor, s.ghost.hue),
						hueShift(stripColor2, s.ghost.hue),
						hueShift(travellerColor, s.ghost.hue),
						s.opacity * s.ghost.opacity
					);
					bctx.restore();
				}
				paintStrip(bctx, b, t, stripColor, stripColor2, travellerColor, s.opacity);
				bctx.restore();

				// `fade` dissolves each end along `fadeAngle`, which is what lets
				// several strips read as one ribbon: an end that fades out where the
				// next fades in leaves the eye to join them up.
				if (s.fade > 0) {
					const a = ((s.fadeAngle - 90) * Math.PI) / 180;
					const r = Math.max(w, h);
					const gx = Math.cos(a) * r * 0.5;
					const gy = Math.sin(a) * r * 0.5;
					const g = bctx.createLinearGradient(cx - gx, cy - gy, cx + gx, cy + gy);
					const f = Math.min(0.5, s.fade);
					g.addColorStop(0, 'rgba(0,0,0,1)');
					g.addColorStop(f, 'rgba(0,0,0,0)');
					g.addColorStop(1 - f, 'rgba(0,0,0,0)');
					g.addColorStop(1, 'rgba(0,0,0,1)');
					bctx.save();
					bctx.globalCompositeOperation = 'destination-out';
					bctx.fillStyle = g;
					bctx.fillRect(bx, by, bw2, bh2);
					bctx.restore();
				}

				// Source rect is in the buffer's INTRINSIC pixels (it carries the dpr
				// scale in its own transform, which drawImage does not apply to the
				// source), destination in CSS pixels.
				ctx.drawImage(
					buf,
					bx * dpr,
					by * dpr,
					bw2 * dpr,
					bh2 * dpr,
					bx,
					by,
					bw2,
					bh2
				);
			}

			if (!still) raf = requestAnimationFrame(frame);
		}
		raf = requestAnimationFrame(frame);

		return () => {
			cancelAnimationFrame(raf);
			ro.disconnect();
		};
	});
</script>

<canvas bind:this={el} class="weave" aria-hidden="true"></canvas>

<style>
	.weave {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		pointer-events: none;
	}
</style>
