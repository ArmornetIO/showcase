/**
 * Previewing a corner-radius change is not a matter of setting one variable:
 * components own their radius through `rounded-*` classes and local
 * `border-radius` rules, so nothing upstream can move them.
 *
 * Blanket-forcing every descendant would work and would also square off every
 * avatar, status dot and pill in the preview — the shapes that are round on
 * purpose. So we select: an element participates only if it ALREADY has a
 * finite, non-pill radius. Fully round (50%) and pill (very large px) shapes
 * are left alone, as are square-cornered elements, which had no radius to
 * restyle in the first place.
 */

/** Radii at or above this are pills/circles, not corners. */
const PILL_THRESHOLD_PX = 100;

/** Attribute recording the element's original radius, so it can be restored. */
const ORIGINAL = 'data-ts-radius-original';

/** Should this computed `border-radius` follow the studio's radius control? */
export function isAdjustableRadius(computed: string): boolean {
	const v = computed.trim();
	if (!v || v === '0px') return false;
	if (v.includes('%')) return false;
	// Take the first component; `10px 10px 0 0` is still corner styling.
	const first = parseFloat(v);
	if (!Number.isFinite(first) || first <= 0) return false;
	return first < PILL_THRESHOLD_PX;
}

/**
 * Apply `radius` px to every element under `root` whose own radius is
 * adjustable. Pass `null` to restore what was there before.
 */
export function applyPreviewRadius(root: HTMLElement, radius: number | null): void {
	const elements = root.querySelectorAll<HTMLElement>('*');

	for (const el of elements) {
		if (radius === null) {
			const original = el.getAttribute(ORIGINAL);
			if (original !== null) {
				el.style.borderRadius = original;
				el.removeAttribute(ORIGINAL);
			}
			continue;
		}

		// Record the inline value we are about to displace, once.
		if (!el.hasAttribute(ORIGINAL)) {
			const computed = getComputedStyle(el).borderRadius;
			if (!isAdjustableRadius(computed)) continue;
			el.setAttribute(ORIGINAL, el.style.borderRadius);
		}

		el.style.borderRadius = `${radius}px`;
	}
}
