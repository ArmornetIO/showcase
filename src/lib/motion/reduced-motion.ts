/**
 * Does the user want motion kept to a minimum?
 *
 * Shared by every transition in `motion/` so the honouring of this preference
 * can never drift between them — each one collapses to a 0ms cut, which keeps
 * the state change (the thing appears / disappears) while dropping the travel.
 */
export function prefersReducedMotion(): boolean {
	return (
		typeof window !== 'undefined' &&
		typeof window.matchMedia === 'function' &&
		window.matchMedia('(prefers-reduced-motion: reduce)').matches
	);
}
