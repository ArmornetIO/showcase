import { BREAKPOINTS, type BreakpointKey } from './breakpoints.js';

export function useBreakpoint(key: BreakpointKey) {
	const query = `(max-width: ${BREAKPOINTS[key] - 1}px)`;

	// Seed from the real match so the very first render is correct. Defaulting to
	// false and only correcting inside the effect flips the value one frame after
	// mount, which makes layout that keys off the breakpoint (e.g. a drawer's
	// slide-in axis) jump on narrow viewports.
	let matches = $state(typeof window !== 'undefined' ? window.matchMedia(query).matches : false);

	$effect(() => {
		const mq = window.matchMedia(query);
		matches = mq.matches;
		const handler = (e: MediaQueryListEvent) => (matches = e.matches);
		mq.addEventListener('change', handler);
		return () => mq.removeEventListener('change', handler);
	});

	return { get matches() { return matches; } };
}
