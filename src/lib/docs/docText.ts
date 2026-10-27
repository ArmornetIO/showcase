// Text helpers the document layouts share.
//
// Both were duplicated across the five blog layout mockups, with the date
// formatter differing in one option between copies — which is the usual shape of
// this bug: not a wrong implementation, several slightly different right ones.

/**
 * Formats an ISO `YYYY-MM-DD` date for display.
 *
 * The `T00:00:00Z` suffix is load-bearing. A bare `YYYY-MM-DD` is parsed as UTC
 * midnight but printed in the reader's zone, so anyone west of Greenwich sees the
 * previous day — a post published on the 4th dated the 3rd.
 */
export function fmtDate(iso: string, month: 'short' | 'long' = 'short'): string {
	if (!iso) return '';
	const d = new Date(`${iso}T00:00:00Z`);
	if (Number.isNaN(d.getTime())) return iso;
	return d.toLocaleDateString('en-US', { year: 'numeric', month, day: 'numeric', timeZone: 'UTC' });
}

/** One `YYYY-MM` bucket of items, newest first. */
export interface MonthGroup<T> {
	/** `YYYY-MM`, for keying. */
	key: string;
	/** Display label, e.g. "June 2026". */
	label: string;
	items: T[];
}

/**
 * Buckets dated items by month, newest first, preserving input order within a
 * month.
 *
 * Undated items are dropped rather than bucketed under "unknown": a listing
 * grouped by month has nowhere to put them, and inventing a heading for them
 * gives an unfinished draft a place in the archive.
 */
export function groupByMonth<T>(items: T[], dateOf: (item: T) => string | undefined): MonthGroup<T>[] {
	const buckets = new Map<string, T[]>();
	for (const item of items) {
		const iso = dateOf(item);
		if (!iso) continue;
		const key = iso.slice(0, 7);
		const bucket = buckets.get(key);
		if (bucket) bucket.push(item);
		else buckets.set(key, [item]);
	}
	return [...buckets.entries()]
		.sort((a, b) => (a[0] < b[0] ? 1 : -1))
		.map(([key, items]) => ({
			key,
			label: new Date(`${key}-01T00:00:00Z`).toLocaleDateString('en-US', {
				year: 'numeric',
				month: 'long',
				timeZone: 'UTC'
			}),
			items
		}));
}

/**
 * Splits text on backticks into plain and code runs.
 *
 * For prose that arrives as a plain string rather than rendered HTML — a
 * changelog bullet, a step summary. Returning runs rather than an HTML string is
 * deliberate: the caller renders `<code>` as real markup, so nothing needs
 * `{@html}` and no escaping decision has to be got right.
 */
export function ticks(text: string): { code: boolean; text: string }[] {
	return text
		.split('`')
		.map((part, i) => ({ code: i % 2 === 1, text: part }))
		.filter((run) => run.text !== '');
}
