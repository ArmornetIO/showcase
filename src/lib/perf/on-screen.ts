// ── perf/on-screen — stop drawing what nobody is looking at ──────────────────
// A render loop that keeps running while its canvas is scrolled off the page is
// not a small waste. Measured on the marketing page: a mesh scene 6,500px below
// the fold was turning its globe and redrawing FIVE WebGL layers at ~68fps into
// a viewport it was nowhere near, rebuilding shell, wall and cap geometry every
// frame to do it. The symptom was not a slow game panel — the panel is offscreen
// and nobody can see it — it was a stutter in the hero's globe at the top of the
// page, because the garbage and the GPU work land on one main thread.
//
// `requestAnimationFrame` does not save you here. It stops for a hidden TAB, not
// for a scrolled-past element, and a marketing page is one long scroll.
//
// The rule was already being written by hand, once per scene (`PipelineScene`,
// `ShowcaseScene`), and the bug above is what happens the third time somebody
// forgets. This is that observer, with the two defaults that make it safe to
// wire into a shared component:
//
//  · It starts VISIBLE and only ever narrows. A gate that guesses "hidden" and
//    is wrong renders nothing at all, which is a far worse failure than a loop
//    that runs one scene too long.
//  · No `IntersectionObserver` means always visible, for the same reason.

/**
 * Call `set` whenever `el` enters or leaves the viewport. Returns a disposer,
 * so it drops straight into an `$effect`.
 *
 * `rootMargin` is deliberately generous: a scene that starts its loop only once
 * a pixel of it has appeared shows its first frame after the viewer is already
 * looking at it. Half a screen of warning is the difference between arriving at
 * a moving scene and watching one start.
 */
export function watchOnScreen(
	el: Element,
	set: (visible: boolean) => void,
	rootMargin = '50%',
): () => void {
	if (typeof IntersectionObserver === 'undefined') {
		set(true);
		return () => {};
	}
	// A threshold of 0 fires on any overlap at all — the question here is "is any
	// of this on screen", never "how much of it".
	const io = new IntersectionObserver(([e]) => set(e.isIntersecting), { rootMargin, threshold: 0 });
	io.observe(el);
	return () => io.disconnect();
}
