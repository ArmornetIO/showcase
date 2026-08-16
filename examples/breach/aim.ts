// ── Aiming, in screen space ──────────────────────────────────────────────────
// View-layer on purpose: this is the only code in the example that asks the
// browser where something was drawn, and the engine must never have to.

/**
 * What a dragged card is over. Deliberately forgiving: an SVG `<g>` only
 * hit-tests on the pixels it actually paints, so aiming at the middle of a
 * building lands in the gap between its roof and its caption and hits nothing at
 * all. The exact hit is tried first; otherwise the nearest LEGAL building within
 * reach wins — a card is thrown at a place, not threaded onto a stroke.
 *
 * `reach` scales with the drawn size, so a building the camera has flown into
 * does not have the same snap radius as one at the limb.
 */
export function nodeUnder(x: number, y: number, legal: string[]): string | null {
	const exact = document.elementFromPoint(x, y)?.closest('[data-node]');
	const id = exact?.getAttribute('data-node');
	if (id && legal.includes(id)) return id;

	let best: string | null = null;
	let bestDistance = Infinity;
	for (const el of document.querySelectorAll('[data-node]')) {
		const nodeId = el.getAttribute('data-node');
		if (!nodeId || !legal.includes(nodeId)) continue;
		const box = el.getBoundingClientRect();
		if (box.width === 0 && box.height === 0) continue;
		const distance = Math.hypot(
			box.left + box.width / 2 - x,
			box.top + box.height / 2 - y
		);
		const reach = Math.max(52, Math.max(box.width, box.height) * 0.7);
		if (distance < reach && distance < bestDistance) {
			bestDistance = distance;
			best = nodeId;
		}
	}
	return best;
}

/** The id the in-flight card carries, so the probe can hide it before measuring
 *  — the card is under the cursor and would otherwise always be the hit. */
export const DRAG_GHOST_ID = 'breach-drag-ghost';
