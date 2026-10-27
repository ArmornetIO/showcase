/**
 * Calendar dates in and out of a form field.
 *
 * The value in the middle is always an ISO calendar day, `YYYY-MM-DD`. A due
 * date has no time and no zone, so holding it as a `Date` or epoch would invent
 * both — and every "off by one day" bug is that invention leaking. A zone is
 * chosen only at the output edge, by the caller who knows what the dataset means.
 *
 *   text ──parseDate(order)──▶ ISODate ──formatDate(output)──▶ dataset value
 */

export type ISODate = string;

/** Field order for all-numeric input, where `03/04` means nothing without it. */
export type DateOrder = 'mdy' | 'dmy' | 'ymd';

export interface ParseOptions {
	/** Order for numeric input. A four-digit leading year always reads as `ymd`. */
	order?: DateOrder;
	/** Month names are matched in this locale as well as English. */
	locale?: string;
	/** Anchor for relative input (`+2w`) and year-less dates. Defaults to local today. */
	today?: ISODate;
}

/** Midnight at the start of the day, or the last millisecond of it. */
export type DateBoundary = 'start' | 'end';

export type DateOutput =
	/** The ISO day itself: `2026-10-15`. */
	| { kind: 'date' }
	/** An ISO instant in UTC: the day's boundary in `zone`, e.g. `2026-10-15T04:00:00.000Z`. */
	| { kind: 'datetime'; zone?: string; boundary?: DateBoundary }
	/** Unix time of the day's boundary in `zone`. */
	| { kind: 'epoch'; unit?: 's' | 'ms'; zone?: string; boundary?: DateBoundary }
	/** Tokens `YYYY YY MMMM MMM MM M DD D dddd ddd`; `[text]` is literal. */
	| { kind: 'pattern'; pattern: string; locale?: string }
	| ((date: ISODate) => string | number);

const pad = (n: number, w = 2) => String(n).padStart(w, '0');
const toISO = (y: number, m: number, d: number) => `${pad(y, 4)}-${pad(m)}-${pad(d)}`;
const split = (d: ISODate) => d.split('-').map(Number) as [number, number, number];

/** A real calendar day, or null — `Date.UTC` would roll Feb 30 into March. */
function ymd(y: number, m: number, d: number): ISODate | null {
	const t = new Date(Date.UTC(y, m - 1, d));
	t.setUTCFullYear(y); // Date.UTC maps years 0–99 onto 1900–1999
	return t.getUTCMonth() === m - 1 && t.getUTCDate() === d ? toISO(y, m, d) : null;
}

export function todayISO(): ISODate {
	const n = new Date();
	return toISO(n.getFullYear(), n.getMonth() + 1, n.getDate());
}

export function addDays(date: ISODate, n: number): ISODate {
	const [y, m, d] = split(date);
	const t = new Date(Date.UTC(y, m - 1, d + n));
	return toISO(t.getUTCFullYear(), t.getUTCMonth() + 1, t.getUTCDate());
}

/** Jan 31 + 1 month is Feb 28, not Mar 3. */
export function addMonths(date: ISODate, n: number): ISODate {
	const [y, m, d] = split(date);
	const first = new Date(Date.UTC(y, m - 1 + n, 1));
	const ty = first.getUTCFullYear();
	const tm = first.getUTCMonth() + 1;
	const last = new Date(Date.UTC(ty, tm, 0)).getUTCDate();
	return toISO(ty, tm, Math.min(d, last));
}

/** The numeric order a locale writes dates in, read from Intl rather than a table. */
export function orderForLocale(locale?: string): DateOrder {
	const parts = new Intl.DateTimeFormat(locale, { year: 'numeric', month: 'numeric', day: 'numeric' })
		.formatToParts(new Date(Date.UTC(2000, 10, 22, 12)))
		.map((p) => p.type[0])
		.filter((c) => c === 'y' || c === 'm' || c === 'd')
		.join('');
	return parts === 'dmy' || parts === 'ymd' ? parts : 'mdy';
}

/** The display pattern matching an order, so committed text reads back the way it was typed. */
export function patternForOrder(order: DateOrder): string {
	return { mdy: 'MM/DD/YYYY', dmy: 'DD/MM/YYYY', ymd: 'YYYY-MM-DD' }[order];
}

function monthNames(locale: string | undefined, style: 'long' | 'short'): string[] {
	const f = new Intl.DateTimeFormat(locale, { month: style, timeZone: 'UTC' });
	return Array.from({ length: 12 }, (_, i) => f.format(Date.UTC(2000, i, 15)));
}

const nameCache = new Map<string, string[][]>();
function monthMatchers(locale?: string): string[][] {
	const key = locale ?? '';
	let hit = nameCache.get(key);
	if (!hit) {
		const sets = [monthNames('en', 'long'), ...(locale ? [monthNames(locale, 'long')] : [])];
		hit = Array.from({ length: 12 }, (_, i) => sets.map((s) => s[i].toLowerCase().replace(/\.$/, '')));
		nameCache.set(key, hit);
	}
	return hit;
}

/** 1–12 for a month name or a 3+ letter prefix of one, else 0. */
function monthFromName(token: string, locale?: string): number {
	const t = token.toLowerCase().replace(/\.$/, '');
	if (t.length < 3) return 0;
	return monthMatchers(locale).findIndex((names) => names.some((n) => n.startsWith(t))) + 1;
}

// ponytail: fixed 2000 pivot for two-digit years; a sliding window when birthdays land here.
const fullYear = (s: string) => (s.length <= 2 ? 2000 + Number(s) : Number(s));

/**
 * Read whatever the user typed. Null means "could not read it", never a guess:
 * the field shows the parse back to the user, so refusing beats misreading.
 */
export function parseDate(raw: string, opts: ParseOptions = {}): ISODate | null {
	const t = raw.trim().toLowerCase();
	if (!t) return null;
	const today = opts.today ?? todayISO();
	const order = opts.order ?? orderForLocale(opts.locale);

	if (t === 'today') return today;
	if (t === 'tomorrow') return addDays(today, 1);
	if (t === 'yesterday') return addDays(today, -1);

	let m = t.match(/^([+-])\s*(\d+)\s*([dwmy]?)$/);
	if (m) {
		const n = (m[1] === '-' ? -1 : 1) * Number(m[2]);
		if (m[3] === 'm') return addMonths(today, n);
		if (m[3] === 'y') return addMonths(today, n * 12);
		return addDays(today, m[3] === 'w' ? n * 7 : n);
	}

	m = t.match(/^(\d{1,4})[/.\-\s](\d{1,2})(?:[/.\-\s](\d{1,4}))?$/);
	if (m) {
		const [, a, b, c] = m;
		const thisYear = split(today)[0];
		if (a.length > 2) return c ? ymd(Number(a), Number(b), Number(c)) : null;
		if (!c) {
			// Year-less: only month and day remain, and ymd puts month first.
			return order === 'dmy' ? ymd(thisYear, Number(b), Number(a)) : ymd(thisYear, Number(a), Number(b));
		}
		if (order === 'dmy') return ymd(fullYear(c), Number(b), Number(a));
		if (order === 'ymd') return ymd(fullYear(a), Number(b), Number(c));
		return ymd(fullYear(c), Number(a), Number(b));
	}

	// A named month is unambiguous, so order no longer matters.
	const words = t.replace(/,/g, ' ').split(/\s+/);
	const nameAt = words.findIndex((w) => /^\p{L}/u.test(w));
	if (nameAt === -1 || words.length < 2 || words.length > 3) return null;
	const month = monthFromName(words[nameAt], opts.locale);
	const nums = words.filter((_, i) => i !== nameAt);
	if (!month || !nums.every((w) => /^\d+$/.test(w))) return null;
	// `oct 15 2026`, `15 oct 2026`, `2026 oct 15`: the 3–4 digit number is the year.
	const yearIdx = nums.findIndex((w) => w.length >= 3);
	const day = nums.find((_, i) => i !== yearIdx);
	if (!day || (nums.length === 2 && yearIdx === -1)) return null;
	return ymd(yearIdx === -1 ? split(today)[0] : Number(nums[yearIdx]), month, Number(day));
}

/** The UTC instant at which `date` starts (or ends) on the wall clocks of `zone`. */
export function zonedInstant(date: ISODate, zone = 'UTC', boundary: DateBoundary = 'start'): number {
	const [y, m, d] = split(date);
	const wall = Date.UTC(y, m - 1, d) + (boundary === 'end' ? 86_400_000 - 1 : 0);
	const fmt = new Intl.DateTimeFormat('en-US', {
		timeZone: zone,
		hourCycle: 'h23',
		year: 'numeric',
		month: 'numeric',
		day: 'numeric',
		hour: 'numeric',
		minute: 'numeric',
		second: 'numeric'
	});
	const offset = (t: number) => {
		const p = Object.fromEntries(fmt.formatToParts(t).map((x) => [x.type, Number(x.value)]));
		return Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second) - (t - (((t % 1000) + 1000) % 1000));
	};
	// Second pass: the first guess can sit across a DST change from the answer.
	// ponytail: a day whose midnight is skipped by DST resolves to the hour after.
	const first = wall - offset(wall);
	return wall - offset(first);
}

const TOKENS = /\[[^\]]*]|YYYY|YY|MMMM|MMM|MM|M|DD|D|dddd|ddd/g;

function applyPattern(date: ISODate, pattern: string, locale = 'en-US'): string {
	const [y, m, d] = split(date);
	const at = Date.UTC(y, m - 1, d);
	const name = (o: Intl.DateTimeFormatOptions) =>
		new Intl.DateTimeFormat(locale, { ...o, timeZone: 'UTC' }).format(at);
	return pattern.replace(TOKENS, (tok) => {
		switch (tok) {
			case 'YYYY': return pad(y, 4);
			case 'YY': return pad(y % 100);
			case 'MMMM': return name({ month: 'long' });
			case 'MMM': return name({ month: 'short' });
			case 'MM': return pad(m);
			case 'M': return String(m);
			case 'DD': return pad(d);
			case 'D': return String(d);
			case 'dddd': return name({ weekday: 'long' });
			case 'ddd': return name({ weekday: 'short' });
			default: return tok.slice(1, -1);
		}
	});
}

/** Render the day in whatever shape the destination needs. */
export function formatDate(date: ISODate, output: DateOutput): string | number {
	if (typeof output === 'function') return output(date);
	switch (output.kind) {
		case 'date':
			return date;
		case 'datetime':
			return new Date(zonedInstant(date, output.zone, output.boundary)).toISOString();
		case 'epoch': {
			const ms = zonedInstant(date, output.zone, output.boundary);
			return output.unit === 'ms' ? ms : Math.floor(ms / 1000);
		}
		case 'pattern':
			return applyPattern(date, output.pattern, output.locale);
	}
}
