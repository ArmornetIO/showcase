/**
 * The absolute URL of a page, for `<link rel="canonical">` and `og:url`.
 *
 * Returns '' when no origin is given, and the caller should then omit the tag
 * entirely rather than emit a relative one. That is deliberate: a canonical tag
 * exists to tell a crawler that several URLs are one page, so building it from
 * whichever hostname the request happened to arrive on is worse than having
 * none — it makes every alias canonical for itself, which is the
 * duplicate-content problem the tag was added to solve.
 *
 * The query string is dropped. A canonical that carries `?utm_source=...`
 * splits one page into as many indexed URLs as there are campaigns. A site with
 * a genuinely query-discriminated public page should not use this.
 */
export function canonicalURL(origin: string, pathname: string): string {
	if (!origin) return '';
	const base = origin.replace(/\/$/, '');
	const path = pathname.split('?')[0];
	return base + (path === '/' ? '/' : path.replace(/\/$/, ''));
}
