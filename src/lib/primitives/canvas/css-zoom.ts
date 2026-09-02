/**
 * The factor between VISUAL px and LAYOUT px for an element.
 *
 * `getBoundingClientRect()` and a pointer event's `clientX/Y` answer in the
 * viewport's visual space. Everything else a canvas works in — an SVG's own
 * units, an absolutely positioned overlay, `ResizeObserver.contentRect`, a
 * stored pan offset — is layout space. Those two are the same number until
 * something up the tree sets `zoom`, and then they differ by exactly this
 * factor, silently, in the one direction nobody checks.
 *
 * `zoom` is used deliberately (BreachHud shrinks the whole game board with one,
 * because `transform: scale()` leaves layout alone and desyncs the two spaces
 * far worse), so any rect-derived offset that is going to be drawn or stored
 * has to be divided by this on the way in.
 *
 * `currentCSSZoom` is the direct answer and is the accumulated zoom of the whole
 * ancestor chain, which is what we want. Where it is missing the ratio of the
 * element's own rect to its layout box says the same thing — measured off
 * `offsetWidth` for HTML, and computed style for anything (SVG) without one.
 */
export function cssZoom(el: Element | null | undefined): number {
	if (!el) return 1;

	const direct = (el as Element & { currentCSSZoom?: number }).currentCSSZoom;
	if (typeof direct === 'number' && direct > 0) return direct;

	const rect = el.getBoundingClientRect();
	if (rect.width === 0) return 1;

	const layoutW = (el as HTMLElement).offsetWidth || parseFloat(getComputedStyle(el).width);
	return layoutW > 0 ? rect.width / layoutW : 1;
}
