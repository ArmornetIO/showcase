// ── svg-export — lift a live SVG off the page as a standalone file ───────────
//
// Showcase tooling, not product code: it exists so a mark you have just tuned
// with the on-page controls can leave the browser in exactly the state you are
// looking at. Nothing here is armornet-specific.
//
// Two things make the difference between "an SVG" and one that actually opens
// elsewhere:
//  · `xmlns` — a DOM-inlined <svg> does not need it, a FILE does. Without it
//    the download is a broken document in every viewer.
//  · Svelte's scoping classes (`svelte-1abc2de`) refer to a <style> block that
//    is NOT coming with us, so they are stripped rather than shipped dead.
//
// It deliberately does not touch paint: no background is added, so whatever the
// component left transparent stays transparent.

/** Serialize a live SVG element into a standalone, self-contained document. */
export function serializeSvg(svg: SVGSVGElement): string {
	const clone = svg.cloneNode(true) as SVGSVGElement;
	clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
	clone.removeAttribute('class');
	for (const el of clone.querySelectorAll('[class]')) el.removeAttribute('class');
	// Components that take an optional `style` prop leave `style=""` behind.
	if (clone.getAttribute('style') === '') clone.removeAttribute('style');
	return `<?xml version="1.0" encoding="UTF-8"?>\n${new XMLSerializer().serializeToString(clone)}`;
}

/** Serialize a live SVG element and hand it to the browser as a download. */
export function downloadSvg(svg: SVGSVGElement, filename: string): void {
	const blob = new Blob([serializeSvg(svg)], { type: 'image/svg+xml;charset=utf-8' });
	save(URL.createObjectURL(blob), ensureExt(filename, 'svg'));
}

/**
 * The pixel box a raster export lands in: the viewBox's own aspect at the
 * on-screen scale, times `scale`.
 *
 * NOT the element's width×height. A square element holding a 200×220 viewBox
 * letterboxes under preserveAspectRatio, so exporting the element box bakes
 * dead transparent margin into the file and makes the art harder to place in a
 * deck. Sizing off the viewBox keeps the mark at the same visual scale with the
 * padding dropped.
 */
export function rasterSize(svg: SVGSVGElement, scale = 4) {
	const vb = svg.viewBox.baseVal;
	const shown = svg.width.baseVal.value || vb.width;
	const perUnit = (shown / Math.max(vb.width, vb.height)) * scale;
	return { w: Math.round(vb.width * perUnit), h: Math.round(vb.height * perUnit) };
}

/**
 * Rasterize a live SVG element to a transparent PNG and download it.
 *
 * For the tools that cannot take an SVG at all — Google Slides being the one
 * that matters — and it moonlights as the safe path for effects: filters get
 * BAKED here by the browser's own renderer, so emboss and glow survive even
 * where an SVG import would drop them.
 *
 * The SVG goes in as a data: URL, which keeps the canvas untainted (a
 * cross-origin image source would make `toBlob` throw a security error). Safe
 * only because the mark is self-contained — no external fonts or images.
 */
export async function downloadPng(svg: SVGSVGElement, filename: string, scale = 4): Promise<void> {
	const { w, h } = rasterSize(svg, scale);
	const clone = svg.cloneNode(true) as SVGSVGElement;
	clone.setAttribute('width', String(w));
	clone.setAttribute('height', String(h));

	const img = new Image();
	img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(serializeSvg(clone))}`;
	await img.decode();

	const canvas = document.createElement('canvas');
	canvas.width = w;
	canvas.height = h;
	// Left unfilled on purpose — an unpainted canvas is transparent, which is the
	// whole point of the export.
	canvas.getContext('2d')!.drawImage(img, 0, 0, w, h);

	const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/png'));
	if (blob) save(URL.createObjectURL(blob), ensureExt(filename, 'png'));
}

function ensureExt(name: string, ext: string) {
	return name.endsWith(`.${ext}`) ? name : `${name.replace(/\.(svg|png)$/, '')}.${ext}`;
}

function save(href: string, filename: string) {
	const a = document.createElement('a');
	a.href = href;
	a.download = filename;
	a.click();
	URL.revokeObjectURL(href);
}
