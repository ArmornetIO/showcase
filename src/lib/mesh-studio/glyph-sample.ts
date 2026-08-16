// ── Glyph / outline sampling ────────────────────────────────────────────────
//
// Generic machinery to sample an arbitrary closed outline or icon markup into a
// 360-bin angle→radius map, so ports, the segmented arc ring, and edges can all
// resolve to a boundary point for any angle θ — exactly like `boundaryPoint`
// does for parametric shapes, but for a hand-drawn outline.
//
// Lives in `primitives/` (not `mesh-studio/`) so BOTH canvas renderers —
// GraphLayer and MeshStudio — can depend on it without a backwards dependency.

export interface SampledShape {
	/** radius (path units) indexed by integer degree 0..359. */
	bins: number[];
	/** largest radius across all angles — used to scale the shape to node radius r. */
	maxR: number;
}

/** Samples a closed outline path into a 360-bin angle→radius map (browser only). */
export function sampleOutline(d: string): SampledShape {
	const NS = 'http://www.w3.org/2000/svg';
	const svg = document.createElementNS(NS, 'svg');
	const path = document.createElementNS(NS, 'path');
	path.setAttribute('d', d);
	svg.appendChild(path);
	svg.setAttribute('style', 'position:absolute;width:0;height:0;opacity:0;pointer-events:none');
	document.body.appendChild(svg);

	const len = path.getTotalLength();
	const bins = new Array(360).fill(0);
	const N = Math.max(360, Math.ceil(len * 3));
	for (let i = 0; i <= N; i++) {
		const p = path.getPointAtLength((len * i) / N);
		const ang = ((Math.atan2(p.y, p.x) * 180) / Math.PI + 360) % 360;
		const r = Math.hypot(p.x, p.y);
		const b = Math.round(ang) % 360;
		if (r > bins[b]) bins[b] = r;
	}
	document.body.removeChild(svg);

	// Fill any empty bins from the nearest populated neighbour (two passes wrap).
	let last = 0;
	for (let i = 0; i < 720; i++) {
		const idx = i % 360;
		if (bins[idx] > 0) last = bins[idx];
		else if (last > 0) bins[idx] = last;
	}
	const maxR = Math.max(...bins);
	return { bins, maxR };
}

/**
 * Samples the OUTER extent of a full icon markup (multiple path/circle/rect/…
 * elements, drawn in a 0..24 box) into a 360-bin angle→radius map centred on
 * (cx,cy). Lets any line-glyph icon act as a node silhouette that edges attach to.
 */
export function sampleMarkup(markup: string, cx = 12, cy = 12): SampledShape {
	const NS = 'http://www.w3.org/2000/svg';
	const svg = document.createElementNS(NS, 'svg');
	svg.setAttribute('viewBox', '0 0 24 24');
	svg.setAttribute('style', 'position:absolute;width:0;height:0;opacity:0;pointer-events:none');
	svg.innerHTML = markup;
	document.body.appendChild(svg);

	const bins = new Array(360).fill(0);
	const els = svg.querySelectorAll('path,circle,rect,ellipse,line,polyline,polygon');
	els.forEach((el) => {
		const geo = el as unknown as SVGGeometryElement;
		let len = 0;
		try { len = geo.getTotalLength(); } catch { len = 0; }
		if (!len) return;
		const N = Math.max(24, Math.ceil(len * 2));
		for (let i = 0; i <= N; i++) {
			const p = geo.getPointAtLength((len * i) / N);
			const x = p.x - cx, y = p.y - cy;
			const ang = ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
			const r = Math.hypot(x, y);
			const b = Math.round(ang) % 360;
			if (r > bins[b]) bins[b] = r;
		}
	});
	document.body.removeChild(svg);

	let last = 0;
	for (let i = 0; i < 720; i++) {
		const idx = i % 360;
		if (bins[idx] > 0) last = bins[idx];
		else if (last > 0) bins[idx] = last;
	}
	const maxR = Math.max(...bins, 0.001);
	return { bins, maxR };
}

/** Closed silhouette path from the sampled hull (for a faint body fill). */
export function binsSilhouette(s: SampledShape, r: number): string {
	const pts: string[] = [];
	for (let a = 0; a < 360; a += 4) {
		const { dx, dy } = boundaryFromBins(s, a, r);
		pts.push(`${dx.toFixed(2)} ${dy.toFixed(2)}`);
	}
	return `M ${pts.join(' L ')} Z`;
}

/** dx/dy from centre to the sampled boundary at angle θ (deg), scaled to node r. */
export function boundaryFromBins(s: SampledShape, thetaDeg: number, r: number): { dx: number; dy: number } {
	const b = ((Math.round(thetaDeg) % 360) + 360) % 360;
	const rad = (s.bins[b] / s.maxR) * r;
	const t = (thetaDeg * Math.PI) / 180;
	return { dx: Math.cos(t) * rad, dy: Math.sin(t) * rad };
}

/** An open arc that follows the sampled boundary from startDeg→endDeg. */
export function binsArcPath(s: SampledShape, startDeg: number, endDeg: number, r: number): string {
	const span = ((endDeg - startDeg) % 360 + 360) % 360;
	const steps = Math.max(2, Math.ceil(span / 3));
	const pts: string[] = [];
	for (let i = 0; i <= steps; i++) {
		const { dx, dy } = boundaryFromBins(s, startDeg + (span * i) / steps, r);
		pts.push(`${dx.toFixed(2)} ${dy.toFixed(2)}`);
	}
	return `M ${pts.join(' L ')}`;
}
