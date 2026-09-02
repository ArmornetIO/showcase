/**
 * Dependency-free fuzzy scorer — the one ranking used by every search box in
 * the library: the command palette, the builder's component palette, the
 * builder's layer list.
 *
 * It lives here rather than in `app-ui` because ranking IS the search: two
 * surfaces that filter the same way but rank differently feel like two
 * different products, and the substring filters these boxes used to run put
 * "Chart" below "Donut Chart" for the query "chart" and dropped "dnt" entirely.
 * `app-ui/src/lib/utils/fuzzy.ts` re-exports this so the app and the library
 * cannot drift apart.
 *
 * Higher score = better match; a negative score means "no match".
 *
 * Tiers (so ranking reads sensibly across entities):
 *   prefix match      → best, shorter text wins
 *   substring match   → next, earlier + shorter wins
 *   subsequence match → last, fewer gaps wins
 */
export function fuzzyScore(query: string, text: string): number {
	const q = query.trim().toLowerCase();
	if (!q) return 0;
	const t = text.toLowerCase();
	if (!t) return -1;

	const idx = t.indexOf(q);
	if (idx === 0) return 1000 - t.length * 0.5; // prefix
	if (idx > 0) return 700 - idx - t.length * 0.2; // substring

	// Subsequence: every query char appears in order.
	let ti = 0;
	let gaps = 0;
	let last = -1;
	for (let qi = 0; qi < q.length; qi++) {
		const c = q[qi];
		let found = -1;
		for (; ti < t.length; ti++) {
			if (t[ti] === c) {
				found = ti;
				ti++;
				break;
			}
		}
		if (found === -1) return -1;
		if (last >= 0) gaps += found - last - 1;
		last = found;
	}
	return 300 - gaps - t.length * 0.1;
}

/**
 * Best score for a record across a weighted set of fields. `fields` is
 * [text, weight] — weight is subtracted so a title (weight 0) outranks a
 * subtitle/keyword hit of equal quality.
 */
export function scoreFields(query: string, fields: [string | undefined, number][]): number {
	let best = -1;
	for (const [text, weight] of fields) {
		if (!text) continue;
		const s = fuzzyScore(query, text);
		if (s < 0) continue;
		const adjusted = s - weight;
		if (adjusted > best) best = adjusted;
	}
	return best;
}

/**
 * Rank-and-filter in one pass: drops non-matches, orders the rest best-first,
 * and leaves the input order alone for an empty query (the caller's own
 * ordering — z-order, category, registry order — is the right answer when
 * there is nothing to rank by).
 */
export function fuzzyRank<T>(
	query: string,
	items: readonly T[],
	fields: (item: T) => [string | undefined, number][]
): T[] {
	if (!query.trim()) return [...items];
	const scored: { item: T; score: number }[] = [];
	for (const item of items) {
		const score = scoreFields(query, fields(item));
		if (score >= 0) scored.push({ item, score });
	}
	scored.sort((a, b) => b.score - a.score);
	return scored.map((s) => s.item);
}
