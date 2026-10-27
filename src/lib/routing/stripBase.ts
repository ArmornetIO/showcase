/**
 * A pathname with the app's mount prefix removed, as a route registry keys it.
 *
 * Pass SvelteKit's `base` as the first argument; this module deliberately does
 * not import `$app/paths`, so it stays testable in a plain node runner.
 *
 * THE TRAP THIS EXISTS FOR. `base` is a URL prefix in a normal client render,
 * but during a PRERENDER SvelteKit sets it to a RELATIVE string — '.', '..',
 * '../..' — so the baked HTML can be served from any mount point. That is not a
 * prefix of the pathname at all, so the obvious `pathname.slice(base.length)`
 * silently eats the leading characters of the real path: '/privacy' becomes
 * 'privacy', which matches no route. Anything keyed on the result then falls
 * through to its unknown-path default, and the page bakes as whatever that is.
 *
 * The bug is quiet in the worst way — '/' survives it, because slicing one
 * character off '/' leaves '' and the empty-string fallback puts it back. So
 * the front page works and every other prerendered route does not.
 *
 * Stripping only when the pathname genuinely starts with `base` is correct in
 * both worlds and needs no knowledge of which one it is in.
 */
export function stripBase(base: string, pathname: string): string {
	const stripped = base && pathname.startsWith(base) ? pathname.slice(base.length) : pathname;
	return stripped || '/';
}
