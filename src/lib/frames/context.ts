import { getContext, setContext } from 'svelte';

// Shared context so any opted-in descendant can read whether its region is
// currently a pre-load frame — e.g. a chart that renders its own placeholder
// instead of the generic shimmer. The value is a getter to stay reactive.
const FRAME_KEY = Symbol.for('itemframes.state');

export function setFrameState(get: () => boolean): void {
	setContext(FRAME_KEY, get);
}

/** Read the enclosing Frame's pre-load state. Returns false outside a Frame. */
export function getFrameState(): () => boolean {
	return getContext<() => boolean>(FRAME_KEY) ?? (() => false);
}
